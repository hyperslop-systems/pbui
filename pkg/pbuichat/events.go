package pbuichat

import (
	gepevents "github.com/go-go-golems/geppetto/pkg/events"
)

// EventTypeWidgetRequested is the geppetto event type a backend tool publishes
// when the model asks for a widget. The plugin turns it into widget-instance
// events; it never reaches the browser itself.
const EventTypeWidgetRequested gepevents.EventType = "pbui-widget-requested"

// EventWidgetRequested carries one widget document from a tool to the plugin.
type EventWidgetRequested struct {
	gepevents.EventImpl
	WidgetID string         `json:"widget_id,omitempty"`
	Document WidgetDocument `json:"document"`
}

var _ gepevents.Event = (*EventWidgetRequested)(nil)

// NewWidgetRequestedEvent builds the event.
func NewWidgetRequestedEvent(metadata gepevents.EventMetadata, widgetID string, doc WidgetDocument) *EventWidgetRequested {
	return &EventWidgetRequested{
		EventImpl: gepevents.EventImpl{Type_: EventTypeWidgetRequested, Metadata_: metadata},
		WidgetID:  widgetID,
		Document:  doc,
	}
}

func init() {
	_ = gepevents.RegisterEventFactory(string(EventTypeWidgetRequested), func() gepevents.Event {
		return &EventWidgetRequested{}
	})
}
