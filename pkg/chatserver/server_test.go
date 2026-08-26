package chatserver

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
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
	server, cleanup, err := NewServer(context.Background(), Options{Authorizer: NewDevelopmentAuthorizer(), ChunkDelay: time.Millisecond})
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

func TestAttachmentsArePreservedInScriptedMessages(t *testing.T) {
	server, ts := newTestServer(t)
	sid := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/messages", map[string]any{
		"prompt":      "",
		"attachments": []any{map[string]any{"attachment_id": "image-1"}},
	})
	waitIdle(t, server, sid)

	for _, entity := range snapshot(t, ts, sid).Entities {
		if entity.Kind == "ChatMessage" && strings.Contains(string(entity.Payload), `"attachmentId":"image-1"`) {
			return
		}
	}
	t.Fatal("user message did not retain attachment image-1")
}

func TestEffectTraceIsRecordedDurablyAndIdempotently(t *testing.T) {
	_, ts := newTestServer(t)
	sid := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)
	canonical := []byte(`{"placementId":"n1"}`)
	digest := sha256.Sum256(canonical)
	body := map[string]any{
		"effectId": "effect-1", "invocationKey": sid + "/tool-1", "actor": "agent", "conversationId": sid,
		"effectKind": "tile.close", "effectScope": "workbench", "canonicalInput": map[string]any{"placementId": "n1"},
		"inputDigest": hex.EncodeToString(digest[:]), "targetIds": []string{"n1"}, "referenceKeys": []string{},
		"beforeRevision": "r1", "afterRevision": "r2", "outcome": "performed", "occurredAt": "2026-08-25T17:00:00.000Z",
	}
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/effects", body)
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/effects", body)
	time.Sleep(20 * time.Millisecond)

	var effectEntries int
	for _, entity := range snapshot(t, ts, sid).Entities {
		if entity.Kind == pbuichat.TimelineEntityTrace && strings.Contains(string(entity.Payload), `"effectId":"effect-1"`) {
			effectEntries++
		}
	}
	if effectEntries != 1 {
		t.Fatalf("effect trace entries = %d, want 1", effectEntries)
	}

	body["conversationId"] = "other-session"
	raw, _ := json.Marshal(body)
	response, err := http.Post(ts.URL+"/api/chat/sessions/"+sid+"/effects", "application/json", bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("mismatched effect status = %d", response.StatusCode)
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

func TestTraceRehydratesBeforeAllocatingAfterRestart(t *testing.T) {
	db := filepath.Join(t.TempDir(), "timeline.sqlite")
	start := func() (*Server, *httptest.Server, func()) {
		server, cleanup, err := NewServer(context.Background(), Options{Authorizer: NewDevelopmentAuthorizer(), TimelineDB: db, ChunkDelay: time.Millisecond})
		if err != nil {
			t.Fatalf("new persistent server: %v", err)
		}
		mux := http.NewServeMux()
		server.RegisterRoutes(mux)
		ts := httptest.NewServer(mux)
		return server, ts, func() { ts.Close(); _ = cleanup() }
	}

	_, first, closeFirst := start()
	sid := postJSON(t, first.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)
	postJSON(t, first.URL+"/api/chat/sessions/"+sid+"/verbs", map[string]any{
		"actor": "human", "verb": map[string]any{"kind": "watch"}, "outcome": "performed",
	})
	closeFirst()

	server, second, closeSecond := start()
	defer closeSecond()
	postJSON(t, second.URL+"/api/chat/sessions/"+sid+"/verbs", map[string]any{
		"actor": "human", "verb": map[string]any{"kind": "watch"}, "outcome": "performed",
	})
	entries := server.Plugin().Trace(sessionstream.SessionId(sid), 0, 10)
	if len(entries) != 2 || entries[0].GetSeq() != 1 || entries[1].GetSeq() != 2 {
		t.Fatalf("rehydrated trace sequences: %+v", entries)
	}
	var ids []string
	for _, entity := range snapshot(t, second, sid).Entities {
		if entity.Kind == pbuichat.TimelineEntityTrace {
			ids = append(ids, entity.ID)
		}
	}
	if len(ids) != 2 {
		t.Fatalf("persisted traces were overwritten: %v", ids)
	}
}

func TestReorderRoundTripsThroughHumanTools(t *testing.T) {
	server, ts := newTestServer(t)
	sid := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/tools/manifest", map[string]any{
		"clientInstanceId": "reorder-test-client",
		"connectionId":     "reorder-test-connection",
		"revision":         1,
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
					ToolCallID string               `json:"toolCallId"`
					Executor   frontendToolExecutor `json:"executor"`
				}
				_ = json.Unmarshal(e.Payload, &p)
				postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/tools/results", map[string]any{"toolCallId": p.ToolCallID, "toolName": toolName, "result": result, "status": "success", "executor": p.Executor})
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

// answerFrontendTool waits for a bridged call to the named tool and answers
// it as the browser would — the fake-browser half of a sandbox round trip.
func answerFrontendTool(t *testing.T, ts *httptest.Server, sid, toolName string, result map[string]any) map[string]any {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		snap := snapshot(t, ts, sid)
		for _, e := range snap.Entities {
			if e.Kind != "ChatFrontendToolCall" || !strings.Contains(string(e.Payload), `"toolName":"`+toolName+`"`) || !strings.Contains(string(e.Payload), `"status":"requested"`) {
				continue
			}
			var p struct {
				ToolCallID string               `json:"toolCallId"`
				Input      map[string]any       `json:"input"`
				Executor   frontendToolExecutor `json:"executor"`
			}
			_ = json.Unmarshal(e.Payload, &p)
			postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/tools/results", map[string]any{"toolCallId": p.ToolCallID, "toolName": toolName, "result": result, "status": "success", "executor": p.Executor})
			return p.Input
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("no %s request appeared", toolName)
	return nil
}

func TestProgramScenarioBridgesTheSandboxTools(t *testing.T) {
	server, ts := newTestServer(t)
	sid := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/tools/manifest", map[string]any{
		"clientInstanceId": "program-test-client",
		"connectionId":     "program-test-connection",
		"revision":         1,
		"tools": []any{
			map[string]any{"name": pbuichat.ToolSandboxTest, "mode": "frontend", "available": true, "inputSchema": map[string]any{"type": "object"}},
			map[string]any{"name": pbuichat.ToolSandboxCreateApp, "mode": "frontend", "available": true, "inputSchema": map[string]any{"type": "object"}},
			map[string]any{"name": pbuichat.ToolSandboxDefineAction, "mode": "frontend", "available": true, "inputSchema": map[string]any{"type": "object"}},
		},
	})
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/messages", map[string]any{
		"prompt": "make me a days of cover tile and add an action for it",
		"refs":   []any{map[string]any{"type": "product", "id": "2051"}},
	})

	// The scenario tests first, then creates, then defines — and each input is
	// what a real tool would receive: the prompt's own worked program, bound to
	// the product the user pointed at.
	tested := answerFrontendTool(t, ts, sid, pbuichat.ToolSandboxTest, map[string]any{"ok": true, "nodeCount": 7, "meta": map[string]any{"widgets": []any{"main"}}})
	if src, _ := tested["source"].(string); !strings.Contains(src, `definePlugin(`) || !strings.Contains(src, `bindings: ["product"]`) {
		t.Errorf("sandbox_test did not receive the worked program: %.80s", src)
	}
	if docs, _ := tested["documents"].(map[string]any); docs["product"] != "2051" {
		t.Errorf("sandbox_test documents = %v", tested["documents"])
	}
	created := answerFrontendTool(t, ts, sid, pbuichat.ToolSandboxCreateApp, map[string]any{"ok": true, "programId": "prg-3", "version": 1, "placementId": "n-9", "warnings": []any{}})
	if created["title"] != "Days of cover · 2051" || created["open"] != true {
		t.Errorf("sandbox_create_app input = %v", created)
	}
	defined := answerFrontendTool(t, ts, sid, pbuichat.ToolSandboxDefineAction, map[string]any{"ok": true, "actionId": "act-1"})
	if b, _ := defined["behaviour"].(map[string]any); b["kind"] != "openProgram" || b["programId"] != "prg-3" {
		t.Errorf("sandbox_define_action behaviour = %v", defined["behaviour"])
	}
	waitIdle(t, server, sid)

	snap := snapshot(t, ts, sid)
	var programMention, actionMention bool
	for _, e := range snap.Entities {
		if e.Kind != "ChatMessage" {
			continue
		}
		if strings.Contains(string(e.Payload), "[[program:prg-3|Days of cover · 2051]]") && strings.Contains(string(e.Payload), "[[tile:n-9|") {
			programMention = true
		}
		if strings.Contains(string(e.Payload), "[[action:act-1|Days of cover]]") {
			actionMention = true
		}
	}
	if !programMention || !actionMention {
		t.Errorf("programMention=%v actionMention=%v", programMention, actionMention)
	}
}

