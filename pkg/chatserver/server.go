package chatserver

import (
	"context"
	"fmt"
	"net/http"

	geptools "github.com/go-go-golems/geppetto/pkg/inference/tools"
	chatapp "github.com/go-go-golems/pinocchio/pkg/chatapp"
	"github.com/go-go-golems/pinocchio/pkg/chatapp/frontendtools"
	"github.com/go-go-golems/pinocchio/pkg/chatapp/plugins"
	"github.com/go-go-golems/pinocchio/pkg/chatapp/serverkit"
	"github.com/go-go-golems/pinocchio/pkg/chatapp/widgets"
	chatstore "github.com/go-go-golems/pinocchio/pkg/persistence/chatstore"
	sessionstream "github.com/go-go-golems/sessionstream/pkg/sessionstream"
	wstransport "github.com/go-go-golems/sessionstream/pkg/sessionstream/transport/ws"
	"github.com/hyperslop-systems/pbui/pkg/chatserver/demo"
	"github.com/hyperslop-systems/pbui/pkg/chatserver/scripted"
	"github.com/hyperslop-systems/pbui/pkg/pbuichat"
	"github.com/pkg/errors"
)

// Server holds the wired chat stack.
type Server struct {
	opts          Options
	hub           *sessionstream.Hub
	service       *chatapp.Service
	ws            *wstransport.Server
	plugin        *pbuichat.Plugin
	frontendTools *frontendtools.Manager
	scripted      *scripted.Engine
	real          *realRuntimeFactory
	turnStore     chatstore.TurnStore
	sessions      SessionIndex
	authorizer    SessionAuthorizer
	closeFn       func() error
}

