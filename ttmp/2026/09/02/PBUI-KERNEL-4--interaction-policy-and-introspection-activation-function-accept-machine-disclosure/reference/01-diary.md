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

## Step 4: A refusal has a face

KERNEL-1 made `onRefuse` required so that a stale row's refusal could not vanish by omission, and every consumer wrote a handler — most of them `() => {}` with a comment, or a status-line setter. This step gives the runtime its own presentation. `describeRefusal` (pure, in `interaction/refusal.ts`) turns a refusal into a headline naming the row and the subject, the product's reason when the fresh status carried one, and a hint. The Provider stores every refusal in `pbui.refusal` (now with the row's `label`) and the instance gains a `RefusalNotice` chrome component that renders it with `role="alert"`, a dismiss button, and retirement on the next menu open.

`onRefuse` becomes optional. The intent of "never silent" is kept mechanically rather than by the type: `RefusalNotice` registers itself in a context counter, and a refusal that neither a mounted notice nor a handler observes logs a warning naming the code.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 4: refusal presentation so a product does not have to write its own handler.

**Inferred user intent:** Same as Step 1.

**Commit (code):** 4ee8735 — "PBUI-KERNEL-4 P4: refusal presentation"

### What I did
- `interaction/refusal.ts` (+ 3 tests): one sentence per fresh-revalidation code and a fallback showing the code.
- `createPbui.tsx`: `PbuiRefusal.label`; `onRefuse?`; `refusal`/`dismissRefusal`/`refusalNotices` on the context; the refuse branch stores, calls the hook, warns if unobserved; `openMenu` clears the last refusal; `RefusalNotice` component returned by the instance.
- `createPbui.refusal.test.tsx` (5 DOM tests): stale row → notice with row, subject and reason; dismiss and next-menu retirement; `onRefuse` still called; warning once when unobserved; no warning when the notice is mounted.
- Root suite: 46 files, 817 tests.

### Why
- The ticket asks for refusal presentation; the guide's §14.3 makes the refusal the runtime's, so its first presentation should be the runtime's too.

### What worked
- The existing consumers pass `onRefuse` and are unaffected; making the prop optional broke no typecheck.

### What didn't work
- N/A.

### What I learned
- `ResolvedAction.label` is a `ReactNode`; only string labels reach the refusal, which is what the sentence can carry. A rendered label falls back to "that action".

### What was tricky to build
- Deciding what "unobserved" means. A mounted `RefusalNotice` counts as observation even if the product's CSS hides it; the runtime cannot see further than the tree.

### What warrants a second pair of eyes
- Loosening `onRefuse` from required to optional is a public API change in the other direction from KERNEL-1's C16. The warning is the replacement guarantee; reviewers should decide whether it is enough.

### What should be done in the future
- Consumers (rag-ttc, hyperblog, shop, chat demo) can mount `RefusalNotice` and drop their `() => {}` handlers; left for the 0.11 release notes.

### Code review instructions
- `interaction/refusal.ts`; `RefusalNotice` in `createPbui.tsx`; `createPbui.refusal.test.tsx`.

## Step 5: Explain the query the user is looking at

Guide §15.3 is explicit about what introspection must not do: re-resolve with a synthetic `"introspection"` invocation to explain a menu, because invocation is an input to discovery and a different one can produce a different candidate set. `explainResolution(query, resolution, disclosure)` therefore takes the resolution the menu (or the primary click) already computed, over the same snapshot, and only decides how much of it to show. `pbui.explain(query, disclosure = "public")` on the context resolves the query exactly as `pbui.resolve` does and hands the result to it.

Disclosure is two policies. Public is the menu: rows in menu order with their availability and the product's `because`, and the ambiguity notes; a hidden rule is hidden from the explanation, rejected candidates and reason codes do not appear, and the trace is absent. Developer is the trace: the same rows each with the entries that produced them, and every other candidate the resolver considered with its last stage, result and reason code.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 5: original-query introspection with an explicit disclosure policy.

**Inferred user intent:** Same as Step 1.

**Commit (code):** 65832f2 — "PBUI-KERNEL-4 P5: explain the original query under a disclosure policy"

### What I did
- `interaction/explain.ts` (+ 5 tests over a compiled presentation with an available, an unavailable-with-code, a hidden and an out-of-scope rule); `pbui.explain` on the context; exports.
- Root suite: 47 files, 822 tests.

### Why
- The exit criteria: public omits hidden detail; developer explains the same rows as the menu query.

### What worked
- The trace already carries everything developer mode needs; the module groups it by candidate and separates shown rows from the rest.

### What didn't work
- The fixture first reused rule ids as action ids (`files.delete`/`files.delete`), which the registry refuses: "a rule names a declaration, an action names the conceptual operation". Renamed the rules.
- Two expectations were wrong about the resolver, not the explanation: menu rows are sorted (Delete before Open), and a hidden winner's last trace stage is `selected:hidden`, not `condition:hidden`. Fixed the expectations; both facts are now recorded in the test.

### What I learned
- A hidden rule wins its action and is then withheld from the menu at the `selected` stage; that is why public disclosure filters on the rows, not on the trace's `condition` stage.

### What was tricky to build
- Making "public omits hidden detail" checkable: the test serializes the public explanation and asserts the hidden rule's id, the out-of-scope rule's id, `reasonCode`, the unavailable rule's code and the words `trace`/`others` are all absent from the text.

### What warrants a second pair of eyes
- Developer disclosure exposes reason codes and predicate ids; the doc comment says "behind a deliberate product gate". Nothing in the runtime enforces the gate.

### What should be done in the future
- A developer-mode panel in a product (the chat demo's inspector is the natural place).

### Code review instructions
- `interaction/explain.ts`; `explain.test.ts`; `explain` in the context value.