func TestProgramScenarioStopsOnAFailedTest(t *testing.T) {
	server, ts := newTestServer(t)
	sid := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/tools/manifest", map[string]any{
		"clientInstanceId": "failed-program-test-client",
		"connectionId":     "failed-program-test-connection",
		"revision":         1,
		"tools": []any{
			map[string]any{"name": pbuichat.ToolSandboxTest, "mode": "frontend", "available": true, "inputSchema": map[string]any{"type": "object"}},
			map[string]any{"name": pbuichat.ToolSandboxCreateApp, "mode": "frontend", "available": true, "inputSchema": map[string]any{"type": "object"}},
		},
	})
	postJSON(t, ts.URL+"/api/chat/sessions/"+sid+"/messages", map[string]any{"prompt": "make me a counter tile"})
	answerFrontendTool(t, ts, sid, pbuichat.ToolSandboxTest, map[string]any{"ok": false, "phase": "render", "error": "TypeError: boom"})
	waitIdle(t, server, sid)
	snap := snapshot(t, ts, sid)
	for _, e := range snap.Entities {
		if e.Kind == "ChatFrontendToolCall" && strings.Contains(string(e.Payload), pbuichat.ToolSandboxCreateApp) {
			t.Fatal("a failed test must not be followed by sandbox_create_app")
		}
		if e.Kind == "ChatMessage" && strings.Contains(string(e.Payload), "TypeError: boom") && strings.Contains(string(e.Payload), "phase render") {
			return
		}
	}
	t.Error("the failure was not reported to the user")
}

