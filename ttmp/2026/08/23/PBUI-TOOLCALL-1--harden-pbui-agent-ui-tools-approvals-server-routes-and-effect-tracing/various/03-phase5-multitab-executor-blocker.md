---
Title: Phase 5 multi-tab executor blocker evidence
Ticket: PBUI-TOOLCALL-1
Status: archived
Topics:
    - chat
    - frontend
    - architecture
DocType: reference
Intent: long-term
Owners:
    - manuel
---

# Phase 5 multi-tab executor blocker evidence

> [!success] Closed on 2026-08-25
> This document preserves the original immutable `0.5.0` failure. Pinocchio `v0.11.16` plus chat-provider `0.6.0` now pass the installed-package and real two-tab acceptance. See `phase5-executor-acceptance-evidence.json`.

Date: 2026-08-25 16:23 EDT  
Server: embedded `pbui-chat` built from `task/add-pbui-agent` after `ac76a40`  
Dependencies: Pinocchio `v0.11.14`; installed npm `@go-go-golems/chat-provider@0.5.0`  
Session: `e2f28965-1872-4b3a-87da-ce43bbf7244d`

## Reproduction

1. Start the SQLite-backed demo on `127.0.0.1:18092`.
2. Open two Chromium tabs on the same origin and same conversation.
3. Reset the workbench and reload the second tab; both begin with four tiles and the same document ids.
4. Send `arrange workbench` from tab A. The scripted agent calls `workbench_describe`, then revision-bound `workbench_perform` with one `tile.split`.
5. Inspect both tabs, each tab's network requests, and the durable sessionstream SQLite events.

## Observed

- Both tabs executed `workbench_describe`.
- Both tabs executed the consequential `workbench_perform`.
- Both tabs changed from four to five local tiles.
- Both tabs generated a new random placement/view id, so their `afterRevision` values differed.
- The server durably accepted one tool result and one causal `workbench.verb_batch` trace.
- The losing tab repeatedly received HTTP 500 responses:

```text
frontend tool invocation rejected: code=terminal_conflict
session_id="e2f28965-1872-4b3a-87da-ce43bbf7244d"
tool_call_id="msg-1:tool:workbench_describe:1"
tool_name="workbench_describe"
```

```text
effect id "e2f28965-1872-4b3a-87da-ce43bbf7244d:msg-1:tool:workbench_perform:2"
was reused with a different envelope
```

The accepted durable effect had:

```text
effectId: e2f28965-1872-4b3a-87da-ce43bbf7244d:msg-1:tool:workbench_perform:2
beforeRevision: 723d2475c5abfd3ff211045a78b4ffb4319998a707a9b92efe466df17ac33491
afterRevision: e73dcfbf3f5bbfc740734b4d2185e11536a56c720639c7eab64984171a2c4fed
```

The conflicting tab reported the same effect id and input digest, but:

```text
afterRevision: 24fd427b1d275fc7bf157d59b9244e0cfe4e1180911d3a335f978ae7588fbbce
occurredAt: 2026-08-25T20:23:14.135Z
```

Durable SQLite events contain exactly one `PbuiVerbRecorded` and one accepted `ChatFrontendToolResultReceived` for the consequential call. That proves server terminal/effect conflict protection works; it does **not** provide single-owner browser execution.

## Installed-package probe

`./scripts/02-probe-installed-chat-provider-multitab.mjs` executes the exact installed registry package and exits 1. Its captured JSON reports:

```json
{
  "terminalReplay": { "executions": 2, "submissions": 2, "requiredExecutions": 1 },
  "twoIndependentTabs": { "executions": 2, "submissions": 2, "requiredExecutions": 1 }
}
```

## Why PBUI must not hide this locally

The PBUI architecture guide explicitly assigns browser terminal-ledger/executor-lease implementation to `REACT-CHAT-TOOL-RUNTIME-1`. A PBUI-only localStorage lock would be a hidden second protocol: it could suppress consequential execution but cannot prevent duplicate read results, duplicate human prompts, manifest races, or reliably return the winning tool result. It would also violate the requirement not to add compatibility shims.

The hardened react-chat source is merged in `v0.0.3`, but npm `0.5.0` is immutable and predates those source changes. The related ticket records that a new npm package version was intentionally not published. PBUI is explicitly constrained to keep exact npm `0.5.0` consumption.

## Live release-gate recheck

At `2026-08-25T16:39:24-04:00`, fresh `npm view` queries still returned versions only through `0.5.0`, with `next: 0.5.0` and `latest: 0.4.2`. No immutable release containing the merged terminal ledger or any server-assigned executor protocol is available to PBUI.

## Required unblock

A release owner must approve and perform the coordinated protocol-v2/package sequence:

1. Finish client/executor identity and one-owner delivery across Pinocchio/react-chat/PBUI.
2. Bump and publish a new immutable `@go-go-golems/chat-provider` version containing the merged terminal ledger.
3. Explicitly authorize PBUI to replace its required exact `0.5.0` dependency.
4. Rerun this two-tab browser case and require one execution, one terminal result, one effect envelope, and no 500/conflict loop.

This condition was true for immutable `0.5.0` and remains useful regression evidence.

## Closure evidence

The coordinated release sequence completed:

- Pinocchio `v0.11.16` resolves to merge commit `d0fb2e485bb21a14d0b43968276ab876443b28c0`.
- Chat-provider `0.6.0` was trusted-published from merge commit `09597c5653f750c7f392cf76ea4343b548c0393e` under npm tag `next`.
- PBUI pins both exact releases and uses strict manifest/result DTOs.
- The installed-package probe reports one execution and one submission for terminal replay and two independent runtimes.
- In real Chromium tabs, only the assigned tab submitted automatic and human results; the non-owner submitted none.
- One durable `program.open` effect envelope was recorded with no terminal or envelope conflict.
- Reload rotated connection and assignment while retaining the client instance and never reassigned the old pending call.

The blocker is closed. The old failing data is not deleted or normalized because it proves the regression that `0.6.0` fixes.
