---
Title: Implementation diary
Ticket: PBUI-PROD-1
Status: active
Topics:
    - pbui
    - frontend
    - backend
    - review
    - refactoring
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/datalab-ui/src/components/pages/Workbench/WorkbenchProviders.test.tsx
      Note: Production datalab PBUI-to-Redux composition proof added in e903dbd.
    - Path: repo://src/presentation/createPbui.test.tsx
      Note: Provider migration and nested-input keyboard regression for e903dbd.
    - Path: repo://src/presentation/createPbui.tsx
      Note: Required verb router and nested-control event ownership implemented in e903dbd.
    - Path: repo://src/styles-wiring.test.ts
      Note: Exact root-selector parsing and spelling regression added in e903dbd.
    - Path: ws://agentlogic/ui/src/components/organisms/ChangesPanel/ChangesPanel.tsx
      Note: Existing production reference for container event ownership.
    - Path: ws://hyperblog/pkg/glossary/search.go
      Note: Tier gate now excludes locked bodies before matching (commit 08177a5).
    - Path: ws://hyperblog/pkg/server/handlers_workbenches.go
      Note: Owner-scoped JSON and SSE cache policy implemented in 08177a5.
    - Path: ws://hyperblog/ui/src/components/molecules/NoteEditor/NoteEditor.tsx
      Note: Blur-to-close now saves the current draft once in 08177a5.
    - Path: ws://turboproof/pkg/server/handlers_files.go
      Note: JSON, Origin, and required-text mutation boundary implemented in b7bd9fb.
    - Path: ws://turboproof/pkg/filestore/store.go
      Note: Canonical root separation and directory fingerprint classification implemented in b7bd9fb.
    - Path: ws://turboproof/ui/src/store/renameBinding.ts
      Note: Open-document destination preflight and post-await rebinding implemented in b7bd9fb.
ExternalSources: []
Summary: Chronological implementation record for production-first PBUI hardening and contained hyperblog and turboproof security/data-integrity fixes.
LastUpdated: 2026-08-03T22:10:00-04:00
WhatFor: Preserve the evidence, commands, failures, commits, and review instructions needed to audit or continue PBUI-PROD-1.
WhenToUse: Read before reviewing, resuming, or extending the implementation.
---









# Diary

## Goal

Implement the small shared-contract, production-integration, confidentiality,
and data-integrity fixes selected from HANDOFF-PR-2, while explicitly leaving
prototype-wide architecture and polish for future feature work. Keep every
change test-backed, commit it at a coherent repository boundary, and deliver an
intern-oriented implementation guide to reMarkable.

## Step 1: Recut the review by product lifetime

The earlier review intentionally described every known correctness gap. This
step converted that inventory into a shipping boundary based on the user's new
information: PBUI, datalab, and agentlogic deserve durable production contracts;
hyperblog and turboproof need only cheap, security-sensitive, or data-loss fixes
now. That distinction prevents prototype polish from displacing shared-library
correctness.

The code trace corrected one assumption from the prioritization discussion.
Datalab instantiates the PBUI presentation runtime and owns a real verb router;
agentlogic imports PBUI visual components but does not instantiate `createPbui`.
Agentlogic therefore needs regression validation for shared component changes,
not an artificial presentation-router test for an API it does not use.

### Prompt Context

**User prompt (verbatim):** "Ok, let's create a new docmgr ticket to address and at least document these issues. Then Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.


Make phases and tasks for the issues we will address in this session, and then implement them. Keep a detailed diaruy as you work, using the diary format skill, and commit at appropriate intervals."

**Assistant interpretation:** Create a new structured ticket, document the
production-first disposition in enough depth for an intern, implement the
selected fix-now tranche across the controlled repositories, preserve a strict
diary, commit coherent steps, verify everything, and upload the final package.

**Inferred user intent:** Spend engineering effort where it will survive: make
shared PBUI and real consumers safer, contain serious prototype risks, and
avoid gold-plating prototype architecture.

### What I did

- Created ticket `PBUI-PROD-1` with a design document, diary, phased tasks,
  changelog, and index.
- Re-read provider call sites, presentation keyboard handling, FileBrowser
  exports, stylesheet guard, datalab's real `WorkbenchProviders`, agentlogic's
  PBUI imports, hyperblog search/cache/editor paths, and turboproof's HTTP,
  filestore, and rename-binding paths.
