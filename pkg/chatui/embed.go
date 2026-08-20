//go:build embed

// Package chatui serves the pbui-chat demo SPA. With the `embed` build tag the
// bundle is compiled into the binary; without it the same files are read from
// disk so `go run` serves whatever `pnpm build` produced last.
package chatui

import (
	"embed"
	"io/fs"
)

//go:embed all:embed
var embedded embed.FS

// PublicFS returns the built SPA.
func PublicFS() (fs.FS, error) {
	return fs.Sub(embedded, "embed")
}

// Embedded reports whether the bundle is compiled in.
const Embedded = true
