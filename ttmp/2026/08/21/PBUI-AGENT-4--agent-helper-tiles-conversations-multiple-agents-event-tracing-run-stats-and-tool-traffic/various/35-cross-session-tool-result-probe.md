---
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
| pending request session | `victim-session` |
| result command session | `attacker-session` |
| pending tool name | `dangerous_browser_tool` |
| submitted tool name | `different_name_is_accepted` |
| value returned to victim request | `source=attacker` |

The manager's pending map is keyed only by `toolCallId`. `HandleResult` does not require the command session or supplied tool name to match the pending call before delivering the result to its channel. A PASS means the probe reproduced current behavior, not that the behavior is safe.