- Established four implementation phases and a separate deferred register.
- Committed the preceding HANDOFF-PR-2 documentation separately as `b259185`
  (`docs: add intern review for outstanding findings`) before beginning this
  ticket.

### Why

- A required callback is useful only if every controlled composition is
  migrated atomically.
- A production composition test must exercise a real composition; inventing an
  agentlogic presentation provider would test a system that does not exist.
- Prototype fixes should be narrow enough that later product work can replace
  them without first undoing speculative architecture.

### What worked

- All five repositories began clean after the prior documentation commit.
- The existing tests expose clear seams for every selected behavior: PBUI uses
  jsdom, datalab can opt one test into jsdom, hyperblog has a server harness,
  and turboproof already separates filestore, server, and rename-binding tests.

### What didn't work

The first attempt to stage the prior HANDOFF documentation failed because this
workspace is a Git worktree whose administrative directory is outside the
writable sandbox:

```text
fatal: Unable to create '/home/manuel/code/wesen/hyperslop-systems/pbui/.git/worktrees/pbui2/index.lock': Read-only file system
```

The same intentional stage-and-commit operation succeeded with approved Git
write access. No unrelated files were staged.

### What I learned

- Most live PBUI findings are keyboard/accessibility findings, but the optional
  `onPerform` contract has the larger production blast radius because it permits
  commands to disappear silently.
- Agentlogic already implements the correct nested-control event-ownership
  predicate in `ChangesPanel`; that is evidence for a small shared rule, not for
  a universal keyboard hook.
- The selected prototype fixes align with existing seams and do not require the
  deferred corpus, verb-language, tile-scope, symlink, or synchronization
  redesigns.

### What was tricky to build

The difficult part was the boundary, not code. “Real app uses PBUI” does not
mean “real app uses every PBUI subsystem.” Searching actual imports and provider
construction prevented an invalid agentlogic test requirement. The session
keeps agentlogic in the verification matrix while limiting presentation-router
composition coverage to datalab, the real consumer.

### What warrants a second pair of eyes

- Confirm the fix-now/deferred split matches expected deployment of both
  prototypes. If either prototype is internet-facing, its wider auth and
  operational findings should be promoted.
- Review the exact semantics of turboproof's same-origin check behind any
  reverse proxy before deployment.

### What should be done in the future

- Promote the deferred PBUI FileBrowser ticket when datalab or agentlogic adopts
  the component.
- Revisit prototype architecture only alongside feature work that needs it.

### Code review instructions

- Begin with `tasks.md`, then read the design guide's scope and decision records.
- Compare the selected list to HANDOFF-PR-2; every omitted finding must appear
  in the deferred register rather than disappearing.
- Validate repository status before each focused commit.

### Technical details

Reviewed starting commits:

```text
pbui       b259185 (after committing the prior HANDOFF documentation)
datalab    71015a5
agentlogic d6c0e91
hyperblog  e622489
turboproof e9de793
```

## Step 2: Make shared PBUI failures loud and input ownership local

This step changed PBUI's presentation provider from a permissive shell into an
explicit product boundary. Every provider must now name its verb router, and a
presentation handles keyboard activation only when the presentation itself—not
a nested input or button—owns the event. Datalab's new composition test proves
that its production provider carries a verb all the way into Redux.

The same commit closed two tiny public-contract gaps while the shared package
was already under test: `RootState` now leaves both FileBrowser barrels, and the
root-font-size guard recognizes literal `html`/`:root` rules as well as
`:where(...)`.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Implement the shared/production phase first and
prove the real datalab composition, without inventing an agentlogic provider it
does not use.

**Inferred user intent:** Make the durable shared boundary safer before spending
time on contained prototype defects.

**Commit (code):** `e903dbd4fabe93a7e8e6294df82258c9800393d5` — "pbui: require verb routing and own keyboard events"

### What I did

- Made `PbuiProviderProps.onPerform` required and called it unconditionally.
- Added `event.target !== event.currentTarget` ownership gating before
  presentation keyboard activation.
- Added a nested-input regression to `createPbui.test.tsx`.
- Migrated PBUI tests and stories to explicit routers.
- Added a jsdom datalab test that performs a `watch` verb through the actual
  `WorkbenchProviders` and asserts the resulting Redux state.
- Exported FileBrowser `RootState` from its local and organism barrels.
- Replaced the stylesheet regex with selector-aware root block extraction and
  tested `html`, `:root`, `:where(:root)`, `:where(html)`, and the non-root
  descendant case.

