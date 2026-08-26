# Changelog

## 2026-08-23

- Initial workspace created


## 2026-08-23

Wrote and validated the PBUI agent-to-UI architecture/design/implementation guide; frontmatter/doctor, 208 pbui-chat tests, focused Go tests, and 2 Mermaid renders pass

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/design-doc/01-pbui-agent-to-ui-hardening-architecture-security-approvals-implementation-guide.md — Primary intern implementation guide
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/reference/01-diary.md — Investigation and validation record


## 2026-08-23

Dry-ran, uploaded, and verified the PBUI guide at /ai/2026/08/23-deliveries/PBUI-TOOLCALL-1; recorded rmapi duplicate-parent recovery

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/reference/01-diary.md — Delivery failure/recovery record
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/02-remarkable-delivery.md — Canonical upload and listing evidence


## 2026-08-25

Phase 0 browser containment: isolated composer drafts and operation-scoped send context (commit 7b3ccd1)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/createPbuiChat.tsx — Operation-owned refs/focus
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/store/chatStore.ts — Conversation-owned drafts


## 2026-08-25

Phase 0 server boundary: required action authorization, ownership claims, filtered lists, and authorized subscriptions (commit a982f98)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/pkg/chatserver/authorization.go — Authorization contract
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/pkg/chatserver/server.go — Route enforcement


## 2026-08-25

Phase 1: replaced factory-local approval callbacks and spent sets with one canonical expiring consume-once ledger (commits 69678a3, f320dfc)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/createPbuiChat.tsx — Product-wide injection
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/tools/approvalLedger.ts — Ledger contract and local implementation


## 2026-08-25

Phase 2 interval 1: unified browser effect gateway, approval reservations, idempotency, revisions and report outbox (commit 1d05677)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/tools/agentEffectGateway.ts — Execution state machine
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/tools/approvalLedger.ts — Approval transaction lifecycle


## 2026-08-25

Phase 2 interval 2: authenticated durable effect schema, route, idempotent projection, hydration adapter and persistent outbox (commit 56a01b6)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/pkg/pbuichat/trace.go — Durable idempotent trace
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/proto/hyperslop/pbui/chat/v1/chat.proto — Effect wire contract


## 2026-08-25

Phase 2 interval 3: typed parent-effect correlation across router, wire, durable trace and hydration (commit 64b5f9d)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/router/createVerbRouter.ts — Router correlation
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/proto/hyperslop/pbui/chat/v1/chat.proto — Wire correlation


## 2026-08-25

Phase 2 validated end-to-end: Chromium handoff, canonical effect POST, rendered correlation, browser reload and SQLite server-restart hydration; full CI/security/package checks green; demo empty-suite failure repaired (commit 7ecc676)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/demo/src/pbui/vocabulary.test.ts — Demo regression validation
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase2-effect-inspector-server-restart.png — Durable rendered validation


## 2026-08-25

Phase 3 intervals: explicit runtime lifecycle/retry UI (c5365e6), server title revision CAS + migration (5916dc0), and local-first durable serialized title outbox (6a8d8c6). Phase 2 completion and Phase 3 start slips printed.

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/conversations/registry.ts — Lifecycle/title state machines
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/pkg/chatserver/sessions.go — Title CAS


## 2026-08-25

Phase 3 rendered validation complete: lifecycle close/reopen/timeout/retry, offline title outbox/reload/retry, cross-client conflict, index-reset recovery, and SQLite title persistence; fixes 5390506, b7ca909, a34cc68, 13dd824; full CI/security/package checks green.

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase3-lifecycle-open-failed.png — Lifecycle failure evidence
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase3-title-server-restart-persisted.png — Durable title evidence


## 2026-08-25

Phase 4 intervals: strict revision-bound atomic workbench plans (27b0025), shared rendered pane minima (ceaea2a), and Dialog/ObjectMenu focus restoration (ab2a629). Phase 3 completion and Phase 4 start slips printed.

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/tools/workbenchTools.ts — Atomic workbench gateway
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/src/focus.ts — Focus restoration


## 2026-08-25

Phase 4 rendered correction: exact launcher invoker restoration, divider-aware pane geometry and ARIA bounds, and shipped atomic workbench smoke scenario (01452a8); captured ObjectMenu, pane, and agent refusal screenshots.

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-workbench/src/components/Launcher/Launcher.tsx — Launcher focus correction
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-workbench/src/verbs.ts — Rendered geometry correction


## 2026-08-25

Phase 5 audit removed unsafe whole-document undo tokens (1d17631), consumed Pinocchio v0.11.14 (ac76a40), passed 20/20 PBUI static contracts, and reproduced the remaining two-tab executor failure in exact npm chat-provider 0.5.0. Phase 5 remains blocked; no completion slip.

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/tools/workbenchTools.ts — Undo correction
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/03-phase5-multitab-executor-blocker.md — Release blocker


## 2026-08-25

Rechecked the live npm release gate after continuation: chat-provider still has no version after immutable 0.5.0, so the documented two-tab executor blocker remains current and Phase 5 remains open.

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/reference/01-diary.md — Step 17 release-gate recheck
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/03-phase5-multitab-executor-blocker.md — Timestamped npm registry evidence


## 2026-08-25

Updated Phase 5 status for published chat-provider 0.5.1 and adopted the concise client, connection, and assignment executor contract without timed leases.

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/react-chat/ttmp/2026/08/23/REACT-CHAT-TOOL-RUNTIME-1--make-browser-tool-execution-idempotent-single-owner-and-manifest-safe/design-doc/02-concise-frontend-tool-executor-ownership-protocol.md — Authoritative cross-repository protocol


## 2026-08-25

Phase 5 executor blocker closed: trusted-published chat-provider 0.6.0, consumed Pinocchio v0.11.16, migrated strict adapter, passed installed-package probe and real two-tab automatic/human/reconnect acceptance (98d3156).

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/pkg/chatserver/handlers.go — Executor-aware server adapter
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase5-executor-acceptance-evidence.json — Final browser evidence


## 2026-08-25

Ticket closed


## 2026-08-25

PR 11 review: persisted demo approval consumption, serialized program events, counted only accepted messages, and made workspace creation singleton-safe (ef6ad86).

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/demo/src/approvalConsumption.ts — Reload-safe spent capability marker
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-sandbox/src/host/useProgramInstance.ts — Event sequencing
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-workbench/src/verbs.ts — Singleton-aware workspace creation
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/pkg/chatserver/handlers.go — Post-acceptance session touch

