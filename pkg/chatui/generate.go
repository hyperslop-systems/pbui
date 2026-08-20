//go:build generate_ui

package chatui

// The SPA build is deliberately behind a build tag so `go generate ./...`
// (which CI runs for logcopter) does not require node. Run it with:
//
//	go generate -tags generate_ui ./pkg/chatui
//
//go:generate pnpm --dir ../../packages/pbui-chat/demo build
