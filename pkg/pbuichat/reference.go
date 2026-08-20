package pbuichat

import (
	"strconv"

	chatv1 "github.com/hyperslop-systems/pbui/gen/go/hyperslop/pbui/chat/v1"
	"google.golang.org/protobuf/types/known/structpb"
)

// Reference is the Go-side view of a presentation reference. It mirrors the
// proto message and the JSON the browser sends, with lowerCamel JSON keys.
type Reference struct {
	Type       string         `json:"type"`
	ID         string         `json:"id"`
	Value      map[string]any `json:"value,omitempty"`
	Provenance *Provenance    `json:"provenance,omitempty"`
}

// Provenance says where a reference was minted.
type Provenance struct {
	MessageID  string `json:"messageId,omitempty"`
	ToolCallID string `json:"toolCallId,omitempty"`
	WidgetID   string `json:"widgetId,omitempty"`
}

// Key is "<type>:<id>", the key used in pbui.refs documents.
func (r Reference) Key() string { return r.Type + ":" + r.ID }

// AsMap renders the reference as a JSON-shaped map (for Struct fields).
func (r Reference) AsMap() map[string]any {
	m := map[string]any{"type": r.Type, "id": r.ID}
	if r.Value != nil {
		m["value"] = r.Value
	}
	if r.Provenance != nil {
		p := map[string]any{}
		if r.Provenance.MessageID != "" {
			p["messageId"] = r.Provenance.MessageID
		}
		if r.Provenance.ToolCallID != "" {
			p["toolCallId"] = r.Provenance.ToolCallID
		}
		if r.Provenance.WidgetID != "" {
			p["widgetId"] = r.Provenance.WidgetID
		}
		m["provenance"] = p
	}
	return m
}

// ToProto converts to the wire message.
func (r Reference) ToProto() (*chatv1.Reference, error) {
	out := &chatv1.Reference{Type: r.Type, Id: r.ID}
	if r.Value != nil {
		s, err := structpb.NewStruct(r.Value)
		if err != nil {
			return nil, err
		}
		out.Value = s
	}
	if r.Provenance != nil {
		out.Provenance = &chatv1.Provenance{
			MessageId:  r.Provenance.MessageID,
			ToolCallId: r.Provenance.ToolCallID,
			WidgetId:   r.Provenance.WidgetID,
		}
	}
	return out, nil
}

// ReferenceFromProto converts from the wire message.
func ReferenceFromProto(p *chatv1.Reference) *Reference {
	if p == nil {
		return nil
	}
	r := &Reference{Type: p.GetType(), ID: p.GetId()}
	if p.GetValue() != nil {
		r.Value = p.GetValue().AsMap()
	}
	if p.GetProvenance() != nil {
		r.Provenance = &Provenance{
			MessageID:  p.GetProvenance().GetMessageId(),
			ToolCallID: p.GetProvenance().GetToolCallId(),
			WidgetID:   p.GetProvenance().GetWidgetId(),
		}
	}
	return r
}

// ReferenceFromMap decodes a JSON-shaped map (as sent by the browser).
func ReferenceFromMap(m map[string]any) *Reference {
	if m == nil {
		return nil
	}
	r := &Reference{}
	r.Type, _ = m["type"].(string)
	switch id := m["id"].(type) {
	case string:
		r.ID = id
	case float64:
		r.ID = strconv.FormatFloat(id, 'f', -1, 64)
	}
	if v, ok := m["value"].(map[string]any); ok {
		r.Value = v
	}
	if p, ok := m["provenance"].(map[string]any); ok {
		r.Provenance = &Provenance{}
		r.Provenance.MessageID, _ = p["messageId"].(string)
		r.Provenance.ToolCallID, _ = p["toolCallId"].(string)
		r.Provenance.WidgetID, _ = p["widgetId"].(string)
	}
	return r
}

// Unresolved builds the reference the client renders when a mention could not
// be resolved: type "unresolved", carrying the original type and id so the
// menu can still offer "ask the agent what this is".
func Unresolved(typ, id, label, reason string) Reference {
	value := map[string]any{"type": typ, "id": id}
	if label != "" {
		value["label"] = label
	}
	if reason != "" {
		value["error"] = reason
	}
	return Reference{Type: "unresolved", ID: typ + ":" + id, Value: value}
}
