package chatui

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

func TestRegisterSPARoutes(t *testing.T) {
	public := fstest.MapFS{
		"index.html":          {Data: []byte("<!doctype html><title>pbui chat</title>")},
		"assets/app-abc12.js": {Data: []byte("console.log(1)")},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/ping", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("pong")) })
	RegisterSPA(mux, public)

	cases := []struct {
		path   string
		status int
		body   string
	}{
		{"/", 200, "pbui chat"},
		{"/ui/anything/deep", 200, "pbui chat"},
		{"/static/assets/app-abc12.js", 200, "console.log"},
		{"/static/assets/missing.js", 404, ""},
		{"/static/index.html", 404, ""},
		{"/api/ping", 200, "pong"},
		{"/api/nope", 404, ""},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, c.path, nil))
		if rec.Code != c.status {
			t.Errorf("%s: status %d, want %d", c.path, rec.Code, c.status)
		}
		if c.body != "" && !contains(rec.Body.String(), c.body) {
			t.Errorf("%s: body %q lacks %q", c.path, rec.Body.String(), c.body)
		}
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
