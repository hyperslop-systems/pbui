package chatserver

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/go-go-golems/geppetto/pkg/inference/engine"
	"github.com/go-go-golems/geppetto/pkg/inference/middleware"
	geptools "github.com/go-go-golems/geppetto/pkg/inference/tools"
	"github.com/go-go-golems/geppetto/pkg/turns"
	"github.com/go-go-golems/geppetto/pkg/turns/serde"
	"github.com/go-go-golems/glazed/pkg/cmds/values"
	chatapp "github.com/go-go-golems/pinocchio/pkg/chatapp"
	"github.com/go-go-golems/pinocchio/pkg/chatapp/frontendtools"
	"github.com/go-go-golems/pinocchio/pkg/cmds/profilebootstrap"
	infruntime "github.com/go-go-golems/pinocchio/pkg/inference/runtime"
	chatstore "github.com/go-go-golems/pinocchio/pkg/persistence/chatstore"
	sessionstream "github.com/go-go-golems/sessionstream/pkg/sessionstream"
	"github.com/hyperslop-systems/pbui/pkg/pbuichat"
	"github.com/pkg/errors"
)

// realRuntimeFactory resolves a pinocchio profile into a geppetto engine with
// the PBUI tools and the generated system-prompt section. Modelled on
// react-chat's chat-overlay real runtime.
type realRuntimeFactory struct {
	profile           string
	profileRegistries []string
	configFile        string
	parsedValues      *values.Values
	systemPrompt      string
	tools             func(registry geptools.ToolRegistry, sid sessionstream.SessionId) error
	plugin            *pbuichat.Plugin
	frontendTools     *frontendtools.Manager
	turnStore         chatstore.TurnStore
}

func newRealRuntimeFactory(opts Options, plugin *pbuichat.Plugin, frontendTools *frontendtools.Manager, turnStore chatstore.TurnStore) (*realRuntimeFactory, error) {
	profile := strings.TrimSpace(opts.Profile)
	if profile == "" {
		return nil, errors.New("--real-runtime requires --profile")
	}
	prompt := strings.TrimSpace(opts.SystemPrompt)
	if prompt == "" {
		prompt = "You are the inventory assistant of a precious-metals coin shop. Answer concisely and ground every claim in the objects you name."
	}
	return &realRuntimeFactory{
		profile:           profile,
		profileRegistries: append([]string(nil), opts.ProfileRegistries...),
		configFile:        strings.TrimSpace(opts.ConfigFile),
		parsedValues:      opts.ParsedValues,
		systemPrompt:      prompt + "\n\n" + pbuichat.SystemPromptSection(plugin.Vocabulary()),
		tools:             opts.Tools,
		plugin:            plugin,
		frontendTools:     frontendTools,
		turnStore:         turnStore,
	}, nil
}

func (f *realRuntimeFactory) promptRequest(ctx context.Context, sid sessionstream.SessionId, prompt string) (chatapp.PromptRequest, error) {
	parsed := f.parsedValues
	if parsed == nil {
		var err error
		parsed, err = profilebootstrap.NewCLISelectionValues(profilebootstrap.CLISelectionInput{
			ConfigFile:        f.configFile,
			Profile:           f.profile,
			ProfileRegistries: f.profileRegistries,
		})
		if err != nil {
			return chatapp.PromptRequest{}, errors.Wrap(err, "create profile selection values")
		}
	}
	resolved, err := profilebootstrap.ResolveCLIEngineSettings(ctx, parsed)
	if err != nil {
		return chatapp.PromptRequest{}, errors.Wrapf(err, "resolve pinocchio profile %q", f.profile)
	}
	defer func() {
		if resolved.Close != nil {
			resolved.Close()
		}
	}()
	baseEngine, err := profilebootstrap.NewEngineFromResolvedCLIEngineSettings(resolved)
	if err != nil {
		return chatapp.PromptRequest{}, errors.Wrapf(err, "build engine from profile %q", f.profile)
	}
	engine := withMiddlewares(baseEngine, middleware.NewSystemPromptMiddleware(f.systemPrompt))

	registry := geptools.NewInMemoryToolRegistry()
	if err := f.plugin.RegisterTools(registry, sid); err != nil {
		return chatapp.PromptRequest{}, errors.Wrap(err, "register pbui tools")
	}
	if f.tools != nil {
		if err := f.tools(registry, sid); err != nil {
			return chatapp.PromptRequest{}, errors.Wrap(err, "register product tools")
		}
	}
	if f.frontendTools != nil {
		if err := f.frontendTools.RegisterManifestTools(sid, registry); err != nil {
			return chatapp.PromptRequest{}, errors.Wrap(err, "register frontend manifest tools")
		}
	}
	bridge := frontendtools.NewBridgeExecutor(f.frontendTools, nil)
	runtimeKey := f.profile
	if resolved != nil && resolved.ProfileRuntime != nil {
		if p := strings.TrimSpace(resolved.ProfileRuntime.ProfileSettings.Profile); p != "" {
			runtimeKey = p
		}
	}
	return chatapp.PromptRequest{
		Prompt:      prompt,
		OnFinalTurn: f.persistFinalTurn(sid, runtimeKey),
		Runtime: &infruntime.ComposedRuntime{
			Engine:       engine,
			Registry:     registry,
			ToolExecutor: bridge,
			RuntimeKey:   runtimeKey,
		},
		RuntimeContext: func(ctx context.Context, sid sessionstream.SessionId, messageID string, pub sessionstream.EventPublisher) context.Context {
			return frontendtools.WithBridgeContext(ctx, frontendtools.BridgeContext{SessionID: sid, MessageID: messageID, Publisher: pub})
		},
	}, nil
}

func (f *realRuntimeFactory) persistFinalTurn(sid sessionstream.SessionId, runtimeKey string) func(*turns.Turn) {
	return func(t *turns.Turn) {
		if f.turnStore == nil || t == nil {
			return
		}
		payload, err := serde.ToYAML(t, serde.Options{})
		if err != nil {
			log.Error().Err(err).Str("session_id", string(sid)).Msg("pbui-chat: serialize final turn")
			return
		}
		turnID := strings.TrimSpace(t.ID)
		if turnID == "" {
			turnID = fmt.Sprintf("turn-%d", time.Now().UnixNano())
		}
		if err := f.turnStore.Save(context.Background(), string(sid), string(sid), turnID, "final", time.Now().UnixMilli(), string(payload), chatstore.TurnSaveOptions{RuntimeKey: runtimeKey}); err != nil {
			log.Error().Err(err).Str("session_id", string(sid)).Msg("pbui-chat: persist final turn")
		}
	}
}

// engineWithMiddlewares wraps a provider engine in a middleware chain. The
// equivalent helper in geppetto's enginebuilder is unexported; the shape is
// small enough to restate.
type engineWithMiddlewares struct {
	handler middleware.HandlerFunc
}

var _ engine.Engine = (*engineWithMiddlewares)(nil)

func withMiddlewares(base engine.Engine, mws ...middleware.Middleware) engine.Engine {
	if len(mws) == 0 {
		return base
	}
	handler := func(ctx context.Context, t *turns.Turn) (*turns.Turn, error) {
		return base.RunInference(ctx, t)
	}
	return &engineWithMiddlewares{handler: middleware.Chain(handler, mws...)}
}

// RunInference implements engine.Engine.
func (e *engineWithMiddlewares) RunInference(ctx context.Context, t *turns.Turn) (*turns.Turn, error) {
	return e.handler(ctx, t)
}
