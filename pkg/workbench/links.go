package workbench

import (
	"context"
	"fmt"
)

// LinksFormat is the DocumentPayload format of the tile-linking document
// (PBUI-LINK-1): the declarations of which port follows, holds, derives
// from or shares a cell with which — never runtime values.
const LinksFormat = "pbui.links"

// LinksDocumentValidator validates a "pbui.links" payload structurally and
// hands every other format to Next (which may be nil to accept them).
//
// Structural only, on purpose: whether a port exists on a catalog
// application, whether a class is contract-homogeneous, and whether the
// follow graph is acyclic are facts the client kernel refuses before they
// are written; the server checks the SHAPE so a corrupt or hostile payload
// never reaches a browser as data.
type LinksDocumentValidator struct {
	Next DocumentValidator
}

var _ DocumentValidator = LinksDocumentValidator{}

func (v LinksDocumentValidator) ValidateDocument(ctx context.Context, document *DocumentPayload) error {
	if document == nil {
		return fmt.Errorf("document is required")
	}
	if document.Format != LinksFormat {
		if v.Next == nil {
			return nil
		}
		return v.Next.ValidateDocument(ctx, document)
	}
	if document.SchemaVersion != 1 {
		return fmt.Errorf("pbui.links: unsupported schema version %d", document.SchemaVersion)
	}
	if document.Body == nil {
		return fmt.Errorf("pbui.links: body is required")
	}
	return ValidateLinksBody(document.Body.AsMap())
}

var termKinds = map[string]bool{"ambient": true, "constant": true, "follow": true, "alias": true, "derived": true, "hold": true, "unresolved": true}
var mergePolicies = map[string]bool{"prefer-left": true, "prefer-right": true, "require-equal": true}

// ValidateLinksBody checks the JSON shape of a pbui.links body:
// bindings (port → term), identity (declarations), classes, history.
func ValidateLinksBody(body map[string]any) error {
	for key := range body {
		switch key {
		case "bindings", "identity", "classes", "history":
		default:
			return fmt.Errorf("pbui.links: unknown field %q", key)
		}
	}
	if raw, ok := body["bindings"]; ok {
		bindings, ok := raw.(map[string]any)
		if !ok {
			return fmt.Errorf("pbui.links: bindings must be an object")
		}
		for port, term := range bindings {
			if !isPortID(port) {
				return fmt.Errorf("pbui.links: %q is not a port id (viewId/name)", port)
			}
			if err := validateTerm(term, 0); err != nil {
				return fmt.Errorf("pbui.links: bindings[%q]: %w", port, err)
			}
		}
	}
	if raw, ok := body["identity"]; ok {
		list, ok := raw.([]any)
		if !ok {
			return fmt.Errorf("pbui.links: identity must be an array")
		}
		for i, entry := range list {
			decl, ok := entry.(map[string]any)
			if !ok {
				return fmt.Errorf("pbui.links: identity[%d] must be an object", i)
			}
			if !isNonEmptyString(decl["linkId"]) || !isPortIDValue(decl["left"]) || !isPortIDValue(decl["right"]) {
				return fmt.Errorf("pbui.links: identity[%d] needs linkId, left and right port ids", i)
			}
			if policy, _ := decl["mergePolicy"].(string); !mergePolicies[policy] {
				return fmt.Errorf("pbui.links: identity[%d] has an unknown mergePolicy", i)
			}
		}
	}
	if raw, ok := body["classes"]; ok {
		list, ok := raw.([]any)
		if !ok {
			return fmt.Errorf("pbui.links: classes must be an array")
		}
		for i, entry := range list {
			cls, ok := entry.(map[string]any)
			if !ok {
				return fmt.Errorf("pbui.links: classes[%d] must be an object", i)
			}
			if !isNonEmptyString(cls["id"]) || !isNonEmptyString(cls["fingerprint"]) {
				return fmt.Errorf("pbui.links: classes[%d] needs id and fingerprint", i)
			}
			members, ok := cls["members"].([]any)
			if !ok || len(members) < 2 {
				return fmt.Errorf("pbui.links: classes[%d] needs at least two members", i)
			}
			for _, member := range members {
				if !isPortIDValue(member) {
					return fmt.Errorf("pbui.links: classes[%d] has a member that is not a port id", i)
				}
			}
		}
	}
	if raw, ok := body["history"]; ok {
		history, ok := raw.(map[string]any)
		if !ok {
			return fmt.Errorf("pbui.links: history must be an object")
		}
		for port, value := range history {
			if !isPortID(port) {
				return fmt.Errorf("pbui.links: history[%q] is not a port id", port)
			}
			if value != nil && !isReference(value) {
				return fmt.Errorf("pbui.links: history[%q] must be null or a reference", port)
			}
		}
	}
	return nil
}

func validateTerm(term any, depth int) error {
	if depth > 8 {
		return fmt.Errorf("term nests too deeply")
	}
	object, ok := term.(map[string]any)
	if !ok {
		return fmt.Errorf("term must be an object")
	}
	kind, _ := object["kind"].(string)
	if !termKinds[kind] {
		return fmt.Errorf("unknown term kind %q", kind)
	}
	switch kind {
	case "ambient":
		if !isNonEmptyString(object["key"]) {
			return fmt.Errorf("ambient needs a key")
		}
	case "constant":
		if !isReference(object["reference"]) {
			return fmt.Errorf("constant needs a reference")
		}
	case "follow":
		if !isPortIDValue(object["source"]) || !isNonEmptyString(object["linkId"]) {
			return fmt.Errorf("follow needs a source port id and a linkId")
		}
	case "alias":
		if !isNonEmptyString(object["classId"]) {
			return fmt.Errorf("alias needs a classId")
		}
	case "derived":
		if !isNonEmptyString(object["relationId"]) || !isNonEmptyString(object["linkId"]) {
			return fmt.Errorf("derived needs a relationId and a linkId")
		}
		if err := validateTerm(object["source"], depth+1); err != nil {
			return fmt.Errorf("derived source: %w", err)
		}
	case "hold":
		if !isReference(object["reference"]) {
			return fmt.Errorf("hold needs a reference")
		}
		if err := validateTerm(object["suspended"], depth+1); err != nil {
			return fmt.Errorf("hold suspended: %w", err)
		}
	case "unresolved":
		diagnostic, ok := object["diagnostic"].(map[string]any)
		if !ok || !isNonEmptyString(diagnostic["code"]) {
			return fmt.Errorf("unresolved needs a diagnostic with a code")
		}
	}
	return nil
}

func isNonEmptyString(value any) bool {
	s, ok := value.(string)
	return ok && s != ""
}

func isPortID(id string) bool {
	for i, r := range id {
		if r == '/' {
			return i > 0 && i < len(id)-1
		}
	}
	return false
}

func isPortIDValue(value any) bool {
	s, ok := value.(string)
	return ok && isPortID(s)
}

func isReference(value any) bool {
	object, ok := value.(map[string]any)
	if !ok {
		return false
	}
	_, hasValue := object["value"]
	return isNonEmptyString(object["type"]) && hasValue
}
