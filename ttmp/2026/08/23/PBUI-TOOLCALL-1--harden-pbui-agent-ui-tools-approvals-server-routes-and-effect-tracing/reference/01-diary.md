---
Title: Diary
Ticket: PBUI-TOOLCALL-1
Status: active
Topics:
    - chat
    - frontend
    - backend
    - onboarding
DocType: reference
Intent: long-term
Owners:
    - manuel
RelatedFiles:
    - Path: repo://cmd/pbui-chat/cmds/serve.go
      Note: |-
        Loopback-only development authorization (commit a982f98)
        Persistent sessions/title index CLI flag (commit a34cc68)
    - Path: repo://packages/pbui-chat/demo/src/pbui/vocabulary.test.ts
      Note: Executable demo handoff and trace vocabulary contract (commit 7ecc676)
    - Path: repo://packages/pbui-chat/src/adapters/traceAdapter.ts
      Note: Live/hydrated effect envelope decoding (commit 56a01b6)
    - Path: repo://packages/pbui-chat/src/composer/Composer/Composer.tsx
      Note: Exact conversation draft selection (commit 7b3ccd1)
    - Path: repo://packages/pbui-chat/src/conversations/ConversationScope.tsx
      Note: Closed/opening/failed/closing UI and recovery actions (commit c5365e6)
    - Path: repo://packages/pbui-chat/src/conversations/conversations.test.tsx
      Note: Cross-conversation and failed-send context regressions (commit 7b3ccd1)
    - Path: repo://packages/pbui-chat/src/conversations/registry.ts
      Note: Explicit lifecycle and durable versioned title outbox (commits c5365e6, 6a8d8c6)
    - Path: repo://packages/pbui-chat/src/createPbuiChat.tsx
      Note: |-
        Request-identity send context and failure cleanup (commit 7b3ccd1)
        One ledger injected into every conversation toolset (commit f320dfc)
        Product-wide gateway and effect reporter wiring (commit 1d05677)
    - Path: repo://packages/pbui-chat/src/router/createVerbRouter.ts
      Note: Typed parent effect correlation on verb reports (commit 64b5f9d)
    - Path: repo://packages/pbui-chat/src/store/chatStore.test.ts
      Note: Draft isolation/clear/forget regressions (commit 7b3ccd1)
    - Path: repo://packages/pbui-chat/src/store/chatStore.ts
      Note: Conversation-keyed draft ownership (commit 7b3ccd1)
    - Path: repo://packages/pbui-chat/src/tools/agentEffectGateway.test.ts
      Note: Race, retry, conflict, release and envelope regressions (commit 1d05677)
    - Path: repo://packages/pbui-chat/src/tools/agentEffectGateway.ts
      Note: |-
        Unified effect identity, approval lifecycle, execution and report outbox (commit 1d05677)
        Persistent retry outbox (commit 56a01b6)
    - Path: repo://packages/pbui-chat/src/tools/approvalLedger.ts
      Note: |-
        Canonical shared approval authority (commit 69678a3)
        Reservation/finalization/release state machine (commit 1d05677)
    - Path: repo://packages/pbui-chat/src/tools/conversationTools.ts
      Note: |-
        Sender/target/prompt/reference-bound approvals (commit f320dfc)
        Gateway-routed handoff effects (commit 1d05677)
    - Path: repo://packages/pbui-chat/src/tools/sandboxTools.ts
      Note: |-
        Canonical sandbox approval subjects (commit f320dfc)
        Gateway-routed library and program effects (commit 1d05677)
    - Path: repo://packages/pbui-chat/src/tools/workbenchTools.ts
      Note: |-
        Canonical workbench and raw approval subjects (commit f320dfc)
        Gateway-routed verbs and raw mutations (commit 1d05677)
    - Path: repo://packages/pbui-chat/src/types.ts
      Note: Public effect correlation trace fields (commit 64b5f9d)
    - Path: repo://pkg/chatserver/authorization.go
      Note: Required principal/session policy contract (commit a982f98)
    - Path: repo://pkg/chatserver/authorization_test.go
      Note: Cross-principal HTTP and WebSocket regressions (commit a982f98)
    - Path: repo://pkg/chatserver/handlers.go
      Note: |-
        Ownership claim and list filtering (commit a982f98)
        Authenticated effect submission handler (commit 56a01b6)
        Version-aware title PATCH conflict response (commit 5916dc0)
    - Path: repo://pkg/chatserver/server.go
      Note: Authorized route and subscribe boundaries (commit a982f98)
    - Path: repo://pkg/chatserver/sessions.go
      Note: Atomic title revision CAS and SQLite migration (commit 5916dc0)
    - Path: repo://pkg/pbuichat/plugin.go
      Note: Strict browser effect decoding and digest validation (commit 56a01b6)
    - Path: repo://pkg/pbuichat/trace.go
      Note: |-
        Idempotent effect recording and durable projection (commit 56a01b6)
        Durable verb/effect correlation (commit 64b5f9d)
    - Path: repo://proto/hyperslop/pbui/chat/v1/chat.proto
      Note: |-
        Durable effect envelope and command schema (commit 56a01b6)
        Generated correlation wire fields (commit 64b5f9d)
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase2-correlated-verb-hydrated.png
      Note: Hydrated parent effect correlation on high-level verb
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase2-effect-inspector-hydrated.png
      Note: Browser-reload effect hydration evidence
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase2-effect-inspector-live.png
      Note: Rendered live canonical effect envelope inspection
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase2-effect-inspector-server-restart.png
      Note: SQLite server-restart hydration evidence
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase3-lifecycle-closed.png
      Note: Rendered explicit closed state
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase3-lifecycle-open-failed.png
      Note: Rendered bounded opening timeout and retry UI
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase3-lifecycle-reopened.png
      Note: Rendered reopen with transcript
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase3-lifecycle-retry-recovered.png
      Note: Rendered recovery after server restart
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase3-title-conflict-visible.png
      Note: Rendered cross-client title conflict without local revert
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase3-title-human-synchronized.png
      Note: Rendered human title at server revision 2
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase3-title-offline-queued.png
      Note: Rendered local-first offline title and retry state
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase3-title-retry-synchronized.png
      Note: Rendered outbox retry success
    - Path: repo://ttmp/2026/08/23/PBUI-TOOLCALL-1--harden-pbui-agent-ui-tools-approvals-server-routes-and-effect-tracing/various/phase3-title-server-restart-persisted.png
      Note: Rendered SQLite-backed title after server restart
ExternalSources: []
Summary: Chronological investigation, design, validation, and delivery record for PBUI-owned agent-to-UI hardening work.
LastUpdated: 2026-08-23T17:25:00-04:00
WhatFor: Let implementers retrace route security, approval, effect tracing, conversation state, workbench, and accessibility design decisions.
WhenToUse: When implementing, reviewing, resuming, or testing PBUI-TOOLCALL-1.
---










# Diary

## Goal

Record how PBUI-AGENT-4 findings were converted into a repository-owned architecture and implementation guide, with validation and delivery evidence.

## Step 1: Partition PBUI-owned fixes and design shared primitives

I separated PBUI responsibilities from the Pinocchio pending-call manager and react-chat browser runtime. The PBUI guide covers route authorization, unified approvals, effect tracing, drafts/lifecycle/title/send correctness, workbench semantics, focus, contracts, pane sizing, and dependency integration.

The document preserves PBUI's typed object/verb architecture. It does not propose direct model-to-DOM control or three separate local patches for approval. Instead it introduces one approval ledger and one effect gateway so workbench, sandbox, and conversation tools share exact one-shot semantics and causal audit records.

### Prompt Context

**User prompt (verbatim):** "Create a new docmgr ticket for each repo and write a detailed design doc for each.\n\nFor each repo:\nCreate  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.\n\n[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Create a new PBUI ticket with a standalone intern guide for every PBUI-owned fix, validate it, and upload it.

