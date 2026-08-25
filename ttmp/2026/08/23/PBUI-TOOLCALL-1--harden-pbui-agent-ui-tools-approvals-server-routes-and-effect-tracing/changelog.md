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

