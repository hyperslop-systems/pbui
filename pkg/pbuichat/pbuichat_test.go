package pbuichat

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	gepevents "github.com/go-go-golems/geppetto/pkg/events"
	widgetv1 "github.com/go-go-golems/pinocchio/pkg/chatapp/pb/proto/pinocchio/chatapp/widgets/v1"
	"github.com/go-go-golems/pinocchio/pkg/chatapp/widgets"
	sessionstream "github.com/go-go-golems/sessionstream/pkg/sessionstream"
	chatv1 "github.com/hyperslop-systems/pbui/gen/go/hyperslop/pbui/chat/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"
)

func loadDemoVocabulary(t *testing.T) *Vocabulary {
	t.Helper()
	data, err := os.ReadFile("../chatserver/demo/vocabulary.json")
	if err != nil {
		t.Fatalf("read demo vocabulary: %v", err)
	}
	v, err := ParseVocabulary(data)
	if err != nil {
		t.Fatalf("parse demo vocabulary: %v", err)
	}
	return v
}

func TestScanMentions(t *testing.T) {
	text := "Three [[product:2049|1oz AGE 2024]] and [[product:2051]] in [[category:7|Eagles]]; not [[broken]] nor [[:x]]."
	got := ScanMentions(text)
	if len(got) != 3 {
		t.Fatalf("want 3 mentions, got %d: %+v", len(got), got)
	}
	if got[0].Type != "product" || got[0].ID != "2049" || got[0].Label != "1oz AGE 2024" {
		t.Errorf("first mention wrong: %+v", got[0])
	}
	if got[1].Label != "" || got[1].ID != "2051" {
		t.Errorf("second mention wrong: %+v", got[1])
	}
	if text[got[2].Start:got[2].End] != "[[category:7|Eagles]]" {
		t.Errorf("offsets wrong: %q", text[got[2].Start:got[2].End])
	}
	if s := StripMentions(text); s != "Three 1oz AGE 2024 and 2051 in Eagles; not [[broken]] nor [[:x]]." {
		t.Errorf("strip: %q", s)
	}
	u := UniqueMentions(ScanMentions("[[a:1]] [[a:1]] [[b:1]]"))
	if len(u) != 2 {
		t.Errorf("unique: %d", len(u))
	}
}

func TestVocabularyValidateVerb(t *testing.T) {
	v := loadDemoVocabulary(t)
	cases := []struct {
		name string
		verb map[string]any
		ok   bool
	}{
		{"addFilter ok", map[string]any{"kind": "addFilter", "tableId": "t1", "field": "qty", "op": "<", "value": "5"}, true},
		{"addFilter missing", map[string]any{"kind": "addFilter", "tableId": "t1"}, false},
		{"unknown", map[string]any{"kind": "setColour"}, false},
		{"no kind", map[string]any{"x": 1}, false},
		{"compareWith optional right", map[string]any{"kind": "compareWith", "left": map[string]any{"type": "product", "id": "1"}}, true},
		{"askAgent refs typed", map[string]any{"kind": "askAgent", "template": "x {0}", "refs": []any{map[string]any{"type": "field", "id": "t.q"}}}, true},
		{"askAgent refs bad", map[string]any{"kind": "askAgent", "template": "x", "refs": []any{"nope"}}, false},
	}
	for _, c := range cases {
		err := v.ValidateVerb(c.verb)
		if (err == nil) != c.ok {
			t.Errorf("%s: ok=%v err=%v", c.name, c.ok, err)
		}
	}
}

