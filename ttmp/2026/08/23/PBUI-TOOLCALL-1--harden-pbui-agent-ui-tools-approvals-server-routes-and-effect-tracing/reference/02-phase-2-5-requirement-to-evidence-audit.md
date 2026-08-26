---
Title: Phase 2–5 Requirement-to-Evidence Audit
Ticket: PBUI-TOOLCALL-1
Status: active
Topics:
    - chat
    - frontend
    - backend
    - architecture
    - review
DocType: reference
Intent: long-term
Owners:
    - manuel
RelatedFiles:
    - Path: repo://go.mod
      Note: Released Pinocchio v0.11.16 strict executor integration
    - Path: repo://packages/pbui-chat/src/tools/workbenchTools.ts
      Note: Unsafe whole-document undo removed and revision-bound gateway tools audited (commit 1d17631)
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/scripts/01-phase5-contract-audit.py
      Note: Fail-closed PBUI-owned static contract audit
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/scripts/02-probe-installed-chat-provider-multitab.mjs
      Note: Exact installed npm replay and two-runtime probe
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase5-installed-provider-multitab-probe.json
      Note: Failing immutable npm runtime evidence
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/03-phase5-multitab-executor-blocker.md
      Note: Real two-tab network and durable trace blocker evidence
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase5-static-contract-audit.txt
      Note: 20/20 PBUI-owned static audit output
ExternalSources: []
Summary: ""
LastUpdated: 0001-01-01T00:00:00Z
WhatFor: ""
WhenToUse: ""
---


# Phase 2–5 Requirement-to-Evidence Audit

Audit date: 2026-08-25  
Branch: `task/add-pbui-agent`  
Audit status: **PASS — Phase 5 completion contract satisfied**

This document maps every PBUI-owned Phase 2–4 implementation requirement and the Phase 5 completion contract to concrete source, commits, executable checks, rendered artifacts, and release artifacts. The former two-tab blocker is closed by immutable Pinocchio `v0.11.16` and npm `@go-go-golems/chat-provider@0.6.0`, the strict PBUI HTTP adapter, installed-package probing, and real two-tab Chromium evidence.

## 1. Phase 2 — transactional approvals and durable causal effects

| Requirement | Implementation evidence | Executable/rendered evidence | Result |
|---|---|---|---|
| One product-wide approval authority | `approvalLedger.ts`; injected by `createPbuiChat.tsx`; commits `69678a3`, `f320dfc` | Approval ledger/tool factory tests in PBUI Chat | PASS |
| Canonical subject binds sender, operation, normalized arguments, targets, refs, scope | `createApprovalSubject`, canonical JSON and SHA-256 digest in `approvalLedger.ts` | mismatch/replay/sender/reference tests | PASS |
| Reserve before effect, finalize only performed, release rejected | `AgentEffectGateway.#executeOnce`; commit `1d05677` | gateway reservation/finalization/release/race tests | PASS |
| Same effect id runs once; conflicting reuse fails | gateway running/terminal ledgers and `EffectConflictError` | concurrent duplicate, cached retry and conflict tests | PASS within one runtime; cross-tab owner is blocked separately |
| One shared gateway routes consequential workbench operations | specialized tools, `workbench.verb_batch`, raw `workbench.mutation_batch` in `workbenchTools.ts` | workbench tool tests and rendered `arrange workbench` scenario | PASS |
| One shared gateway routes sandbox writes/open/remove/action changes | `executeGated`/`performGated` in `sandboxTools.ts` | sandbox gateway/policy tests | PASS |
| One shared gateway routes cross-conversation send | `conversationTools.ts` | sender/target/prompt/ref approval and send tests; Phase 2 browser handoff | PASS |
| No legacy callback/spent-set authorities | production source lacks `isApproved`, `isRawApproved`, factory `spent` sets | `01-phase5-contract-audit.py`: `no legacy approval authorities` | PASS |
| Canonical effect envelope includes identity, input digest, conversation, scope, outcome, occurrence, approval, revisions, correlation | `EffectEnvelope` in TypeScript and protobuf | TS envelope tests, Go parser/digest/session tests, static audit | PASS |
| Durable report outbox survives reload, is bounded, and fails closed at capacity | `EffectOutboxStorage`, restore/persist, `outboxError`, max entries | gateway storage/corruption/capacity/retry tests | PASS |
| Authenticated server effect route validates session and envelope | `POST .../{id}/effects`, `SessionEffectWrite`, strict Go parser | authorization, route, digest/session/conflict/idempotency tests | PASS |
| Duplicate identical server delivery records once; conflicting envelope rejects | durable trace command handling | Go duplicate/conflict tests; SQLite/browser evidence | PASS |
| Typed effect/verb correlation survives live and hydrated projections | protobuf fields, router correlation, trace adapter | router/adapter/hydration tests; `phase2-correlated-verb-hydrated.png` | PASS |
| Browser reload and process restart hydrate durable effect evidence | chat snapshot/SQLite trace projection | Phase 2 screenshots `phase2-effect-inspector-hydrated.png` and `phase2-effect-inspector-server-restart.png` | PASS |

