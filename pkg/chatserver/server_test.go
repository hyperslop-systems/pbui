package chatserver

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	sessionstream "github.com/go-go-golems/sessionstream/pkg/sessionstream"
	"github.com/hyperslop-systems/pbui/pkg/pbuichat"
)

type snapshotBody struct {
	Entities []struct {
		Kind    string          `json:"kind"`
		ID      string          `json:"id"`
		Payload json.RawMessage `json:"payload"`
	} `json:"entities"`
}

func newTestServer(t *testing.T) (*Server, *httptest.Server) {
	t.Helper()
	server, cleanup, err := NewServer(context.Background(), Options{ChunkDelay: time.Millisecond})
	if err != nil {
		t.Fatalf("new server: %v", err)
	}
	mux := http.NewServeMux()
	server.RegisterRoutes(mux)
	ts := httptest.NewServer(mux)
	t.Cleanup(func() {
		ts.Close()
		_ = cleanup()
	})
	return server, ts
}

func postJSON(t *testing.T, url string, body any) map[string]any {
	t.Helper()
	raw, _ := json.Marshal(body)
	resp, err := http.Post(url, "application/json", bytes.NewReader(raw))
	if err != nil {
		t.Fatalf("POST %s: %v", url, err)
	}
	defer func() { _ = resp.Body.Close() }()
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("POST %s: status %d body %v", url, resp.StatusCode, out)
	}
	return out
}

func snapshot(t *testing.T, ts *httptest.Server, sid string) snapshotBody {
	t.Helper()
	resp, err := http.Get(ts.URL + "/api/chat/sessions/" + sid)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var snap snapshotBody
	if err := json.NewDecoder(resp.Body).Decode(&snap); err != nil {
		t.Fatalf("decode snapshot: %v", err)
	}
	return snap
}

func waitIdle(t *testing.T, server *Server, sid string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	// The scripted engine starts its goroutine from the command handler; give
	// the hub a moment to dispatch before polling for idleness.
	time.Sleep(20 * time.Millisecond)
	if err := server.scripted.WaitIdle(ctx, sessionstream.SessionId(sid)); err != nil {
		t.Fatalf("wait idle: %v", err)
	}
	time.Sleep(20 * time.Millisecond)
}

func TestLowStockProducesRefsAndWidgets(t *testing.T) {
	server, ts := newTestServer(t)
	created := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})
	sid := created["sessionId"].(string)
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/messages", map[string]any{"prompt": "which gold eagles are low on stock?"})
	waitIdle(t, server, sid)

	snap := snapshot(t, ts, sid)
	var refs, widgets, messages int
	for _, e := range snap.Entities {
		switch e.Kind {
		case "ChatWidgetInstance":
			var p struct {
				WidgetName string         `json:"widgetName"`
				Status     string         `json:"status"`
				Props      map[string]any `json:"props"`
			}
			_ = json.Unmarshal(e.Payload, &p)
			switch p.WidgetName {
			case pbuichat.WidgetNameRefs:
				refs++
				m, _ := p.Props["refs"].(map[string]any)
				if _, ok := m["product:2049"]; !ok {
					t.Errorf("refs missing product:2049: %v", m)
				}
				if _, ok := m["source:E1"]; !ok {
					t.Errorf("refs missing source:E1: %v", m)
				}
			case pbuichat.WidgetNameWidget:
				widgets++
				if p.Status != "WIDGET_STATUS_READY" {
					t.Errorf("widget %s not ready after run: %s", e.ID, p.Status)
				}
			case pbuichat.WidgetNameError:
				t.Errorf("unexpected error widget: %v", p.Props)
			}
		case "ChatMessage":
			messages++
		}
	}
	if refs != 1 {
		t.Errorf("want 1 refs entity, got %d", refs)
	}
	if widgets != 2 {
		t.Errorf("want 2 widgets (table + next steps), got %d", widgets)
	}
	if messages < 2 {
		t.Errorf("want user + assistant messages, got %d", messages)
	}
}

