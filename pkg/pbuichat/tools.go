package pbuichat

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	gepevents "github.com/go-go-golems/geppetto/pkg/events"
	geptools "github.com/go-go-golems/geppetto/pkg/inference/tools"
	sessionstream "github.com/go-go-golems/sessionstream/pkg/sessionstream"
	"github.com/pkg/errors"
)

// Tool names. Human tools (pbui_accept, pbui_propose) are advertised by the
// browser manifest, not here: a client that cannot accept does not advertise
// them and the model is not offered them.
const (
	ToolWidget        = "pbui_widget"
	ToolTrace         = "pbui_trace"
	ToolDescribeTypes = "pbui_describe_types"
	ToolAccept        = "pbui_accept"
	ToolPropose       = "pbui_propose"
)

// WidgetToolInput is the argument schema of pbui_widget. The document is
// validated against the vocabulary before it is published.
type WidgetToolInput struct {
	Document map[string]any `json:"document" jsonschema:"required,description=A pbui.widget document. Shape: {format:'pbui.widget', schema_version:1, title:string, layout:'stack', children:[child...], verbs:[{label:string, verb:{kind:string, ...fields}}]}. Children by kind: {kind:'table', docId:string, columns:[{name:string, type:'q'|'n'}], rows:[[cell,...],...]} | {kind:'text', text:string, markdown:true} | {kind:'refs', label:string, refs:[{type:string, id:string, value:{name:string}}]} | {kind:'meter', label, value:number, max:number} | {kind:'sparkline', label, values:[number]} | {kind:'segmented', label, parts:[{label, value:number}]} | {kind:'stat', label, value, unit?, delta?} | {kind:'callout', tone:'warning'|'neutral'|'positive'|'danger', text} | {kind:'log', entries:[{level, text}]}. Example: {format:'pbui.widget', schema_version:1, title:'Low stock', layout:'stack', children:[{kind:'table', docId:'t1', columns:[{name:'sku', type:'n'},{name:'qty', type:'q'}], rows:[['2049', 3]]}], verbs:[{label:'Watch 2049', verb:{kind:'watch', ref:{type:'product', id:'2049'}}}]}"`
}

// WidgetToolOutput tells the model the id it can mention as [[widget:<id>]].
type WidgetToolOutput struct {
	WidgetID string `json:"widget_id"`
	Status   string `json:"status"`
	Error    string `json:"error,omitempty"`
}

// TraceToolInput selects trace entries.
type TraceToolInput struct {
	SinceSeq int `json:"since_seq,omitempty" jsonschema:"description=Return entries with a sequence number greater than this (0 = all kept entries)"`
	Limit    int `json:"limit,omitempty" jsonschema:"description=At most this many of the newest entries (default 50)"`
}

// TraceToolEntry is one entry as the model sees it.
type TraceToolEntry struct {
	Seq     uint64         `json:"seq"`
	Actor   string         `json:"actor"`
	Verb    map[string]any `json:"verb,omitempty"`
	Target  *Reference     `json:"target,omitempty"`
	Outcome string         `json:"outcome"`
	At      string         `json:"at"`
}

// TraceToolOutput is the pbui_trace result.
type TraceToolOutput struct {
	Entries []TraceToolEntry `json:"entries"`
}

// DescribeTypesInput selects vocabulary types.
type DescribeTypesInput struct {
	Types []string `json:"types,omitempty" jsonschema:"description=Only these types (default: all)"`
}

// DescribeTypesOutput is the pbui_describe_types result.
type DescribeTypesOutput struct {
	Types map[string]TypeSpec `json:"types"`
	Verbs map[string]VerbSpec `json:"verbs"`
}

