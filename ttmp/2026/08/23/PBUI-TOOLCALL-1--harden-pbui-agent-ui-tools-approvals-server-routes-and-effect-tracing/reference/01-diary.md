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
    - Path: repo://packages/pbui-chat/src/composer/Composer/Composer.tsx
      Note: Exact conversation draft selection (commit 7b3ccd1)
    - Path: repo://packages/pbui-chat/src/conversations/conversations.test.tsx
      Note: Cross-conversation and failed-send context regressions (commit 7b3ccd1)
    - Path: repo://packages/pbui-chat/src/createPbuiChat.tsx
      Note: Request-identity send context and failure cleanup (commit 7b3ccd1)
    - Path: repo://packages/pbui-chat/src/store/chatStore.test.ts
      Note: Draft isolation/clear/forget regressions (commit 7b3ccd1)
    - Path: repo://packages/pbui-chat/src/store/chatStore.ts
      Note: Conversation-keyed draft ownership (commit 7b3ccd1)
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
