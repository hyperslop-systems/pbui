package pbuichat

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/pkg/errors"
)

// VocabularySchemaVersion is the vocabulary.json format this package reads.
const VocabularySchemaVersion = 1

// Vocabulary is the product's presentation vocabulary as exported by the
// TypeScript registry: which presentation types exist, which verbs exist and
// what fields they carry, and which widget-document child kinds a client can
// render. The Go side uses it to validate model output, to generate the
// system-prompt section, and to answer the pbui_describe_types tool. It is the
// single source of truth shared with the browser; drift is a build failure,
// not a runtime surprise.
type Vocabulary struct {
	SchemaVersion int                 `json:"schema_version"`
	Product       string              `json:"product,omitempty"`
	Types         map[string]TypeSpec `json:"types"`
	Verbs         map[string]VerbSpec `json:"verbs"`
	Widget        WidgetVocabulary    `json:"widget"`
	Conversions   []Conversion        `json:"conversions,omitempty"`
}

// TypeSpec describes one presentation type.
type TypeSpec struct {
	// Doc is the one-line description shown to the model and in the mouse-doc.
	Doc string `json:"doc"`
	// IDHint tells the model what identifies an object of this type
	// ("products.id", "<docId>.<column>", "evidence id E<n>").
	IDHint string `json:"idHint,omitempty"`
	// Tone is a CSS custom property reference, never a hex value.
	Tone string `json:"tone,omitempty"`
	// Verbs lists the verb kinds the descriptor may offer for this type.
	Verbs []string `json:"verbs,omitempty"`
	// Example is a sample mention the prompt shows.
	Example string `json:"example,omitempty"`
}

// VerbSpec describes one verb kind. Fields map a field name to a coarse type
// ("string", "number", "boolean", "ref", "refs", "object"); a trailing "?"
// on the name marks the field optional.
type VerbSpec struct {
	Doc    string            `json:"doc"`
	Fields map[string]string `json:"fields"`
	// Danger marks verbs that must never be performed on the agent's behalf.
	Danger bool `json:"danger,omitempty"`
}

// WidgetVocabulary describes the widget-document dialect the client renders.
type WidgetVocabulary struct {
	SchemaVersion int      `json:"schema_version"`
	Kinds         []string `json:"kinds"`
	Layouts       []string `json:"layouts,omitempty"`
}

// Conversion declares that a reference of type From may stand in for type To
// during accept mode (for example a table row that carries a product id).
type Conversion struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// ParseVocabulary decodes and validates a vocabulary.json document.
func ParseVocabulary(data []byte) (*Vocabulary, error) {
	var v Vocabulary
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, errors.Wrap(err, "decode vocabulary")
	}
	if err := v.Validate(); err != nil {
		return nil, err
	}
	return &v, nil
}

// MustParseVocabulary is ParseVocabulary for embedded, CI-checked files.
func MustParseVocabulary(data []byte) *Vocabulary {
	v, err := ParseVocabulary(data)
	if err != nil {
		panic(err)
	}
	return v
}

// Validate checks the vocabulary's own consistency.
func (v *Vocabulary) Validate() error {
	if v == nil {
		return errors.New("vocabulary is nil")
	}
	if v.SchemaVersion != VocabularySchemaVersion {
		return errors.Errorf("vocabulary schema_version %d is not %d", v.SchemaVersion, VocabularySchemaVersion)
	}
	if len(v.Types) == 0 {
		return errors.New("vocabulary declares no types")
	}
	for name, t := range v.Types {
		if !isIdentifier(name) {
			return errors.Errorf("type %q is not a valid identifier", name)
		}
		for _, verb := range t.Verbs {
			if _, ok := v.Verbs[verb]; !ok {
				return errors.Errorf("type %q lists unknown verb %q", name, verb)
			}
		}
	}
	for kind, spec := range v.Verbs {
		if !isIdentifier(kind) {
			return errors.Errorf("verb %q is not a valid identifier", kind)
		}
		for field, typ := range spec.Fields {
			switch typ {
			case "string", "number", "boolean", "ref", "refs", "object":
			default:
				return errors.Errorf("verb %q field %q has unknown type %q", kind, field, typ)
			}
		}
	}
	if v.Widget.SchemaVersion != WidgetSchemaVersion {
		return errors.Errorf("widget schema_version %d is not %d", v.Widget.SchemaVersion, WidgetSchemaVersion)
	}
	for _, kind := range v.Widget.Kinds {
		if _, ok := knownWidgetKinds[kind]; !ok {
			return errors.Errorf("widget kind %q is not known to this server", kind)
		}
	}
	for _, c := range v.Conversions {
		if _, ok := v.Types[c.From]; !ok {
			return errors.Errorf("conversion from unknown type %q", c.From)
		}
		if _, ok := v.Types[c.To]; !ok {
			return errors.Errorf("conversion to unknown type %q", c.To)
		}
	}
	return nil
}

