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
      Note: Loopback-only development authorization (commit a982f98)
    - Path: repo://packages/pbui-chat/src/composer/Composer/Composer.tsx
      Note: Exact conversation draft selection (commit 7b3ccd1)
    - Path: repo://packages/pbui-chat/src/conversations/conversations.test.tsx
      Note: Cross-conversation and failed-send context regressions (commit 7b3ccd1)
    - Path: repo://packages/pbui-chat/src/createPbuiChat.tsx
      Note: |-
        Request-identity send context and failure cleanup (commit 7b3ccd1)
        One ledger injected into every conversation toolset (commit f320dfc)
    - Path: repo://packages/pbui-chat/src/store/chatStore.test.ts
      Note: Draft isolation/clear/forget regressions (commit 7b3ccd1)
    - Path: repo://packages/pbui-chat/src/store/chatStore.ts
      Note: Conversation-keyed draft ownership (commit 7b3ccd1)
    - Path: repo://packages/pbui-chat/src/tools/approvalLedger.ts
      Note: Canonical shared approval authority (commit 69678a3)
    - Path: repo://packages/pbui-chat/src/tools/conversationTools.ts
      Note: Sender/target/prompt/reference-bound approvals (commit f320dfc)
    - Path: repo://packages/pbui-chat/src/tools/sandboxTools.ts
      Note: Canonical sandbox approval subjects (commit f320dfc)
    - Path: repo://packages/pbui-chat/src/tools/workbenchTools.ts
      Note: Canonical workbench and raw approval subjects (commit f320dfc)
    - Path: repo://pkg/chatserver/authorization.go
      Note: Required principal/session policy contract (commit a982f98)
    - Path: repo://pkg/chatserver/authorization_test.go
      Note: Cross-principal HTTP and WebSocket regressions (commit a982f98)
    - Path: repo://pkg/chatserver/handlers.go
      Note: Ownership claim and list filtering (commit a982f98)
    - Path: repo://pkg/chatserver/server.go
      Note: Authorized route and subscribe boundaries (commit a982f98)
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