**Inferred user intent:** Turn the review findings into an actionable repository-specific handoff instead of leaving implementation scattered across the broader PBUI-AGENT-4 review.

### What I did

- Created `PBUI-TOOLCALL-1` and tasks for writing, validation, and delivery.
- Reused source- and browser-backed PBUI-AGENT-4 evidence while independently mapping the affected PBUI files.
- Explained package layers, tool/verb/effect distinctions, server route matrix, factory policy paths, conversation/store ownership, workbench mutation paths, and UI primitives.
- Wrote target APIs, diagrams, pseudocode, phased file-level changes, cross-repo rollout, test matrices, risks, and intern checklist.

### Why

- PBUI owns the product policy and actual UI state even when Pinocchio/chat-provider transport the call.
- Local factory `spent` sets cannot enforce durable cross-factory approval.
- Tool traffic alone cannot explain raw/sandbox effects; trace correlation needs a product effect envelope.
- The shared draft/lifecycle/title/send defects are ownership mistakes adjacent to the tool path and should be fixed in the same PBUI implementation plan.

### What worked

- The existing per-conversation tool closure is correct and can carry invocation/effect context.
- `VerbRouter` already centralizes validation, actor attribution, and ordered trace reporting.
- Workbench/sandbox factories expose focused seams for replacing policy callbacks with a gateway.

### What didn't work

N/A during document authoring. No PBUI implementation behavior was changed.

### What I learned

- Server auth and Pinocchio invocation matching solve different problems and both are required.
- Approval reservation/finalization must account for a local effect succeeding while result delivery fails.
- Conversation drafts should be keyed narrowly; duplicating the full chat store would break intentionally shared watchlist/inspector state.

### What was tricky to build

The guide spans frontend, Go server, workbench, sandbox, and accessibility without becoming a second monolithic rewrite. The phased plan starts with three Critical containment changes, then introduces shared primitives before migrating individual effects. Cross-repo dependency work is explicit so PBUI does not reimplement Pinocchio/chat-provider state machines.

### What warrants a second pair of eyes

- Choice and persistence boundary for the approval ledger.
- Effect envelope payload/redaction and relation to existing verb trace.
- Workbench atomic-plan and revision format.
- Secure development defaults and integration with `pkg/authkit`.

### What should be done in the future

- Implement route authorization and conversation-keyed drafts first alongside the Pinocchio containment bump.
- Introduce approval/effect primitives before editing individual factory behavior.
- Validate with live multi-conversation, multi-tab, double-response, reconnect, and keyboard browser tests.

### Code review instructions

- Start with `pkg/chatserver/server.go`, `packages/pbui-chat/src/createPbuiChat.tsx`, and the three tool factories.
- Map each code change to one invariant and one targeted test from the design.
- Run all PBUI JS/TS/Go/package/consumer checks after dependency bumps.

### Technical details

The two central product APIs are:

```ts
ApprovalLedger.consume(capability, canonicalSubject, effectId)
AgentEffectGateway.execute({ invocation, effect, policy, approval, expectedRevision, perform })
```

## Step 2: Validate the guide and current PBUI baseline

The finished guide is 873 lines and 4,360 words. Frontmatter and doctor pass, both Mermaid diagrams render, 208 pbui-chat tests pass, and focused Go chatserver/pbuichat packages pass.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Validate that the repository-specific guide is structurally sound, renderable, and based on a green current subsystem baseline.

**Inferred user intent:** Deliver a trustworthy intern handoff with concrete review/validation commands.

### What I did

- Ran frontmatter validation and `docmgr doctor --ticket PBUI-TOOLCALL-1`.
- Ran the complete pbui-chat test suite (21 files, 208 tests).
- Ran `GOWORK=off go test ./pkg/chatserver ./pkg/pbuichat -count=1`.
- Rendered both Mermaid diagrams with Mermaid CLI.
- Related the guide to eight focused PBUI source files.

### Why

- The ticket spans TypeScript tool/runtime integration and Go server boundaries.
- PDF delivery must not degrade diagrams into parser-error code blocks.

### What worked

```text
pbui-chat: 21 files, 208 tests passed
pkg/chatserver: ok
pkg/pbuichat: ok
Doctor: all checks passed
Mermaid: 2/2 PASS
```

### What didn't work

The first Mermaid command could not find `mmdc` on the active PATH:

```text
/bin/bash: mmdc: command not found
```

The rerun used `/home/manuel/.nvm/versions/node/v22.22.1/bin/mmdc` with a no-sandbox Puppeteer config and both diagrams passed.

### What I learned

- Existing green suites establish baseline but do not cover the new multi-principal/multi-tab/approval replay matrices.
- The repository's current source boundaries align with the guide's phased ownership.

### What was tricky to build

The guide deliberately validates only affected package baselines now; broader CI/consumer tests belong to implementation dependency bumps. This avoids implying documentation-only changes prove future cross-repo behavior.

### What warrants a second pair of eyes

- Verify authkit integration and development defaults before any server implementation.
- Review approval/effect persistence choices for privacy and atomicity.

### What should be done in the future

- Implement the phased design and run the complete PBUI CI/protocol/package/browser matrix.

### Code review instructions

- Use the invariant list and phase exit conditions as the review checklist.
- Re-run doctor, focused tests, and Mermaid rendering after design edits.

### Technical details

Renderer evidence is `various/01-mermaid-render.txt`; focused validation commands and outcomes are recorded above.

## Step 3: Deliver the guide to a canonical reMarkable path

After a successful dry run, the guide uploaded and was verified under the unique `23-deliveries` root. The first parallel upload attempt exposed an rmapi directory-creation race, so canonical delivery was repeated sequentially rather than trusting success output alone.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Upload the validated PBUI guide and preserve verifiable delivery evidence.

**Inferred user intent:** Make the design available for offline reading on reMarkable at a dependable path.

### What I did

- Dry-ran the exact final bundle destination.
- Uploaded one design-document PDF with ToC depth 2.
- Verified the exact remote listing.
- Added `various/02-remarkable-delivery.md`.

### Why

- CLI success alone was insufficient after duplicate remote directory names appeared.
- A unique parent avoids ambiguous rmapi path resolution without destructive remote cleanup.

### What worked

```text
OK: uploaded PBUI-TOOLCALL-1 Agent UI Hardening Guide.pdf -> /ai/2026/08/23-deliveries/PBUI-TOOLCALL-1
[f] PBUI-TOOLCALL-1 Agent UI Hardening Guide
```

### What didn't work

Parallel uploads reported repeated warnings:

```text
remote tree has changed, refresh the file tree
```

and created three collections named `23`. Pinocchio/react-chat exact-path listings initially failed. No remote deletion was attempted because duplicate-name cleanup by path is unsafe.

### What I learned

- reMarkable directory creation must be serialized when several uploads share a missing parent.
- Verification must use an unambiguous exact path.

### What was tricky to build

The first PBUI file itself was visible, but the shared parent was ambiguous. A new unique `23-deliveries` root allowed sequential, verifiable delivery while preserving unknown remote content.

### What warrants a second pair of eyes

- Optional manual cleanup of duplicate `23` collections should use remote object IDs, not names.

### What should be done in the future

- Use the canonical delivery path recorded in `various/02-remarkable-delivery.md`.

### Code review instructions

- Open the PDF and inspect both Mermaid diagrams and the ToC.

### Technical details

Canonical path: `/ai/2026/08/23-deliveries/PBUI-TOOLCALL-1`.

## Step 4: Isolate conversation drafts and send operations

I began Phase 0 with the two browser-state containment defects that can land independently of server authorization. Composer text and inserted references now belong to explicit conversation ids, while intentionally product-wide inspector, focus, watchlist, table, and tile state remain shared.