### Why

- Silent verb loss is a composition error and should fail TypeScript, not a
  user's click.
- A container must not answer a child control's keyboard event.
- Datalab's real router is the evidence that the shared API is actually wired;
  isolated descriptor/reducer tests cannot prove the composition.

### What worked

```text
PBUI:    12 test files, 96 tests passed; typecheck passed; build passed
Datalab: 45 test files, 518 tests passed; typecheck passed
```

The PBUI build was run before consumer checks so generated `dist` declarations
contained the required prop.

### What didn't work

The first datalab full-suite run found that the new composition probe used a
raw HTML button, violating the package's design-system convention:

```text
components/pages/Workbench/WorkbenchProviders.test.tsx:16 — use Button or IconButton from components/atoms
```

Replacing it with PBUI's `Button` made both the focused convention test and the
full 518-test suite pass. This was the only implementation correction attempt
needed for the step.

The hyperblog and turboproof standalone installs did not report missing provider
props after the PBUI build because they resolve their own installed PBUI package,
not this repository's freshly built workspace package. Their source call sites
must therefore be migrated explicitly rather than treating those typechecks as
evidence of compatibility.

Both standalone prototype pnpm commands also emitted the existing warning:

```text
Failed to replace env in config: ${NODE_AUTH_TOKEN}
```

No environment value was read or introduced.

### What I learned

- Datalab is a real presentation-runtime consumer; agentlogic currently consumes
  PBUI components and chrome but not `createPbui`.
- Repository-local package resolution can make a consumer typecheck too weak to
  validate an unpublished shared API change.
- Datalab's architectural convention tests apply to test fixtures as well as
  production components, which keeps examples honest.

### What was tricky to build

The stylesheet test could not simply broaden its regex to `html`, because that
would also treat `html body { ... }` as a root declaration. The implemented
helper extracts rule selectors, splits selector lists, and accepts only an exact
root selector. The negative descendant case pins that distinction.

### What warrants a second pair of eyes

- Requiring `onPerform` is a source-breaking API change by design. Confirm every
  published consumer migrates before the next PBUI release.
- A nested interactive element inside a role=button presentation may still be
  undesirable HTML composition even though keyboard ownership is now safe;
  review callers rather than weakening the ownership rule.

### What should be done in the future

- Add the PBUI version bump/release coordination when this branch is published.
- Promote the deferred composite-menu work independently; it is not required
  for the safety predicate implemented here.

### Code review instructions

- Start at `PbuiProviderProps` and `Presentation.handleKeyDown` in
  `src/presentation/createPbui.tsx`.
- Read the datalab composition test next; it is the broadest behavioral proof.
- Run `pnpm run build` in PBUI before running datalab validation.

### Technical details

```ts
interface PbuiProviderProps<Values, Environment, Verb> {
  children: ReactNode;
  environment?: Environment;
  onPerform: (verb: Verb) => void | Promise<void>;
}

if (event.target !== event.currentTarget) return;
```

## Step 3: Contain hyperblog confidentiality and draft loss

This step fixed three prototype defects whose consequences exceed ordinary
prototype polish. Search now excludes locked body text before matching, so paid
prose cannot influence hit existence or metadata. Owner-scoped workbench JSON
and SSE responses are explicitly private and non-storable. Closing a question
now commits the current local draft and closed state as one logical save.

The implementation deliberately stops short of the deferred `ReaderCorpus`,
verb-language, and `TileScope` refactors. Each fix sits at the boundary that can
prove the security or data-integrity property without redesigning the product.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Fix only contained hyperblog confidentiality and
data-loss defects, with boundary regressions and no prototype-wide rewrite.

**Inferred user intent:** Prevent serious leaks or lost writing now while
preserving freedom to evolve the prototype later.

**Commit (code):** `08177a55e116fd39459cd2641fcfb0100e5b951c` — "security: contain reader data and draft loss"

### What I did

- Skipped locked post bodies before the search matcher, leaving public title/dek
  discovery intact and body-derived fields empty.
- Reversed the old tests that intentionally preserved body-only locked hits and
  added assertions for both body-only and public-title queries.
- Added `Cache-Control: private, no-store` and
  `Vary: Cookie, Authorization` to every workbench JSON response and the owner
  stream.
