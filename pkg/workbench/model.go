// Package workbench validates and mutates the generated PBUI workbench graph.
//
// It deliberately contains no storage, HTTP, authentication, or UI code.
// Hosts provide an application catalog and document validator.
package workbench

import (
	"context"

	workbenchv1 "github.com/hyperslop-systems/pbui/gen/go/hyperslop/pbui/workbench/v1"
)

const (
	Format        = "pbui.workbench"
	SchemaVersion = 1
)

// Aliases keep semantic code concise without defining a second wire model.
type (
	Document        = workbenchv1.WorkbenchDocument
	Workspace       = workbenchv1.Workspace
	Node            = workbenchv1.Node
	AppView         = workbenchv1.AppView
	DocumentPayload = workbenchv1.DocumentPayload
	Mutation        = workbenchv1.Mutation
)

// BindingRule describes one named document binding supported by an app.
type BindingRule struct {
	Required bool
}

// ApplicationDescriptor is the server-visible portion of an application.
type ApplicationDescriptor struct {
	ID               string
	Singleton        bool
	DocumentBindings map[string]BindingRule
}

// ApplicationCatalog supplies the host application's registered apps.
type ApplicationCatalog interface {
	LookupApplication(ctx context.Context, id string) (ApplicationDescriptor, bool)
}

// DocumentValidator validates one host-specific document payload.
type DocumentValidator interface {
	ValidateDocument(ctx context.Context, document *DocumentPayload) error
}

// Dependencies are the host-specific inputs to validation.
type Dependencies struct {
	Applications ApplicationCatalog
	Documents    DocumentValidator
}

// Limits bound untrusted snapshots and recursive traversal.
type Limits struct {
	Bytes            int
	Workspaces       int
	Nodes            int
	Depth            int
	Views            int
	Documents        int
	NameBytes        int
	TitleBytes       int
	DocumentBytes    int
	DocumentBindings int
}

// DefaultLimits are intentionally conservative for an interactive workbench.
var DefaultLimits = Limits{
	Bytes:            2 << 20,
	Workspaces:       32,
	Nodes:            256,
	Depth:            24,
	Views:            128,
	Documents:        128,
	NameBytes:        256,
	TitleBytes:       512,
	DocumentBytes:    512 << 10,
	DocumentBindings: 8,
}