func TestValidateWidgetDocument(t *testing.T) {
	v := loadDemoVocabulary(t)
	good := WidgetDocument{
		"format": WidgetFormat, "schema_version": float64(1), "title": "Health", "layout": "stack",
		"children": []any{
			map[string]any{"kind": "meter", "label": "stock", "value": float64(5), "max": float64(25)},
			map[string]any{"kind": "refs", "refs": []any{map[string]any{"type": "product", "id": "2049"}}},
			map[string]any{"kind": "table", "columns": []any{map[string]any{"name": "sku"}}, "rows": []any{[]any{"2049"}}},
			map[string]any{"kind": "widget", "document": map[string]any{"children": []any{map[string]any{"kind": "text", "text": "nested"}}}},
		},
		"verbs": []any{map[string]any{"label": "Watch", "verb": map[string]any{"kind": "watch", "ref": map[string]any{"type": "product", "id": "2049"}}}},
	}
	if err := ValidateWidgetDocument(good, v, DefaultLimits); err != nil {
		t.Fatalf("good document rejected: %v", err)
	}
	bad := []struct {
		name string
		doc  WidgetDocument
	}{
		{"wrong format", WidgetDocument{"format": "x", "schema_version": float64(1), "children": []any{map[string]any{"kind": "text", "text": "a"}}}},
		{"no children", WidgetDocument{"format": WidgetFormat, "schema_version": float64(1), "children": []any{}}},
		{"unknown kind", WidgetDocument{"format": WidgetFormat, "schema_version": float64(1), "children": []any{map[string]any{"kind": "hologram"}}}},
		{"unknown layout", WidgetDocument{"format": WidgetFormat, "schema_version": float64(1), "layout": "spiral", "children": []any{map[string]any{"kind": "text", "text": "a"}}}},
		{"table no columns", WidgetDocument{"format": WidgetFormat, "schema_version": float64(1), "children": []any{map[string]any{"kind": "table", "rows": []any{}}}}},
		{"bad verb", WidgetDocument{"format": WidgetFormat, "schema_version": float64(1), "children": []any{map[string]any{"kind": "text", "text": "a"}}, "verbs": []any{map[string]any{"label": "x", "verb": map[string]any{"kind": "nope"}}}}},
		{"too deep", WidgetDocument{"format": WidgetFormat, "schema_version": float64(1), "children": []any{map[string]any{"kind": "widget", "document": map[string]any{"children": []any{map[string]any{"kind": "widget", "document": map[string]any{"children": []any{map[string]any{"kind": "widget", "document": map[string]any{"children": []any{map[string]any{"kind": "text", "text": "a"}}}}}}}}}}}}},
	}
	for _, c := range bad {
		if err := ValidateWidgetDocument(c.doc, v, DefaultLimits); err == nil {
			t.Errorf("%s: accepted", c.name)
		}
	}
}

type capture struct {
	names    []string
	payloads []proto.Message
}

func (c *capture) publish(_ context.Context, name string, payload proto.Message) error {
	c.names = append(c.names, name)
	c.payloads = append(c.payloads, payload)
	return nil
}

func TestEmitRefsForText(t *testing.T) {
	v := loadDemoVocabulary(t)
	resolver := ResolverMux{"product": NewStaticResolver(map[string]map[string]any{"2049": {"name": "1oz AGE 2024", "qty": 3}})}
	e := NewEmitter(v, resolver, DefaultLimits)
	c := &capture{}
	n, err := e.EmitRefsForText(context.Background(), c.publish, "m1", "see [[product:2049|AGE]] and [[product:9999]] and [[planet:mars]]")
	if err != nil || n != 3 {
		t.Fatalf("n=%d err=%v", n, err)
	}
	if len(c.names) != 1 || c.names[0] != widgets.EventWidgetInstanceStarted {
		t.Fatalf("events: %v", c.names)
	}
	started := c.payloads[0].(*widgetv1.WidgetInstanceStarted)
	if started.InstanceId != "m1-refs" || started.WidgetName != WidgetNameRefs || started.ParentMessageId != "m1" {
		t.Errorf("started: %+v", started)
	}
	refs := started.Props.AsMap()["refs"].(map[string]any)
	if len(refs) != 3 {
		t.Fatalf("refs: %v", refs)
	}
	ok := refs["product:2049"].(map[string]any)
	if ok["type"] != "product" || ok["value"].(map[string]any)["name"] != "1oz AGE 2024" {
		t.Errorf("resolved ref wrong: %v", ok)
	}
	if refs["product:9999"].(map[string]any)["type"] != "unresolved" {
		t.Errorf("missing id should be unresolved: %v", refs["product:9999"])
	}
	if refs["planet:mars"].(map[string]any)["type"] != "unresolved" {
		t.Errorf("unknown type should be unresolved: %v", refs["planet:mars"])
	}
	// Second segment of the same message: only new refs resolved, whole map patched.
	n, err = e.EmitRefsForText(context.Background(), c.publish, "m1", "[[product:2049]] again and [[order:1]]")
	if err != nil || n != 1 {
		t.Fatalf("second: n=%d err=%v", n, err)
	}
	if c.names[1] != widgets.EventWidgetInstancePatched {
		t.Fatalf("second event: %v", c.names)
	}
	patched := c.payloads[1].(*widgetv1.WidgetInstancePatched)
	if got := len(patched.Patch.AsMap()["refs"].(map[string]any)); got != 4 {
		t.Errorf("patch should carry the whole map, got %d", got)
	}
}

