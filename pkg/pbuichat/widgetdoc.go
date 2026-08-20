package pbuichat

import (
	"encoding/json"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/types/known/structpb"
)

// WidgetFormat and WidgetSchemaVersion identify the widget-document dialect.
const (
	WidgetFormat        = "pbui.widget"
	WidgetSchemaVersion = 1
)

// Widget names carried in WidgetInstanceEntity.widget_name.
const (
	WidgetNameRefs   = "pbui.refs"
	WidgetNameWidget = "pbui.widget"
	WidgetNameError  = "pbui.error"
)

// knownWidgetKinds is the closed set of child kinds this server version
// understands. A client advertises the subset it renders in its vocabulary;
// a document using a kind the client did not advertise is still published
// (the client shows a callout for it) but the tool result tells the model.
var knownWidgetKinds = map[string]struct{}{
	"text": {}, "refs": {}, "meter": {}, "sparkline": {}, "segmented": {},
	"stat": {}, "callout": {}, "table": {}, "diff": {}, "log": {}, "form": {}, "widget": {},
}

var knownLayouts = map[string]struct{}{"stack": {}, "row": {}, "grid": {}}

// Limits bound untrusted model output.
type Limits struct {
	RefsPerMessage int
	WidgetBytes    int
	WidgetChildren int
	WidgetDepth    int
	TableRows      int
	TraceKeep      int
}

// DefaultLimits are conservative for an interactive chat.
var DefaultLimits = Limits{
	RefsPerMessage: 32,
	WidgetBytes:    256 << 10,
	WidgetChildren: 64,
	WidgetDepth:    3,
	TableRows:      500,
	TraceKeep:      500,
}

// WidgetDocument is the decoded form of a widget document. It is kept as a
// generic map on purpose: the dialect is validated structurally here and
// rendered by the client, and neither side needs a Go struct per child kind.
type WidgetDocument map[string]any

// ParseWidgetDocument decodes JSON into a widget document and validates it.
func ParseWidgetDocument(data []byte, vocab *Vocabulary, limits Limits) (WidgetDocument, error) {
	if limits.WidgetBytes > 0 && len(data) > limits.WidgetBytes {
		return nil, errors.Errorf("widget document is %d bytes, limit %d", len(data), limits.WidgetBytes)
	}
	var doc WidgetDocument
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, errors.Wrap(err, "decode widget document")
	}
	if err := ValidateWidgetDocument(doc, vocab, limits); err != nil {
		return nil, err
	}
	return doc, nil
}

// ValidateWidgetDocument checks format, version, layout, child kinds,
// nesting depth, counts, references and verbs. It rewrites nothing: the
// caller decides whether to publish an error widget or return the error to
// the model.
func ValidateWidgetDocument(doc WidgetDocument, vocab *Vocabulary, limits Limits) error {
	if doc == nil {
		return errors.New("widget document is empty")
	}
	if format, _ := doc["format"].(string); format != WidgetFormat {
		return errors.Errorf("format must be %q", WidgetFormat)
	}
	if version, ok := numberOf(doc["schema_version"]); !ok || int(version) != WidgetSchemaVersion {
		return errors.Errorf("schema_version must be %d", WidgetSchemaVersion)
	}
	counter := 0
	if err := validateWidgetBody(doc, vocab, limits, 1, &counter); err != nil {
		return err
	}
	return nil
}

func validateWidgetBody(doc map[string]any, vocab *Vocabulary, limits Limits, depth int, counter *int) error {
	if limits.WidgetDepth > 0 && depth > limits.WidgetDepth {
		return errors.Errorf("widget nesting deeper than %d", limits.WidgetDepth)
	}
	if layout, ok := doc["layout"].(string); ok && layout != "" {
		if _, known := knownLayouts[layout]; !known {
			return errors.Errorf("unknown layout %q", layout)
		}
	}
	children, _ := doc["children"].([]any)
	if len(children) == 0 {
		return errors.New("widget has no children")
	}
	for i, raw := range children {
		*counter++
		if limits.WidgetChildren > 0 && *counter > limits.WidgetChildren {
			return errors.Errorf("more than %d children", limits.WidgetChildren)
		}
		child, ok := raw.(map[string]any)
		if !ok {
			return errors.Errorf("children[%d] is not an object", i)
		}
		kind, _ := child["kind"].(string)
		if _, known := knownWidgetKinds[kind]; !known {
			return errors.Errorf("children[%d] has unknown kind %q", i, kind)
		}
		if err := validateChild(kind, child, vocab, limits, depth, counter); err != nil {
			return errors.Wrapf(err, "children[%d] (%s)", i, kind)
		}
	}
	if verbs, ok := doc["verbs"].([]any); ok {
		for i, raw := range verbs {
			chip, ok := raw.(map[string]any)
			if !ok {
				return errors.Errorf("verbs[%d] is not an object", i)
			}
			if label, _ := chip["label"].(string); label == "" {
				return errors.Errorf("verbs[%d] has no label", i)
			}
			verb, _ := chip["verb"].(map[string]any)
			if vocab != nil {
				if err := vocab.ValidateVerb(verb); err != nil {
					return errors.Wrapf(err, "verbs[%d]", i)
				}
			} else if verb == nil {
				return errors.Errorf("verbs[%d] has no verb", i)
			}
		}
	}
	return nil
}

