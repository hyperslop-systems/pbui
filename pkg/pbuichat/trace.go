package pbuichat

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	sessionstream "github.com/go-go-golems/sessionstream/pkg/sessionstream"
	chatv1 "github.com/hyperslop-systems/pbui/gen/go/hyperslop/pbui/chat/v1"
	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// Wire names for the verb trace.
const (
	CommandVerbPerformed   = "PbuiVerbPerformed"
	CommandEffectPerformed = "PbuiEffectPerformed"
	EventVerbRecorded      = "PbuiVerbRecorded"
	UIEventTraceEntry      = "PbuiTraceEntryUpsert"
	TimelineEntityTrace    = "PbuiTraceEntry"
	TraceEntryIDPrefix     = "trace-"
	traceOutcomePerformed  = "performed"
)

// traceStore keeps the recent trace per session in memory so the pbui_trace
// tool can answer without a store round trip. The hydration store holds the
// durable copy through the timeline projection.
type traceStore struct {
	mu       sync.Mutex
	keep     int
	seq      map[sessionstream.SessionId]uint64
	entries  map[sessionstream.SessionId][]*chatv1.TraceEntry
	effects  map[sessionstream.SessionId]map[string]*chatv1.TraceEntry
	hydrated map[sessionstream.SessionId]bool
}

func newTraceStore(keep int) *traceStore {
	if keep <= 0 {
		keep = DefaultLimits.TraceKeep
	}
	return &traceStore{
		keep:     keep,
		seq:      map[sessionstream.SessionId]uint64{},
		entries:  map[sessionstream.SessionId][]*chatv1.TraceEntry{},
		effects:  map[sessionstream.SessionId]map[string]*chatv1.TraceEntry{},
		hydrated: map[sessionstream.SessionId]bool{},
	}
}

func (s *traceStore) next(sid sessionstream.SessionId) uint64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.seq[sid]++
	return s.seq[sid]
}

// hydrate merges persisted entries into the in-memory trace and raises the
// allocator before a new sequence can be issued.
func (s *traceStore) hydrate(sid sessionstream.SessionId, persisted []*chatv1.TraceEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()
	bySeq := make(map[uint64]*chatv1.TraceEntry, len(s.entries[sid])+len(persisted))
	for _, entry := range append(s.entries[sid], persisted...) {
		if entry == nil {
			continue
		}
		seq := entry.GetSeq()
		bySeq[seq] = proto.Clone(entry).(*chatv1.TraceEntry)
		if s.seq[sid] < seq {
			s.seq[sid] = seq
		}
	}
	list := make([]*chatv1.TraceEntry, 0, len(bySeq))
	for _, entry := range bySeq {
		list = append(list, entry)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].GetSeq() < list[j].GetSeq() })
	if len(list) > s.keep {
		list = list[len(list)-s.keep:]
	}
	s.entries[sid] = list
	effects := make(map[string]*chatv1.TraceEntry)
	for _, entry := range list {
		if id := entry.GetEffect().GetEffectId(); id != "" {
			effects[id] = entry
		}
	}
	s.effects[sid] = effects
	s.hydrated[sid] = true
}

func (s *traceStore) isHydrated(sid sessionstream.SessionId) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.hydrated[sid]
}

func (s *traceStore) add(sid sessionstream.SessionId, entry *chatv1.TraceEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := append(s.entries[sid], entry)
	if len(list) > s.keep {
		dropped := list[:len(list)-s.keep]
		for _, old := range dropped {
			delete(s.effects[sid], old.GetEffect().GetEffectId())
		}
		list = list[len(list)-s.keep:]
	}
	s.entries[sid] = list
}

func (s *traceStore) addEffect(sid sessionstream.SessionId, effect *chatv1.EffectEnvelope, at time.Time) (*chatv1.TraceEntry, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.effects[sid] == nil {
		s.effects[sid] = map[string]*chatv1.TraceEntry{}
	}
	if existing := s.effects[sid][effect.GetEffectId()]; existing != nil {
		if !proto.Equal(existing.GetEffect(), effect) {
			return nil, false, fmt.Errorf("effect id %q was reused with a different envelope", effect.GetEffectId())
		}
		return proto.Clone(existing).(*chatv1.TraceEntry), false, nil
	}
	s.seq[sid]++
	verb, err := structpb.NewStruct(map[string]any{"kind": effect.GetEffectKind()})
	if err != nil {
		return nil, false, err
	}
	entry := &chatv1.TraceEntry{
		Seq:     s.seq[sid],
		Actor:   effect.GetActor(),
		Verb:    verb,
		Outcome: effect.GetOutcome(),
		At:      timestamppb.New(at.UTC()),
		Effect:  proto.Clone(effect).(*chatv1.EffectEnvelope),
	}
	list := append(s.entries[sid], entry)
	if len(list) > s.keep {
		dropped := list[:len(list)-s.keep]
		for _, old := range dropped {
			delete(s.effects[sid], old.GetEffect().GetEffectId())
		}
		list = list[len(list)-s.keep:]
	}
	s.entries[sid] = list
	s.effects[sid][effect.GetEffectId()] = entry
	return proto.Clone(entry).(*chatv1.TraceEntry), true, nil
}