func TestEmitWidgetInvalidPublishesError(t *testing.T) {
	v := loadDemoVocabulary(t)
	e := NewEmitter(v, nil, DefaultLimits)
	c := &capture{}
	err := e.EmitWidget(context.Background(), c.publish, "m1", "m1-w1", WidgetDocument{"format": WidgetFormat, "schema_version": float64(1), "children": []any{map[string]any{"kind": "nope"}}})
	if err == nil {
		t.Fatal("expected validation error")
	}
	if len(c.names) != 1 {
		t.Fatalf("expected one error widget, got %v", c.names)
	}
	if p := c.payloads[0].(*widgetv1.WidgetInstanceStarted); p.WidgetName != WidgetNameError || p.InstanceId != "m1-w1-error" {
		t.Errorf("error widget: %+v", p)
	}
}

type captureSink struct{ events []gepevents.Event }

func (s *captureSink) PublishEvent(event gepevents.Event) error {
	s.events = append(s.events, event)
	return nil
}

func TestWidgetToolReturnsPublishedWidgetID(t *testing.T) {
	p, err := New(Options{Vocabulary: loadDemoVocabulary(t)})
	if err != nil {
		t.Fatal(err)
	}
	sink := &captureSink{}
	ctx := gepevents.WithEventSinks(context.Background(), sink)
	out, err := p.runWidgetTool(ctx, WidgetToolInput{Document: map[string]any{
		"title": "Health", "children": []any{map[string]any{"kind": "text", "text": "ok"}},
	}})
	if err != nil || out.Status != "published" || out.WidgetID == "" {
		t.Fatalf("widget result: %+v, %v", out, err)
	}
	if len(sink.events) != 1 {
		t.Fatalf("published events: %d", len(sink.events))
	}
	event, ok := sink.events[0].(*EventWidgetRequested)
	if !ok || event.WidgetID != out.WidgetID {
		t.Fatalf("event id does not match result: %#v vs %q", sink.events[0], out.WidgetID)
	}
}

type fakePub struct{ events []sessionstream.Event }

func (f *fakePub) Publish(_ context.Context, ev sessionstream.Event) error {
	f.events = append(f.events, ev)
	return nil
}