Primary commits: `1d056779`, `56a01b61`, `64b5f9d9`, with diary commits `c5e575e`, `5a6bc88`, `c819c97`.

## 2. Phase 3 — conversation lifecycle and title synchronization

| Requirement | Implementation evidence | Executable/rendered evidence | Result |
|---|---|---|---|
| Distinct closed/opening/open/failed/closing lifecycle | `ConversationRuntimeLifecycle` and state transitions in `registry.ts` | registry/scope/tile tests; closed/failed/reopened screenshots | PASS |
| Bounded opening and stale-attempt cancellation | opening deadline and attempt identity in registry/runtime | fake timer timeout regression; browser failure/retry | PASS |
| Human close/reopen/cancel/retry controls use existing runtime | `ConversationScope.tsx`, `ConversationsTile.tsx` | component tests and Phase 3 Chromium sequence | PASS |
| Conversation-keyed drafts and operation-keyed send context do not leak | store/composer and `WeakMap<SendMessageRequest, PendingSend>` | two-composer/concurrent/preflight-failure tests | PASS |
| Local-first title updates synchronize through serialized CAS PATCH | title outbox/CAS in `registry.ts`, PATCH handler | registry/server tests; browser human rename | PASS |
| Title failures remain visible/retryable and survive reload | durable title outbox and retry UI | offline/reload/retry screenshot sequence | PASS |
| Cross-client 409 uses authoritative revision without dropping local title | title conflict path and `TitleRevisionConflict` | cross-client/index-reset regressions and screenshots | PASS |
| SQLite session title/revision survive process restart | `sqliteSessionIndex`, migration, `--sessions-db` | Go migration/persistence tests and `phase3-title-server-restart-persisted.png` | PASS |

Primary commits: `c5365e6`, `5390506`, `b7ca909`, `6a8d8c6`, `a34cc68`, `13dd824`, with validation commit `456d4a3`.

## 3. Phase 4 — atomic workbench semantics, rendered constraints, and focus