Send context is now keyed by the exact `SendMessageRequest` object using a `WeakMap`, not by conversation id. This gives concurrent same-conversation sends distinct identity and guarantees `finally` cleanup when WebSocket or manifest preflight fails before `sendMessageBody` executes.

### Prompt Context

**User prompt (verbatim):** "I guess it's time now to address PBUI-TOOLCALL-1

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Resume the PBUI remediation ticket, account for landed cross-repository prerequisites, and implement its phases in tested commits.

**Inferred user intent:** Move from architecture review into concrete PBUI security and correctness remediation.

**Commit (code):** `7b3ccd1ec5ac647a396f9ae6408fb7338ff2a465` — "fix(pbui-chat): isolate conversation send state"

### What I did

- Replaced the singleton `draft` with `drafts[conversationId]` and explicit draft APIs.
- Updated Composer and stories to resolve an exact conversation before reading/writing/sending.
- Added clear/forget semantics scoped to one conversation.
- Replaced conversation-keyed pending send context with request-identity `WeakMap` state and `try/finally` cleanup.
- Added draft isolation and failed-preflight regression coverage.
- Confirmed chat-provider 0.5.0 is already published under npm's `next` tag and PBUI pins that exact version.

### Why

- Two open tiles must never mirror text/reference chips.
- A failed or concurrent send must not attach one operation's references to another message.

### What worked

```text
pbui-chat typecheck                 # PASS
pbui-chat tests                     # 22 files, 211 PASS
```

### What didn't work

The first typecheck inferred the constant empty draft's `refs` as `{}` and rejected dynamic reference indexing:

```text
TS7053: Element implicitly has an 'any' type because expression of type 'string' can't be used to index type 'Record<string, Reference<...>> | {}'.
```

Typing the stable empty value as `ComposerDraft` fixed the selector without a cast or widened store state.

### What I learned

- `sendMessageBody` receives the same request object passed to chat-provider `send`, so object identity provides an operation key without a protocol/API change.
- npm `latest` remains chat-provider 0.4.2, but exact 0.5.0 is published under `next`; PBUI's exact dependency therefore resolves the hardened runtime.

### What was tricky to build

A per-conversation queue still cannot distinguish two identical concurrent prompts. Request-object identity does, and a `WeakMap` avoids retention after operation completion. The test blocks the mocked send long enough to invoke body construction with that exact object, proving isolation through the real callback seam.

### What warrants a second pair of eyes

- Decide draft persistence/eviction policy before adding durable storage.
- Review whether forgetting a conversation should call `forgetDraft` directly in the registry integration.

### What should be done in the future

- Implement explicit chatserver principal/session authorization under task `k5uo`.
- Continue unified approval/effect gateway phases after the security boundary.

### Code review instructions

- Start in `chatStore.ts`, then trace conversation resolution in `Composer.tsx`.
- Review `sendTo` and `sendMessageBodyFor` together; their shared request object is the invariant.
- Run `pnpm --filter @hyperslop-systems/pbui-chat typecheck` and `pnpm --filter @hyperslop-systems/pbui-chat test`.

### Technical details

The react-chat Go release failure was diagnosed separately: the repository is `github.com/go-go-golems/react-chat`, but its module declared nonexistent `github.com/go-go-golems/chat-overlay`. Commit `4c7ffae` fixes the module path and PR 13 carries it; the already-pushed invalid v0.0.2 tag should not be moved, so the next valid Go release is v0.0.3.

## Step 5: Fail closed at every chat session boundary

I added a required chatserver authorization contract and applied it before every session operation. HTTP routes now authenticate once and authorize explicit actions, lists are filtered through read policy, creation claims ownership before returning an id, and WebSocket subscriptions reuse the authenticated HTTP principal inside sessionstream's subscribe authorizer.

The built-in permissive policy is explicitly named `DevelopmentAuthorizer`; callers must opt into it, and the demo CLI refuses non-loopback binding while using it. There is no silent unauthenticated server default.

### Prompt Context

**User prompt (verbatim):** "continue

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Continue implementing the next PBUI-TOOLCALL-1 phase without stopping at the browser-state commit.

**Inferred user intent:** Complete the server security boundary and proceed through the remediation plan with tests and bookkeeping.

**Commit (code):** `a982f980a24d88661280a30aff9d5b0efb02448e` — "feat(chatserver): authorize session routes"

### What I did

- Added principal, action, authentication, ownership-claim, list, and session-access contracts.
- Made `Options.Authorizer` mandatory and fail-closed during construction.
- Wrapped create/list/read/retitle/send/stop/manifest/result/verb/WS routes.
- Filtered session lists and installed sessionstream's subscription authorizer.
- Restricted the development-authorized CLI to loopback hosts.
- Added unauthenticated, cross-principal, existence-nondisclosure, list-filtering, and WebSocket-denial tests.

### Why

A caller knowing a session UUID must not gain snapshot, mutation, tool-result, trace, or streaming access. Authorization must precede body parsing and domain side effects.

### What worked

- `go test ./... -count=1`: passed.
- `make lint`: passed with zero issues.
- `make gosec`: passed with zero issues.
- PBUI chat typecheck and all 211 tests: passed.

### What didn't work

The first focused Go test invocation failed because `go test`/vet rejected formatting a cleanup function with `%v`:

```text
pkg/chatserver/authorization_test.go:109:49: (*testing.common).Fatalf format %v arg cleanup is a func value, not called
```

The assertion now reports boolean presence for the server and cleanup function.

### What I learned

Sessionstream already exposes `WithSubscribeAuthorizer`; the upgraded request context survives into subscribe handling, so PBUI can enforce the same principal without parsing protocol frames itself.

### What was tricky to build

Authorization has two moments for a newly minted UUID: permission to create and atomic policy ownership claim. Claiming before indexing/responding avoids returning an unowned capability. For WebSockets, authenticating only the upgrade is insufficient because each subscribe names a session; both layers are now enforced.

### What warrants a second pair of eyes

- Production authorizers must persist ownership consistently with their identity store; the development implementation intentionally does not model tenancy.
- Manifest/result policy has explicit actions but executor `ClientID` binding remains a coordinated protocol-v2 task.

### What should be done in the future

Implement the canonical approval ledger and effect gateway, then lifecycle/workbench/focus phases.

### Code review instructions

- Start at `authorization.go`, then inspect wrappers and route matrix in `server.go`.
- Verify create/list handling in `handlers.go` and subscribe policy in `NewServer`.
- Run `go test ./... -count=1`, `make lint`, and `make gosec`.

### Technical details

Foreign existing and missing session ids both return `403 forbidden` after successful authentication. Public health and vocabulary endpoints remain outside session authorization by design.

## Step 6: Establish the canonical approval authority

I printed both the remaining ticket plan and a dedicated Phase 1 start slip before changing code. I then introduced the shared approval vocabulary and an offline ledger implementation as the first independently reviewable Phase 1 commit; tool-factory migration follows in the next step rather than mixing representation, authority, and call-site changes in one diff.

Subjects now canonicalize domain inputs, sender, scope, targets, and reference keys before SHA-256 digesting. Capabilities are immutable, expiring, bounded, cannot be rebound to a different subject, and atomically move from available to consumed once across every caller sharing the ledger.

### Prompt Context

**User prompt (verbatim):** "continue. Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done.

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Continue the ticket, print its overall plan, and use thermal start/completion gates around every subsequent implementation phase.

**Inferred user intent:** Keep the long remediation sequence physically visible and make phase boundaries explicit before code starts and after validation succeeds.

**Commit (code):** `69678a32e7620aaa297c9db8e8ae94ec99d003e3` — "feat(pbui-chat): add canonical approval ledger"

### What I did