func TestVerbTraceIsRecordedAndReadable(t *testing.T) {
	server, ts := newTestServer(t)
	sid := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/verbs", map[string]any{
		"clientSeq": "c1", "actor": "human",
		"verb":    map[string]any{"kind": "watch", "ref": map[string]any{"type": "product", "id": "2049"}},
		"target":  map[string]any{"type": "product", "id": "2049", "value": map[string]any{"name": "1oz AGE"}},
		"outcome": "performed",
	})
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/verbs", map[string]any{
		"actor": "agent", "verb": map[string]any{"kind": "teleport"}, "outcome": "performed",
	})
	time.Sleep(20 * time.Millisecond)
	snap := snapshot(t, ts, sid)
	var traces []string
	for _, e := range snap.Entities {
		if e.Kind == pbuichat.TimelineEntityTrace {
			traces = append(traces, string(e.Payload))
		}
	}
	if len(traces) != 2 {
		t.Fatalf("want 2 trace entities, got %d", len(traces))
	}
	if !strings.Contains(traces[1], "rejected:unknown verb teleport") {
		t.Errorf("invalid verb should be recorded as rejected: %s", traces[1])
	}
	// The scripted engine answers "what did I do" from the same trace.
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/messages", map[string]any{"prompt": "what did I do?"})
	waitIdle(t, server, sid)
	snap = snapshot(t, ts, sid)
	found := false
	for _, e := range snap.Entities {
		if e.Kind == "ChatMessage" && strings.Contains(string(e.Payload), "#1 human performed watch") {
			found = true
		}
	}
	if !found {
		t.Error("trace scenario did not narrate entry #1")
	}
}

func TestReorderRoundTripsThroughHumanTools(t *testing.T) {
	server, ts := newTestServer(t)
	sid := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/tools/manifest", map[string]any{
		"revision": 1,
		"tools": []any{
			map[string]any{"name": pbuichat.ToolAccept, "mode": "human", "available": true, "inputSchema": map[string]any{"type": "object"}},
			map[string]any{"name": pbuichat.ToolPropose, "mode": "human", "available": true, "inputSchema": map[string]any{"type": "object"}},
		},
	})
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/messages", map[string]any{"prompt": "draft a reorder"})

	// Wait for the accept request to appear, answer it, then the proposal.
	answer := func(toolName string, result map[string]any) {
		deadline := time.Now().Add(5 * time.Second)
		for time.Now().Before(deadline) {
			snap := snapshot(t, ts, sid)
			for _, e := range snap.Entities {
				if e.Kind != "ChatFrontendToolCall" || !strings.Contains(string(e.Payload), `"toolName":"`+toolName+`"`) || !strings.Contains(string(e.Payload), `"status":"requested"`) {
					continue
				}
				var p struct {
					ToolCallID string `json:"toolCallId"`
				}
				_ = json.Unmarshal(e.Payload, &p)
				postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/tools/results", map[string]any{"toolCallId": p.ToolCallID, "toolName": toolName, "result": result, "status": "success"})
				return
			}
			time.Sleep(20 * time.Millisecond)
		}
		t.Fatalf("no %s request appeared", toolName)
	}
	answer(pbuichat.ToolAccept, map[string]any{"reference": map[string]any{"type": "product", "id": "2051"}})
	answer(pbuichat.ToolPropose, map[string]any{"decision": "approve"})
	waitIdle(t, server, sid)

	snap := snapshot(t, ts, sid)
	var approvedText, logWidget bool
	for _, e := range snap.Entities {
		if e.Kind == "ChatMessage" && strings.Contains(string(e.Payload), "Approved. I drafted the purchase order for [[product:2051|") {
			approvedText = true
		}
		if e.Kind == "ChatWidgetInstance" && strings.Contains(string(e.Payload), "Reorder submitted") {
			logWidget = true
		}
	}
	if !approvedText || !logWidget {
		t.Errorf("approved=%v logWidget=%v", approvedText, logWidget)
	}
}

func TestInvalidWidgetBecomesErrorEntity(t *testing.T) {
	server, ts := newTestServer(t)
	sid := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/messages", map[string]any{"prompt": "show an error"})
	waitIdle(t, server, sid)
	snap := snapshot(t, ts, sid)
	for _, e := range snap.Entities {
		if e.Kind == "ChatWidgetInstance" && strings.Contains(string(e.Payload), `"widgetName":"pbui.error"`) {
			return
		}
	}
	t.Error("no pbui.error entity")
}

func TestVocabularyEndpoint(t *testing.T) {
	_, ts := newTestServer(t)
	resp, err := http.Get(ts.URL + "/api/pbui/vocabulary")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var v pbuichat.Vocabulary
	if err := json.NewDecoder(resp.Body).Decode(&v); err != nil {
		t.Fatal(err)
	}
	if !v.KnowsType("product") || len(v.Verbs) == 0 {
		t.Errorf("vocabulary incomplete: %+v", v)
	}
}
