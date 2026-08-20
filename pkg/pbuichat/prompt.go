package pbuichat

import (
	"fmt"
	"sort"
	"strings"
)

// Workbench tool names. These tools are FRONTEND tools: the browser
// advertises them in its manifest and pinocchio's bridge registers them for
// the model, so nothing in this package implements them. They are named here
// because the generated prompt has to tell the model they exist, and one
// misspelling between the prompt and the browser is a tool the model calls
// and never reaches.
const (
	ToolWorkbenchDescribe        = "workbench_describe"
	ToolWorkbenchCreateWorkspace = "workbench_create_workspace"
	ToolWorkbenchOpenTile        = "workbench_open_tile"
	ToolWorkbenchPerform         = "workbench_perform"
	ToolWorkbenchSwitchWorkspace = "workbench_switch_workspace"
)

// SystemPromptSection renders the model-facing description of the vocabulary.
// It is generated so that adding a type to the registry changes the model's
// instructions without anyone editing prose.
func SystemPromptSection(v *Vocabulary) string {
	if v == nil {
		return ""
	}
	var b strings.Builder
	b.WriteString("## Objects and verbs (PBUI)\n")
	b.WriteString("You are talking to a user through a presentation-based interface. Every concrete object you name becomes a live, clickable object with its own menu. Write an object as a mention: [[type:id|label]]. Known types and what identifies them:\n")
	for _, name := range v.TypeNames() {
		t := v.Types[name]
		if name == "unresolved" {
			continue
		}
		line := fmt.Sprintf("  %-12s %s", name, t.Doc)
		if t.IDHint != "" {
			line += fmt.Sprintf("; id = %s", t.IDHint)
		}
		if t.Example != "" {
			line += fmt.Sprintf("; e.g. %s", t.Example)
		}
		b.WriteString(line + "\n")
	}
	b.WriteString("Never invent ids. The interface resolves mentions server-side; an unknown id is shown to the user as unresolved.\n")
	b.WriteString("To show structured results, call " + ToolWidget + " with a widget document (format pbui.widget, schema_version 1). Child kinds: " + strings.Join(v.Widget.Kinds, ", ") + ". Prefer a widget over an ASCII table. A table child mints [[field:<docId>.<column>]] and [[row:<docId>#<i>]] objects automatically.\n")
	b.WriteString("A minimal valid document: {\"format\":\"pbui.widget\",\"schema_version\":1,\"title\":\"Low stock\",\"layout\":\"stack\",\"children\":[{\"kind\":\"table\",\"docId\":\"t1\",\"columns\":[{\"name\":\"sku\",\"type\":\"n\"},{\"name\":\"qty\",\"type\":\"q\"}],\"rows\":[[\"2049\",3]]}],\"verbs\":[{\"label\":\"Watch 2049\",\"verb\":{\"kind\":\"watch\",\"ref\":{\"type\":\"product\",\"id\":\"2049\"}}}]}. Tool results that contain rows are projected into a table widget for you automatically; do not repeat them as a widget.\n")
	b.WriteString("Offer next steps as verbs in the document's `verbs` list. Only these verb kinds exist (fields in braces; a trailing ? marks optional):\n")
	for _, kind := range v.VerbKinds() {
		spec := v.Verbs[kind]
		fields := make([]string, 0, len(spec.Fields))
		for f, t := range spec.Fields {
			fields = append(fields, f+":"+t)
		}
		sort.Strings(fields)
		line := fmt.Sprintf("  %s{%s} — %s", kind, strings.Join(fields, ", "), spec.Doc)
		if spec.Danger {
			line += " (consequential: only a human may perform it)"
		}
		b.WriteString(line + "\n")
	}
	b.WriteString("To ask the user to choose an object, call " + ToolAccept + " with the types you accept; the user clicks any matching object on screen and you receive the reference. To ask for approval before a consequential action, call " + ToolPropose + ". To recall what the user did, call " + ToolTrace + ".\n")
	b.WriteString("The user's message may end with a `pbui-refs` section listing objects they pointed at; treat those as authoritative and refer to them by their mentions.\n")
	b.WriteString(workbenchSection(v))
	return b.String()
}

