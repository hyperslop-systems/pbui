package workbench

import (
	"context"
	"fmt"
	"math"
	"strings"
	"unicode"
	"unicode/utf8"

	workbenchv1 "github.com/hyperslop-systems/pbui/gen/go/hyperslop/pbui/workbench/v1"
	"google.golang.org/protobuf/encoding/protojson"
)

var canonicalJSON = protojson.MarshalOptions{
	UseProtoNames:   false,
	EmitUnpopulated: false,
}

// Validate checks the complete normalized graph.
func Validate(ctx context.Context, document *Document, deps Dependencies, limits Limits) error {
	if ctx == nil {
		return invalid("context_required", "", "context is required")
	}
	if document == nil {
		return invalid("document_required", "", "workbench is required")
	}
	if limits == (Limits{}) {
		limits = DefaultLimits
	}
	if document.Format != Format {
		return invalid("unsupported_format", "format", "got %q, want %q", document.Format, Format)
	}
	if document.SchemaVersion != SchemaVersion {
		return invalid("unsupported_version", "schemaVersion", "got %d, want %d", document.SchemaVersion, SchemaVersion)
	}
	if err := validText("id", document.Id, limits.NameBytes, false); err != nil {
		return err
	}
	if err := validText("name", document.Name, limits.NameBytes, false); err != nil {
		return err
	}
	encoded, err := canonicalJSON.Marshal(document)
	if err != nil {
		return invalid("invalid_json", "", "%v", err)
	}
	if len(encoded) > limits.Bytes {
		return invalid("limit_exceeded", "", "snapshot has %d bytes; limit is %d", len(encoded), limits.Bytes)
	}
	if len(document.Workspaces) == 0 {
		return invalid("workspace_required", "workspaces", "at least one workspace is required")
	}
	if len(document.Workspaces) > limits.Workspaces {
		return invalid("limit_exceeded", "workspaces", "found %d; limit is %d", len(document.Workspaces), limits.Workspaces)
	}
	if len(document.Views) > limits.Views {
		return invalid("limit_exceeded", "views", "found %d; limit is %d", len(document.Views), limits.Views)
	}
	if len(document.Documents) > limits.Documents {
		return invalid("limit_exceeded", "documents", "found %d; limit is %d", len(document.Documents), limits.Documents)
	}

	nodeIDs := map[string]string{}
	workspaceIDs := map[string]struct{}{}
	nodeCount := 0
	for i, workspace := range document.Workspaces {
		path := fmt.Sprintf("workspaces[%d]", i)
		if workspace == nil {
			return invalid("invalid_workspace", path, "workspace is required")
		}
		if err := validText(path+".id", workspace.Id, limits.NameBytes, false); err != nil {
			return err
		}
		if _, exists := workspaceIDs[workspace.Id]; exists {
			return invalid("duplicate_id", path+".id", "workspace ID %q is duplicated", workspace.Id)
		}
		workspaceIDs[workspace.Id] = struct{}{}
		if err := validText(path+".name", workspace.Name, limits.NameBytes, false); err != nil {
			return err
		}
		if err := validateNode(workspace.Tree, path+".tree", 1, limits, nodeIDs, &nodeCount, document.Views); err != nil {
			return err
		}
	}

	if len(document.ViewOrder) != len(document.Views) {
		return invalid("view_order_mismatch", "viewOrder", "contains %d IDs for %d views", len(document.ViewOrder), len(document.Views))
	}
	ordered := map[string]struct{}{}
	singletons := map[string]string{}
	for i, id := range document.ViewOrder {
		path := fmt.Sprintf("viewOrder[%d]", i)
		if _, duplicate := ordered[id]; duplicate {
			return invalid("duplicate_id", path, "view ID %q occurs more than once", id)
		}
		if _, exists := document.Views[id]; !exists {
			return invalid("unknown_view", path, "view %q does not exist", id)
		}
		ordered[id] = struct{}{}
	}

	for key, view := range document.Views {
		path := fmt.Sprintf("views[%q]", key)
		if view == nil {
			return invalid("invalid_view", path, "view is required")
		}
		if key != view.Id {
			return invalid("id_mismatch", path+".id", "map key %q disagrees with embedded ID %q", key, view.Id)
		}
		if _, exists := ordered[key]; !exists {
			return invalid("view_order_mismatch", path, "view is absent from viewOrder")
		}
		if err := validText(path+".id", view.Id, limits.NameBytes, false); err != nil {
			return err
		}
		if err := validText(path+".appId", view.AppId, limits.NameBytes, false); err != nil {
			return err
		}
		if view.Title != nil {
			if err := validText(path+".title", *view.Title, limits.TitleBytes, false); err != nil {
				return err
			}
			if strings.TrimSpace(*view.Title) != *view.Title {
				return invalid("noncanonical_title", path+".title", "title must be trimmed")
			}
		}
		if len(view.Documents) > limits.DocumentBindings {
			return invalid("limit_exceeded", path+".documents", "found %d bindings; limit is %d", len(view.Documents), limits.DocumentBindings)
		}
		if deps.Applications == nil {
			return invalid("application_catalog_required", path+".appId", "application catalog is required")
		}
		app, ok := deps.Applications.LookupApplication(ctx, view.AppId)
		if !ok {
			return invalid("unknown_application", path+".appId", "application %q is not registered", view.AppId)
		}
		if app.Singleton {
			if first, exists := singletons[view.AppId]; exists {
				return invalid("duplicate_singleton", path+".appId", "application %q already has view %q", view.AppId, first)
			}
			singletons[view.AppId] = view.Id
		}
		for binding, documentID := range view.Documents {
			bindingPath := fmt.Sprintf("%s.documents[%q]", path, binding)
			if _, known := app.DocumentBindings[binding]; !known {
				return invalid("unknown_binding", bindingPath, "application %q does not define binding %q", view.AppId, binding)
			}
			if _, exists := document.Documents[documentID]; !exists {
				return invalid("unknown_document", bindingPath, "document %q does not exist", documentID)
			}
		}
		for binding, rule := range app.DocumentBindings {
			if rule.Required && view.Documents[binding] == "" {
				return invalid("required_binding", path+".documents", "application %q requires binding %q", view.AppId, binding)
			}
		}
	}

	if deps.Documents == nil && len(document.Documents) > 0 {
		return invalid("document_validator_required", "documents", "document validator is required")
	}
	for key, payload := range document.Documents {
		path := fmt.Sprintf("documents[%q]", key)
		if payload == nil {
			return invalid("invalid_document", path, "document is required")
		}
		if err := validText(path, key, limits.NameBytes, false); err != nil {
			return err
		}
		if key != payload.Id {
			return invalid("id_mismatch", path+".id", "map key %q disagrees with embedded ID %q", key, payload.Id)
		}
		raw, err := canonicalJSON.Marshal(payload)
		if err != nil {
			return invalid("invalid_document", path, "%v", err)
		}
		if len(raw) > limits.DocumentBytes {
			return invalid("limit_exceeded", path, "document has %d bytes; limit is %d", len(raw), limits.DocumentBytes)
		}
		if payload.Body == nil {
			return invalid("invalid_document", path+".body", "document body is required")
		}
		if hasCredentialKey(payload.Body.AsMap()) {
			return invalid("credential_field", path, "document contains a credential-shaped field")
		}
		if err := deps.Documents.ValidateDocument(ctx, payload); err != nil {
			return invalid("invalid_document", path, "%v", err)
		}
	}
	return nil
}