// KnowsType reports whether the vocabulary declares the presentation type.
func (v *Vocabulary) KnowsType(typ string) bool {
	_, ok := v.Types[typ]
	return ok
}

// TypeNames returns the declared types in a stable order.
func (v *Vocabulary) TypeNames() []string {
	names := make([]string, 0, len(v.Types))
	for name := range v.Types {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// VerbKinds returns the declared verb kinds in a stable order.
func (v *Vocabulary) VerbKinds() []string {
	kinds := make([]string, 0, len(v.Verbs))
	for kind := range v.Verbs {
		kinds = append(kinds, kind)
	}
	sort.Strings(kinds)
	return kinds
}

// RendersKind reports whether the client declared it can render a widget child kind.
func (v *Vocabulary) RendersKind(kind string) bool {
	for _, k := range v.Widget.Kinds {
		if k == kind {
			return true
		}
	}
	return false
}

// ValidateVerb checks a verb (as decoded JSON) against the vocabulary: the
// kind must exist and every required field must be present with a value of
// the declared coarse type. It returns a message suitable for
// `disabledBecause` on failure.
func (v *Vocabulary) ValidateVerb(verb map[string]any) error {
	if verb == nil {
		return errors.New("verb is empty")
	}
	kind, _ := verb["kind"].(string)
	if kind == "" {
		return errors.New("verb has no kind")
	}
	spec, ok := v.Verbs[kind]
	if !ok {
		return errors.Errorf("unknown verb %s", kind)
	}
	for field, typ := range spec.Fields {
		name := strings.TrimSuffix(field, "?")
		optional := strings.HasSuffix(field, "?")
		value, present := verb[name]
		if !present || value == nil {
			if optional {
				continue
			}
			return errors.Errorf("verb %s is missing %s", kind, name)
		}
		if err := checkCoarseType(value, typ); err != nil {
			return errors.Wrapf(err, "verb %s field %s", kind, name)
		}
	}
	return nil
}

// ValidateReference checks that a reference (as decoded JSON) has a type and
// an id. Unknown types are legal on the wire — the client renders them as
// <unresolved> — so this only rejects structurally broken references.
func ValidateReference(ref map[string]any) error {
	if ref == nil {
		return errors.New("reference is empty")
	}
	typ, _ := ref["type"].(string)
	if !isIdentifier(typ) {
		return errors.Errorf("reference type %q is not a valid identifier", typ)
	}
	switch id := ref["id"].(type) {
	case string:
		if strings.TrimSpace(id) == "" {
			return errors.New("reference id is empty")
		}
	case float64:
	default:
		return errors.New("reference has no id")
	}
	return nil
}

func checkCoarseType(value any, typ string) error {
	switch typ {
	case "string":
		if _, ok := value.(string); !ok {
			return fmt.Errorf("expected string, got %T", value)
		}
	case "number":
		switch value.(type) {
		case float64, int, int64, json.Number:
		default:
			return fmt.Errorf("expected number, got %T", value)
		}
	case "boolean":
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("expected boolean, got %T", value)
		}
	case "ref":
		m, ok := value.(map[string]any)
		if !ok {
			return fmt.Errorf("expected reference object, got %T", value)
		}
		return ValidateReference(m)
	case "refs":
		list, ok := value.([]any)
		if !ok {
			return fmt.Errorf("expected list of references, got %T", value)
		}
		for i, item := range list {
			m, ok := item.(map[string]any)
			if !ok {
				return fmt.Errorf("refs[%d]: expected reference object, got %T", i, item)
			}
			if err := ValidateReference(m); err != nil {
				return fmt.Errorf("refs[%d]: %w", i, err)
			}
		}
	case "object":
		if _, ok := value.(map[string]any); !ok {
			return fmt.Errorf("expected object, got %T", value)
		}
	}
	return nil
}

func isIdentifier(s string) bool {
	if s == "" || len(s) > 64 {
		return false
	}
	for i, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r == '_':
		case r >= '0' && r <= '9', r == '-', r == '.':
			if i == 0 {
				return false
			}
		default:
			return false
		}
	}
	return true
}