// RegisterTools registers the backend tools for one session into a geppetto
// registry. Tools are per session because pbui_trace reads that session's
// trace and pbui_widget must know which message it belongs to; the message id
// comes from the event metadata geppetto puts on the context.
func (p *Plugin) RegisterTools(registry geptools.ToolRegistry, sid sessionstream.SessionId) error {
	if registry == nil {
		return errors.New("tool registry is nil")
	}
	widgetTool, err := geptools.NewToolFromFunc(ToolWidget,
		"Publish a PBUI widget document in the conversation. Use it for any structured result: tables, meters, sparklines, stats, callouts, forms. The document is validated; the result carries the widget id you can mention as [[widget:<id>|title]]. Offer follow-up actions in the document's `verbs` list using only known verb kinds.",
		func(ctx context.Context, in WidgetToolInput) (WidgetToolOutput, error) {
			return p.runWidgetTool(ctx, in)
		})
	if err != nil {
		return errors.Wrap(err, ToolWidget)
	}
	traceTool, err := geptools.NewToolFromFunc(ToolTrace,
		"Read the session's verb trace: every action the user performed through object menus and verb chips, and every action performed on your behalf, newest last.",
		func(_ context.Context, in TraceToolInput) (TraceToolOutput, error) {
			return p.runTraceTool(sid, in), nil
		})
	if err != nil {
		return errors.Wrap(err, ToolTrace)
	}
	describeTool, err := geptools.NewToolFromFunc(ToolDescribeTypes,
		"Describe the presentation types and verb kinds this interface understands (the same vocabulary summarised in your instructions, in full).",
		func(_ context.Context, in DescribeTypesInput) (DescribeTypesOutput, error) {
			return p.runDescribeTool(in), nil
		})
	if err != nil {
		return errors.Wrap(err, ToolDescribeTypes)
	}
	for _, t := range []*geptools.ToolDefinition{widgetTool, traceTool, describeTool} {
		if err := registry.RegisterTool(t.Name, *t); err != nil {
			return errors.Wrap(err, t.Name)
		}
	}
	return nil
}

func (p *Plugin) runWidgetTool(ctx context.Context, in WidgetToolInput) (WidgetToolOutput, error) {
	doc := WidgetDocument(in.Document)
	if doc == nil {
		return WidgetToolOutput{Status: "error", Error: "document is required"}, nil
	}
	if _, ok := doc["format"]; !ok {
		doc["format"] = WidgetFormat
	}
	if _, ok := doc["schema_version"]; !ok {
		doc["schema_version"] = float64(WidgetSchemaVersion)
	}
	if err := ValidateWidgetDocument(doc, p.vocab, p.limits); err != nil {
		return WidgetToolOutput{Status: "error", Error: err.Error()}, nil
	}
	raw, err := json.Marshal(doc)
	if err != nil {
		return WidgetToolOutput{Status: "error", Error: err.Error()}, nil
	}
	if p.limits.WidgetBytes > 0 && len(raw) > p.limits.WidgetBytes {
		return WidgetToolOutput{Status: "error", Error: fmt.Sprintf("document is %d bytes, limit %d", len(raw), p.limits.WidgetBytes)}, nil
	}
	// The message id is not known here; the plugin assigns the widget id when
	// it handles the event (it knows the message from the runtime context).
	gepevents.PublishEventToContext(ctx, NewWidgetRequestedEvent(gepevents.EventMetadata{}, "", doc))
	title := doc.Title()
	if title == "" {
		title = "widget"
	}
	return WidgetToolOutput{WidgetID: "(assigned when published; mention the title instead: " + title + ")", Status: "published"}, nil
}

func (p *Plugin) runTraceTool(sid sessionstream.SessionId, in TraceToolInput) TraceToolOutput {
	limit := in.Limit
	if limit <= 0 {
		limit = 50
	}
	since := uint64(0)
	if in.SinceSeq > 0 {
		since = uint64(in.SinceSeq)
	}
	entries := p.Trace(sid, since, limit)
	out := TraceToolOutput{Entries: make([]TraceToolEntry, 0, len(entries))}
	for _, e := range entries {
		item := TraceToolEntry{Seq: e.GetSeq(), Actor: strings.ToLower(strings.TrimPrefix(e.GetActor().String(), "ACTOR_")), Outcome: e.GetOutcome()}
		if e.GetVerb() != nil {
			item.Verb = e.GetVerb().AsMap()
		}
		item.Target = ReferenceFromProto(e.GetTarget())
		if e.GetAt() != nil {
			item.At = e.GetAt().AsTime().Format("2006-01-02T15:04:05Z07:00")
		}
		out.Entries = append(out.Entries, item)
	}
	return out
}

func (p *Plugin) runDescribeTool(in DescribeTypesInput) DescribeTypesOutput {
	out := DescribeTypesOutput{Types: map[string]TypeSpec{}, Verbs: map[string]VerbSpec{}}
	want := map[string]bool{}
	for _, t := range in.Types {
		want[t] = true
	}
	for name, spec := range p.vocab.Types {
		if len(want) > 0 && !want[name] {
			continue
		}
		out.Types[name] = spec
		for _, v := range spec.Verbs {
			out.Verbs[v] = p.vocab.Verbs[v]
		}
	}
	if len(want) == 0 {
		for k, v := range p.vocab.Verbs {
			out.Verbs[k] = v
		}
	}
	return out
}
