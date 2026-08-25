package pbuichat

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	gepevents "github.com/go-go-golems/geppetto/pkg/events"
	chatapp "github.com/go-go-golems/pinocchio/pkg/chatapp"
	sessionstream "github.com/go-go-golems/sessionstream/pkg/sessionstream"
	chatv1 "github.com/hyperslop-systems/pbui/gen/go/hyperslop/pbui/chat/v1"
	"github.com/pkg/errors"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// Options configure the plugin.
type Options struct {
	Vocabulary *Vocabulary
	Resolver   Resolver
	// Projection rules turn backend tool results into widgets.
	Projection []ProjectionRule
	Limits     Limits
}

// Plugin is the chatapp.ChatPlugin. It adds to the base projections and never
// replaces them: HandleRuntimeEvent always reports handled=false.
type Plugin struct {
	*Emitter
	vocab          *Vocabulary
	rules          []ProjectionRule
	trace          *traceStore
	hydrationStore sessionstream.HydrationStore
	// widgetCount numbers widgets per message for stable ids.
	widgetCount map[string]int
}

var _ chatapp.ChatPlugin = (*Plugin)(nil)

// New builds the plugin.
func New(opts Options) (*Plugin, error) {
	if opts.Vocabulary == nil {
		return nil, errors.New("pbuichat: a vocabulary is required")
	}
	if err := opts.Vocabulary.Validate(); err != nil {
		return nil, err
	}
	limits := opts.Limits
	if limits == (Limits{}) {
		limits = DefaultLimits
	}
	return &Plugin{
		Emitter:     NewEmitter(opts.Vocabulary, opts.Resolver, limits),
		vocab:       opts.Vocabulary,
		rules:       opts.Projection,
		trace:       newTraceStore(limits.TraceKeep),
		widgetCount: map[string]int{},
	}, nil
}

// Vocabulary returns the plugin's vocabulary.
func (p *Plugin) Vocabulary() *Vocabulary { return p.vocab }

// SetHydrationStore supplies the durable timeline used to restore trace state.
// It must be called during setup, before commands are handled.
func (p *Plugin) SetHydrationStore(store sessionstream.HydrationStore) {
	p.hydrationStore = store
}

// HydrateTrace restores persisted entries and seeds the sequence allocator.
func (p *Plugin) HydrateTrace(ctx context.Context, sid sessionstream.SessionId) error {
	if p.trace.isHydrated(sid) {
		return nil
	}
	if p.hydrationStore == nil {
		p.trace.hydrate(sid, nil)
		return nil
	}
	view, err := p.hydrationStore.View(ctx, sid)
	if err != nil {
		return err
	}
	persisted := make([]*chatv1.TraceEntry, 0)
	for _, entity := range view.List(TimelineEntityTrace) {
		if entry, ok := entity.Payload.(*chatv1.TraceEntry); ok && entry != nil {
			persisted = append(persisted, entry)
		}
	}
	p.trace.hydrate(sid, persisted)
	return nil
}

// RegisterSchemas registers the trace command, event, UI event and entity.
func (p *Plugin) RegisterSchemas(reg *sessionstream.SchemaRegistry) error {
	for _, err := range []error{
		reg.RegisterCommand(CommandVerbPerformed, &chatv1.VerbPerformedCommand{}),
		reg.RegisterCommand(CommandEffectPerformed, &chatv1.EffectPerformedCommand{}),
		reg.RegisterEvent(EventVerbRecorded, &chatv1.TraceEntry{}),
		reg.RegisterUIEvent(UIEventTraceEntry, &chatv1.TraceEntry{}),
		reg.RegisterTimelineEntity(TimelineEntityTrace, &chatv1.TraceEntry{}),
	} {
		if err != nil {
			return err
		}
	}
	return nil
}