func (s *traceStore) list(sid sessionstream.SessionId, sinceSeq uint64, limit int) []*chatv1.TraceEntry {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []*chatv1.TraceEntry
	for _, e := range s.entries[sid] {
		if e.GetSeq() > sinceSeq {
			out = append(out, proto.Clone(e).(*chatv1.TraceEntry))
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].GetSeq() < out[j].GetSeq() })
	if limit > 0 && len(out) > limit {
		out = out[len(out)-limit:]
	}
	return out
}

// HandleVerbPerformed is the command handler for PbuiVerbPerformed. It
// assigns the sequence number, validates the verb against the vocabulary
// (recording an invalid verb with a rejected outcome rather than dropping it:
// the trace must reflect what the UI did), and publishes PbuiVerbRecorded.
func (p *Plugin) HandleVerbPerformed(ctx context.Context, cmd sessionstream.Command, _ *sessionstream.Session, pub sessionstream.EventPublisher) error {
	if err := p.HydrateTrace(ctx, cmd.SessionId); err != nil {
		return errors.Wrap(err, "hydrate trace")
	}
	payload, ok := cmd.Payload.(*chatv1.VerbPerformedCommand)
	if !ok || payload == nil {
		return fmt.Errorf("%s payload must be %T, got %T", CommandVerbPerformed, &chatv1.VerbPerformedCommand{}, cmd.Payload)
	}
	outcome := payload.GetOutcome()
	if outcome == "" {
		outcome = traceOutcomePerformed
	}
	if p.vocab != nil && payload.GetVerb() != nil {
		if err := p.vocab.ValidateVerb(payload.GetVerb().AsMap()); err != nil && outcome == traceOutcomePerformed {
			outcome = "rejected:" + err.Error()
		}
	}
	seq := p.trace.next(cmd.SessionId)
	entry := &chatv1.TraceEntry{
		Seq:           seq,
		Actor:         payload.GetActor(),
		Verb:          payload.GetVerb(),
		Target:        payload.GetTarget(),
		Outcome:       outcome,
		At:            timestamppb.New(time.Now().UTC()),
		ClientSeq:     payload.GetClientSeq(),
		EffectId:      payload.GetEffectId(),
		InvocationKey: payload.GetInvocationKey(),
		ApprovalId:    payload.GetApprovalId(),
	}
	p.trace.add(cmd.SessionId, entry)
	return pub.Publish(ctx, sessionstream.Event{Name: EventVerbRecorded, SessionId: cmd.SessionId, Payload: entry})
}

// HandleEffectPerformed records one canonical gateway outcome idempotently.
func (p *Plugin) HandleEffectPerformed(ctx context.Context, cmd sessionstream.Command, _ *sessionstream.Session, pub sessionstream.EventPublisher) error {
	if err := p.HydrateTrace(ctx, cmd.SessionId); err != nil {
		return errors.Wrap(err, "hydrate trace")
	}
	payload, ok := cmd.Payload.(*chatv1.EffectPerformedCommand)
	if !ok || payload == nil || payload.GetEffect() == nil {
		return fmt.Errorf("%s payload must contain an effect", CommandEffectPerformed)
	}
	effect := payload.GetEffect()
	if effect.GetConversationId() != string(cmd.SessionId) {
		return fmt.Errorf("effect conversation %q does not match session %q", effect.GetConversationId(), cmd.SessionId)
	}
	entry, created, err := p.trace.addEffect(cmd.SessionId, effect, time.Now().UTC())
	if err != nil {
		return err
	}
	if !created {
		return nil
	}
	return pub.Publish(ctx, sessionstream.Event{Name: EventVerbRecorded, SessionId: cmd.SessionId, Payload: entry})
}

// Install registers the trace commands on the hub. Call it once per hub.
func (p *Plugin) Install(hub *sessionstream.Hub) error {
	if hub == nil {
		return errors.New("hub is nil")
	}
	if err := hub.RegisterCommand(CommandVerbPerformed, p.HandleVerbPerformed); err != nil {
		return err
	}
	return hub.RegisterCommand(CommandEffectPerformed, p.HandleEffectPerformed)
}

// Trace returns recent entries for a session (what pbui_trace reads).
func (p *Plugin) Trace(sid sessionstream.SessionId, sinceSeq uint64, limit int) []*chatv1.TraceEntry {
	return p.trace.list(sid, sinceSeq, limit)
}

// RecordAgentVerb records a verb the server performed on the agent's behalf
// (for example a workbench mutation a tool applied) without a browser round
// trip.
func (p *Plugin) RecordAgentVerb(ctx context.Context, sid sessionstream.SessionId, pub sessionstream.EventPublisher, verb map[string]any, target *Reference, outcome string) error {
	cmd, err := buildVerbCommand(chatv1.Actor_ACTOR_AGENT, verb, target, outcome, "")
	if err != nil {
		return err
	}
	return p.HandleVerbPerformed(ctx, sessionstream.Command{Name: CommandVerbPerformed, Payload: cmd, SessionId: sid}, nil, pub)
}

func traceEntryID(seq uint64) string { return fmt.Sprintf("%s%d", TraceEntryIDPrefix, seq) }