| Requirement | Implementation evidence | Executable/rendered evidence | Result |
|---|---|---|---|
| Public `perform` contract reports real refusal | `Workbench.perform(): boolean`, strict `performWorkbenchVerb` | workbench and chat refusal tests | PASS |
| Runtime verb validation checks complete per-kind shape | `isWorkbenchVerb` | malformed/missing-field matrix | PASS |
| Multi-verb calls preflight atomically | shadow store `plan`, aggregated mutations, `applyPlan` | all-valid/one-invalid/refusal tests | PASS |
| Plans bind to immutable document/revision and reject stale approval waits | `baseDocument` CAS and SHA-256 `expectedRevision` | stale-before-plan and changed-during-approval tests | PASS |
| One batch produces one approval/effect and no partial siblings | `workbench.verb_batch` gateway call | canonical subject and atomic result tests; one rendered trace | PASS |
| Raw mutations use revision, policy and canonical gateway | `workbench_apply` | raw validation/stale/policy/gateway tests | PASS |
| Unsafe whole-document undo cannot overwrite another agent | undo/history API and all returned `undoToken` fields removed in `1d17631` | regression proves no token/API; static audit | PASS by explicit guide-approved removal |
| Human/keyboard/pointer/agent split paths share pane constraints | `DEFAULT_PANE_CONSTRAINTS`, `ratioBounds`, `canSplit`, `layoutFits`, SplitPane | 125 workbench tests; rendered keyboard/pointer/agent scenario | PASS |
| Divider track is included in real geometry and ARIA bounds | measured divider/token fallback, distributable axis, ResizeObserver | Home: 239.98/368 px at ARIA 39; pointer max: 367.99/240 px at ARIA 61 | PASS |
| Agent refusal is actionable and changes nothing | `verbProblem` and atomic plan result | repeated `arrange workbench`: zero changes, exact too-small message | PASS |
| Dialog restores exact invoker/fallback across close paths | `focus.ts`, `Dialog.tsx` | Escape/X/programmatic/nested/removed-invoker tests; launcher browser smoke | PASS |
| ObjectMenu restores on Escape/click-away/action and removed invoker | invoker propagation and unmount restoration in `createPbui.tsx` | unit matrix and real product right-click sequence | PASS |
| New transient surface wins over stale restoration | `TRANSIENT_SELECTOR` guard | nested surface regression | PASS |

Primary commits: `27b00258`, `ceaea2a`, `ab2a629`, rendered corrections `01452a8`, rendered evidence `0be23a3`, unsafe undo removal `1d17631`.

Rendered artifacts:

- `various/phase4-object-menu-action-focus.png`
- `various/phase4-rendered-pane-minimum.png`
- `various/phase4-agent-atomic-split-and-refusal.png`

Phase 4 slip evidence:

- Correct completion print: `2026-08-25T20:07:50Z`, 384×881, two printer segments, `JS=615 PASS`.
- An earlier paper at `20:07:38Z` contained incorrect arithmetic (`813`) and is explicitly superseded.

## 4. Phase 5 validation and release artifacts

| Evidence | Fresh result |
|---|---|
| `make protocol-check` | PASS; Buf lint and generated Go/TS diff clean |
| Relevant workspace typechecks | PASS: protocol, workbench, sandbox, chat, demo |
| Root PBUI typecheck | PASS |
| Frontend tests | Current final matrix: 613 PASS (102 root + 44 protocol + 125 workbench + 103 sandbox + 237 chat + 2 demo) |
| Relevant package production builds | PASS |
| Embedded demo production build | PASS; expected QuickJS browser-external/chunk-size warnings only |
| `GOWORK=off go test ./... -count=1` | PASS after Pinocchio bump |
| Focused Go race tests | PASS |
| `make ci-check` | PASS: fmt, lint, logcopter, glazed-lint, tests, generate/build |
| `make gosec` | PASS: 41 files, 7,751 lines, 0 issues |
| Root `consumer:smoke` | PASS from a clean npm consumer with React 19.2.8 |
| Root `pack:check` | PASS; 159 KiB tarball contains JS, declarations, CSS, README, LICENSE, package metadata |
| Embedded UI artifact digest | `541e0ff42cb4c9248eeb3fb83098b09ae4c4716416937f8490ffb67b7a8c441b` |
| Embedded binary digest (pre-final rebuild) | `cc950880ff140c80183fd8cd2238fd6a752a2bad04adfad8724ee2b66ef9b2eb` |
| npm pack digest | `4a207cafefd0ec53bb85495f913dc5a3fd50e9b89dfb4364f1e372f1ac5d212b` |
| PBUI static completion probe | `phase5-static-contract-audit.txt`: 20/20 PASS |
| Stable one-tab console | 0 errors, 0 warnings |
| `docmgr doctor --ticket PBUI-TOOLCALL-1` | PASS before blocker documentation |
| Pinocchio release consumption | exact `v0.11.16`; strict manifest acknowledgement and executor-bound result adapter; full/race validation PASS |
| npm dependency constraint | exact `@go-go-golems/chat-provider@0.6.0`; registry `next=0.6.0`; integrity `sha512-dMJsObne...MSm2sQ==` |
| Installed-package executor probe | PASS: terminal replay 1 execution/1 submission; two independent runtimes 1 execution/1 submission with exact assigned tuple |
| Real two-tab automatic tool | PASS: owner submitted results; non-owner submitted 0; one durable `program.open` effect envelope; no terminal/envelope conflict |
| Real two-tab human tool | PASS: owner displayed ACCEPT MODE; non-owner showed read-only requested history; owner alone submitted cancellation |
| Reconnect | PASS: client identity stable, connection/assignment rotated, old pending call was not reassigned, new call actionable only in reconnected owner |