- Added an authenticated HTTP regression for the workbench cache policy.
- Treated blur-to-close as one NoteEditor command: blur defers when focus moves
  to the close button, and the click saves `draft ?? note.body` with `open=false`.
- Added native-event jsdom regressions for close and ordinary blur.
- Migrated hyperblog tests/stories to explicit PBUI routers in anticipation of
  the required provider contract.

### Why

- Withholding only a snippet still revealed whether secret prose contained a
  query, how often, its first paragraph, and its score.
- Workbench URLs are owner-relative; shared caching can serve one user's private
  layout to another.
- The old blur/click order issued two saves, and the second used stale
  `note.body`, overwriting the draft the first had just saved.

### What worked

```text
GOCACHE=/tmp/pbui-prod-1-hyperblog-go-cache go test ./...   PASS
hyperblog UI: 5 test files, 27 tests passed
hyperblog TypeScript: PASS
```

The search tests prove response fields rather than internal flags. The
NoteEditor test dispatches the actual `focusout` followed by `click`, pinning the
browser event order that caused the loss.

### What didn't work

The first Go test invocation tried to use the machine-wide build cache, which is
read-only in this workspace sandbox:

```text
open /home/manuel/.cache/go-build/...: read-only file system
```

Using a task-specific `GOCACHE` under `/tmp` resolved the environmental failure.

The first UI regression used Testing Library, which hyperblog does not install:

```text
Failed to resolve import "@testing-library/react"
```

It was rewritten with the repository's existing `createRoot`, `act`, and native
event pattern. That harness then exposed a second missing context:

```text
Error: PBUI components must be rendered inside their Provider
```

Per the repository debugging rule, work stopped after that second consecutive
test-harness correction. On the next continuation, wrapping NoteEditor in
hyperblog's real `PbuiProvider` made both focused tests pass immediately, after
which the full suites passed.

### What I learned

- Search authorization must happen before matching, not after result creation.
- Hyperblog's UI tests intentionally use React's built-in test primitives, so a
  local regression should preserve that dependency boundary.
- NoteChip makes NoteEditor presentation-bound even though the editor itself
  looks like a local molecule; real provider context belongs in its test.

### What was tricky to build

The close path needed to work for pointer and keyboard focus movement without a
timing guess. Inspecting `FocusEvent.relatedTarget` identifies the close button
as the next owner. Blur then does nothing, and click reads the same render's
draft and performs one save. A timer, ref reset race, or duplicate idempotent
save would make the test pass less directly while preserving ambiguity.

### What warrants a second pair of eyes

- Confirm proxies preserve `Vary` and respect `private, no-store` for both JSON
  and SSE responses.
- Review whether locked terms themselves ever contain tier-restricted prose;
  this change addresses post bodies, matching the current entitlement model.

### What should be done in the future

- If hyperblog becomes a real service, replace the contained search guard with
  the deferred materialized reader corpus so unsafe data is absent by type.
- Keep the current body-oracle regressions when that refactor happens.

### Code review instructions

- Review `pkg/glossary/search.go` and its unit/server regressions together.
- Review `writeWorkbenchJSON`, `handleStreamWorkbench`, and the cache-header
  test as one HTTP boundary.
- In the UI, start with the NoteEditor test because it narrates the exact event
  order before reading the implementation.

### Technical details

```text
locked post + body-only query  → no hit
locked post + title/dek query  → hit, Hits=0, ParagraphID="", Snippet=""

textarea focusout → relatedTarget[data-note-close] → defer
close click → onSave(draft ?? note.body, false) exactly once
```

## Step 4: Contain turboproof's browser-to-disk and document-identity risks

This step protected the prototype where HTTP input becomes filesystem state and
where a completed disk rename becomes open-document state. Create and rename
now reject browser-simple media types and foreign origins before mutation. PUT
distinguishes a missing/null `text` value from an intentional empty string.
Configured roots cannot overlap after symlink resolution, directories receive
the stable fingerprint domain error, and the UI refuses to rename an open
document onto a URI already owned by another document.

The implementation does not attempt the deferred full symlink policy or client
synchronization state machine. It closes known, testable hazards without
freezing the future IDE design.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Apply the bounded security and data-integrity
tranche to turboproof, prove both no-mutation failure paths and successful
paths, and leave broader prototype synchronization work documented.

**Inferred user intent:** Keep a prototype safe enough to evolve without
spending production-scale architecture effort on it now.

