// Package scripted is a deterministic stand-in for the LLM: it answers a
// handful of prompts with text full of mentions, widget documents, accept
// requests and proposals, through exactly the same emission code the real
// runtime uses. It exists so the browser, the tests and the demo need no model
// credentials.
package scripted

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	chatapp "github.com/go-go-golems/pinocchio/pkg/chatapp"
	"github.com/go-go-golems/pinocchio/pkg/chatapp/frontendtools"
	chatappv1 "github.com/go-go-golems/pinocchio/pkg/chatapp/pb/proto/pinocchio/chatapp/v1"
	sessionstream "github.com/go-go-golems/sessionstream/pkg/sessionstream"
	"github.com/hyperslop-systems/pbui/pkg/pbuichat"
	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"
)

// Commands the HTTP layer submits.
const (
	CommandStart = "PbuiChatStartInference"
	CommandStop  = "PbuiChatStopInference"
)

// Options configure the engine.
type Options struct {
	Plugin        *pbuichat.Plugin
	FrontendTools *frontendtools.Manager
	ChunkDelay    time.Duration
}

// Engine is the scripted engine.
type Engine struct {
	plugin        *pbuichat.Plugin
	frontendTools *frontendtools.Manager
	chunkDelay    time.Duration

	mu      sync.Mutex
	nextID  int
	active  map[sessionstream.SessionId]*run
	pending map[sessionstream.SessionId]pendingContext
}

type run struct {
	messageID string
	cancel    context.CancelFunc
	done      chan struct{}
}

type pendingContext struct {
	refs  []pbuichat.Reference
	focus *pbuichat.Focus
}

// New builds the engine.
func New(opts Options) *Engine {
	delay := opts.ChunkDelay
	if delay <= 0 {
		delay = 20 * time.Millisecond
	}
	return &Engine{
		plugin:        opts.Plugin,
		frontendTools: opts.FrontendTools,
		chunkDelay:    delay,
		active:        map[sessionstream.SessionId]*run{},
		pending:       map[sessionstream.SessionId]pendingContext{},
	}
}

// RegisterSchemas registers the engine's commands.
func RegisterSchemas(reg *sessionstream.SchemaRegistry) error {
	for _, err := range []error{
		reg.RegisterCommand(CommandStart, &chatappv1.StartInferenceCommand{}),
		reg.RegisterCommand(CommandStop, &chatappv1.StopInferenceCommand{}),
	} {
		if err != nil {
			return err
		}
	}
	return nil
}

// Install registers the command handlers.
func (e *Engine) Install(hub *sessionstream.Hub) error {
	if hub == nil {
		return errors.New("hub is nil")
	}
	if err := hub.RegisterCommand(CommandStart, e.HandleStart); err != nil {
		return err
	}
	return hub.RegisterCommand(CommandStop, e.HandleStop)
}

// SetPendingContext stores the typed references and focus that accompany the
// next prompt of a session. The StartInferenceCommand proto has no field for
// them, and the scripted engine should see them structurally, as a real
// runtime would through the turn.
func (e *Engine) SetPendingContext(sid sessionstream.SessionId, refs []pbuichat.Reference, focus *pbuichat.Focus) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.pending[sid] = pendingContext{refs: refs, focus: focus}
}

func (e *Engine) takePendingContext(sid sessionstream.SessionId) pendingContext {
	e.mu.Lock()
	defer e.mu.Unlock()
	pc := e.pending[sid]
	delete(e.pending, sid)
	return pc
}

// HandleStart accepts the user message and starts the scripted run.
func (e *Engine) HandleStart(ctx context.Context, cmd sessionstream.Command, _ *sessionstream.Session, pub sessionstream.EventPublisher) error {
	payload, ok := cmd.Payload.(*chatappv1.StartInferenceCommand)
	if !ok || payload == nil {
		return fmt.Errorf("start payload must be %T, got %T", &chatappv1.StartInferenceCommand{}, cmd.Payload)
	}
	prompt := strings.TrimSpace(payload.GetPrompt())
	if prompt == "" {
		return errors.New("prompt is empty")
	}
	messageID := e.nextMessageID()
	if err := publish(ctx, cmd.SessionId, pub, chatapp.EventUserMessageAccepted, &chatappv1.ChatUserMessageAccepted{
		MessageId: messageID + "-user", Role: "user", Text: prompt, Content: prompt, Status: "accepted",
		Attachments: payload.GetAttachments(),
	}); err != nil {
		return err
	}
	pc := e.takePendingContext(cmd.SessionId)
	runCtx, cancel := context.WithCancel(context.WithoutCancel(ctx))
	r := &run{messageID: messageID, cancel: cancel, done: make(chan struct{})}
	if previous := e.swapRun(cmd.SessionId, r); previous != nil {
		previous.cancel()
		<-previous.done
	}
	go e.run(runCtx, cmd.SessionId, messageID, prompt, pc, pub, r.done)
	return nil
}