// HandleRuntimeEvent reacts to geppetto events of the real runtime. It never
// claims an event, so the reasoning/tool-call/widget plugins still see it.
func (p *Plugin) HandleRuntimeEvent(ctx context.Context, runtime chatapp.RuntimeEventContext, event gepevents.Event) (bool, error) {
	publish := Publisher(runtime.Publish)
	messageID := runtime.MessageID
	switch ev := event.(type) {
	case *gepevents.EventTextSegmentFinished:
		if _, err := p.EmitRefsForText(ctx, publish, messageID, ev.Text); err != nil {
			log.Warn().Err(err).Str("message_id", messageID).Msg("pbuichat: publish refs")
		}
	case *gepevents.EventToolResultReady:
		p.projectToolResult(ctx, publish, messageID, ev)
	case *EventWidgetRequested:
		if err := p.emitRequestedWidget(ctx, publish, messageID, ev); err != nil {
			log.Warn().Err(err).Str("message_id", messageID).Msg("pbuichat: publish requested widget")
		}
	case *gepevents.EventRunFinished, *gepevents.EventRunFailed, *gepevents.EventRunStopped:
		p.ForgetMessage(messageID)
		p.mu.Lock()
		delete(p.widgetCount, messageID)
		p.mu.Unlock()
	}
	return false, nil
}

// NextWidgetID allocates the next widget id for a message.
func (p *Plugin) NextWidgetID(messageID string) string {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.widgetCount[messageID]++
	return WidgetID(messageID, p.widgetCount[messageID])
}

func (p *Plugin) emitRequestedWidget(ctx context.Context, publish Publisher, messageID string, ev *EventWidgetRequested) error {
	widgetID := ev.WidgetID
	if widgetID == "" {
		widgetID = p.NextWidgetID(messageID)
	}
	return p.EmitWidget(ctx, publish, messageID, widgetID, ev.Document)
}

func (p *Plugin) projectToolResult(ctx context.Context, publish Publisher, messageID string, ev *gepevents.EventToolResultReady) {
	for _, rule := range p.rules {
		if rule == nil || !rule.Matches(ev.ToolName) {
			continue
		}
		var result any
		if err := json.Unmarshal([]byte(ev.Result), &result); err != nil {
			// Not JSON: nothing to project.
			return
		}
		doc, ok := rule.Project(ev.ToolName, ev.ToolCallID, result)
		if !ok {
			continue
		}
		widgetID := p.NextWidgetID(messageID)
		if err := p.EmitWidget(ctx, publish, messageID, widgetID, doc); err != nil {
			log.Warn().Err(err).Str("tool", ev.ToolName).Msg("pbuichat: project tool result")
		}
		return
	}
}

// ProjectUI forwards trace events live.
func (p *Plugin) ProjectUI(_ context.Context, ev sessionstream.Event, _ *sessionstream.Session, _ sessionstream.TimelineView) ([]sessionstream.UIEvent, bool, error) {
	if ev.Name != EventVerbRecorded {
		return nil, false, nil
	}
	entry, ok := ev.Payload.(*chatv1.TraceEntry)
	if !ok || entry == nil {
		return nil, true, fmt.Errorf("unexpected %s payload %T", EventVerbRecorded, ev.Payload)
	}
	return []sessionstream.UIEvent{{Name: UIEventTraceEntry, Payload: entry}}, true, nil
}

// ProjectTimeline persists trace entries and tombstones the oldest beyond
// the keep limit.
func (p *Plugin) ProjectTimeline(_ context.Context, ev sessionstream.Event, _ *sessionstream.Session, view sessionstream.TimelineView) ([]sessionstream.TimelineEntity, bool, error) {
	if ev.Name != EventVerbRecorded {
		return nil, false, nil
	}
	entry, ok := ev.Payload.(*chatv1.TraceEntry)
	if !ok || entry == nil {
		return nil, true, fmt.Errorf("unexpected %s payload %T", EventVerbRecorded, ev.Payload)
	}
	// Command handling hydrates before allocating the sequence. Persistence
	// only needs to apply this event to the supplied view.
	_ = view
	out := []sessionstream.TimelineEntity{{Kind: TimelineEntityTrace, Id: traceEntryID(entry.GetSeq()), Payload: entry}}
	keep := p.limits.TraceKeep
	if keep > 0 && entry.GetSeq() > uint64(keep) {
		out = append(out, sessionstream.TimelineEntity{Kind: TimelineEntityTrace, Id: traceEntryID(entry.GetSeq() - uint64(keep)), Tombstone: true})
	}
	return out, true, nil
}