**Commit (code):** `b7bd9fb322d4f4b6279419c89f3fe18cccba570c` — "security: guard file mutations and document identity"

### What I did

- Added `requireFileMutationJSON`, which requires `application/json` and rejects
  a present foreign HTTP(S) Origin before create/rename decoding or store calls.
- Added a `403` problem type for the forbidden-origin response.
- Changed the PUT body to `*string`, rejecting absent/null `text` while
  preserving an intentional empty string.
- Rejected equal, nested, reverse-nested, and symlink-aliased roots after
  canonicalization in `filestore.New`.
- Classified directories as `ErrIsDirectory` before fingerprint streaming.
- Added a rename preflight over every `renameMoves` destination URI; a URI held
  by an unrelated open document fails before the server request.
- Added HTTP no-mutation, filestore relation/type, and UI dispatch/server-spy
  regressions.

### Why

- A cross-origin page should not be able to send a browser-simple POST that
  reaches local disk mutation.
- JSON absence is not the same intent as writing a zero-byte file.
- Two root names for one canonical namespace undermine locks, fingerprints, and
  document identity.
- A directory is a domain type error, not a platform-specific stream error.
- Rebinding one document onto another document's URI creates two in-memory
  owners for one disk identity and can lose or misdirect later saves.

### What worked

```text
targeted Go: pkg/filestore and pkg/server passed
targeted UI: renameBinding 5/5 passed; TypeScript passed
full Go: all turboproof packages passed
full UI: 17 test files, 132 tests passed; TypeScript passed
pre-commit: Go tests, golangci-lint, formatting, logcopter, glazed-lint passed
```

The server regressions assert both the HTTP status and that disk state did not
change. The UI collision test asserts the rename client was never called and no
Redux action was dispatched.

### What didn't work

The first UI run failed one existing refused-rename test. That fixture made
`currentDocument` throw on every call because the old implementation read it
only after a successful server response:

```text
Error: must not be read after a failed rename
at currentDocument (renameBinding.test.ts:187)
```

The new identity preflight intentionally needs one read before the server
request. The fixture was corrected to return an empty registry on its first
read and throw only if a failed request caused a second, post-await read. The
second run passed and proves both invariants: preflight state may be read once,
and failed disk mutation never enters post-success rebinding.

The pnpm commands emitted the existing `${NODE_AUTH_TOKEN}` substitution
warning. No environment value was read or added.

### What I learned

- Rename correctness spans two time domains. Destination identity belongs to a
  precondition snapshot; editable content must be re-read after the await.
- Content type and Origin checks belong to HTTP, while canonical namespace
  separation belongs to the filestore constructor.
- A no-mutation assertion is essential for error-path security tests; a status
  code alone does not prove validation happened before the side effect.

### What was tricky to build

The root overlap relation must be symmetric and operate on canonical paths.
Checking only whether the new root lies below an old root misses the reverse
configuration order; comparing raw strings misses symlink aliases and path
segment boundaries. `filepath.Rel` on absolute, symlink-resolved paths provides
the correct segment-aware relation.

The rename collision cannot be checked only after the server succeeds: at that
point disk has already moved. At the same time, the mutable document contents
cannot be captured only before the request because the user may type during the
await. The two reads are therefore intentional, not redundant.

### What warrants a second pair of eyes

- Review same-origin behavior behind the actual reverse proxy. The current
  comparison uses the request Host and deliberately does not trust arbitrary
  forwarded headers.
- Review the residual race in which another document opens the destination
  between preflight and response. Closing it requires the deferred
  synchronization state machine.
- Decide whether non-browser clients without Origin should remain supported if
  turboproof becomes remotely exposed.

### What should be done in the future

- Define a trusted external-origin configuration alongside any proxy deployment.
- Promote symlink identity and operation synchronization when turboproof stores
  durable projects or supports concurrent clients.
- Retain the contained regressions through any larger filestore/UI rewrite.

### Code review instructions

- Review `handlers_files.go` before its tests and verify every rejection returns
  before JSON decoding/store invocation.
- Review `filestore.New` with the four root relation tests, then inspect
  `fingerprintAt` with its directory assertion.
- Read the comment at the top of `renameBinding.ts`, then trace state at T0 and
  T2 through the asynchronous test.

### Technical details