// HandleStop cancels the active run.
func (e *Engine) HandleStop(_ context.Context, cmd sessionstream.Command, _ *sessionstream.Session, _ sessionstream.EventPublisher) error {
	if current := e.currentRun(cmd.SessionId); current != nil {
		current.cancel()
	}
	return nil
}

// WaitIdle blocks until the session has no active run (tests).
func (e *Engine) WaitIdle(ctx context.Context, sid sessionstream.SessionId) error {
	for {
		current := e.currentRun(sid)
		if current == nil {
			return nil
		}
		select {
		case <-current.done:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (e *Engine) run(ctx context.Context, sid sessionstream.SessionId, messageID, prompt string, pc pendingContext, pub sessionstream.EventPublisher, done chan struct{}) {
	defer close(done)
	defer e.clearRun(sid, messageID)
	publishCtx := context.WithoutCancel(ctx)
	t := &turn{
		engine:    e,
		ctx:       ctx,
		pubCtx:    publishCtx,
		sid:       sid,
		messageID: messageID,
		prompt:    prompt,
		refs:      pc.refs,
		focus:     pc.focus,
		pub:       pub,
		publish:   pbuichat.PublisherFor(sid, pub),
	}
	if err := publish(publishCtx, sid, pub, chatapp.EventChatRunStarted, &chatappv1.ChatRunStarted{MessageId: messageID, Prompt: prompt}); err != nil {
		e.logErr(err, sid, messageID, "run started")
		return
	}
	err := e.respond(t)
	switch {
	case err == nil:
		_ = publish(publishCtx, sid, pub, chatapp.EventChatRunFinished, &chatappv1.ChatRunFinished{MessageId: messageID, Status: "finished"})
	case ctx.Err() != nil:
		_ = publish(publishCtx, sid, pub, chatapp.EventChatRunStopped, &chatappv1.ChatRunStopped{MessageId: messageID, Status: "stopped"})
	default:
		e.logErr(err, sid, messageID, "scenario")
		_ = publish(publishCtx, sid, pub, chatapp.EventChatRunFailed, &chatappv1.ChatRunFailed{MessageId: messageID, Status: "failed", Error: err.Error()})
	}
	e.plugin.ForgetMessage(messageID)
}

// turn bundles what a scenario needs to talk.
type turn struct {
	engine    *Engine
	ctx       context.Context
	pubCtx    context.Context
	sid       sessionstream.SessionId
	messageID string
	prompt    string
	refs      []pbuichat.Reference
	focus     *pbuichat.Focus
	pub       sessionstream.EventPublisher
	publish   pbuichat.Publisher
	segments  int
	widgets   int
}

// say streams one assistant text segment and resolves its mentions.
func (t *turn) say(text string) error {
	t.segments++
	segmentID := fmt.Sprintf("%s:text:%d", t.messageID, t.segments)
	if err := publish(t.pubCtx, t.sid, t.pub, chatapp.EventChatTextSegmentStarted, &chatappv1.ChatTextSegmentStarted{MessageId: segmentID, Role: "assistant", Prompt: t.prompt, Status: "streaming", Streaming: true}); err != nil {
		return err
	}
	accumulated := ""
	for i, chunk := range chunkWords(text, 4) {
		select {
		case <-t.ctx.Done():
			_ = publish(t.pubCtx, t.sid, t.pub, chatapp.EventChatTextSegmentFinished, &chatappv1.ChatTextSegmentFinished{MessageId: segmentID, Role: "assistant", Prompt: t.prompt, Text: accumulated, Content: accumulated, Status: "stopped", Final: true, FinishReason: "stopped"})
			return t.ctx.Err()
		case <-time.After(t.engine.chunkDelay):
		}
		accumulated += chunk
		if err := publish(t.pubCtx, t.sid, t.pub, chatapp.EventChatTextPatch, &chatappv1.ChatTextPatch{MessageId: segmentID, Role: "assistant", Prompt: t.prompt, StreamId: segmentID, Sequence: uint64(i + 1), Text: chunk, Mode: chatappv1.ChatStreamPatchMode_CHAT_STREAM_PATCH_MODE_APPEND, Status: "streaming"}); err != nil {
			return err
		}
	}
	if err := publish(t.pubCtx, t.sid, t.pub, chatapp.EventChatTextSegmentFinished, &chatappv1.ChatTextSegmentFinished{MessageId: segmentID, Role: "assistant", Prompt: t.prompt, Text: accumulated, Content: accumulated, Status: "finished", Final: true}); err != nil {
		return err
	}
	_, err := t.engine.plugin.EmitRefsForText(t.pubCtx, t.publish, t.messageID, accumulated)
	return err
}

// widget publishes a widget document and returns its id.
func (t *turn) widget(doc pbuichat.WidgetDocument) (string, error) {
	t.widgets++
	id := pbuichat.WidgetID(t.messageID, t.widgets)
	return id, t.engine.plugin.EmitWidget(t.pubCtx, t.publish, t.messageID, id, doc)
}

// streamingTable publishes a table row by row.
func (t *turn) streamingTable(title, docID string, columns []pbuichat.TableColumn, rows [][]any) (string, error) {
	t.widgets++
	id := pbuichat.WidgetID(t.messageID, t.widgets)
	return id, t.engine.plugin.EmitStreamingTable(t.ctx, t.publish, t.messageID, id, title, docID, columns, rows, 1, t.engine.chunkDelay*4)
}

// hasHumanTool reports whether the browser advertised a human tool.
func (t *turn) hasHumanTool(name string) bool {
	return t.engine.frontendTools != nil && t.engine.frontendTools.HasAvailableTool(t.sid, name)
}

// humanTool runs a browser-side human tool and returns its result map.
func (t *turn) humanTool(name string, input map[string]any) (map[string]any, string, error) {
	if t.engine.frontendTools == nil {
		return nil, "", errors.New("frontend tools are not installed")
	}
	t.widgets++
	result, err := t.engine.frontendTools.Request(t.ctx, t.sid, t.pub, frontendtools.Request{
		MessageID:  t.messageID,
		ToolCallID: fmt.Sprintf("%s:tool:%s:%d", t.messageID, name, t.widgets),
		ToolName:   name,
		Mode:       frontendHumanMode(),
		Input:      input,
	})
	if err != nil {
		return nil, "", err
	}
	var m map[string]any
	if result.GetResult() != nil {
		m = result.GetResult().AsMap()
	}
	return m, result.GetStatus(), nil
}

func publish(ctx context.Context, sid sessionstream.SessionId, pub sessionstream.EventPublisher, name string, payload proto.Message) error {
	return pub.Publish(ctx, sessionstream.Event{Name: name, SessionId: sid, Payload: payload})
}

func chunkWords(text string, words int) []string {
	fields := strings.SplitAfter(text, " ")
	var out []string
	for i := 0; i < len(fields); i += words {
		end := i + words
		if end > len(fields) {
			end = len(fields)
		}
		out = append(out, strings.Join(fields[i:end], ""))
	}
	return out
}

func (e *Engine) nextMessageID() string {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.nextID++
	return fmt.Sprintf("msg-%d", e.nextID)
}

func (e *Engine) swapRun(sid sessionstream.SessionId, next *run) *run {
	e.mu.Lock()
	defer e.mu.Unlock()
	previous := e.active[sid]
	e.active[sid] = next
	return previous
}

func (e *Engine) currentRun(sid sessionstream.SessionId) *run {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.active[sid]
}

func (e *Engine) clearRun(sid sessionstream.SessionId, messageID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if current := e.active[sid]; current != nil && current.messageID == messageID {
		delete(e.active, sid)
	}
}

func (e *Engine) logErr(err error, sid sessionstream.SessionId, messageID, what string) {
	log.Error().Err(err).Str("session_id", string(sid)).Str("message_id", messageID).Str("step", what).Msg("scripted engine")
}