// ProjectionRule turns a backend tool result into a widget document.
type ProjectionRule interface {
	Matches(toolName string) bool
	Project(toolName, toolCallID string, result any) (WidgetDocument, bool)
}

// RowsToTable projects a tool result of the shape {"<key>": [ {col: val}, … ]}
// (or a bare array of objects when key is "") into a table widget.
func RowsToTable(toolName, key string) ProjectionRule {
	return rowsToTable{tool: toolName, key: key}
}

type rowsToTable struct {
	tool string
	key  string
}

func (r rowsToTable) Matches(toolName string) bool { return toolName == r.tool }

func (r rowsToTable) Project(toolName, toolCallID string, result any) (WidgetDocument, bool) {
	var rows []any
	switch v := result.(type) {
	case []any:
		rows = v
	case map[string]any:
		if r.key == "" {
			return nil, false
		}
		rows, _ = v[r.key].([]any)
	}
	if len(rows) == 0 {
		return nil, false
	}
	first, ok := rows[0].(map[string]any)
	if !ok {
		return nil, false
	}
	names := make([]string, 0, len(first))
	for k := range first {
		names = append(names, k)
	}
	sortStrings(names)
	columns := make([]TableColumn, 0, len(names))
	for _, n := range names {
		columns = append(columns, TableColumn{Name: n, Type: guessType(first[n])})
	}
	data := make([][]any, 0, len(rows))
	for _, raw := range rows {
		obj, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		row := make([]any, 0, len(names))
		for _, n := range names {
			row = append(row, obj[n])
		}
		data = append(data, row)
	}
	title := fmt.Sprintf("%s · %d rows", toolName, len(data))
	docID := strings.TrimSpace(toolCallID)
	if docID == "" {
		docID = toolName
	}
	return NewTableDocument(title, docID, columns, data, false), true
}

func guessType(v any) string {
	switch v.(type) {
	case float64, json.Number:
		return "q"
	case string:
		return "n"
	}
	return "n"
}

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j-1] > s[j]; j-- {
			s[j-1], s[j] = s[j], s[j-1]
		}
	}
}

// buildVerbCommand encodes a verb command from Go values.
func buildVerbCommand(actor chatv1.Actor, verb map[string]any, target *Reference, outcome, clientSeq string) (*chatv1.VerbPerformedCommand, error) {
	cmd := &chatv1.VerbPerformedCommand{Actor: actor, Outcome: outcome, ClientSeq: clientSeq}
	if verb != nil {
		s, err := structpb.NewStruct(verb)
		if err != nil {
			return nil, errors.Wrap(err, "encode verb")
		}
		cmd.Verb = s
	}
	if target != nil {
		t, err := target.ToProto()
		if err != nil {
			return nil, errors.Wrap(err, "encode target")
		}
		cmd.Target = t
	}
	return cmd, nil
}

// VerbCommandFromJSON decodes the browser's JSON body for POST …/verbs:
// {clientSeq, actor: "human"|"agent", verb, target?, outcome}.
func VerbCommandFromJSON(data []byte) (*chatv1.VerbPerformedCommand, error) {
	var body struct {
		ClientSeq string         `json:"clientSeq"`
		Actor     string         `json:"actor"`
		Verb      map[string]any `json:"verb"`
		Target    map[string]any `json:"target"`
		Outcome   string         `json:"outcome"`
	}
	if err := json.Unmarshal(data, &body); err != nil {
		return nil, errors.Wrap(err, "decode verb command")
	}
	if body.Verb == nil {
		return nil, errors.New("verb is required")
	}
	actor := chatv1.Actor_ACTOR_HUMAN
	if strings.EqualFold(body.Actor, "agent") {
		actor = chatv1.Actor_ACTOR_AGENT
	}
	return buildVerbCommand(actor, body.Verb, ReferenceFromMap(body.Target), body.Outcome, body.ClientSeq)
}

