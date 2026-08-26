// Command cross-session-tool-result-probe demonstrates the current frontend
// tool manager's session-binding behavior. Run from the PBUI repository root.
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/go-go-golems/pinocchio/pkg/chatapp/frontendtools"
	toolv1 "github.com/go-go-golems/pinocchio/pkg/chatapp/pb/proto/pinocchio/chatapp/frontendtools/v1"
	"github.com/go-go-golems/sessionstream/pkg/sessionstream"
	"google.golang.org/protobuf/types/known/structpb"
)

type publisher struct {
	events chan sessionstream.Event
}

func (p *publisher) Publish(_ context.Context, event sessionstream.Event) error {
	p.events <- event
	return nil
}

type answer struct {
	result *toolv1.FrontendToolResultCommand
	err    error
}

func main() {
	manager := frontendtools.NewManager()
	pub := &publisher{events: make(chan sessionstream.Event, 4)}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	victim := sessionstream.SessionId("victim-session")
	attacker := sessionstream.SessionId("attacker-session")
	answers := make(chan answer, 1)
	go func() {
		result, err := manager.Request(ctx, victim, pub, frontendtools.Request{
			MessageID:  "victim-message",
			ToolCallID: "shared-call-id",
			ToolName:   "dangerous_browser_tool",
			Input:      map[string]any{"operation": "close"},
		})
		answers <- answer{result: result, err: err}
	}()

	requested := <-pub.events
	if requested.SessionId != victim || requested.Name != frontendtools.EventCallRequested {
		panic(fmt.Sprintf("unexpected request event: %#v", requested))
	}

	forged, err := structpb.NewStruct(map[string]any{"ok": true, "source": "attacker"})
	if err != nil {
		panic(err)
	}
	if err := manager.HandleResult(ctx, sessionstream.Command{
		SessionId: attacker,
		Name:      frontendtools.CommandResult,
		Payload: &toolv1.FrontendToolResultCommand{
			ToolCallId: "shared-call-id",
			ToolName:   "different_name_is_accepted",
			Status:     "success",
			Result:     forged,
		},
	}, nil, pub); err != nil {
		panic(err)
	}

	resolved := <-answers
	if resolved.err != nil {
		panic(resolved.err)
	}
	if got := resolved.result.GetResult().AsMap()["source"]; got != "attacker" {
		panic(fmt.Sprintf("victim did not receive forged result: %#v", resolved.result))
	}

	body := `---
Title: 'Cross-session frontend-tool result probe'
Ticket: PBUI-AGENT-4
Status: active
Topics: [pbui, chat, frontend, backend, onboarding]
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: 'Executable proof that a result submitted under one session id can currently resolve another session pending call when the tool-call id matches.'
WhatFor: Verify the highest-severity session-binding finding in the agent-to-UI tool bridge.
WhenToUse: Designing or testing composite pending-call keys and result authentication.
---

# Cross-session frontend-tool result probe

Result: **PASS (the current cross-session acceptance hazard was reproduced)**

| Field | Value |
|---|---|
| pending request session | ` + "`victim-session`" + ` |
| result command session | ` + "`attacker-session`" + ` |
| pending tool name | ` + "`dangerous_browser_tool`" + ` |
| submitted tool name | ` + "`different_name_is_accepted`" + ` |
| value returned to victim request | ` + "`source=attacker`" + ` |

The manager's pending map is keyed only by ` + "`toolCallId`" + `. ` + "`HandleResult`" + ` does not require the command session or supplied tool name to match the pending call before delivering the result to its channel. A PASS means the probe reproduced current behavior, not that the behavior is safe.
`

	fmt.Print(body)
}