func TestSessionIndexListsWhatItHasSeen(t *testing.T) {
	_, ts := newTestServer(t)

	first := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)
	second := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)

	listed := listSessions(t, ts)
	if len(listed) != 2 {
		t.Fatalf("expected 2 sessions, got %d", len(listed))
	}
	// Most recently active first; the second was created last.
	if listed[0].ID != second || listed[1].ID != first {
		t.Errorf("expected %s before %s, got %v", second, first, []string{listed[0].ID, listed[1].ID})
	}
	if listed[0].MessageCount != 0 {
		t.Errorf("a session with no messages should count 0, got %d", listed[0].MessageCount)
	}
}

func TestSessionIndexCountsMessagesAndReordersByActivity(t *testing.T) {
	_, ts := newTestServer(t)

	first := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)
	second := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)
	postJSON(t, ts.URL+"/api/chat/sessions/"+first+"/messages", map[string]any{"prompt": "hello"})

	listed := listSessions(t, ts)
	// Sending moved `first` to the top and counted the message.
	if listed[0].ID != first {
		t.Fatalf("expected the session that just spoke first, got %s (second is %s)", listed[0].ID, second)
	}
	if listed[0].MessageCount != 1 {
		t.Errorf("expected 1 message, got %d", listed[0].MessageCount)
	}
}

func TestSessionTitleIsStoredAndRefusedForUnknownSessions(t *testing.T) {
	_, ts := newTestServer(t)
	id := postJSON(t, ts.URL+"/api/chat/sessions", map[string]any{})["sessionId"].(string)

	if status := patchJSON(t, ts.URL+"/api/chat/sessions/"+id, map[string]any{"title": "  reorder desk  ", "expectedRevision": 0}); status != http.StatusOK {
		t.Fatalf("PATCH title: status %d", status)
	}
	listed := listSessions(t, ts)
	if listed[0].Title != "reorder desk" || listed[0].TitleRevision != 1 {
		t.Errorf("expected the trimmed title at revision 1, got %+v", listed[0])
	}

	// A stale retry cannot overwrite the newer title.
	if status := patchJSON(t, ts.URL+"/api/chat/sessions/"+id, map[string]any{"title": "stale", "expectedRevision": 0}); status != http.StatusConflict {
		t.Fatalf("expected 409 for stale title revision, got %d", status)
	}
	if status := patchJSON(t, ts.URL+"/api/chat/sessions/"+id, map[string]any{"title": "latest", "expectedRevision": 1}); status != http.StatusOK {
		t.Fatalf("expected current revision to update, got %d", status)
	}
	listed = listSessions(t, ts)
	if listed[0].Title != "latest" || listed[0].TitleRevision != 2 {
		t.Errorf("expected latest title at revision 2, got %+v", listed[0])
	}

	// A session this server never minted is not silently created by a rename.
	if status := patchJSON(t, ts.URL+"/api/chat/sessions/ghost", map[string]any{"title": "nope"}); status != http.StatusNotFound {
		t.Errorf("expected 404 for an unknown session, got %d", status)
	}
}