```text
POST non-JSON                    -> 415, no disk mutation
POST JSON + foreign Origin       -> 403, no disk mutation
PUT {} or {"text": null}         -> 400, existing bytes unchanged
root A contains B or B contains A -> startup error
fingerprint(directory)           -> ErrIsDirectory
occupied destination URI         -> no server request, no Redux action
```

## Step 5: Validate the production graph and finish the review package

The final verification returned to the durable side of the system. PBUI was
tested, typechecked, and built first so its generated declarations represented
the required provider prop. Datalab and agentlogic were then validated against
that state. The design guide was expanded from its scaffold into the
intern-facing architecture/code-review document, and docmgr validated every
frontmatter, relationship, and ticket structure entry.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Do not stop at local fixes; demonstrate the real
consumer graph still works and leave a reviewable, teachable ticket package.

**Inferred user intent:** Make the implementation easy for a new engineer to
understand, reproduce, and extend without reopening the entire 38-finding
review.

### What I did

- Re-ran PBUI tests and typecheck, then built its package declarations/assets.
- Ran the full datalab UI suite and typecheck after the PBUI build.
- Ran the full agentlogic UI suite and typecheck.
- Wrote the architecture guide with system diagrams, trust/data flows,
  pseudocode, API contracts, decision records, alternatives, residual risks,
  file references, and explicit ticket/defer/leave-as-is guidance.
- Related the eleven primary cross-repository implementation/reference files.
- Converted the deferred register from unchecked tasks into non-completion
  bullets so intentional deferral is not confused with unfinished work.
- Ran `docmgr doctor --ticket PBUI-PROD-1 --fail-on warning` to a clean result.

### Why

- Shared package success is incomplete until real consumers remain green.
- An intern needs the ownership boundaries and time/order invariants, not just a
  diff summary.
- Deferred work must remain visible without making the current ticket
  permanently incomplete.

### What worked

```text
PBUI:       12 files / 96 tests; typecheck; production build
datalab:    45 files / 518 tests; typecheck
agentlogic: 121 passed, 1 pre-existing skipped; typecheck
docmgr:     all checks passed under --fail-on warning
```

Hyperblog and turboproof remained clean at their focused code commits after
their full suites passed. Datalab and agentlogic had no source changes from this
ticket; their repository heads remained `71015a5` and `d6c0e91` respectively.

### What didn't work

The first docmgr audit reported six warnings because the ticket scaffold used
the intuitive topics `security` and `testing`, but PBUI's repository vocabulary
does not define them. The affected design, diary, and index documents were
mapped to the existing `review` and `refactoring` topics. The second audit was
clean. The repository-wide vocabulary was not expanded for one ticket.

### What I learned

- A ticket's deferred list should not use task checkboxes when those items are
  intentionally outside its completion boundary.
- Doc metadata is a repository API: locally sensible terms are still invalid
  when they are outside the declared vocabulary.
- The production graph remained stable because the breaking PBUI API was
  migrated atomically and tested at the one real presentation composition.

### What was tricky to build

The guide had to be detailed without turning the prototypes' deferred designs
into accidental commitments. Each section therefore distinguishes an
implemented invariant from a residual limitation and names the event that
should promote deferred work: internet deployment, durable projects,
concurrent clients, or production FileBrowser adoption.

### What warrants a second pair of eyes

- Check the full consumer inventory before publishing PBUI 0.4.0; standalone
  repositories may resolve installed rather than workspace declarations.
- Review the ticket/defer boundary if the deployment status of either prototype
  changes.
- Confirm the reMarkable PDF preserves code blocks and ASCII diagrams legibly.

### What should be done in the future

- File the focused PBUI FileBrowser accessibility ticket when a production
  consumer adopts it.
- Promote prototype auth/synchronization work only at the triggers recorded in
  the design guide.
- Keep this ticket as the implementation/audit source rather than duplicating
  its deferred register into speculative micro-tickets.

### Code review instructions

- Read the design guide executive summary and system map before reviewing any
  repository diff.
- Review commits in order: `e903dbd`, `08177a5`, `b7bd9fb`.
- Use the exact validation table above to reproduce the cross-app evidence.
- End with the deferred register to ensure omitted HANDOFF findings are visible.

### Technical details

```text
shared protocol validation order:
PBUI test -> PBUI typecheck -> PBUI build -> datalab -> agentlogic

focused commits:
e903dbd  PBUI + datalab production contract
08177a5  hyperblog confidentiality + draft integrity
b7bd9fb  turboproof mutation + document identity
```
