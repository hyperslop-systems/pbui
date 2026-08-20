// Command pbui-chat serves the PBUI-native chat agent: a scripted demo engine
// by default, a real pinocchio/geppetto profile with --real-runtime.
package main

import (
	"github.com/go-go-golems/glazed/pkg/cli"
	"github.com/go-go-golems/glazed/pkg/cmds/logging"
	"github.com/go-go-golems/glazed/pkg/cmds/schema"
	"github.com/go-go-golems/glazed/pkg/help"
	help_cmd "github.com/go-go-golems/glazed/pkg/help/cmd"
	"github.com/hyperslop-systems/pbui/cmd/pbui-chat/cmds"
	"github.com/spf13/cobra"
)

const (
	appName        = "pbui-chat"
	profileAppName = "pinocchio"
)

func main() {
	rootCmd := &cobra.Command{
		Use:           appName,
		Short:         "PBUI-native chat agent server",
		SilenceUsage:  true,
		SilenceErrors: true,
		PersistentPreRunE: func(cmd *cobra.Command, _ []string) error {
			return logging.InitLoggerFromCobra(cmd)
		},
	}
	cobra.CheckErr(logging.AddLoggingSectionToRootCommand(rootCmd, appName))

	helpSystem := help.NewHelpSystem()
	help_cmd.SetupCobraRootCommand(helpSystem, rootCmd)

	serveCmd, err := cmds.NewServeCommand()
	cobra.CheckErr(err)
	cobraServe, err := cli.BuildCobraCommandFromCommand(
		serveCmd,
		// Pinocchio's app name so --profile/--profile-registries and the
		// ~/.config/pinocchio registry conventions apply unchanged.
		cli.WithParserConfig(cli.CobraParserConfig{AppName: profileAppName}),
		cli.WithCobraShortHelpSections(schema.DefaultSlug),
	)
	cobra.CheckErr(err)
	rootCmd.AddCommand(cobraServe)

	vocabCmd, err := cmds.NewVocabularyCommand()
	cobra.CheckErr(err)
	cobraVocab, err := cli.BuildCobraCommandFromCommand(vocabCmd)
	cobra.CheckErr(err)
	rootCmd.AddCommand(cobraVocab)

	cobra.CheckErr(rootCmd.Execute())
}
