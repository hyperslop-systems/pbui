// Package chatserver wires a PBUI-native chat agent: pinocchio chatapp +
// sessionstream + the pbuichat plugin, behind a plain net/http mux, with a
// scripted demo engine by default and a real geppetto runtime on request.
package chatserver

import (
	"time"

	"github.com/go-go-golems/glazed/pkg/cmds/values"
	"github.com/hyperslop-systems/pbui/pkg/pbuichat"
)

// Options configure the server.
type Options struct {
	// TimelineDB is a SQLite path for the hydration store; empty = in-memory.
	TimelineDB string
	// TurnsDB is a SQLite path for final-turn history; empty = in-memory.
	TurnsDB string
	// ChunkDelay paces the scripted engine's text stream.
	ChunkDelay time.Duration
	// RealRuntime switches from the scripted engine to a pinocchio profile.
	RealRuntime       bool
	Profile           string
	ProfileRegistries []string
	ConfigFile        string
	ParsedValues      *values.Values
	// SystemPrompt is prepended to the generated PBUI section for the real runtime.
	SystemPrompt string

	// Vocabulary and Resolver define the product. Both default to the demo.
	Vocabulary *pbuichat.Vocabulary
	Resolver   pbuichat.Resolver
	Projection []pbuichat.ProjectionRule
	Limits     pbuichat.Limits
}

func (o Options) chunkDelay() time.Duration {
	if o.ChunkDelay > 0 {
		return o.ChunkDelay
	}
	return 20 * time.Millisecond
}