func TestTraceCommandAndProjections(t *testing.T) {
	v := loadDemoVocabulary(t)
	p, err := New(Options{Vocabulary: v})
	if err != nil {
		t.Fatal(err)
	}
	body := []byte(`{"clientSeq":"c1","actor":"human","verb":{"kind":"watch","ref":{"type":"product","id":"2049"}},"target":{"type":"product","id":"2049","value":{"name":"AGE"}},"outcome":"performed"}`)
	cmd, err := VerbCommandFromJSON(body)
	if err != nil {
		t.Fatal(err)
	}
	pub := &fakePub{}
	sid := sessionstream.SessionId("s1")
	if err := p.HandleVerbPerformed(context.Background(), sessionstream.Command{Name: CommandVerbPerformed, Payload: cmd, SessionId: sid}, nil, pub); err != nil {
		t.Fatal(err)
	}
	bad, _ := VerbCommandFromJSON([]byte(`{"actor":"agent","verb":{"kind":"nope"},"outcome":"performed"}`))
	if err := p.HandleVerbPerformed(context.Background(), sessionstream.Command{Name: CommandVerbPerformed, Payload: bad, SessionId: sid}, nil, pub); err != nil {
		t.Fatal(err)
	}
	if len(pub.events) != 2 || pub.events[0].Name != EventVerbRecorded {
		t.Fatalf("events: %+v", pub.events)
	}
	first := pub.events[0].Payload.(*chatv1.TraceEntry)
	second := pub.events[1].Payload.(*chatv1.TraceEntry)
	if first.GetSeq() != 1 || second.GetSeq() != 2 {
		t.Errorf("seq: %d %d", first.GetSeq(), second.GetSeq())
	}
	if first.GetActor() != chatv1.Actor_ACTOR_HUMAN || first.GetOutcome() != "performed" || first.GetTarget().GetId() != "2049" {
		t.Errorf("first: %+v", first)
	}
	if second.GetActor() != chatv1.Actor_ACTOR_AGENT || second.GetOutcome() != "rejected:unknown verb nope" {
		t.Errorf("second outcome: %q", second.GetOutcome())
	}
	ui, handled, err := p.ProjectUI(context.Background(), pub.events[0], nil, nil)
	if err != nil || !handled || len(ui) != 1 || ui[0].Name != UIEventTraceEntry {
		t.Errorf("ui projection: %v %v %v", ui, handled, err)
	}
	tl, handled, err := p.ProjectTimeline(context.Background(), pub.events[0], nil, nil)
	if err != nil || !handled || len(tl) != 1 || tl[0].Kind != TimelineEntityTrace || tl[0].Id != "trace-1" {
		t.Errorf("timeline projection: %v %v %v", tl, handled, err)
	}
	entries := p.Trace(sid, 0, 10)
	if len(entries) != 2 {
		t.Errorf("trace: %d", len(entries))
	}
	out := p.runTraceTool(sid, TraceToolInput{SinceSeq: 1})
	if len(out.Entries) != 1 || out.Entries[0].Actor != "agent" {
		t.Errorf("trace tool: %+v", out)
	}
}

func TestRowsToTableProjection(t *testing.T) {
	rule := RowsToTable("sql_query", "rows")
	raw := `{"rows":[{"sku":"2049","qty":3},{"sku":"2051","qty":1}]}`
	var result any
	_ = json.Unmarshal([]byte(raw), &result)
	doc, ok := rule.Project("sql_query", "tc1", result)
	if !ok {
		t.Fatal("expected projection")
	}
	v := loadDemoVocabulary(t)
	if err := ValidateWidgetDocument(doc, v, DefaultLimits); err != nil {
		t.Fatalf("projected doc invalid: %v", err)
	}
	table := doc["children"].([]any)[0].(map[string]any)
	if table["docId"] != "tc1" || len(table["rows"].([]any)) != 2 {
		t.Errorf("table: %v", table)
	}
	if _, err := structpb.NewStruct(map[string]any(doc)); err != nil {
		t.Errorf("doc not struct-encodable: %v", err)
	}
}

func TestSystemPromptAndRefsSuffix(t *testing.T) {
	v := loadDemoVocabulary(t)
	s := SystemPromptSection(v)
	for _, want := range []string{"[[type:id|label]]", "product", "addFilter{", ToolWidget, ToolAccept, "consequential"} {
		if !contains(s, want) {
			t.Errorf("prompt missing %q", want)
		}
	}
	suffix := RenderRefsSuffix([]Reference{{Type: "field", ID: "t3.qty", Value: map[string]any{"name": "qty"}}}, &Focus{Reference: &Reference{Type: "product", ID: "2049"}})
	if !contains(suffix, "```pbui-refs") || !contains(suffix, "- field:t3.qty (qty)") || !contains(suffix, "focus: product:2049") {
		t.Errorf("suffix: %q", suffix)
	}
	if RenderRefsSuffix(nil, nil) != "" {
		t.Error("empty suffix expected")
	}
}

func contains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && (func() bool { return indexOf(s, sub) >= 0 })())
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
