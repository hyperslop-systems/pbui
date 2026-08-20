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
	"google.golang.org/protobuf/types/known/timestamppb"
)

// Wire names for the verb trace.
const (
	CommandVerbPerformed  = "PbuiVerbPerformed"
	EventVerbRecorded     = "PbuiVerbRecorded"
	UIEventTraceEntry     = "PbuiTraceEntryUpsert"
	TimelineEntityTrace   = "PbuiTraceEntry"
	TraceEntryIDPrefix    = "trace-"
	traceOutcomePerformed = "performed"
)

// traceStore keeps the recent trace per session in memory so the pbui_trace
// tool can answer without a store round trip. The hydration store holds the
// durable copy through the timeline projection.
type traceStore struct {
	mu      sync.Mutex
	keep    int
	seq     map[sessionstream.SessionId]uint64
	entries map[sessionstream.SessionId][]*chatv1.TraceEntry
}

func newTraceStore(keep int) *traceStore {
	if keep <= 0 {
		keep = DefaultLimits.TraceKeep
	}
	return &traceStore{keep: keep, seq: map[sessionstream.SessionId]uint64{}, entries: map[sessionstream.SessionId][]*chatv1.TraceEntry{}}
}

func (s *traceStore) next(sid sessionstream.SessionId) uint64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.seq[sid]++
	return s.seq[sid]
}

// seed raises the counter to at least n (used when a session rehydrates).
func (s *traceStore) seed(sid sessionstream.SessionId, n uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.seq[sid] < n {
		s.seq[sid] = n
	}
}

func (s *traceStore) add(sid sessionstream.SessionId, entry *chatv1.TraceEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := append(s.entries[sid], entry)
	if len(list) > s.keep {
		list = list[len(list)-s.keep:]
	}
	s.entries[sid] = list
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
		Seq:       seq,
		Actor:     payload.GetActor(),
		Verb:      payload.GetVerb(),
		Target:    payload.GetTarget(),
		Outcome:   outcome,
		At:        timestamppb.New(time.Now().UTC()),
		ClientSeq: payload.GetClientSeq(),
	}
	p.trace.add(cmd.SessionId, entry)
	return pub.Publish(ctx, sessionstream.Event{Name: EventVerbRecorded, SessionId: cmd.SessionId, Payload: entry})
}

// Install registers the trace command on the hub. Call it once per hub.
func (p *Plugin) Install(hub *sessionstream.Hub) error {
	if hub == nil {
		return errors.New("hub is nil")
	}
	return hub.RegisterCommand(CommandVerbPerformed, p.HandleVerbPerformed)
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
