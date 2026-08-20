package pbuichat

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	widgetv1 "github.com/go-go-golems/pinocchio/pkg/chatapp/pb/proto/pinocchio/chatapp/widgets/v1"
	"github.com/go-go-golems/pinocchio/pkg/chatapp/widgets"
	sessionstream "github.com/go-go-golems/sessionstream/pkg/sessionstream"
	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"
)

// Publisher publishes one named session event. It matches the shape of
// chatapp.RuntimeEventContext.Publish so the same emission code serves the
// real geppetto runtime and a scripted engine.
type Publisher func(ctx context.Context, eventName string, payload proto.Message) error

// PublisherFor adapts a sessionstream publisher bound to one session.
func PublisherFor(sid sessionstream.SessionId, pub sessionstream.EventPublisher) Publisher {
	return func(ctx context.Context, name string, payload proto.Message) error {
		return pub.Publish(ctx, sessionstream.Event{Name: name, SessionId: sid, Payload: payload})
	}
}

// RefsInstanceID is the widget instance id of a message's pbui.refs document.
func RefsInstanceID(messageID string) string { return messageID + "-refs" }

// refsState remembers which references a message has already published so a
// later text segment only resolves what is new, while every patch still
// carries the whole accumulated map (the client and the timeline store both
// replace top-level keys; sending the whole map keeps live and hydrated state
// identical).
type refsState struct {
	started bool
	refs    map[string]map[string]any
}

// Emitter publishes pbui.refs and pbui.widget instances. It is embedded in the
// Plugin and also usable on its own (the scripted demo engine does that).
type Emitter struct {
	vocab    *Vocabulary
	resolver Resolver
	limits   Limits

	mu   sync.Mutex
	refs map[string]*refsState // by message id
}

// NewEmitter builds an emitter. A nil resolver marks every mention unresolved.
func NewEmitter(vocab *Vocabulary, resolver Resolver, limits Limits) *Emitter {
	return &Emitter{vocab: vocab, resolver: resolver, limits: limits, refs: map[string]*refsState{}}
}

// ResolveMention resolves one mention into a reference, never failing: an
// unknown type or a resolver error yields an <unresolved> reference whose
// value says why.
func (e *Emitter) ResolveMention(ctx context.Context, m Mention, provenance *Provenance) Reference {
	if e.vocab != nil && !e.vocab.KnowsType(m.Type) {
		return Unresolved(m.Type, m.ID, m.Label, "unknown type "+m.Type)
	}
	if e.resolver == nil {
		return Unresolved(m.Type, m.ID, m.Label, "no resolver")
	}
	value, err := e.resolver.Resolve(ctx, m.Type, m.ID)
	if err != nil {
		return Unresolved(m.Type, m.ID, m.Label, err.Error())
	}
	if value == nil {
		value = map[string]any{}
	}
	if _, ok := value["id"]; !ok {
		value["id"] = m.ID
	}
	if m.Label != "" {
		if _, ok := value["label"]; !ok {
			value["label"] = m.Label
		}
	}
	return Reference{Type: m.Type, ID: m.ID, Value: value, Provenance: provenance}
}

// EmitRefsForText scans text for mentions, resolves the ones this message has
// not published yet, and publishes (or patches) the message's pbui.refs
// document. It returns the number of newly resolved references.
func (e *Emitter) EmitRefsForText(ctx context.Context, publish Publisher, messageID, text string) (int, error) {
	mentions := UniqueMentions(ScanMentions(text))
	if len(mentions) == 0 {
		return 0, nil
	}
	e.mu.Lock()
	state := e.refs[messageID]
	if state == nil {
		state = &refsState{refs: map[string]map[string]any{}}
		e.refs[messageID] = state
	}
	var pending []Mention
	for _, m := range mentions {
		if _, done := state.refs[m.Key()]; done {
			continue
		}
		if e.limits.RefsPerMessage > 0 && len(state.refs)+len(pending) >= e.limits.RefsPerMessage {
			log.Warn().Str("message_id", messageID).Int("limit", e.limits.RefsPerMessage).Msg("pbuichat: refs per message limit reached")
			break
		}
		pending = append(pending, m)
	}
	e.mu.Unlock()
	if len(pending) == 0 {
		return 0, nil
	}

	provenance := &Provenance{MessageID: messageID}
	resolved := make([]Reference, 0, len(pending))
	for _, m := range pending {
		resolved = append(resolved, e.ResolveMention(ctx, m, provenance))
	}

	e.mu.Lock()
	for i, m := range pending {
		state.refs[m.Key()] = resolved[i].AsMap()
	}
	full := map[string]any{}
	for k, v := range state.refs {
		full[k] = v
	}
	first := !state.started
	state.started = true
	e.mu.Unlock()

	props, err := structpb.NewStruct(map[string]any{"schema_version": 1, "refs": full})
	if err != nil {
		return 0, errors.Wrap(err, "encode refs")
	}
	instanceID := RefsInstanceID(messageID)
	if first {
		err = publish(ctx, widgets.EventWidgetInstanceStarted, &widgetv1.WidgetInstanceStarted{
			InstanceId:      instanceID,
			WidgetName:      WidgetNameRefs,
			ParentMessageId: messageID,
			Status:          widgetv1.WidgetStatus_WIDGET_STATUS_READY,
			Props:           props,
		})
	} else {
		err = publish(ctx, widgets.EventWidgetInstancePatched, &widgetv1.WidgetInstancePatched{
			InstanceId: instanceID,
			WidgetName: WidgetNameRefs,
			Status:     widgetv1.WidgetStatus_WIDGET_STATUS_READY,
			Patch:      props,
		})
	}
	if err != nil {
		return 0, err
	}
	return len(pending), nil
}