// NewServer wires everything. The returned cleanup closes the stores.
func NewServer(ctx context.Context, opts Options) (*Server, func() error, error) {
	if opts.Authorizer == nil {
		return nil, nil, errors.New("chatserver: authorizer is required")
	}
	vocab := opts.Vocabulary
	if vocab == nil {
		v, err := demo.Vocabulary()
		if err != nil {
			return nil, nil, errors.Wrap(err, "load demo vocabulary")
		}
		vocab = v
	}
	resolver := opts.Resolver
	if resolver == nil {
		resolver = demo.Resolver()
	}
	if opts.Vocabulary == nil {
		if opts.Tools == nil {
			opts.Tools = func(registry geptools.ToolRegistry, _ sessionstream.SessionId) error {
				return demo.RegisterTools(registry)
			}
		}
		if opts.Projection == nil {
			opts.Projection = demo.ProjectionRules()
		}
	}
	limits := opts.Limits
	if limits == (pbuichat.Limits{}) {
		limits = pbuichat.DefaultLimits
	}
	plugin, err := pbuichat.New(pbuichat.Options{Vocabulary: vocab, Resolver: resolver, Projection: opts.Projection, Limits: limits})
	if err != nil {
		return nil, nil, errors.Wrap(err, "create pbuichat plugin")
	}

	widgetPlugin := widgets.NewWidgetPlugin()
	frontendToolPlugin := frontendtools.NewPlugin()
	frontendToolManager := frontendtools.NewManager()
	// pbuichat goes FIRST: the engine stops at the first plugin that reports a
	// runtime event as handled, and the tool-call plugin claims tool events.
	// pbuichat never claims anything, so the others still run after it.
	chatPlugins := []chatapp.ChatPlugin{plugin, plugins.NewReasoningPlugin(), plugins.NewToolCallPlugin(), widgetPlugin, frontendToolPlugin}

	reg := sessionstream.NewSchemaRegistry()
	if err := chatapp.RegisterSchemas(reg, chatPlugins...); err != nil {
		return nil, nil, errors.Wrap(err, "register chat schemas")
	}
	if err := scripted.RegisterSchemas(reg); err != nil {
		return nil, nil, errors.Wrap(err, "register scripted engine schemas")
	}

	timelineSpec := serverkit.StoreSpec{Backend: serverkit.StoreBackendMemory}
	if opts.TimelineDB != "" {
		timelineSpec = serverkit.StoreSpec{Backend: serverkit.StoreBackendSQLite, Path: opts.TimelineDB}
	}
	store, closeStore, err := serverkit.OpenHydrationStore(ctx, timelineSpec, reg)
	if err != nil {
		return nil, nil, errors.Wrap(err, "open hydration store")
	}
	plugin.SetHydrationStore(store)
	turnsSpec := serverkit.StoreSpec{Backend: serverkit.StoreBackendMemory}
	if opts.TurnsDB != "" {
		turnsSpec = serverkit.StoreSpec{Backend: serverkit.StoreBackendSQLite, Path: opts.TurnsDB}
	}
	turnStore, closeTurns, err := serverkit.OpenTurnStore(ctx, serverkit.StoreOptions{Turns: turnsSpec})
	if err != nil {
		_ = closeStore()
		return nil, nil, errors.Wrap(err, "open turn store")
	}
	cleanup := func() error {
		var first error
		for _, fn := range []func() error{closeTurns, closeStore} {
			if fn == nil {
				continue
			}
			if err := fn(); err != nil && first == nil {
				first = err
			}
		}
		return first
	}

	ws, err := wstransport.NewServer(snapshotProvider{store: store}, wstransport.WithSubscribeAuthorizer(func(ctx context.Context, sid sessionstream.SessionId) error {
		principal, ok := principalFromContext(ctx)
		if !ok || !opts.Authorizer.CanAccessSession(ctx, principal, sid, SessionSubscribe) {
			return ErrUnauthorized
		}
		return nil
	}))
	if err != nil {
		_ = cleanup()
		return nil, nil, errors.Wrap(err, "create websocket transport")
	}

	chatEngine := chatapp.NewEngine(
		chatapp.WithChunkDelay(opts.chunkDelay()),
		chatapp.WithPlugins(chatPlugins...),
		chatapp.WithTurnStore(turnStore),
	)
	hub, err := sessionstream.NewHub(
		sessionstream.WithSchemaRegistry(reg),
		sessionstream.WithHydrationStore(store),
		sessionstream.WithUIFanout(ws),
	)
	if err != nil {
		_ = cleanup()
		return nil, nil, errors.Wrap(err, "create hub")
	}
	if err := frontendToolManager.Install(hub); err != nil {
		_ = cleanup()
		return nil, nil, errors.Wrap(err, "install frontend tools")
	}
	if err := plugin.Install(hub); err != nil {
		_ = cleanup()
		return nil, nil, errors.Wrap(err, "install pbuichat trace command")
	}
	scriptedEngine := scripted.New(scripted.Options{
		Plugin:        plugin,
		FrontendTools: frontendToolManager,
		ChunkDelay:    opts.chunkDelay(),
	})
	if err := scriptedEngine.Install(hub); err != nil {
		_ = cleanup()
		return nil, nil, errors.Wrap(err, "install scripted engine")
	}
	if err := chatapp.Install(hub, chatEngine); err != nil {
		_ = cleanup()
		return nil, nil, errors.Wrap(err, "install chatapp projections")
	}
	service, err := chatapp.NewService(hub, chatEngine)
	if err != nil {
		_ = cleanup()
		return nil, nil, errors.Wrap(err, "create chat service")
	}

	sessions := SessionIndex(NewMemorySessionIndex())
	if opts.SessionsDB != "" {
		index, err := NewSQLiteSessionIndex(ctx, opts.SessionsDB)
		if err != nil {
			_ = cleanup()
			return nil, nil, errors.Wrap(err, "open session index")
		}
		sessions = index
	}
	// The index outlives nothing: it is closed with the stores, and a server
	// whose index failed to open would be a server that cannot serve a list —
	// which is worth failing loudly for, unlike an empty list.
	baseCleanup := cleanup
	cleanup = func() error {
		indexErr := sessions.Close()
		if err := baseCleanup(); err != nil {
			return err
		}
		return indexErr
	}

	s := &Server{
		opts:          opts,
		hub:           hub,
		service:       service,
		ws:            ws,
		plugin:        plugin,
		frontendTools: frontendToolManager,
		scripted:      scriptedEngine,
		turnStore:     turnStore,
		sessions:      sessions,
		authorizer:    opts.Authorizer,
		closeFn:       cleanup,
	}
	if opts.RealRuntime {
		realRuntime, err := newRealRuntimeFactory(opts, plugin, frontendToolManager, turnStore)
		if err != nil {
			_ = cleanup()
			return nil, nil, errors.Wrap(err, "create real runtime factory")
		}
		s.real = realRuntime
	}
	return s, cleanup, nil
}

