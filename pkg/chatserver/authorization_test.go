package chatserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	sessionstream "github.com/go-go-golems/sessionstream/pkg/sessionstream"
	"github.com/gorilla/websocket"
)

type ownershipAuthorizer struct {
	mu     sync.Mutex
	owners map[sessionstream.SessionId]string
}

func (a *ownershipAuthorizer) Authenticate(r *http.Request) (Principal, error) {
	subject := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if subject != "alice" && subject != "bob" {
		return Principal{}, ErrUnauthorized
	}
	return Principal{Subject: subject, ClientID: subject + "-browser"}, nil
}
func (*ownershipAuthorizer) CanCreateSession(context.Context, Principal) bool { return true }
func (*ownershipAuthorizer) CanListSessions(context.Context, Principal) bool  { return true }
func (a *ownershipAuthorizer) CanAccessSession(_ context.Context, principal Principal, sid sessionstream.SessionId, _ SessionAction) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.owners[sid] == principal.Subject
}
func (a *ownershipAuthorizer) ClaimSession(_ context.Context, principal Principal, sid sessionstream.SessionId) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.owners[sid] = principal.Subject
	return nil
}

func TestSessionRoutesEnforcePrincipalOwnership(t *testing.T) {
	authorizer := &ownershipAuthorizer{owners: map[sessionstream.SessionId]string{}}
	server, cleanup, err := NewServer(context.Background(), Options{Authorizer: authorizer})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = cleanup() }()
	mux := http.NewServeMux()
	server.RegisterRoutes(mux)

	request := func(method, path, subject string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader("{}"))
		if subject != "" {
			req.Header.Set("Authorization", "Bearer "+subject)
		}
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, req)
		return response
	}

	unauthenticated := request(http.MethodPost, "/api/chat/sessions", "")
	if unauthenticated.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated create status = %d", unauthenticated.Code)
	}
	created := request(http.MethodPost, "/api/chat/sessions", "alice")
	if created.Code != http.StatusOK {
		t.Fatalf("create status = %d: %s", created.Code, created.Body.String())
	}
	var body struct {
		SessionID string `json:"sessionId"`
	}
	if err := json.NewDecoder(created.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}

	routes := []struct{ method, suffix string }{
		{http.MethodGet, ""},
		{http.MethodPatch, ""},
		{http.MethodPost, "/messages"},
		{http.MethodPost, "/stop"},
		{http.MethodPost, "/tools/manifest"},
		{http.MethodPost, "/tools/results"},
		{http.MethodPost, "/verbs"},
		{http.MethodPost, "/effects"},
	}
	for _, route := range routes {
		got := request(route.method, "/api/chat/sessions/"+body.SessionID+route.suffix, "bob")
		if got.Code != http.StatusForbidden {
			t.Errorf("bob %s %s status = %d, want 403", route.method, route.suffix, got.Code)
		}
	}
	missing := request(http.MethodGet, "/api/chat/sessions/missing", "bob")
	if missing.Code != http.StatusForbidden {
		t.Fatalf("missing session status = %d, want same 403 as foreign session", missing.Code)
	}

	aliceList := request(http.MethodGet, "/api/chat/sessions", "alice")
	bobList := request(http.MethodGet, "/api/chat/sessions", "bob")
	if !strings.Contains(aliceList.Body.String(), body.SessionID) {
		t.Fatalf("alice list omitted owned session: %s", aliceList.Body.String())
	}
	if strings.Contains(bobList.Body.String(), body.SessionID) {
		t.Fatalf("bob list leaked foreign session: %s", bobList.Body.String())
	}
}

func TestWebSocketSubscribeEnforcesSessionOwnership(t *testing.T) {
	authorizer := &ownershipAuthorizer{owners: map[sessionstream.SessionId]string{"alice-session": "alice"}}
	server, cleanup, err := NewServer(context.Background(), Options{Authorizer: authorizer})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = cleanup() }()
	mux := http.NewServeMux()
	server.RegisterRoutes(mux)
	httpServer := httptest.NewServer(mux)
	defer httpServer.Close()

	header := http.Header{"Authorization": []string{"Bearer bob"}}
	conn, response, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(httpServer.URL, "http")+"/api/chat/ws", header)
	if err != nil {
		if response != nil {
			t.Fatalf("websocket dial status %d: %v", response.StatusCode, err)
		}
		t.Fatal(err)
	}
	defer func() { _ = conn.Close() }()
	var hello map[string]any
	if err := conn.ReadJSON(&hello); err != nil {
		t.Fatal(err)
	}
	if err := conn.WriteJSON(map[string]any{"subscribe": map[string]any{"sessionId": "alice-session"}}); err != nil {
		t.Fatal(err)
	}
	var denied struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := conn.ReadJSON(&denied); err != nil {
		t.Fatal(err)
	}
	if denied.Error.Code != "subscribe_denied" {
		t.Fatalf("subscribe error code = %q", denied.Error.Code)
	}
}

func TestNewServerRequiresExplicitAuthorizer(t *testing.T) {
	server, cleanup, err := NewServer(context.Background(), Options{})
	if err == nil || server != nil || cleanup != nil {
		t.Fatalf("NewServer without authorizer returned server=%t cleanup=%t err=%v", server != nil, cleanup != nil, err)
	}
}