// workbenchSection describes the user's screen, and is emitted only for a
// product that declares a `tile` type. A product whose UI is a fixed layout
// has no workbench tools in its manifest, and telling its model about
// workspaces would invite calls that go nowhere.
func workbenchSection(v *Vocabulary) string {
	if !v.KnowsType("tile") {
		return ""
	}
	var b strings.Builder
	b.WriteString("\n## The workspace\n")
	b.WriteString("The user's screen is a workbench: one or more workspaces, each a tree of tiles, each tile showing one application. ")
	b.WriteString("Call " + ToolWorkbenchDescribe + " before changing anything — it returns the application ids, the placement ids and the current layout. Never invent an id; every id you use must have come from a tool result.\n")
	b.WriteString("To build a whole screen at once, call " + ToolWorkbenchCreateWorkspace + " with a layout. A tile is {\"kind\":\"tile\",\"appId\":\"...\"} and a split is {\"kind\":\"split\",\"direction\":\"row\"|\"col\",\"ratio\":0.5,\"a\":...,\"b\":...}, where \"row\" places a and b side by side, \"col\" stacks them, and ratio is a's share between 0.1 and 0.9. ")
	// The worked example is not decoration. PBUI-AGENT-1 recorded the model
	// guessing a shape for pbui_widget and failing until the description
	// carried a complete, valid value; the same fix applies to any nested
	// argument a model has to construct in one shot.
	b.WriteString("For example: {\"name\":\"Gold desk\",\"layout\":{\"kind\":\"split\",\"direction\":\"row\",\"ratio\":0.55,\"a\":{\"kind\":\"tile\",\"appId\":\"chat\"},\"b\":{\"kind\":\"split\",\"direction\":\"col\",\"ratio\":0.4,\"a\":{\"kind\":\"tile\",\"appId\":\"metals\"},\"b\":{\"kind\":\"tile\",\"appId\":\"inventory\"}}}}.\n")
	b.WriteString("To open one application on a specific document, call " + ToolWorkbenchOpenTile + "; if a tile already shows those exact bindings the result says so and you should not open it again. ")
	b.WriteString("For a single change to the current layout — split, close, rename, move, resize, switch workspace — call " + ToolWorkbenchPerform + " with one or two verbs, and " + ToolWorkbenchSwitchWorkspace + " to change which workspace is on screen.\n")
	b.WriteString("Closing a tile or deleting a workspace destroys something the user may be reading: propose it with " + ToolPropose + " and let them decide, rather than doing it. Rearranging the screen is a favour, not a habit — change the layout when asked, or when a result genuinely does not fit, and say what you changed.\n")
	if v.KnowsType("workspace") {
		b.WriteString("Refer to what you made by its mention, so the user can act on it: a tile is [[tile:<placementId>|label]] and a workspace is [[workspace:<workspaceId>|name]].\n")
	}
	return b.String()
}

// Focus is what the user was looking at when they sent a message.
type Focus struct {
	Reference *Reference     `json:"reference,omitempty"`
	Tile      map[string]any `json:"tile,omitempty"`
}

// RenderRefsSuffix renders the user's typed references and focus as a section
// appended to the prompt the model sees. The user's own words are left
// untouched; the section follows them.
func RenderRefsSuffix(refs []Reference, focus *Focus) string {
	if len(refs) == 0 && (focus == nil || (focus.Reference == nil && len(focus.Tile) == 0)) {
		return ""
	}
	var b strings.Builder
	b.WriteString("\n\n```pbui-refs\n")
	for _, r := range refs {
		b.WriteString(fmt.Sprintf("- %s:%s", r.Type, r.ID))
		if label, ok := r.Value["label"].(string); ok && label != "" {
			b.WriteString(" (" + label + ")")
		} else if name, ok := r.Value["name"].(string); ok && name != "" {
			b.WriteString(" (" + name + ")")
		}
		b.WriteString("\n")
	}
	if focus != nil && focus.Reference != nil {
		b.WriteString(fmt.Sprintf("focus: %s:%s\n", focus.Reference.Type, focus.Reference.ID))
	}
	b.WriteString("```")
	return b.String()
}
