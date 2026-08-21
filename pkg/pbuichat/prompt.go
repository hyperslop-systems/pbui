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

// Sandbox tool names. Frontend tools too: the browser runs the programs, so
// the browser advertises the tools; the prompt only has to name them
// correctly.
const (
	ToolSandboxDescribe     = "sandbox_describe"
	ToolSandboxTest         = "sandbox_test"
	ToolSandboxCreateApp    = "sandbox_create_app"
	ToolSandboxUpdateApp    = "sandbox_update_app"
	ToolSandboxOpen         = "sandbox_open"
	ToolSandboxDefineAction = "sandbox_define_action"
	ToolSandboxRemove       = "sandbox_remove"
)

// sandboxExample is the worked program the prompt carries. PBUI-AGENT-1 and -2
// both recorded the model guessing a nested shape until the instructions held
// one complete, valid value; a program is the most nested thing yet.
const sandboxExample = `definePlugin(({ ui }) => ({
  id: "days-of-cover", title: "Days of cover", bindings: ["product"], initialState: { days: 30 },
  widgets: { main: {
    render({ pluginState, globalState }) {
      const product = globalState.shared.documents?.product;
      if (!product) return ui.callout({ variant: "warning", text: "bind this tile to a product" });
      const stock = Number(product.value?.stock ?? 0), perDay = Number(product.value?.sold30d ?? 0) / 30;
      const days = Number(pluginState?.days ?? 30), needed = Math.ceil(perDay * days);
      return ui.column([
        ui.row([ui.ref(product), ui.badge(stock >= needed ? "covered" : "short")]),
        ui.input(String(days), { type: "number", placeholder: "days", onChange: { handler: "setDays" } }),
        ui.meter({ fraction: needed === 0 ? 1 : Math.min(1, stock / needed), value: stock + " / " + needed, label: "stock vs need" }),
        ui.button("Draft a reorder", { variant: "destructive", disabled: stock >= needed, onClick: { handler: "reorder" } }),
      ]);
    },
    handlers: {
      setDays({ dispatchPluginAction }, args) { dispatchPluginAction("state/merge", { days: Number(args?.value ?? 0) }); },
      reorder({ dispatchVerb, globalState }) { const p = globalState.shared.documents?.product; if (p) dispatchVerb({ kind: "reorder", productId: p.id }); },
    },
  } },
}))`

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
	b.WriteString(sandboxSection(v))
	return b.String()
}

// sandboxSection teaches the model the program dialect, and is emitted only
// for a product that declares a `program` type AND a sandbox block: the first
// says programs are objects here, the second says what a program may draw.
// Generated from the vocabulary so the list of kinds cannot drift from the
// renderer (PBUI-AGENT-3 D12).
func sandboxSection(v *Vocabulary) string {
	if !v.KnowsType("program") || !v.HasSandbox() {
		return ""
	}
	var b strings.Builder
	b.WriteString("\n## Programs\n")
	b.WriteString("You can write small programs that run in the user's browser and show as tiles. A program is JavaScript in a fixed dialect: it calls definePlugin(({ ui }) => ({ id, title, bindings?, initialState?, widgets: { main: { render, handlers } } })) exactly once. ")
	b.WriteString("render({ pluginState, globalState }) is a PURE function that returns a UI tree built only with these helpers: ui.text(content, {size?, tone?, strong?}), ui.badge(text), ui.button(label, {onClick?, variant?, disabled?}), ui.input(value, {placeholder?, type?, onChange?}), ui.select(value, {options, onChange?}), ui.row(children), ui.column(children), ui.panel(children, {title?}), ui.table(rows, {headers}), ui.meter({fraction, label?, value?}), ui.sparkline({points, label?}), ui.callout({variant?, title?, text}), ui.ref(reference, label?). ")
	b.WriteString("Node kinds: " + strings.Join(v.Sandbox.Kinds, ", ") + ". ")
	b.WriteString("onClick and onChange take { handler: \"name\", args? }; an input's handler receives { value }. handlers[name]({ pluginState, globalState, dispatchPluginAction, dispatchVerb }, args) must be synchronous and change nothing directly: it emits intents — dispatchPluginAction(\"state/merge\", {…}) or (\"state/replace\", {…}) for the program's own state, dispatchVerb({ kind, … }) for anything else, using only the verb kinds listed above. Intents: " + strings.Join(v.Sandbox.Intents, ", ") + ".\n")
	b.WriteString("globalState.shared.documents holds the objects the tile is bound to, by binding key, as references { type, id, value }; globalState.shared.env holds the user's environment. Declare bindings: [\"product\"] and read globalState.shared.documents.product rather than copying an object's fields into the source. State is JSON: coerce what you read (Number(pluginState?.days ?? 0)). There is no DOM, fetch, timer, import or async in a program; reaching for one is an error.\n")
	b.WriteString("Workflow: call " + ToolSandboxTest + " first with the source (and documents, and events to click through); create only a program whose test rendered, with " + ToolSandboxCreateApp + " (documents binds objects when it opens). Change a program with " + ToolSandboxUpdateApp + "; open a stored one with " + ToolSandboxOpen + "; list what exists with " + ToolSandboxDescribe + " — ids come from there. ")
	b.WriteString("To add an entry to the menu of every object of some types, call " + ToolSandboxDefineAction + ": it opens a program bound to the clicked object, performs a declared verb on it (write \"$ref\" for the object), or asks you with a template ({0} is the object). Remove with " + ToolSandboxRemove + "; something pinned or human-made needs " + ToolPropose + " first. Mention what you made: [[program:<programId>|title]], [[action:<actionId>|label]].\n")
	b.WriteString("A complete, valid program:\n```js\n" + sandboxExample + "\n```\n")
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