// Plugin exposes the pbuichat plugin (tests, tools).
func (s *Server) Plugin() *pbuichat.Plugin { return s.plugin }

// Close releases resources.
func (s *Server) Close() error {
	if s == nil || s.closeFn == nil {
		return nil
	}
	return s.closeFn()
}

// RegisterRoutes mounts the API on mux. The SPA is mounted separately (and
// last) by the caller so nothing here can shadow it or be shadowed by it.
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", s.HandleHealth)
	mux.HandleFunc("GET /api/chat/health", s.HandleHealth)
	mux.HandleFunc("GET /api/pbui/vocabulary", s.HandleVocabulary)
	mux.HandleFunc("POST /api/chat/sessions", s.requireGlobal(SessionCreate, s.HandleCreateSession))
	mux.HandleFunc("GET /api/chat/sessions", s.requireGlobal(SessionList, s.HandleListSessions))
	mux.HandleFunc("GET /api/chat/sessions/{id}", s.requireSession(SessionRead, s.HandleSessionSnapshot))
	mux.HandleFunc("PATCH /api/chat/sessions/{id}", s.requireSession(SessionRetitle, s.HandleRetitleSession))
	mux.HandleFunc("POST /api/chat/sessions/{id}/messages", s.requireSession(SessionSend, s.HandleSubmitMessage))
	mux.HandleFunc("POST /api/chat/sessions/{id}/stop", s.requireSession(SessionStop, s.HandleStopSession))
	mux.HandleFunc("POST /api/chat/sessions/{id}/tools/manifest", s.requireSession(SessionManifestWrite, s.HandleToolManifest))
	mux.HandleFunc("POST /api/chat/sessions/{id}/tools/results", s.requireSession(SessionResultWrite, s.HandleToolResult))
	mux.HandleFunc("POST /api/chat/sessions/{id}/verbs", s.requireSession(SessionVerbWrite, s.HandleVerbPerformed))
	mux.HandleFunc("POST /api/chat/sessions/{id}/effects", s.requireSession(SessionEffectWrite, s.HandleEffectPerformed))
	mux.HandleFunc("GET /api/chat/ws", s.authenticate(s.HandleWS))
}

func (s *Server) authenticate(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		principal, err := s.authorizer.Authenticate(r)
		if err != nil || principal.Subject == "" {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(w, withPrincipal(r, principal))
	}
}

func (s *Server) requireGlobal(action SessionAction, next http.HandlerFunc) http.HandlerFunc {
	return s.authenticate(func(w http.ResponseWriter, r *http.Request) {
		principal, _ := principalFromContext(r.Context())
		allowed := action == SessionCreate && s.authorizer.CanCreateSession(r.Context(), principal)
		allowed = allowed || action == SessionList && s.authorizer.CanListSessions(r.Context(), principal)
		if !allowed {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
		next(w, r)
	})
}

func (s *Server) requireSession(action SessionAction, next http.HandlerFunc) http.HandlerFunc {
	return s.authenticate(func(w http.ResponseWriter, r *http.Request) {
		principal, _ := principalFromContext(r.Context())
		sid := sessionIDFrom(r)
		if sid == "" {
			writeError(w, http.StatusBadRequest, "missing session id")
			return
		}
		if !s.authorizer.CanAccessSession(r.Context(), principal, sid, action) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
		next(w, r)
	})
}

type snapshotProvider struct {
	store sessionstream.HydrationStore
}

func (p snapshotProvider) Snapshot(ctx context.Context, sid sessionstream.SessionId) (sessionstream.Snapshot, error) {
	if p.store == nil {
		return sessionstream.Snapshot{}, fmt.Errorf("hydration store is nil")
	}
	return p.store.Snapshot(ctx, sid, 0)
}