func TestSubmittingToAnUnindexedSessionStillWorks(t *testing.T) {
	// The index is a convenience, not a gate: a browser holding an id from
	// before a restart must still be able to use it. Nothing here creates the
	// session first.
	_, ts := newTestServer(t)
	postJSON(t, ts.URL+"/api/chat/sessions/"+string(sessionstream.SessionId("recovered"))+"/messages", map[string]any{"prompt": "hello"})

	listed := listSessions(t, ts)
	if len(listed) != 1 || listed[0].ID != "recovered" {
		t.Fatalf("expected the session to be indexed on first use, got %v", listed)
	}
	if listed[0].MessageCount != 1 {
		t.Errorf("expected 1 message, got %d", listed[0].MessageCount)
	}
}

func TestSQLiteSessionIndexSurvivesReopening(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sessions.sqlite")
	ctx := context.Background()

	index, err := NewSQLiteSessionIndex(ctx, path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	at := time.Date(2026, 8, 21, 12, 0, 0, 0, time.UTC)
	if err := index.Remember(ctx, "s1", at); err != nil {
		t.Fatalf("remember: %v", err)
	}
	if err := index.Touch(ctx, "s1", at.Add(time.Minute), true); err != nil {
		t.Fatalf("touch: %v", err)
	}
	if _, err := index.Retitle(ctx, "s1", "kept", 0); err != nil {
		t.Fatalf("retitle: %v", err)
	}
	if err := index.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}

	reopened, err := NewSQLiteSessionIndex(ctx, path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	t.Cleanup(func() { _ = reopened.Close() })
	records, err := reopened.List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(records) != 1 || records[0].Title != "kept" || records[0].TitleRevision != 1 || records[0].MessageCount != 1 {
		t.Fatalf("expected the record to survive, got %+v", records)
	}
	if !records[0].LastActivityAt.Equal(at.Add(time.Minute)) {
		t.Errorf("expected the touched time, got %s", records[0].LastActivityAt)
	}
}

func TestSQLiteSessionIndexMigratesLegacyTitleRows(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy-sessions.sqlite")
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatalf("open legacy database: %v", err)
	}
	_, err = db.Exec(`CREATE TABLE sessions (
		id TEXT PRIMARY KEY,
		created_at TEXT NOT NULL,
		last_activity_at TEXT NOT NULL,
		message_count INTEGER NOT NULL DEFAULT 0,
		title TEXT NOT NULL DEFAULT ''
	); INSERT INTO sessions (id, created_at, last_activity_at, title) VALUES ('s1', '2026-08-21T00:00:00Z', '2026-08-21T00:00:00Z', 'legacy');`)
	if err != nil {
		t.Fatalf("seed legacy database: %v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatalf("close legacy database: %v", err)
	}

	index, err := NewSQLiteSessionIndex(context.Background(), path)
	if err != nil {
		t.Fatalf("migrate: %v", err)
	}
	defer func() { _ = index.Close() }()
	record, err := index.Retitle(context.Background(), "s1", "migrated", 0)
	if err != nil {
		t.Fatalf("retitle migrated row: %v", err)
	}
	if record.Title != "migrated" || record.TitleRevision != 1 {
		t.Fatalf("unexpected migrated row: %+v", record)
	}
}

func listSessions(t *testing.T, ts *httptest.Server) []SessionRecord {
	t.Helper()
	resp, err := http.Get(ts.URL + "/api/chat/sessions")
	if err != nil {
		t.Fatalf("GET sessions: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET sessions: status %d", resp.StatusCode)
	}
	var out listSessionsResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode sessions: %v", err)
	}
	return out.Sessions
}

func patchJSON(t *testing.T, url string, body any) int {
	t.Helper()
	raw, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPatch, url, bytes.NewReader(raw))
	if err != nil {
		t.Fatalf("build PATCH: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PATCH %s: %v", url, err)
	}
	defer func() { _ = resp.Body.Close() }()
	return resp.StatusCode
}
