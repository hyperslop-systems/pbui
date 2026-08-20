package pbuichat

import (
	"context"
	"fmt"
	"sync"

	"github.com/pkg/errors"
)

// Resolver turns an id the model named into the value the descriptor needs.
// The model supplies ids; the application supplies truth. A resolver must
// never put a secret into the returned value: presentation values flow to the
// inspector, the watchlist, the trace and the hydration store.
type Resolver interface {
	Resolve(ctx context.Context, typ, id string) (map[string]any, error)
}

// ResolverFunc adapts a function to Resolver.
type ResolverFunc func(ctx context.Context, typ, id string) (map[string]any, error)

// Resolve implements Resolver.
func (f ResolverFunc) Resolve(ctx context.Context, typ, id string) (map[string]any, error) {
	return f(ctx, typ, id)
}

// ErrUnknownType is returned when no resolver is registered for a type.
var ErrUnknownType = errors.New("no resolver for type")

// ErrNotFound is returned when a resolver knows the type but not the id.
var ErrNotFound = errors.New("not found")

// ResolverMux dispatches by presentation type.
type ResolverMux map[string]Resolver

var _ Resolver = ResolverMux{}

// Resolve implements Resolver.
func (m ResolverMux) Resolve(ctx context.Context, typ, id string) (map[string]any, error) {
	r, ok := m[typ]
	if !ok || r == nil {
		return nil, errors.Wrap(ErrUnknownType, typ)
	}
	return r.Resolve(ctx, typ, id)
}

// StaticResolver resolves from an in-memory table, keyed by id. It is what a
// demo or a test uses; a product wraps its database instead.
type StaticResolver struct {
	mu     sync.RWMutex
	values map[string]map[string]any
}

var _ Resolver = (*StaticResolver)(nil)

// NewStaticResolver builds a resolver over the given id → value table.
func NewStaticResolver(values map[string]map[string]any) *StaticResolver {
	copied := make(map[string]map[string]any, len(values))
	for id, v := range values {
		copied[id] = cloneMap(v)
	}
	return &StaticResolver{values: copied}
}

// Put adds or replaces a value.
func (s *StaticResolver) Put(id string, value map[string]any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.values == nil {
		s.values = map[string]map[string]any{}
	}
	s.values[id] = cloneMap(value)
}

// Resolve implements Resolver.
func (s *StaticResolver) Resolve(_ context.Context, typ, id string) (map[string]any, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.values[id]
	if !ok {
		return nil, errors.Wrap(ErrNotFound, fmt.Sprintf("%s %s", typ, id))
	}
	return cloneMap(v), nil
}

// IDs returns the known ids (for tests and demos).
func (s *StaticResolver) IDs() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]string, 0, len(s.values))
	for id := range s.values {
		out = append(out, id)
	}
	return out
}

func cloneMap(m map[string]any) map[string]any {
	if m == nil {
		return nil
	}
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}
