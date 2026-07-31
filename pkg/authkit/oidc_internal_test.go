package authkit

import (
	"net/url"
	"testing"
)

// EndSessionURL must merge into a discovered endpoint's existing query
// string; a second "?" would fold id_token_hint into the tenant parameter's
// value and the provider would ignore the logout hints entirely.
func TestEndSessionURLPreservesExistingQuery(t *testing.T) {
	p := &oidcProvider{endSession: "https://id.example/oidc/v1/end_session?tenant=x"}

	raw := p.EndSessionURL("token-123", "https://app.example/bye")
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("EndSessionURL produced an unparseable URL %q: %v", raw, err)
	}
	query := parsed.Query()
	for key, want := range map[string]string{
		"tenant":                   "x",
		"id_token_hint":            "token-123",
		"post_logout_redirect_uri": "https://app.example/bye",
	} {
		if got := query.Get(key); got != want {
			t.Fatalf("%s = %q, want %q (full URL %q)", key, got, want, raw)
		}
	}
}

func TestEndSessionURLWithoutParams(t *testing.T) {
	p := &oidcProvider{endSession: "https://id.example/end_session?tenant=x"}
	if got := p.EndSessionURL("", ""); got != p.endSession {
		t.Fatalf("no params must return the endpoint verbatim, got %q", got)
	}
}