- Printed the overall six-phase ticket work slip and Phase 1 start slip successfully.
- Added canonical approval subjects, capabilities, consume results, and ledger interface.
- Added deterministic JSON normalization and SHA-256 subject digests.
- Added bounded, expiring `InMemoryApprovalLedger` for offline products/tests.
- Added grant, lookup, exact-capability validation, mismatch, expiry, and global consume-once tests.
- Committed the ledger core separately before factory integration.

### Why

Factory-local callback signatures and `spent` sets cannot enforce one authority across workbench, sandbox, conversation, and raw effects. A canonical subject and shared CAS-like consume operation are the minimum safe seam.

### What worked

```text
pbui-chat typecheck                     PASS
pbui-chat tests                         23 files, 216 PASS
thermal overall plan                    printed
thermal Phase 1 start                   printed
```

### What didn't work

N/A

### What I learned

- Browser and current Node test runtimes both expose Web Crypto SHA-256, avoiding a Node-only hashing dependency.
- Treating target/reference collections as sorted sets prevents ordering differences from changing authority while argument arrays preserve semantic order.

### What was tricky to build

Canonical JSON must reject non-finite numbers, normalize negative zero, sort object keys recursively, omit undefined object fields, and preserve array order. The ledger also compares the complete immutable capability returned by lookup, so a caller cannot extend expiry by forging a new object with the same id and digest.

### What warrants a second pair of eyes

- Confirm whether a production server-backed ledger should retain consumed records beyond capability expiry for audit/replay diagnostics.
- The current consume operation intentionally fails closed by burning authority before a later effect; the Phase 2 gateway should add reservation/finalization semantics for revision-rejected local effects.

### What should be done in the future

- Replace every factory-local approval callback/set with this shared ledger.
- Expose product-level grant/lookup integration for approved `pbui_propose` results.

### Code review instructions

- Review `approvalLedger.ts` from `createApprovalSubject` through `consume` invariants.
- Run `pnpm --filter @hyperslop-systems/pbui-chat typecheck` and `pnpm --filter @hyperslop-systems/pbui-chat test`.

### Technical details

Default local retention is 1,000 entries with a five-minute TTL. Unconsumed expired entries are pruned; consumed entries remain bounded so replay reports `already-used` until eviction.

## Step 7: Replace every local approval island

I migrated workbench, raw mutation, sandbox, and cross-conversation tools to the product-wide ledger and removed the four incompatible callback APIs plus both factory-local `spent` sets. `createPbuiChat` now injects one ledger into every per-conversation toolset while each factory constructs a domain-specific canonical subject with the exact sender and tool-call effect identity.

The demo now uses one timeline-backed ledger adapter: it still treats hydrated `pbui_propose` results as the human-decision source of truth, but consumption is shared globally instead of living independently in tool closures. I validated the public package and printed the Phase 1 completion slip with the integration commit QR.

### Prompt Context

**User prompt (verbatim):** "commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Finish Phase 1 in focused increments, preserving a detailed implementation and validation trail.

**Inferred user intent:** Make approval replay prevention an actual shared runtime invariant, not merely a new unused abstraction.

**Commit (code):** `f320dfc55973fc4c5518b872cba5f92da76b8377` — "feat(pbui-chat): unify consequential approvals"

### What I did

- Added `approvalLedger` as one top-level `createPbuiChat` dependency.
- Injected exact `senderConversationId` and the same ledger into every per-session factory.
- Canonicalized workbench verbs, raw mutation batches, full sandbox writes, and conversation target/prompt/reference subjects.
- Correlated consumption with conversation id + provider tool-call id.
- Removed public `isApproved` and `isRawApproved` callback seams and local spent sets.
- Migrated demo timeline approval lookup and all affected tests.
- Added a real-ledger conversation regression proving target/prompt/reference mismatch does not consume the capability.
- Printed the Phase 1 completion status slip.

### Why

An approval spent in one factory must not remain usable in another factory, recreated closure, or neighboring conversation. Domain callbacks also made it impossible to audit one canonical authority contract.

### What worked

```text
pbui-chat typecheck                     PASS
pbui-chat tests                         23 files, 217 PASS
pbui-chat production build              PASS
Phase 1 completion work slip            printed
```

### What didn't work

The first migration typecheck correctly failed at every old callback and every direct factory test that did not yet provide `senderConversationId`. This was expected compiler evidence that no hidden compatibility path remained. The concrete failures included:

```text
'isApproved' does not exist in type ...
'isRawApproved' does not exist in type ...
Property 'senderConversationId' is missing ...
```

Tests were migrated to small `ApprovalLedger` fakes that inspect canonical subjects, plus real-ledger integration coverage; no callback shim was added to production.

### What I learned

- Provider `toolCallId` is already available at every mutating execute seam and composes cleanly with the immutable conversation id for effect correlation.
- Full sandbox authority must include source, bindings, behavior, documents, and open options rather than only `kind` and a display label.
- Raw protobuf JSON should be authorized in its original canonical input form, not by inventing a lossy stand-in verb.

### What was tricky to build

Each tool dialect identifies targets differently. Workbench subjects extract placement/workspace/view/split/app ids; sandbox subjects retain the full write verb and program/action ids; conversation subjects separate prompt arguments, target conversation, and sorted reference keys. The test harnesses had to inspect this common representation while retaining consume-once behavior, otherwise tests would accidentally reintroduce callback semantics under another name.

### What warrants a second pair of eyes

- The demo timeline adapter validates the approved target and message but does not yet encode references into its human proposal fields; production ledgers must compare the complete canonical digest.
- Current ledger `consume` burns before the domain effect executes. Phase 2 needs reservation/finalization/release so validation or revision rejection before a side effect does not waste authority while post-effect transport failure never restores it.

### What should be done in the future

Implement the AgentEffectGateway with approval reservation, effect envelopes, causal tracing, and outcome-aware finalization.

### Code review instructions

- Start with top-level injection in `createPbuiChat.tsx`.
- Compare canonical construction in `conversationTools.ts`, `workbenchTools.ts`, and `sandboxTools.ts`.
- Verify there are no production `isApproved`, `isRawApproved`, or approval-local `spent` sets.
- Run package typecheck, tests, and build.

### Technical details

Confirm-policy tools fail closed when no ledger exists. Allow-policy tools remain usable. One capability is consumed before the routed/local side effect; the next phase replaces this conservative ordering with a reservation state machine tied to a durable effect id.

## Step 8: Put agent effects behind one execution state machine

I replaced the Phase 1 consume-before-perform seam with an `AgentEffectGateway` that owns exact effect identity, concurrent/terminal idempotency, approval reservation/finalization/release, revision evidence, canonical envelopes, and retryable trace reporting. Every high-level workbench verb, raw protobuf mutation batch, sandbox write/open/remove, and cross-conversation send now enters this gateway rather than implementing policy and approval ordering independently.

This is the first Phase 2 implementation interval. The browser now POSTs envelopes to an authenticated session effect route and retains failed reports in a bounded runtime outbox; the next interval adds the server command/schema/timeline projection that durably accepts that route.

### Prompt Context

**User prompt (verbatim):** "phase 2 - 4, budget 500k, commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill) [REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Complete ticket phases 2–4 under a durable 500K-token goal, committing reviewable increments and maintaining the strict implementation diary throughout.

**Inferred user intent:** Finish the remaining runtime, lifecycle, workbench, and focus hardening comprehensively with enough evidence and history to audit every phase.

**Commit (code):** `1d05677998a21ce88deadf2f641dcf1248739554` — "feat(pbui-chat): route agent effects through gateway"

### What I did