// EffectCommandFromJSON validates and decodes the browser effect envelope.
func EffectCommandFromJSON(data []byte) (*chatv1.EffectPerformedCommand, error) {
	var body struct {
		EffectID       string   `json:"effectId"`
		InvocationKey  string   `json:"invocationKey"`
		Actor          string   `json:"actor"`
		ConversationID string   `json:"conversationId"`
		EffectKind     string   `json:"effectKind"`
		EffectScope    string   `json:"effectScope"`
		CanonicalInput any      `json:"canonicalInput"`
		InputDigest    string   `json:"inputDigest"`
		TargetIDs      []string `json:"targetIds"`
		ReferenceKeys  []string `json:"referenceKeys"`
		ApprovalID     string   `json:"approvalId"`
		BeforeRevision string   `json:"beforeRevision"`
		AfterRevision  string   `json:"afterRevision"`
		Outcome        string   `json:"outcome"`
		OccurredAt     string   `json:"occurredAt"`
	}
	if err := json.Unmarshal(data, &body); err != nil {
		return nil, errors.Wrap(err, "decode effect command")
	}
	body.EffectID = strings.TrimSpace(body.EffectID)
	body.ConversationID = strings.TrimSpace(body.ConversationID)
	body.EffectKind = strings.TrimSpace(body.EffectKind)
	body.EffectScope = strings.TrimSpace(body.EffectScope)
	body.InputDigest = strings.ToLower(strings.TrimSpace(body.InputDigest))
	if body.EffectID == "" || body.ConversationID == "" || body.EffectKind == "" {
		return nil, errors.New("effectId, conversationId, and effectKind are required")
	}
	if body.EffectScope != "workbench" && body.EffectScope != "sandbox" && body.EffectScope != "conversation" && body.EffectScope != "server" {
		return nil, errors.New("invalid effectScope")
	}
	if body.Outcome != traceOutcomePerformed && !strings.HasPrefix(body.Outcome, "rejected:") {
		return nil, errors.New("outcome must be performed or rejected:<reason>")
	}
	digestBytes, err := hex.DecodeString(body.InputDigest)
	if err != nil || len(digestBytes) != sha256.Size {
		return nil, errors.New("inputDigest must be a SHA-256 hex digest")
	}
	canonicalJSON, err := json.Marshal(body.CanonicalInput)
	if err != nil {
		return nil, errors.Wrap(err, "encode canonicalInput")
	}
	computed := sha256.Sum256(canonicalJSON)
	if !strings.EqualFold(body.InputDigest, hex.EncodeToString(computed[:])) {
		return nil, errors.New("inputDigest does not match canonicalInput")
	}
	input, err := structpb.NewValue(body.CanonicalInput)
	if err != nil {
		return nil, errors.Wrap(err, "encode canonicalInput")
	}
	occurredAt, err := time.Parse(time.RFC3339Nano, body.OccurredAt)
	if err != nil {
		return nil, errors.Wrap(err, "parse occurredAt")
	}
	if !strings.EqualFold(body.Actor, "agent") {
		return nil, errors.New("effect actor must be agent")
	}
	actor := chatv1.Actor_ACTOR_AGENT
	effect := &chatv1.EffectEnvelope{
		EffectId:       body.EffectID,
		InvocationKey:  strings.TrimSpace(body.InvocationKey),
		Actor:          actor,
		ConversationId: body.ConversationID,
		EffectKind:     body.EffectKind,
		EffectScope:    body.EffectScope,
		CanonicalInput: input,
		InputDigest:    body.InputDigest,
		TargetIds:      cleanStrings(body.TargetIDs),
		ReferenceKeys:  cleanStrings(body.ReferenceKeys),
		ApprovalId:     strings.TrimSpace(body.ApprovalID),
		BeforeRevision: strings.TrimSpace(body.BeforeRevision),
		AfterRevision:  strings.TrimSpace(body.AfterRevision),
		Outcome:        body.Outcome,
		OccurredAt:     timestamppb.New(occurredAt.UTC()),
	}
	return &chatv1.EffectPerformedCommand{Effect: effect}, nil
}

func cleanStrings(values []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	return out
}
