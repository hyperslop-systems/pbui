package chatserver

import (
	"context"
	"errors"
	"net/http"

	sessionstream "github.com/go-go-golems/sessionstream/pkg/sessionstream"
)

// Principal is the authenticated identity used for chat session policy.
type Principal struct {
	Subject  string
	ClientID string
	Scopes   map[string]bool
}

// SessionAction identifies the operation being authorized.
type SessionAction string

const (
	SessionCreate        SessionAction = "create"
	SessionList          SessionAction = "list"
	SessionRead          SessionAction = "read"
	SessionRetitle       SessionAction = "retitle"
	SessionSend          SessionAction = "send"
	SessionStop          SessionAction = "stop"
	SessionManifestWrite SessionAction = "manifest-write"
	SessionResultWrite   SessionAction = "tool-result-write"
	SessionVerbWrite     SessionAction = "verb-write"
	SessionSubscribe     SessionAction = "subscribe"
)

var ErrUnauthorized = errors.New("unauthorized")

// SessionAuthorizer authenticates requests, records newly-created ownership,
// and authorizes operations. Implementations must be safe for concurrent use.
type SessionAuthorizer interface {
	Authenticate(*http.Request) (Principal, error)
	CanCreateSession(context.Context, Principal) bool
	CanListSessions(context.Context, Principal) bool
	CanAccessSession(context.Context, Principal, sessionstream.SessionId, SessionAction) bool
	ClaimSession(context.Context, Principal, sessionstream.SessionId) error
}

type principalContextKey struct{}

func withPrincipal(r *http.Request, principal Principal) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), principalContextKey{}, principal))
}

func principalFromContext(ctx context.Context) (Principal, bool) {
	principal, ok := ctx.Value(principalContextKey{}).(Principal)
	return principal, ok && principal.Subject != ""
}

// DevelopmentAuthorizer deliberately allows one local development identity.
// Callers must opt into it; NewServer has no unauthenticated default.
type DevelopmentAuthorizer struct{}

func NewDevelopmentAuthorizer() *DevelopmentAuthorizer { return &DevelopmentAuthorizer{} }
func (*DevelopmentAuthorizer) Authenticate(*http.Request) (Principal, error) {
	return Principal{Subject: "local-development", ClientID: "local-browser"}, nil
}
func (*DevelopmentAuthorizer) CanCreateSession(context.Context, Principal) bool { return true }
func (*DevelopmentAuthorizer) CanListSessions(context.Context, Principal) bool  { return true }
func (*DevelopmentAuthorizer) CanAccessSession(context.Context, Principal, sessionstream.SessionId, SessionAction) bool {
	return true
}
func (*DevelopmentAuthorizer) ClaimSession(context.Context, Principal, sessionstream.SessionId) error {
	return nil
}