- Extended `ApprovalLedger` from immediate consume to atomic reserve/finalize/release operations.
- Added bounded running/terminal effect identity and conflict detection.
- Added canonical `EffectEnvelope` creation with input digest, actor, conversation, scope, targets, references, approval, revisions, outcome, and timestamp.
- Added report retry/outbox behavior and opportunistic flushing.
- Routed conversation sends, workbench verbs, raw batches, and sandbox writes through one gateway.
- Added whole-document SHA-256 revision evidence for local workbench operations and version/timestamp evidence for sandbox records.
- Removed the superseded per-factory policy/consume implementation rather than retaining a compatibility path.
- Added gateway race, retry, conflict, approval release, denial, and envelope tests.

### Why

Approval authority must be reserved before an effect, finalized only after a performed outcome, and released after a pre-side-effect rejection. The same effect id must never execute twice after provider retries or concurrent duplicate delivery, and every outcome needs one canonical correlation envelope.

### What worked

```text
pnpm --filter @hyperslop-systems/pbui-chat typecheck   PASS
pnpm --filter @hyperslop-systems/pbui-chat test        24 files, 224 PASS
pnpm --filter @hyperslop-systems/pbui-chat build       PASS
```

### What didn't work

The first typecheck exposed that the local workbench document has no persisted `revision` field:

```text
Property 'revision' does not exist on type 'WorkbenchDocument'.
```

I replaced the false assumption with a deterministic SHA-256 digest of generated protobuf JSON. The first full test run then reported 10 failures because all three old test harnesses reused the literal provider id `t1` for distinct calls:

```text
EffectConflictError: effect agent-a:t1 was reused with different input
Test Files  4 failed | 20 passed
Tests  10 failed | 214 passed
```

That was valid production behavior and invalid test identity. Each harness now generates a fresh tool-call id per invocation; explicit gateway replay tests retain a fixed id and prove deduplication/conflict behavior.

### What I learned

- Provider tool-call identity is a usable idempotency key only when tests preserve its real uniqueness contract.
- The local workbench protocol separates mutable documents from server resources, so local revision evidence must be content-derived rather than fabricated from the remote resource schema.
- Validation should happen before gateway entry when possible; sandbox source/schema checks now run before approval reservation, while router/domain rejection releases the reservation.

### What was tricky to build

The gateway must distinguish four timing zones: validation before reservation, atomic reservation, potentially side-effecting execution, and durable report publication after outcome. A rejected domain result releases authority; a performed result finalizes it before reporting; a failed report never rolls back either the effect or approval and instead remains pending for retry. Concurrent identical requests share one promise, while the same key with a different canonical fingerprint throws before any side effect.

### What warrants a second pair of eyes

- The runtime outbox is bounded by effect terminal retention but is not yet persisted across page reload; server acceptance and any required browser persistence are reviewed in the next interval.
- If a remote ledger reports an impossible finalize/release state after the domain callback, the gateway throws loudly because silently claiming a safe outcome would hide an authority inconsistency.
- Sandbox create-and-open intentionally produces a parent library effect and a child workbench/router effect with related tool-call-derived ids.

### What should be done in the future

- Add the authenticated `/effects` route, protobuf command/event, durable timeline projection, and browser adapter.
- Add explicit router effect correlation fields and server/client end-to-end tests.
- Decide whether failed effect report outbox entries need durable browser storage beyond server retry semantics.

### Code review instructions

- Start with `agentEffectGateway.ts`, especially `execute`, `#executeOnce`, approval transitions, and `#record`.
- Review the ledger state transitions in `approvalLedger.ts` next.
- Trace one operation through each factory and `createPbuiChat.tsx` to confirm one shared gateway.
- Run package typecheck, all tests, and the production build.

### Technical details

Terminal effect retention defaults to 1,000 entries for 30 minutes. Approval retention remains 1,000 entries for five minutes. Effect fingerprints cover conversation, kind, scope, canonical input, policy, confirmation id, and before-revision so key reuse cannot silently return an unrelated cached result.

## Step 9: Persist and hydrate causal effect outcomes

I added the server half of the gateway contract: an authenticated `effect-write` route, generated protobuf envelope/command fields, strict digest and session validation, idempotent server recording, and reuse of the existing durable trace projection. Effect rows now hydrate and stream with the complete canonical envelope rather than hiding correlation in a free-form verb field.

I also made the browser report outbox durable across reloads through product-keyed storage. A failed effect POST survives gateway recreation and retries against the idempotent server endpoint; an outbox at its configured bound fails closed before another untraceable side effect begins.

### Prompt Context

**User prompt (verbatim):** (same as Step 8)

**Assistant interpretation:** Continue Phase 2 through a durable server and hydration boundary, keeping the change independently committed and fully tested.

**Inferred user intent:** Ensure effect tracing is actual persisted evidence, not a best-effort browser diagnostic that disappears offline or after reload.

**Commit (code):** `56a01b61108f5761f0e8442c9ebf8aab2076a62b` — "feat(chatserver): persist causal effect traces"

### What I did

- Added generated `EffectEnvelope` and `EffectPerformedCommand` protobuf contracts and attached envelopes to durable `TraceEntry` records.
- Added authenticated `POST /api/chat/sessions/{id}/effects` with its own action policy.
- Validated actor, scope, outcome, RFC3339 timestamp, session binding, SHA-256 shape, and recomputed canonical-input digest.
- Added idempotent effect-id recording and exact-envelope conflict rejection in the trace store.
- Reused existing UI-event and timeline projections so effect rows are live and hydrated under one ordered trace sequence.
- Extended the TypeScript adapter and public trace types to retain every effect correlation field.
- Added persistent browser outbox restore/flush behavior and fail-closed capacity handling.
- Added Go parser, conflict, digest, session, persistence, authorization, route, and duplicate-delivery tests plus frontend hydration/outbox tests.

### Why

A performed local effect cannot be undone merely because its trace POST failed. The report therefore needs durable retry on the browser and idempotent acceptance on the server, while the server must independently reject forged digests and cross-session envelopes.

### What worked

```text
go test ./pkg/pbuichat ./pkg/chatserver -count=1       PASS
pnpm pbui-chat typecheck                                PASS
pnpm pbui-chat tests                                    24 files, 225 PASS
pnpm pbui-chat production build                         PASS
buf lint                                                PASS
pre-commit GOWORK=off go test ./...                     PASS
pre-commit golangci-lint + logcopter + glazed-lint      PASS, 0 issues
```

### What didn't work

N/A

### What I learned

- The existing trace command/event/UI/timeline projection is the correct durable ordering substrate; a distinct effect timeline would duplicate retention and hydration logic.
- Server idempotency must compare the complete protobuf envelope, not only input digest and outcome, because a reused id could otherwise alter kind, approval, revision, or correlation fields silently.
- Trace entry time should remain server receipt time for trustworthy ordering; the client occurrence time belongs inside the envelope.

### What was tricky to build

Browser canonical JSON and Go `encoding/json` must hash the same bytes. Both recursively order object/map keys and preserve array order, allowing the server to recompute SHA-256 over `canonicalInput` rather than trusting the browser. Duplicate retries must publish no second event, while a same-id envelope difference must fail rather than overwrite or acknowledge ambiguous history. Hydration rebuilds the bounded effect-id index from persisted trace entries so idempotency survives process restart.

### What warrants a second pair of eyes

- Confirm cross-language canonical number formatting for any future non-integer numeric effect arguments; current workbench ratios and finite JSON numbers are covered by standard JSON behavior but deserve explicit vectors.
- Browser storage quota failure remains observable through `outboxError()` and retains the in-memory envelope, but cannot manufacture persistence when the platform storage itself is unavailable.
- The shared trace retention limit bounds the in-memory/persisted replay window; effect ids older than retention may be accepted again, while browser terminal retention is also bounded by design.

### What should be done in the future

- Add explicit router effect/invocation correlation to high-level verb trace rows rather than relying only on adjacent effect envelopes.
- Exercise the complete browser → authenticated route → snapshot hydration path in a rendered smoke scenario.
- Complete Phase 2 final validation and print its completion slip only after those checks.

