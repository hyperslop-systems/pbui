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
	closeFn       func() error
}

// NewServer wires everything. The returned cleanup closes the stores.
func NewServer(ctx context.Context, opts Options) (*Server, func() error, error) {
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
	chatPlugins := []chatapp.ChatPlugin{plugins.NewReasoningPlugin(), plugins.NewToolCallPlugin(), widgetPlugin, frontendToolPlugin, plugin}

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

	ws, err := wstransport.NewServer(snapshotProvider{store: store})
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

	s := &Server{
		opts:          opts,
		hub:           hub,
		service:       service,
		ws:            ws,
		plugin:        plugin,
		frontendTools: frontendToolManager,
		scripted:      scriptedEngine,
		turnStore:     turnStore,
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
	mux.HandleFunc("POST /api/chat/sessions", s.HandleCreateSession)
	mux.HandleFunc("GET /api/chat/sessions/{id}", s.HandleSessionSnapshot)
	mux.HandleFunc("POST /api/chat/sessions/{id}/messages", s.HandleSubmitMessage)
	mux.HandleFunc("POST /api/chat/sessions/{id}/stop", s.HandleStopSession)
	mux.HandleFunc("POST /api/chat/sessions/{id}/tools/manifest", s.HandleToolManifest)
	mux.HandleFunc("POST /api/chat/sessions/{id}/tools/results", s.HandleToolResult)
	mux.HandleFunc("POST /api/chat/sessions/{id}/verbs", s.HandleVerbPerformed)
	mux.HandleFunc("GET /api/chat/ws", s.HandleWS)
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
