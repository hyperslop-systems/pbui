package cmds

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-go-golems/glazed/pkg/cli"
	"github.com/go-go-golems/glazed/pkg/cmds"
	"github.com/go-go-golems/glazed/pkg/cmds/fields"
	"github.com/go-go-golems/glazed/pkg/cmds/schema"
	"github.com/go-go-golems/glazed/pkg/cmds/values"
	"github.com/go-go-golems/pinocchio/pkg/cmds/profilebootstrap"
	"github.com/hyperslop-systems/pbui/pkg/chatserver"
	"github.com/hyperslop-systems/pbui/pkg/chatui"
	"github.com/pkg/errors"
	"github.com/rs/zerolog/log"
)

// ServeCommand starts the HTTP server.
type ServeCommand struct {
	*cmds.CommandDescription
}

var _ cmds.BareCommand = (*ServeCommand)(nil)

// ServeSettings are the serve flags.
type ServeSettings struct {
	Host           string `glazed:"host"`
	Port           int    `glazed:"port"`
	TimelineDB     string `glazed:"timeline-db"`
	TurnsDB        string `glazed:"turns-db"`
	ChunkDelay     string `glazed:"chunk-delay"`
	UseRealRuntime bool   `glazed:"real-runtime"`
	SystemPrompt   string `glazed:"system-prompt"`
}

// NewServeCommand builds the serve command.
func NewServeCommand() (*ServeCommand, error) {
	commandSettingsSection, err := cli.NewCommandSettingsSection()
	if err != nil {
		return nil, errors.Wrap(err, "create command settings section")
	}
	profileSettingsSection, err := profilebootstrap.NewProfileSettingsSection()
	if err != nil {
		return nil, errors.Wrap(err, "create pinocchio profile settings section")
	}
	desc := cmds.NewCommandDescription(
		"serve",
		cmds.WithShort("Start the PBUI chat agent server"),
		cmds.WithLong(`Start the PBUI chat agent server.

By default the scripted demo engine answers, so the browser and CI need no
model credentials. Pass --real-runtime with a pinocchio --profile to run real
inference with the PBUI tools (pbui_widget, pbui_trace, pbui_describe_types)
and the generated system-prompt section.

  pbui-chat serve --port 8090
  pbui-chat serve --real-runtime --profile gpt-5-mini-low --log-level debug
`),
		cmds.WithFlags(
			fields.New("host", fields.TypeString, fields.WithDefault("127.0.0.1"), fields.WithHelp("Listen address")),
			fields.New("port", fields.TypeInteger, fields.WithDefault(8090), fields.WithHelp("Listen port")),
			fields.New("timeline-db", fields.TypeString, fields.WithDefault(""), fields.WithHelp("SQLite path for the hydration store (empty = in-memory)")),
			fields.New("turns-db", fields.TypeString, fields.WithDefault(""), fields.WithHelp("SQLite path for final-turn history (empty = in-memory)")),
			fields.New("chunk-delay", fields.TypeString, fields.WithDefault("20ms"), fields.WithHelp("Pacing of the scripted engine's text stream")),
			fields.New("real-runtime", fields.TypeBool, fields.WithDefault(false), fields.WithHelp("Use a pinocchio profile instead of the scripted engine")),
			fields.New("system-prompt", fields.TypeString, fields.WithDefault(""), fields.WithHelp("Product system prompt for the real runtime; the PBUI section is appended")),
		),
		cmds.WithSections(commandSettingsSection, profileSettingsSection),
	)
	return &ServeCommand{CommandDescription: desc}, nil
}

// Run implements cmds.BareCommand.
func (c *ServeCommand) Run(ctx context.Context, parsed *values.Values) error {
	settings := &ServeSettings{}
	if err := parsed.DecodeSectionInto(schema.DefaultSlug, settings); err != nil {
		return errors.Wrap(err, "decode serve settings")
	}
	chunkDelay, err := time.ParseDuration(settings.ChunkDelay)
	if err != nil {
		return errors.Wrap(err, "parse --chunk-delay")
	}
	profileSettings := &profilebootstrap.ProfileSettings{}
	if err := parsed.DecodeSectionInto(profilebootstrap.ProfileSettingsSectionSlug, profileSettings); err != nil {
		return errors.Wrap(err, "decode profile settings")
	}

	ctx, stop := signal.NotifyContext(ctx, syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	server, cleanup, err := chatserver.NewServer(ctx, chatserver.Options{
		TimelineDB:        settings.TimelineDB,
		TurnsDB:           settings.TurnsDB,
		ChunkDelay:        chunkDelay,
		RealRuntime:       settings.UseRealRuntime,
		Profile:           profileSettings.Profile,
		ProfileRegistries: profileSettings.ProfileRegistries,
		ParsedValues:      parsed,
		SystemPrompt:      settings.SystemPrompt,
	})
	if err != nil {
		return err
	}
	defer func() { _ = cleanup() }()

	public, err := chatui.PublicFS()
	if err != nil {
		return errors.Wrap(err, "open UI bundle")
	}
	mux := http.NewServeMux()
	server.RegisterRoutes(mux)
	chatui.RegisterSPA(mux, public)

	addr := net.JoinHostPort(settings.Host, fmt.Sprintf("%d", settings.Port))
	httpServer := &http.Server{Addr: addr, Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	errCh := make(chan error, 1)
	go func() {
		log.Info().Str("addr", "http://"+addr).Bool("embedded_ui", chatui.Embedded).Bool("real_runtime", settings.UseRealRuntime).Msg("pbui-chat listening")
		errCh <- httpServer.ListenAndServe()
	}()
	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return httpServer.Shutdown(shutdownCtx)
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}
