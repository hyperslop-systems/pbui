package pbuichat

import (
	"fmt"
	"sort"
	"strings"
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
