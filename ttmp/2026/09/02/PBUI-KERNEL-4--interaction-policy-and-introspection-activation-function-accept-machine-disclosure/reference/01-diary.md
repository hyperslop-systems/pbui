---
Title: Diary
Ticket: PBUI-KERNEL-4
Status: active
Topics:
    - pbui
    - design
    - architecture
    - frontend
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://src/presentation/createPbui.tsx
      Note: The runtime this ticket restructures
    - Path: repo://src/presentation/interaction/accept.ts
      Note: The accept machine (Step 2)
    - Path: repo://src/presentation/interaction/activation.ts
      Note: activationOutcome (Step 1)
ExternalSources: []
Summary: 'Chronological record of PBUI-KERNEL-4: how the click ladder, the accept flow and menu explanation became pure, tested policy, how refusals got a presentation, and what evidence each step left.'
LastUpdated: 2026-09-02T21:16:26.475584895-04:00
WhatFor: Continue or review the interaction-policy work without re-deriving why the activation function, the accept machine and the disclosure rules are shaped as they are.
WhenToUse: Before touching createPbui.tsx handlers, the accept flow, RefusalNotice or explain().
---



# Diary

## Goal

Capture how PBUI-KERNEL-4 (guide Phase 10) was implemented: the pointer/keyboard ladder as one `activationOutcome` function, the accept flow as a request-identified pure state machine, refusal presentation, and original-query introspection under a disclosure policy, with the constraint that `pbui.accept` stays a promise-returning call usable outside React.

## Step 1: One activation ladder