func validateChild(kind string, child map[string]any, vocab *Vocabulary, limits Limits, depth int, counter *int) error {
	if ref, ok := child["ref"].(map[string]any); ok {
		if err := ValidateReference(ref); err != nil {
			return err
		}
	}
	switch kind {
	case "refs":
		refs, _ := child["refs"].([]any)
		for i, raw := range refs {
			ref, ok := raw.(map[string]any)
			if !ok {
				return errors.Errorf("refs[%d] is not an object", i)
			}
			if err := ValidateReference(ref); err != nil {
				return errors.Wrapf(err, "refs[%d]", i)
			}
		}
	case "table":
		columns, _ := child["columns"].([]any)
		if len(columns) == 0 {
			return errors.New("table has no columns")
		}
		rows, _ := child["rows"].([]any)
		if limits.TableRows > 0 && len(rows) > limits.TableRows {
			return errors.Errorf("table has %d rows, limit %d", len(rows), limits.TableRows)
		}
		for i, raw := range rows {
			if _, ok := raw.([]any); !ok {
				return errors.Errorf("rows[%d] is not an array", i)
			}
		}
	case "meter":
		if _, ok := numberOf(child["value"]); !ok {
			return errors.New("meter needs a numeric value")
		}
	case "sparkline":
		values, _ := child["values"].([]any)
		if len(values) == 0 {
			return errors.New("sparkline needs values")
		}
	case "segmented":
		parts, _ := child["parts"].([]any)
		if len(parts) == 0 {
			return errors.New("segmented needs parts")
		}
	case "text":
		if _, ok := child["text"].(string); !ok {
			return errors.New("text needs text")
		}
	case "callout":
		if _, ok := child["text"].(string); !ok {
			return errors.New("callout needs text")
		}
	case "form":
		fields, _ := child["fields"].([]any)
		if len(fields) == 0 {
			return errors.New("form needs fields")
		}
	case "widget":
		nested, ok := child["document"].(map[string]any)
		if !ok {
			return errors.New("nested widget needs a document")
		}
		return validateWidgetBody(nested, vocab, limits, depth+1, counter)
	}
	return nil
}

// ToStruct converts the document for transport inside WidgetInstance props.
func (d WidgetDocument) ToStruct() (*structpb.Struct, error) {
	return structpb.NewStruct(map[string]any(d))
}

// Title returns the document title, if any.
func (d WidgetDocument) Title() string {
	title, _ := d["title"].(string)
	return title
}

// NewTableDocument builds a table widget document from column names and rows.
// It is the shape the tool-result projection emits.
func NewTableDocument(title, docID string, columns []TableColumn, rows [][]any, streaming bool) WidgetDocument {
	cols := make([]any, 0, len(columns))
	for _, c := range columns {
		col := map[string]any{"name": c.Name}
		if c.Type != "" {
			col["type"] = c.Type
		}
		cols = append(cols, col)
	}
	rawRows := make([]any, 0, len(rows))
	for _, r := range rows {
		rawRows = append(rawRows, append([]any(nil), r...))
	}
	table := map[string]any{"kind": "table", "columns": cols, "rows": rawRows}
	if docID != "" {
		table["docId"] = docID
	}
	if streaming {
		table["streaming"] = true
	}
	doc := WidgetDocument{
		"format":         WidgetFormat,
		"schema_version": WidgetSchemaVersion,
		"layout":         "stack",
		"children":       []any{table},
	}
	if title != "" {
		doc["title"] = title
	}
	return doc
}

// TableColumn names a table column and its datalab-style type ("q", "n", "t").
type TableColumn struct {
	Name string
	Type string
}

func numberOf(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case json.Number:
		f, err := n.Float64()
		return f, err == nil
	}
	return 0, false
}