The first unfiltered recursive typecheck failed only because `packages/datalab-ui` is intentionally excluded from this repository install and has no local dependency tree. The Makefile documents that exclusion. The complete installed/relevant workspace passed with `--filter '!@hyperslop-systems/datalab-ui'`; root PBUI was validated separately.

Phase 5 start slip printed successfully at `2026-08-25T20:08:01Z`. The Phase 5 completion slip is permitted after the final documentation/doctor/clean-tree audit.

## 5. Constraints audit

| Constraint | Evidence | Result |
|---|---|---|
| Preserve unrelated/user changes | commits stage explicit files; unrelated `PBUI-ACTIONS-1/scripts` content was never touched | PASS |
| No compatibility shim | unsafe undo removed; no PBUI-local executor lock or dual protocol added | PASS |
| No TODO/FIXME/HACK in hardened paths | static audit | PASS |
| No dead legacy approval/undo authorities | static audit and source search | PASS |
| No undocumented behavior changes | strict diary Steps 1–16, changelog, related-file notes, this audit | PASS so far |
| Coherent commits at intervals | implementation/evidence commits listed above | PASS |
| Required phase slips | Phase 2, 3, 4 completion and Phase 5 start recorded; Phase 5 completion follows final audit | PASS pending final print |
| Clean status/diff | implementation committed; evidence/docs will be committed after doctor | PASS pending final evidence commit |

## 6. Closed acceptance criterion — two tabs, one frontend executor

The architecture guide requires `two tabs, one frontend executor`. The coordinated implementation now satisfies it without a PBUI-local lock:

- Pinocchio `v0.11.16` creates and validates `(client_instance_id, connection_id, assignment_id)`.
- Chat-provider `0.6.0` filters before claim/effect/human controls and retains invocation-captured executor for result retries.
- PBUI's strict HTTP adapter returns exact manifest acknowledgement and echoes result executor provenance.
- `scripts/02-probe-installed-chat-provider-multitab.mjs` exits 0 against the exact installed registry package.
- The real two-tab Chromium run recorded one automatic owner, zero non-owner result submissions, one durable effect envelope, and zero terminal/effect conflicts.
- The owner alone entered human ACCEPT MODE; the non-owner retained a read-only requested projection.
- Reload retained `client_instance_id`, rotated connection/assignment, did not reassign the old pending call, and made a new human call actionable only in the reconnected owner.

Evidence:

- `various/phase5-executor-acceptance-evidence.json`
- `various/phase5-owner-human-tool.png`
- `various/phase5-non-owner-read-only.png`
- updated installed-package probe script

The earlier failing `0.5.0` artifacts remain as historical evidence and are explicitly superseded rather than rewritten.

## 7. Completion decision

**COMPLETE AFTER FINAL BOOKKEEPING.** Every Phase 2–5 requirement now maps to implementation, executable checks, immutable releases, or rendered browser evidence. The only remaining actions are to update the diary/changelog/tasks, run `docmgr doctor`, commit and push evidence, print the Phase 5 completion slip, and close the durable goal.
