package chatui

import (
	"io"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// RegisterSPA mounts the three route boundaries the PBUI playbook prescribes
// for a single-binary app:
//
//	GET /{$}               the front door, an exact match on the empty path
//	GET /ui/{path...}      the SPA shell, with a fallback to index.html
//	GET /static/{path...}  the hashed bundles, with NO fallback
//
// The SPA is never mounted at "/" with a catch-all, so a mistyped API route
// returns an API 404 rather than HTML; and a stale chunk under /static/ fails
// loudly instead of receiving HTML. Register API routes before calling this.
func RegisterSPA(mux *http.ServeMux, public fs.FS) {
	index := func(w http.ResponseWriter, r *http.Request) {
		serveIndex(w, r, public)
	}
	mux.HandleFunc("GET /{$}", index)
	mux.HandleFunc("GET /ui/{path...}", index)
	files := http.FileServerFS(public)
	mux.HandleFunc("GET /static/{path...}", func(w http.ResponseWriter, r *http.Request) {
		name := path.Clean("/" + r.PathValue("path"))
		if name == "/" || name == "/index.html" {
			http.NotFound(w, r)
			return
		}
		if _, err := fs.Stat(public, strings.TrimPrefix(name, "/")); err != nil {
			http.NotFound(w, r)
			return
		}
		if strings.HasPrefix(name, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		r2 := r.Clone(r.Context())
		r2.URL.Path = name
		files.ServeHTTP(w, r2)
	})
}

func serveIndex(w http.ResponseWriter, r *http.Request, public fs.FS) {
	f, err := public.Open("index.html")
	if err != nil {
		http.Error(w, "the UI bundle is not built: run `pnpm --dir packages/pbui-chat/demo build` (or `make chat-ui`)", http.StatusServiceUnavailable)
		return
	}
	defer func() { _ = f.Close() }()
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	if r.Method == http.MethodHead {
		return
	}
	_, _ = io.Copy(w, f)
}
