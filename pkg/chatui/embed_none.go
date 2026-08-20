//go:build !embed

package chatui

import (
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
)

// PublicFS returns the on-disk build output (pkg/chatui/embed), located
// relative to this source file so `go run ./cmd/pbui-chat` works from any cwd.
func PublicFS() (fs.FS, error) {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		return os.DirFS("pkg/chatui/embed"), nil
	}
	return os.DirFS(filepath.Join(filepath.Dir(file), "embed")), nil
}

// Embedded reports whether the bundle is compiled in.
const Embedded = false