### Code review instructions

- Review the proto contract, then `EffectCommandFromJSON`, `HandleEffectPerformed`, and `traceStore.addEffect`.
- Review `traceAdapter.ts` for generated-proto and loose-json parity.
- Review gateway outbox restore/persist/full behavior.
- Regenerate protocols, run Go tests, frontend typecheck/tests/build, and `buf lint`.

### Technical details

Effect routes accept only `actor=agent`, and route authorization occurs before body parsing. Existing and duplicate identical envelopes produce one durable trace entity. Foreign-session envelopes return `400`; foreign principals are rejected by session authorization before reaching the handler.

## Step 10: Correlate high-level verbs with parent effects

I added typed effect, invocation, and approval correlation to the existing high-level verb trace rather than embedding hidden provenance into the verb payload. Tool factories now pass the gateway identity through their router callback, and generated wire fields survive server recording and browser hydration.

This closes the structural correlation gap between the durable effect envelope and the user-facing verb row. Phase 2 still requires final end-to-end rendered smoke evidence and a complete validation sweep before its completion slip may be printed.

### Prompt Context

**User prompt (verbatim):** (same as Step 8)

**Assistant interpretation:** Continue Phase 2 with explicit trace correlation and commit the next coherent interval.

**Inferred user intent:** Make effect causality directly queryable and reviewable without conventions hidden inside arbitrary verb JSON.

**Commit (code):** `64b5f9d91adfcea17f00a58c445c03894a1747ff` — "feat(pbui-chat): correlate verb and effect traces"

### What I did

- Added typed `effectId`, `invocationKey`, and `approvalId` fields to verb commands and trace entries.
- Extended router `PerformOptions` and report bodies with those fields.
- Propagated correlation through conversation, workbench, and sandbox router effects.
- Recorded and hydrated correlation through generated Go/TypeScript schemas.
- Added browser router and Go trace regression coverage.

### Why

A nearby effect row is not sufficient causal evidence when traces interleave. Both the parent effect and child high-level verb need the same stable identifiers.

### What worked

```text
go test ./pkg/pbuichat ./pkg/chatserver -count=1       PASS
pbui-chat typecheck                                     PASS
pbui-chat tests                                         24 files, 226 PASS
buf lint                                                PASS
pre-commit full Go tests and quality checks             PASS, 0 issues
```

### What didn't work

N/A

### What I learned

Typed optional fields preserve existing human/router traces while making gateway-caused rows explicitly joinable.

### What was tricky to build

Correlation had to flow through the factory callback type, `createPbuiChat`'s session-bound closure, router report serialization, protobuf decoding, durable trace entry, and hydration adapter. Missing any one layer would produce correlation that appeared live but vanished after reload.

### What warrants a second pair of eyes

- Verify rendered trace tooling exposes these fields intelligibly rather than only retaining them in entity props.
- Confirm parent/child effect conventions for compound sandbox create-and-open operations.

### What should be done in the future

- Run browser-level effect execution and hydration smoke inspection.
- Run final Phase 2 protocol-generation, CI, security, package, and repository audit.
- Only then mark the task and print the Phase 2 completion slip.

### Code review instructions

- Trace `EffectCorrelation` from each factory through `createVerbRouter.report`, Go decoding, `TraceEntry`, and `traceAdapter`.
- Validate with Go tests, PBUI chat typecheck/tests, protocol generation, and `buf lint`.

### Technical details

Correlation remains optional for ordinary human actions. Gateway-originated high-level verbs use the immutable conversation/tool-call effect id and carry approval id only when a capability participated.

## Step 11: Validate Phase 2 through the rendered and durable boundaries

I built the full embedded application, ran the deterministic two-conversation handoff in Chromium, approved the exact proposal, and observed the real browser POST a canonical `conversation.send` effect envelope. The server accepted it, the trace pane rendered both the correlated high-level verb and durable effect row, and the inspector exposed the full identity, digest, target, approval, and occurrence fields. I then reloaded the browser and restarted the Go server against the same SQLite database; the exact digest and correlation fields hydrated after both boundaries.

The full validation sweep found that the demo package advertised a `test` script but had no test files, causing Vitest to exit 1. I did not suppress the failure with `--passWithNoTests`; I added a focused demo vocabulary contract test and committed it as `7ecc676dcd084957ecf2a281ad8e0af4129cdbf8`.

### Prompt Context

**User prompt (verbatim):**

