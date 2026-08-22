---
Title: 'Tool runtime executable probes'
Ticket: PBUI-AGENT-4
Status: active
Topics: [pbui, chat, frontend, backend, onboarding]
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: 'Executable evidence for replay and duplicate-submission findings in the agent-to-UI tool path.'
WhatFor: Verify review claims that are easy to miss in static reading.
WhenToUse: Reviewing tool-call idempotency and approval-consumption remediation.
---

# Tool runtime executable probes

Result: **PASS (all currently observable hazards reproduced)**

| Probe | Observation |
|---|---|
| completed frontend request replay | `executions=2; submittedResults=2` |
| duplicate human-tool response | `submittedResults=2` |
| conversation approval replay | `performedHandoffs=2` |
| sandbox action approval replay | `createdActions=2` |

A PASS means the probe successfully reproduced the reviewed current behavior; it does **not** mean the behavior is desirable. After remediation, invert these assertions and treat replay/duplicate execution as a failing condition.