func validateNode(
	node *Node,
	path string,
	depth int,
	limits Limits,
	nodeIDs map[string]string,
	nodeCount *int,
	views map[string]*AppView,
) error {
	if node == nil {
		return invalid("invalid_node", path, "node is required")
	}
	if depth > limits.Depth {
		return invalid("limit_exceeded", path, "tree depth exceeds %d", limits.Depth)
	}
	*nodeCount++
	if *nodeCount > limits.Nodes {
		return invalid("limit_exceeded", path, "node count exceeds %d", limits.Nodes)
	}
	if err := validText(path+".id", node.Id, limits.NameBytes, false); err != nil {
		return err
	}
	if first, exists := nodeIDs[node.Id]; exists {
		return invalid("duplicate_id", path+".id", "node ID %q was already used at %s", node.Id, first)
	}
	nodeIDs[node.Id] = path

	switch body := node.Body.(type) {
	case *workbenchv1.Node_Leaf:
		if body.Leaf == nil || body.Leaf.ViewId == "" {
			return invalid("invalid_leaf", path+".leaf.viewId", "leaf must reference a view")
		}
		if _, exists := views[body.Leaf.ViewId]; !exists {
			return invalid("unknown_view", path+".leaf.viewId", "view %q does not exist", body.Leaf.ViewId)
		}
	case *workbenchv1.Node_Split:
		if body.Split == nil {
			return invalid("invalid_split", path+".split", "split is required")
		}
		split := body.Split
		if split.Direction != workbenchv1.Direction_DIRECTION_ROW &&
			split.Direction != workbenchv1.Direction_DIRECTION_COLUMN {
			return invalid("invalid_split", path+".split.direction", "got %q", split.Direction)
		}
		if math.IsNaN(split.Ratio) || math.IsInf(split.Ratio, 0) ||
			split.Ratio < 0.05 || split.Ratio > 0.95 {
			return invalid("invalid_split", path+".split.ratio", "ratio must be between 0.05 and 0.95")
		}
		if split.A == nil || split.B == nil {
			return invalid("invalid_split", path+".split", "split requires exactly two children")
		}
		if err := validateNode(split.A, path+".split.a", depth+1, limits, nodeIDs, nodeCount, views); err != nil {
			return err
		}
		if err := validateNode(split.B, path+".split.b", depth+1, limits, nodeIDs, nodeCount, views); err != nil {
			return err
		}
	default:
		return invalid("invalid_node", path+".body", "node body is required")
	}
	return nil
}

func validText(path, value string, maxBytes int, allowEmpty bool) error {
	if !utf8.ValidString(value) {
		return invalid("invalid_utf8", path, "value is not valid UTF-8")
	}
	if !allowEmpty && strings.TrimSpace(value) == "" {
		return invalid("required", path, "value is required")
	}
	if len(value) > maxBytes {
		return invalid("limit_exceeded", path, "value has %d bytes; limit is %d", len(value), maxBytes)
	}
	return nil
}

func hasCredentialKey(value any) bool {
	switch typed := value.(type) {
	case map[string]any:
		for key, child := range typed {
			switch normalizedCredentialKey(key) {
			case "token", "accesstoken", "refreshtoken", "password", "secret", "apikey", "authorization":
				return true
			}
			if hasCredentialKey(child) {
				return true
			}
		}
	case []any:
		for _, child := range typed {
			if hasCredentialKey(child) {
				return true
			}
		}
	}
	return false
}

func normalizedCredentialKey(key string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			return unicode.ToLower(r)
		}
		return -1
	}, key)
}