> phase 2 - 4, budget 1M, commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill) [REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory.

**Assistant interpretation:** Resume the budget-limited ticket, finish Phase 2 with fresh rendered/durable evidence, and continue through lifecycle/title and workbench/focus phases without repeating completed implementation.

**Inferred user intent:** Complete every remaining hard acceptance criterion with auditable commits, failures, UI evidence, and phase slips rather than treating previously green unit tests as sufficient.

**Commit (validation regression):** `7ecc676dcd084957ecf2a281ad8e0af4129cdbf8` — "test(pbui-chat-demo): cover handoff vocabulary"

### What I did

- Rebuilt all PBUI/chat/workbench/sandbox/demo packages and the embedded Go binary.
- Ran a real Chromium handoff between two live conversation runtimes.
- Captured the successful `/effects` request and response, including effect id, invocation key, SHA-256 input digest, approval id, exact target, and `effect_recorded` acknowledgement.
- Inspected the live effect row and its correlated verb row in the rendered trace panel.
- Reloaded the browser and verified hydration from the server snapshot.
- Restarted the server against `/tmp/pbui-phase2-timeline.db` and verified the same trace after process recovery.
- Captured five rendered screenshots under the ticket `various/` directory.
- Ran protocol generation/diff checks, local CI, GoSec, every affected package typecheck/test/build, and embedded binary build.
- Added two demo vocabulary tests rather than allowing an empty test suite.

### Why

Phase 2 promises durable causal evidence. That is not demonstrated by an adapter unit test alone: the browser, authenticated route, command bus, SQLite trace, snapshot hydration, React trace panel, and inspector all have to preserve the same identity across reload and restart.

### What worked

```text
make protocol-check                                      PASS, generated diff clean
make ci-check                                            PASS
make gosec                                               PASS, 0 issues / 41 files
@hyperslop-systems/pbui typecheck                        PASS
@hyperslop-systems/pbui tests                            12 files / 96 PASS
pbui-workbench typecheck/tests                           9 files / 115 PASS
pbui-sandbox typecheck/tests                             15 files / 103 PASS
pbui-chat typecheck/tests                                24 files / 226 PASS
pbui-chat-demo typecheck                                 PASS
pbui-chat-demo tests after repair                        1 file / 2 PASS
make chat-build                                          PASS
Chromium console errors                                  0
POST /effects                                            200 effect_recorded
browser reload hydration                                 PASS
Go server restart + SQLite hydration                     PASS
```

### What didn't work

1. The first readiness loop probed `/health`, which is not a registered public path. The server had started successfully but the probe received `404`, so the loop reported failure. I inspected the process and responses, switched the readiness probe to `/`, and retained the server log evidence.
2. `pnpm --filter @hyperslop-systems/pbui-chat-demo test` failed with `No test files found, exiting with code 1`. I added a real vocabulary contract test.
3. The first new assertion expected `vocabulary.verbs["conversation.send"].danger === true`; `danger` is product UI metadata and is intentionally not part of the exported model vocabulary. The test failed with `expected undefined to be true`. I inspected the generated Go vocabulary JSON and corrected the test to assert the exported operation documentation and typed fields instead.
4. The first root-package filters omitted `--include-workspace-root`, producing `No projects matched`. I reran the root PBUI typecheck and 96 tests with the required flag.

### What I learned

- The rendered trace intentionally shows two `conversation.send` rows: one is the high-level routed verb with typed parent correlation and one is the durable effect envelope. Inspecting each proves the join explicitly.
- SQLite-backed timeline hydration reconstructs effect idempotency and UI projection after process restart; browser local storage is not the source of the recovered effect row.
- The demo's model vocabulary omits UI-only danger metadata, while the approval enforcement remains in the shared gateway/ledger.

### What was tricky to build

Rendered inspection itself emits human `inspect` verbs, so sequence numbers advance while collecting evidence. The durable effect retained sequence `#3`, and the correlated high-level verb retained `#2`; later inspect rows are expected evidence of user actions, not duplicate gateway execution. The trace had to be selected by its original sequence and digest after reload and restart rather than assuming it remained the newest row.

### What warrants a second pair of eyes

- Review the deliberate two-row rendered representation (verb plus effect) for clarity; it is causally sound but may benefit from a visual parent/child affordance in future product design.
- Confirm that retaining full canonical inputs in the inspector is acceptable for every future effect kind; current diagnostics are redacted only by canonical subject construction policy.
- Review storage quota observability through `outboxError()` for product-level user messaging.

### What should be done in the future

- Begin Phase 3 only after printing the Phase 2 completion slip and Phase 3 start slip.
- Implement explicit conversation lifecycle and versioned durable title synchronization next.
- Keep the rendered SQLite smoke procedure available for the final cross-phase audit.

### Code review instructions

1. Review commits `1d05677`, `56a01b6`, and `64b5f9d` in order.
2. Inspect `phase2-effect-inspector-live.png`, `phase2-effect-inspector-hydrated.png`, `phase2-effect-inspector-server-restart.png`, and `phase2-correlated-verb-hydrated.png`.
3. Re-run `make protocol-check`, `make ci-check`, `make gosec`, affected package checks, and `make chat-build`.
4. Start the embedded binary with SQLite stores, complete the scripted handoff, restart it, and inspect trace sequences `#2` and `#3`.

### Technical details

The observed envelope used effect id `720c0e04-62cd-4903-8d3b-63b4eb3160bf:msg-1:tool:conversation_send:3`, digest `b800c25ca0dc53f40bbffefa089b299cccaf48940129fcb413afb331cd27c2e0`, approval `handoff-msg-1`, and target `1490cfcb-9f92-4626-9b01-b2fdd1ed2be8`. The browser received HTTP 200 with `status=effect_recorded`. No console errors were observed.

## Step 12: Start Phase 3 with explicit lifecycle and versioned title truth

After Phase 2 validation and documentation were committed as `77063a8`, I printed the Phase 2 completion slip and the Phase 3 start slip. I then separated conversation lifecycle from the presence or absence of a captured runtime, and implemented local-first, versioned, durable title synchronization across browser and server.

### Prompt Context

**User prompt (verbatim):** (same as Step 11)

**Assistant interpretation:** Move through the thermal phase gate and implement conversation correctness in independently reviewable lifecycle, server-CAS, and browser-outbox commits.

**Inferred user intent:** Closed/failed conversations must tell the truth and recover intentionally; names must remain immediate locally while stale/offline writes can neither disappear nor overwrite newer server state.

**Commits:**

- `c5365e60a5c513f355eb03099b757e9e4efc6299` — "fix(pbui-chat): model conversation runtime lifecycle"
- `5916dc018534894bd55d551c507157db7fbe0d14` — "feat(chatserver): version conversation titles"
- `6a8d8c61e15a24eb845f6b9b73624f311173d68d` — "feat(pbui-chat): synchronize versioned titles"

### What I did

- Added explicit `closed`, `opening`, `open`, `failed`, and `closing` lifecycle snapshots with monotonic opening-attempt identities.
- Routed provider connection success/failure through the registry instead of swallowing failure in `ConversationHost`.
- Added cancel, close, open, and retry states/actions to `ConversationScope` and lifecycle-aware list status.
- Kept failed retries on the existing runtime rather than creating duplicate clients.
- Added server-side `title_revision`, SQLite migration, and atomic compare-and-swap PATCH behavior with HTTP 409 conflicts.
- Added local-first browser renames, per-conversation serialized PATCHes, durable storage outbox, automatic reload retry, conflict preservation, explicit retry, and visible queued/failed state.
- Synchronized auto-derived titles as well as explicit human/agent names.
- Preserved human-title ownership when reconciling another browser's server index.

### Why

The old `!runtime => opening` inference mislabeled a deliberately closed conversation forever. The old rename changed only browser storage, so another browser never reliably learned it. A plain optimistic PATCH would add a worse race: an old offline retry could overwrite a newer name. Explicit lifecycle and revision CAS address those as separate state machines.

### What worked

```text
pbui-chat typecheck                                    PASS
pbui-chat tests after lifecycle interval               24 files / 229 PASS
pbui-chat tests after title interval                   24 files / 233 PASS
pbui-chat production build                             PASS
go test ./pkg/chatserver -count=1                      PASS
pre-commit full Go tests + Go quality                  PASS, 0 issues
```

### What didn't work

1. Adding required lifecycle fields exposed an old test fixture that inferred closed state solely from `open:false`; TypeScript and one status assertion failed. I made the fixture explicit and changed the assertion to pass `{ lifecycle: { phase: "closed" } }`.
2. The registry-level empty rename test caused an unhandled rejected promise after `rename` became asynchronous. The public registry previously treated whitespace as a no-op, while the verb layer already rejects it. I preserved that existing low-level behavior with a resolved no-op and retained strict user/tool validation in `performConversationVerb`.
3. The first typecheck after adding title status found the shared `ConversationSnapshot` fixture could spread an optional `titleSync: undefined` over a required field. I normalized required lifecycle/title fields after the patch spread.

### What I learned

- Runtime attachment and transport readiness are distinct. With auto-connect disabled, attachment is enough for the test/story runtime to be open; production remains opening until `client.connect()` resolves.
- Serializing title writes per conversation is still necessary even with server CAS: it gives every newer local write the revision acknowledged by its predecessor and avoids a preventable 409.
- A 409 is not a reason to revert local UI. It advances the known server revision, retains the newest local write, and exposes a retry decision.

### What was tricky to build

A newer rename may arrive while an older PATCH is in flight. The outbox replaces only the pending value, while the drain loop keeps the in-flight write identity. When the older response arrives, it advances only `titleRevision`; it cannot delete the newer outbox entry or replace the local title. The loop then sends the newer title against the newly acknowledged revision. SQLite migration also had to preserve existing title rows by adding `title_revision DEFAULT 0` after inspecting `PRAGMA table_info`.

### What warrants a second pair of eyes

- Review whether product copy should distinguish network-queued title writes from explicit revision conflicts more strongly than the current `title queued` / `title failed` labels.
- Review the policy that a human-owned local title remains visible after another browser renames it; retry explicitly reasserts the local choice and avoids automatic cross-browser ping-pong.
- Verify StrictMode provider detach/reattach continues to move through a new opening attempt without showing closed.

### What should be done in the future

- Add rendered Chromium evidence for close/reopen/failure copy and title PATCH/reload/conflict behavior.
- Run the full Phase 3 validation sweep and print its completion slip only after rendered evidence is committed.
- Then print the Phase 4 start slip before workbench/focus implementation.

### Code review instructions

1. Review lifecycle transitions in `registry.ts`, then `ConversationHost` and `ConversationScope`.
2. Review server memory and SQLite CAS implementations and legacy migration test.
3. Trace `rename -> queueTitle -> processTitle -> drainTitle`, including concurrent-write identity and 409 handling.
4. Run PBUI chat typecheck/tests/build and focused/full Go tests.

### Technical details

Title PATCH bodies carry `{ title, expectedRevision }`; success increments the server revision, and conflict returns the current title/revision with HTTP 409. Outbox entries carry conversation id, newest title, owner, local monotonic version, and update timestamp. A persisted write is retried automatically after registry restoration.

## Step 13: Exercise lifecycle and title recovery in Chromium

I exercised every user-visible lifecycle/title branch in the embedded Chromium application: synchronized auto and human titles, explicit closed state, reopen with transcript preservation, injected offline rename with persistent queued status, reload retry, cross-client revision conflict, opening timeout while the server was down, and retry after server recovery. This rendered work found three integration defects that unit coverage had not exposed: opening could wait forever, the CLI could not configure the existing SQLite session index, and a rebuilt index could legitimately report a lower title revision than the browser cached.

### Prompt Context

**User prompt (verbatim):** (same as Step 11)

**Assistant interpretation:** Treat rendered smoke as an implementation probe: fix any lifecycle/title defect it reveals, add executable regression coverage, rebuild, and repeat until every state recovers correctly.

**Inferred user intent:** User-visible conversation truth must survive real transport failure, offline storage, conflicting clients, page reload, and server restart—not merely mocked fetch responses.

**Additional commits:**

- `53905069ef1ef8015472c7a72e7a89a6bda96b4c` — "fix(pbui-chat): bound conversation opening attempts"
- `b7ca909ce651ef9deea3e891c5f20a06a0367dc2` — "test(pbui-chat): cover lifecycle opening timeout"
- `a34cc68daf8133b5e3b3f8b449e7afc373b51c52` — "fix(pbui-chat): expose persistent session index"
- `13dd824cc4a1fab9d6ed97b77940acd6b58e0465` — "fix(pbui-chat): recover title revisions after index reset"

### What I did

- Observed auto title PATCH `{ title: "inventory overview", expectedRevision: 0 } -> titleRevision: 1`.
- Renamed through the real conversation object menu and observed revision 1 -> 2.
- Disconnected the conversation and verified both the tile and conversation list said `closed`, never `opening`.
- Reopened it and verified the same two-message transcript and title.
- Aborted PATCH requests in Playwright, renamed locally, and verified `title queued`, `retry title`, and the exact durable localStorage outbox entry.
- Reloaded while still offline and verified the local title/outbox/status survived.
- Restored the network, retried, and verified expected revision 2 -> 3 and outbox deletion.
- Simulated another tab with a direct server PATCH, observed a 409 while local title remained visible, then retried revision 4 -> 5.
- Stopped the actual server, opened a closed conversation, observed a bounded 10-second failure with Retry/Close, restarted the server, and recovered the existing runtime/transcript.
- Exposed `--sessions-db` through the demo CLI, ran against SQLite, and verified `persistent desk` at revision 1 before and after process restart.
- Added timeout and index-reset regression tests and reran full Phase 3 validation.

### Why

A transport library's `connect()` may remain pending while it retries. Without an application deadline, explicit `opening` is still an infinite euphemism. Likewise, server CAS is not durable if the shipped CLI cannot select its SQLite index. Finally, this index is intentionally rebuildable; the browser must treat a 409's current revision as authoritative even when it decreased after index loss.

### What worked

```text
Rendered closed -> reopened                               PASS
Rendered server-down opening -> failed after 10000ms      PASS
Rendered failed -> retry after restart                    PASS
Rendered offline title + localStorage outbox              PASS
Rendered reload while offline                             PASS
Rendered retry -> outbox removed                          PASS
Rendered cross-client 409 -> local title retained         PASS
Rendered conflict retry with current revision             PASS
SQLite sessions/title list before process restart         persistent desk / rev 1
SQLite sessions/title list after process restart          persistent desk / rev 1
make protocol-check                                       PASS
make ci-check                                             PASS
make gosec                                                PASS, 0 issues / 41 files
root PBUI typecheck/tests                                  PASS, 12 files / 96
pbui-chat typecheck/tests/build                            PASS, 24 files / 235
pbui-chat-demo typecheck/tests/build                       PASS, 1 file / 2
```

### What didn't work

1. My first server-stop attempt killed the PID captured from a background shell compound command, not the child `pbui-chat` process. `curl` still returned 200, so the apparent successful reopen was invalid evidence. I checked the process table, killed the actual command by exact port arguments, and repeated the test. The real outage then exposed the infinite-opening defect.
2. `client.connect()` did not reject while reconnecting to an unavailable endpoint; lifecycle remained `opening`. I added a configurable positive `connectTimeoutMs` (10 seconds default), stale-attempt guards, rendered the failure, and added a fake-timer regression.
3. The first timeout regression attached its rejection assertion only after advancing fake timers. Vitest reported `PromiseRejectionHandledWarning` and an unhandled rejection despite the assertion later passing. I attached `expect(pending).rejects` before advancing time; all 234 tests then passed cleanly.
4. After a process restart, `/api/chat/sessions` was empty despite SQLite timeline/turn stores. `Options.SessionsDB` already existed, but `pbui-chat serve` had no setting/flag/wiring for it. I added `--sessions-db`, rebuilt, and verified durable title revision across restart.
5. Testing recovery from a reset in-memory index revealed repeated 409s: the browser only accepted a conflict revision when it was greater than its cached value. Because the session index is rebuildable, revision zero can be authoritative after loss. I changed conflict handling to accept any different server revision and added a 5 -> 0 -> 1 regression. The rendered retry then succeeded.
6. Playwright's intentionally injected offline and HTTP 409 cases appear as browser resource errors. There were no uncaught application exceptions; the UI surfaced each expected failure and recovered.

### What I learned

- Readiness evidence must include a direct endpoint probe and process identity; a printed PID from a shell grouping is not enough.
- Application lifecycle deadlines cannot be delegated to a reconnecting transport promise.
- Revisions are monotonic only within one persisted index lineage. A rebuildable index requires epoch-aware behavior or acceptance of an authoritative lower CAS revision; current behavior safely chooses the latter after an explicit conflict.
- Durable server configuration has to be reachable from the shipped executable, not merely present in an internal Go options struct.

### What was tricky to build

The rendered sequence intentionally accumulated expected network console errors while testing offline, 409, and server-down behavior. Evidence had to distinguish browser resource failures from uncaught app errors by matching each to an injected condition and confirming the visible queued/failed/retry state. Recovering from index reset also required preserving the local title/outbox while moving only the cached server revision backward.

### What warrants a second pair of eyes

- Consider adding an explicit server-index epoch in a future wire revision; current 409 recovery is safe but infers reset from an authoritative lower revision.
- Confirm 10 seconds is the desired product opening deadline; it is configurable through registry options.
- Review whether repeated transport resource errors should be rate-limited by chat-provider during a known server outage.

### What should be done in the future

- Commit and relate the rendered evidence, run `docmgr doctor`, and print the Phase 3 completion slip.
- Print the Phase 4 start slip before changing workbench or focus code.
- Begin with a fresh semantic audit of workbench planning/revisions/minimum pane constraints and transient-surface focus paths.

### Code review instructions

1. Compare the closed, failed, retried, offline-title, conflict, and server-restart screenshots.
2. Review `connectRuntime` deadline/stale-attempt handling and its fake-timer regression.
3. Run the binary with all three SQLite flags, rename, restart, and compare `/api/chat/sessions` JSON.
4. Exercise an index reset and verify the retry sends expected revision zero after the 409.
5. Re-run protocol, CI, GoSec, root/PBUI-chat/demo checks.

### Technical details

The real rendered title sequence was 0 -> 1 (auto), 1 -> 2 (human), 2 -> 3 (offline retry), 3 -> 4 (simulated remote tab), 4 -> 5 (local conflict retry). A deliberately reset session index then returned revision 0 to a browser caching 5; the repaired client retried 0 -> 1. The final SQLite-backed list preserved `persistent desk`, revision 1, and message count 1 across the Go process restart.