// ForgetMessage drops per-message state once a run is over.
func (e *Emitter) ForgetMessage(messageID string) {
	e.mu.Lock()
	delete(e.refs, messageID)
	e.mu.Unlock()
}

// EmitWidget validates and publishes a widget document as a READY
// pbui.widget instance. An invalid document is published as a pbui.error
// instance so the failure is visible in the timeline, and the error is
// returned so the caller (a tool) can tell the model.
func (e *Emitter) EmitWidget(ctx context.Context, publish Publisher, messageID, widgetID string, doc WidgetDocument) error {
	return e.emitWidget(ctx, publish, messageID, widgetID, doc, widgetv1.WidgetStatus_WIDGET_STATUS_READY)
}

// EmitStreamingWidget publishes a widget in STREAMING state; follow with
// PatchWidget and CompleteWidget.
func (e *Emitter) EmitStreamingWidget(ctx context.Context, publish Publisher, messageID, widgetID string, doc WidgetDocument) error {
	return e.emitWidget(ctx, publish, messageID, widgetID, doc, widgetv1.WidgetStatus_WIDGET_STATUS_STREAMING)
}

func (e *Emitter) emitWidget(ctx context.Context, publish Publisher, messageID, widgetID string, doc WidgetDocument, status widgetv1.WidgetStatus) error {
	if strings.TrimSpace(widgetID) == "" {
		return errors.New("widget id is empty")
	}
	if err := ValidateWidgetDocument(doc, e.vocab, e.limits); err != nil {
		if perr := e.EmitError(ctx, publish, messageID, widgetID, err.Error(), doc); perr != nil {
			return errors.Wrap(perr, "publish widget error")
		}
		return errors.Wrap(err, "invalid widget document")
	}
	props, err := doc.ToStruct()
	if err != nil {
		return errors.Wrap(err, "encode widget document")
	}
	return publish(ctx, widgets.EventWidgetInstanceStarted, &widgetv1.WidgetInstanceStarted{
		InstanceId:      widgetID,
		WidgetName:      WidgetNameWidget,
		ParentMessageId: messageID,
		Status:          status,
		Props:           props,
	})
}

// PatchWidget replaces top-level keys of a widget document. Pass the WHOLE
// accumulated value for each key (for a streaming table: the whole `children`
// array with all rows so far). No patch_paths are used on purpose: the Go
// timeline projection replaces a path while the chat-provider client appends
// arrays for one, and sending accumulated state is the only encoding both
// treat identically.
func (e *Emitter) PatchWidget(ctx context.Context, publish Publisher, widgetID string, patch map[string]any, status widgetv1.WidgetStatus) error {
	s, err := structpb.NewStruct(patch)
	if err != nil {
		return errors.Wrap(err, "encode widget patch")
	}
	return publish(ctx, widgets.EventWidgetInstancePatched, &widgetv1.WidgetInstancePatched{
		InstanceId: widgetID,
		WidgetName: WidgetNameWidget,
		Status:     status,
		Patch:      s,
	})
}

// CompleteWidget marks a streaming widget READY.
func (e *Emitter) CompleteWidget(ctx context.Context, publish Publisher, widgetID string) error {
	return publish(ctx, widgets.EventWidgetInstanceCompleted, &widgetv1.WidgetInstanceCompleted{
		InstanceId: widgetID,
		Status:     widgetv1.WidgetStatus_WIDGET_STATUS_READY,
	})
}

// EmitError publishes a pbui.error instance. Silence is the worst failure
// mode for model-driven UI; an error that the user can see and the model is
// told about is recoverable.
func (e *Emitter) EmitError(ctx context.Context, publish Publisher, messageID, widgetID, message string, doc WidgetDocument) error {
	payload := map[string]any{"message": message, "at": time.Now().UTC().Format(time.RFC3339)}
	if doc != nil {
		payload["document"] = map[string]any(doc)
	}
	props, err := structpb.NewStruct(payload)
	if err != nil {
		return err
	}
	return publish(ctx, widgets.EventWidgetInstanceStarted, &widgetv1.WidgetInstanceStarted{
		InstanceId:      widgetID + "-error",
		WidgetName:      WidgetNameError,
		ParentMessageId: messageID,
		Status:          widgetv1.WidgetStatus_WIDGET_STATUS_ERROR,
		Props:           props,
	})
}

// EmitStreamingTable publishes a table document and then streams its rows in
// batches, pausing `delay` between batches. It is the shape a long-running
// tool uses; the demo engine uses it to show provisional state.
func (e *Emitter) EmitStreamingTable(ctx context.Context, publish Publisher, messageID, widgetID, title, docID string, columns []TableColumn, rows [][]any, batch int, delay time.Duration) error {
	if batch <= 0 {
		batch = 1
	}
	doc := NewTableDocument(title, docID, columns, nil, true)
	if err := e.EmitStreamingWidget(ctx, publish, messageID, widgetID, doc); err != nil {
		return err
	}
	for i := 0; i < len(rows); i += batch {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
		end := i + batch
		if end > len(rows) {
			end = len(rows)
		}
		accumulated := NewTableDocument(title, docID, columns, rows[:end], end < len(rows))
		if err := e.PatchWidget(ctx, publish, widgetID, map[string]any{"children": accumulated["children"]}, widgetv1.WidgetStatus_WIDGET_STATUS_STREAMING); err != nil {
			return err
		}
	}
	return e.CompleteWidget(ctx, publish, widgetID)
}

// WidgetID builds a stable widget id for the n-th widget of a message.
func WidgetID(messageID string, n int) string { return fmt.Sprintf("%s-w%d", messageID, n) }
