package cmds

import (
	"context"
	"fmt"
	"os"

	"github.com/go-go-golems/glazed/pkg/cmds"
	"github.com/go-go-golems/glazed/pkg/cmds/values"
	"github.com/hyperslop-systems/pbui/pkg/chatserver/demo"
	"github.com/hyperslop-systems/pbui/pkg/pbuichat"
	"github.com/pkg/errors"
)

// VocabularyCommand prints the generated system-prompt section, which is the
// fastest way to see what the model is told about the interface.
type VocabularyCommand struct {
	*cmds.CommandDescription
}

var _ cmds.BareCommand = (*VocabularyCommand)(nil)

// NewVocabularyCommand builds the command.
func NewVocabularyCommand() (*VocabularyCommand, error) {
	return &VocabularyCommand{CommandDescription: cmds.NewCommandDescription(
		"prompt",
		cmds.WithShort("Print the PBUI system-prompt section generated from the demo vocabulary"),
	)}, nil
}

// Run implements cmds.BareCommand.
func (c *VocabularyCommand) Run(_ context.Context, _ *values.Values) error {
	vocab, err := demo.Vocabulary()
	if err != nil {
		return errors.Wrap(err, "load demo vocabulary")
	}
	_, err = fmt.Fprint(os.Stdout, pbuichat.SystemPromptSection(vocab))
	return err
}