`Presentation`'s click handler and its Enter/Space handler each spelled the same four-rung ladder: acceptable → accept; `activate` → the host's gesture; a unique primary → perform it; otherwise open the menu. The two had already diverged once (PR #9: Enter ran `activate.run` directly and never reached the host) and were re-aligned by hand. This step moves the decision into `src/presentation/interaction/activation.ts` as `activationOutcome({ acceptable, activate, primary })`, returning `attempt-accept`, `activate-host` (bubbling, carrying `run`), `perform-primary` (carrying the resolved action) or `open-menu`. Both handlers now ask it and only differ in how they carry the outcome out: a keyboard `activate-host` synthesises a bubbling click, a keyboard `open-menu` anchors at the element's box.

The primary resolution is a thunk so that it runs only when the ladder reaches it; the table test records, for every input combination, the outcome, whether the gesture stops, and whether the thunk ran. The existing click-propagation DOM tests (host sees an activated click, menu swallows, Enter reaches the host, nested presentations) pass unchanged.

### Prompt Context

**User prompt (verbatim):** "do it"

**Assistant interpretation:** Implement PBUI-KERNEL-4 with the same discipline as KERNEL-2 and -3: plan slip, phase slips, commits per phase, diary, screenshots, and the vault report the user asked for after each ticket.

**Inferred user intent:** Finish the last follow-up of the KERNEL-1 design.

**Commit (code):** 2ae05e8 — "PBUI-KERNEL-4 P1: one activation ladder for pointer and keyboard"

### What I did
- Read the ticket, guide §14.4–§14.6, §15.3–§15.5, §19.8, and `createPbui.tsx` (handlers, accept state, menu, banner, chooser, refusal type).
- Printed the plan slip (six phases) and the P1 slip; created the diary and six tasks.
- Wrote `interaction/activation.ts` and its table test (10 tests); routed `handleClick` and `handleKeyDown` through it; exported from `presentation/index.ts`.
- `tsc` clean; `npx vitest run src/presentation` → 32 files, 496 tests.

### Why
- §14.4: "extract the pointer/keyboard ladder as one pure function" with accurate naming: an acceptable click may open a chooser, so the outcome is `attempt-accept`, not `accept`.

### What worked
- The handlers' comments about propagation (which rung stops, which bubbles) moved verbatim onto the switch cases; `stopsPropagation(outcome)` states the rule once.

### What didn't work
- `stopsPropagation` was first typed over `ActivationOutcome<PresentationValues, unknown>`, which a test's `ActivationOutcome<never, string>` could not be assigned to (the subject type is invariant through `ResolvedAction`). Made generic.

### What I learned
- The mouse-doc line (`describe()`) walks the same ladder to say what a left click will do; it stays a separate reading of the same three inputs because it must not resolve the primary on every hover more than it already does.

### What was tricky to build
- Keeping the primary lazy. Resolving it per render would put menu-time work on every grid cell (the datalab cost boundary); the thunk keeps the P1 change cost-neutral.

### What warrants a second pair of eyes
- `activate` without `run` still yields `activate-host`; the pointer path then does nothing itself and lets the click bubble, which is the documented "host owns the click" state.

### What should be done in the future
- N/A beyond P2–P6.

### Code review instructions
- `interaction/activation.ts`, then the two `switch (outcome.kind)` blocks in `createPbui.tsx`.
- `npx vitest run src/presentation/interaction src/presentation/createPbui.test.tsx`.

## Step 2: The accept flow as a request-identified machine

The accept flow lived in three pieces of React state (`accepting`, `acceptChooser`, and a `pending` ref holding the promise's resolver) and four callbacks that each knew part of the policy. Guide §14.5 asks for one state carrying a request id, a step function, and effects, with the invariants listed. `interaction/accept.ts` is that machine: `AcceptState` is `idle`, `pending {requestId, request}` or `choosing {requestId, request, options}`; `AcceptEvent` is `request`, `offer` (a clicked reference with its acceptance resolution), `choose`, `escape`, `dismiss-chooser`, `abort`; `AcceptEffect` is `close-menu`, `settle {requestId, reference}` or `resolve-null {requestId, reason}`.

The `reason` on `resolve-null` was added after the first draft: the old code resolved a second request with null WITHOUT telling the product's `onAccept`, and aborted the pending one WITH it; the effect has to say which, since the Provider executing it no longer knows.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 2: the pure machine and its fuzzed invariants, before wiring it into the Provider.

**Inferred user intent:** Same as Step 1.

**Commit (code):** 65ae198 — "PBUI-KERNEL-4 P2: the accept flow as a request-identified pure machine"

### What I did
- `interaction/accept.ts` and `accept.test.ts`: eight transition tests and 200 seeded sequences of 40 random events; each run checks that a second request is refused for its own id and leaves the first state object identical, that a chooser only exists with options under a pending request, that a terminal effect for the current request leaves the machine idle, that chooser Escape keeps the request id and pending Escape ends it, and after draining that every admitted and every refused request has exactly one terminal.
- `tsc` clean; interaction suite 218 tests.

### Why
- Promise correlation. A resolver held in one ref can be settled by whichever callback runs last; a settle effect naming its request id cannot.

### What worked
- The machine's tests needed no React: the Provider's job in P3 is reduced to executing three effect kinds.

### What didn't work
- `TS7022` on the fuzz loop's destructured `after` (referenced in its own initializer through `state`); annotated with `AcceptStepResult<V>`.

### What I learned
- `offer` while `choosing` behaves as if pending: a click elsewhere while the chooser is open re-resolves and may settle or replace the options. The old code behaved the same since the chooser was not modal; now it is a stated transition.

### What was tricky to build
- Terminal accounting in the fuzz: requests refused on arrival get their terminal in the same step; admitted ones get it when settled, aborted, or at the drain. Counting both sets separately is what proves "exactly once".

### What warrants a second pair of eyes
- Whether a `request` while `choosing` should instead queue. The guide says refuse; the machine refuses.

### What should be done in the future
- N/A.

### Code review instructions
- `interaction/accept.ts` top comment lists the invariants; `accept.test.ts` "§14.5 invariants" is the fuzz.

## Step 3: The Provider on the machine

With the machine proven, the Provider's accept code became an executor. One `useRef` holds the current `AcceptState` (so `accept()` and the executor read it outside React's render cycle) and a `useState` mirrors it for rendering; `accepting` and `acceptChooser` are derived from it, so every consumer that reads those context fields is unchanged. Resolvers are a `Map<requestId, resolve>`; `accept(request)` mints an id, files the resolver and dispatches `request`. The executor handles three effects: `close-menu`, `settle` (resolve and tell `onAccept`), `resolve-null` (resolve; tell `onAccept` only for `aborted`).

`AcceptBanner` and `AcceptChooser` no longer decide anything on Escape: both dispatch `{ type: "escape" }` and the machine's rule applies. The escape-surface stack still decides which of the two surfaces forwards the key, so a dialog above keeps its own Escape.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 3: wire the machine in without changing the context API the consumers read.

**Inferred user intent:** Same as Step 1.

**Commit (code):** db767eb — "PBUI-KERNEL-4 P3: Provider dispatches accept events and executes effects"

### What I did
- `createPbui.tsx`: `acceptRef`, `acceptState`, `acceptResolvers`, `acceptRequestIds`, `onAcceptRef`; `executeAcceptEffect`, `acceptDispatch`; `accept`, `satisfyAccept`, `abortAccept`, `chooseAcceptance`, `dismissAcceptChooser` over dispatch; `acceptDispatch` on the context; banner and chooser Escape handlers dispatch.
- `tsc` clean; `npx vitest run src/presentation` → 33 files, 704 tests (the existing "resolves typed accept requests" and chooser tests pass unchanged).

### Why
- §14.5: "React components dispatch events and execute effects; transition policy stays pure."
- §3.13.1 constraint: rag-ttc's `acceptBridge.tsx` captures `pbui.accept` and calls it from its verb sink; it must remain a stable promise-returning function, which it is (a `useCallback` over a stable dispatch).

### What worked
- `onAccept` through a ref: the executor is stable across renders and still calls the latest handler.

### What didn't work
- N/A.

### What I learned
- `isAcceptable` must read the MIRRORED state (it is a render-time predicate that highlights presentations), while `satisfyAccept` must read the REF (a click may arrive before the mirror re-renders). Reading the ref in both would make highlighting stale; reading state in both would let a click be lost.

### What was tricky to build
- The reason on `resolve-null` (Step 2) is what made the executor simple: it does not consult the machine to know whether the product should hear about a null.

### What warrants a second pair of eyes
- `acceptDispatch` runs effects synchronously inside the dispatch, including `setMenu(null)`; that matches the old `accept()` which also set the menu in the same tick.

### What should be done in the future
- N/A.

### Code review instructions
- `createPbui.tsx`: search `acceptDispatch`; the executor is the switch above it.
- `npx vitest run src/presentation/createPbui.test.tsx`.
