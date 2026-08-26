---
Title: Diary
Ticket: PBUI-ACTIONS-2
Status: active
Topics:
    - pbui
    - frontend
    - architecture
    - design
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Working diary for PBUI-ACTIONS-2 — importing the ACTIONS-1 source guide, auditing it against HEAD, and writing the implementation intern guide with the four amendments.
WhatFor: Record how the implementation design was grounded in current code and what a reviewer should re-check.
WhenToUse: Read before reviewing the intern guide or starting PR 0.
---

# Diary

## Goal

Capture the design phase of PBUI-ACTIONS-2: ticket creation, source-guide
import, the HEAD drift audit, and the intern implementation guide.

## Step 1: Create the ticket, import the source guide, audit against HEAD

Created PBUI-ACTIONS-2 in the pbui repository's docmgr workspace, copied
`~/Downloads/PBUI-ACTIONS-1-source-audited-implementation-guide.md` (2,198
lines, audited against the 0.6.0 snapshot) into `sources/`, read it in full,
and verified its claims against current HEAD rather than trusting the
snapshot.

The audit's finding: every seam the guide targets still exists unchanged —
the exact `actionsFor` lookup (`src/presentation/registry.ts:69-72`),
render-time menu resolution (`createPbui.tsx:509`), raw-verb perform without
revalidation (`createPbui.tsx:267-270`), the `tileDescriptor.extra` seam
(lines 30 and 125), the sandbox `withGeneratedActions` wrapper, and the
unstable `${ptype}:${index}:${label}` adapter IDs in both datalab-ui
(`registry.ts:84`) and the chat demo (`registry.ts:48`). Drift is limited to:
`onPerform` now required (commit `e903dbd`), `MenuState` relocated into
`types.ts`, chrome/toolbars calling `pbui.perform(verb)` directly with
hand-built verbs, `createPbui.tsx` at 685 lines with the P-series gesture
fixes applied, and pbui-chat's executor-aware tool runtime (PBUI-TOOLCALL-1)
landed around — not in — the verb router/gateway seam.

### Prompt Context

**User prompt (verbatim):** "Ok, while we are waiting on OPTKIT-018, let's
tackle a different topic in pbui. Create a new docmgr ticket to improve the
actions framework, and import and read the file
@~/Downloads/PBUI-ACTIONS-1-source-audited-implementation-guide.md into its
sources/ folder, and analyze.\n\nThen tell me how you would design and
implement the suggestions in the pbui codebase (since this was based off an
older prototype)."

**Assistant interpretation:** Create the implementation ticket for the
ACTIONS-1 design, import the source guide, verify it against current code
(the "older prototype" caveat), and present a design/implementation position
in chat.

**Inferred user intent:** Turn the finished ACTIONS-1 research into an
executable implementation plan that is correct for today's pbui, usable while
the OPTKIT backend chain is blocked on a colleague.

**Commit (code):** `30e99aa` — "PBUI-ACTIONS-2: create implementation ticket,
import ACTIONS-1 guide, record HEAD drift audit" (docs only)

### What I did
- `docmgr ticket create-ticket --ticket PBUI-ACTIONS-2` in the pbui repo
  (own `.ttmp.yaml`, separate from the optkit workspace root).
- Copied the guide into `sources/`; read all 2,198 lines.
- Verified claims at HEAD: read `types.ts` and `registry.ts` in full, grepped
  `createPbui.tsx` seams, `tileDescriptor.ts`, sandbox `actions.ts`, both
  product adapters; checked recent history (`git log` on
  `src/presentation/`, releases since 08/20).
- Filled the ticket index with the drift-audit summary; changelog; commit.
- Presented the analysis and design position in chat: guide holds; four
  amendments (dual perform entry points; optional kernel with automatic
  legacy adapter; shared-package contribution fragments; stable IDs in PR 0);
  PR ladder mapped to today's files; OPTKIT-022/023 coordination note.

### Why
- The user flagged the guide as "based off an older prototype" — the honest
  first step is establishing exactly how much of the audited snapshot
  survives at HEAD, before designing anything on top of it.

### What worked
- The guide's own evidence index (Appendix A) made verification fast: each
  claim names a file and line range, so the check was mechanical.
- The two unstable-ID adapter sites are still character-identical to the
  guide's quotes, which confirms the snapshot is recent enough for the
  consumer-migration sections to be trustworthy.

### What didn't work
- `grep -rn --include=*.ts` failed under zsh glob expansion
  (`no matches found`); quoted patterns or `git grep` avoid it. Cosmetic.

### What I learned
- `perform(verb)` is called directly by chrome and toolbars with hand-built
  verbs, so the source guide's §17.2 context-signature change would break
  pbui-workbench and products — the origin of Amendment A.
- pbui-chat changed substantially since the audit (PBUI-TOOLCALL-1 executor
  runtime), but the router/gateway *seam* the kernel relies on is intact;
  PR 4 needs a fresh line-level audit, not a redesign.

### What was tricky to build
- Distinguishing "the guide is stale" from "the guide's line numbers are
  stale". The semantics all hold; only offsets and surroundings moved. The
  intern guide therefore forbids trusting line numbers while affirming the
  claims.

### What warrants a second pair of eyes
- Amendment B (optional `actions`/`snapshotFor` with an auto legacy adapter)
  deviates from the source PR plan; confirm the team wants zero-change PR 2
  over the guide's explicit-adoption PR 2.
- Whether `performAction` should be the name (vs overloading `perform`) —
  overloading was rejected to keep the raw path's type signature honest.

### What should be done in the future
- Write the intern implementation guide (Step 2), then PR 0.

### Code review instructions
- Re-run the audit spot-checks: `sed -n '69,72p' src/presentation/registry.ts`,
  `sed -n '262,270p' src/presentation/createPbui.tsx`,
  `grep -n "extra" packages/pbui-workbench/src/tileDescriptor.ts`,
  `grep -n 'ptype}:' packages/datalab-ui/src/pbui/registry.ts packages/pbui-chat/demo/src/pbui/registry.ts`.

### Technical details
- Ticket path: `ttmp/2026/08/26/PBUI-ACTIONS-2--type-directed-action-selection-engine-in-the-pbui-package/`.
- Source guide: `sources/PBUI-ACTIONS-1-source-audited-implementation-guide.md`.

## Step 2: Write the implementation intern guide and publish to reMarkable

Wrote
`design-doc/01-intern-guide-implementing-the-action-selection-kernel-in-current-pbui.md`:
the HEAD system tour (references/descriptors/registry, Provider/menu/perform,
accept, the four consumers and their workarounds), the drift-audit table, the
kernel condensed to its load-bearing contracts (identities, type graph,
snapshot, availability quartet, conditions, resolver ladder, revalidation,
translators) with section pointers into the source guide as the design of
record, the four amendments in full, the file-by-file plan with the PR ladder
and exit criteria, testing strategy, OPTKIT coordination, pitfalls, and a
glossary. Seeded the task list (PR 0–7 plus review), related files, updated
the changelog, committed, and uploaded the guide bundled with the source
guide to the reMarkable.

### Prompt Context

**User prompt (verbatim):** "Ok, Create  a detailed analysis / design /
implementation guide that is for a new intern, explaining all the parts of
the system needed to understand what it is, with prose paragraphs and bullet
point sand pseudocode and diagrams and api references and file references. It
should be very clear and technical. Store in the ticket and the nupload to
remarkable."

**Assistant interpretation:** Turn the chat design position into a durable
intern-grade guide in the ticket, complementing (not duplicating) the source
guide, and publish both to the reMarkable.

**Inferred user intent:** Make the implementation startable and reviewable by
someone who was not in this conversation, with the current-codebase
corrections captured durably.

**Commit (code):** recorded in the changelog with the upload entry.

### What I did
- Wrote the guide (sections 0–10) with the deliberate split: this guide owns
  the HEAD tour, drift audit, amendments, and file plan; the source guide
  remains authoritative for kernel semantics and the full test matrix.
- Tasks, relations, changelog, commit; `remarquee upload bundle` of the
  intern guide plus the source guide to `/ai/2026/08/26/PBUI-ACTIONS-2`.

### Why
- Duplicating the 2,198-line source guide would have created two divergent
  authorities; the companion-guide structure keeps one design of record and
  one implementation map.

### What worked
- The amendment structure (A–D) cleanly contains every deviation, so a
  reviewer can accept/reject them individually without re-litigating the
  kernel.

### What didn't work
- N/A.

### What was tricky to build
- Compressing the kernel (source §§6–19) to a map that is complete enough to
  orient an intern but visibly *not* the implementation spec — each condensed
  section carries its source-section pointer to prevent implementing from the
  summary.

### What warrants a second pair of eyes
- The PR 2 exit criterion "menu behavior byte-identical to goldens" — with
  the legacy adapter, ordering comes from metadata order; confirm the
  adapter's order mapping reproduces current array order exactly, including
  for the workbench tile menu's informational row.

### What should be done in the future
- Team review of amendments A–D, then PR 0 (goldens + stable IDs).

### Code review instructions
- Read the intern guide start to finish with `src/presentation/registry.ts`
  and `createPbui.tsx` open; then spot-check the drift table (section 3)
  against HEAD.

### Technical details
- Guide: `design-doc/01-intern-guide-implementing-the-action-selection-kernel-in-current-pbui.md`.
- reMarkable: `/ai/2026/08/26/PBUI-ACTIONS-2`.

## Step 3: P0 — freeze golden menus, make action identity semantic

The implementation began with the migration fence. Both product adapters
stopped manufacturing `${ptype}:${index}:${label}` ids and now derive identity
from verb content (`ptype.kind[.discriminant]`), with a loud collision guard.
Golden snapshot tests freeze the full menus of representative references in
datalab-ui, pbui-workbench, and the chat demo; the two conversion arrays are
exported and frozen; the sandbox gained an explicit generated-action liveness
test. Six suites green: root 102, datalab-ui 531, workbench 131, sandbox 105,
pbui-chat 237, demo 13.

### Prompt Context

**User prompt (verbatim):** "Print out a brutalist work slip with the plan /
different phases for the ticket. then before stsarting a phase, plrint a
split about the phase, and print one when the phase is done. \n\ncommit at
appropriate intervals and keep a detailed diary as you work (using the diary
format from the skill)"

**Assistant interpretation:** Begin implementing the ticket phase by phase,
printing physical work slips (almanach thermal printer, brutalist theme) at
plan/phase-start/phase-done boundaries, committing per phase, diarying as I
go.

**Inferred user intent:** Run the PBUI-ACTIONS-2 implementation as a properly
instrumented workflow with physical progress artifacts, matching the
work-slip discipline the OPTKIT-012–015 implementation tickets used.

**Commit (code):** `fbfa492` — "PBUI-ACTIONS-2 P0: freeze golden menus, make
action identity semantic"

### What I did
- Printed the ticket plan slip (8 phases) and P0 start/done slips; YAML
  archived under `various/work-slips/`.
- Restored the toolchain: `pnpm install` failed with 403 on
  `@hyperslop-systems/plot` because the `~/.npmrc` GitHub Packages token is
  stale; the gh CLI token works, so the install ran with
  `npm_config_//npm.pkg.github.com/:_authToken=$(gh auth token)` — no edit to
  the user's `~/.npmrc`. Built all workspace packages (`pnpm -r build`) so
  cross-package test imports resolve.
- `packages/datalab-ui/src/pbui/registry.ts` and
  `packages/pbui-chat/demo/src/pbui/registry.ts`: verb-derived stable ids
  with per-kind discriminants and a duplicate-id throw.
- `runtime.tsx` in both products: conversions extracted/exported
  (`catToField`/`datadropConversions`, `rowToProduct`/`demoConversions`).
- New golden tests: `datalab-ui/test/menu-goldens.test.ts` (10 snapshots,
  identity-shape assertions, conversion freeze),
  `pbui-workbench/src/tileDescriptor.golden.test.ts` (4 snapshots incl.
  informational row and `extra` composition),
  `pbui-chat/demo/src/pbui/menu-goldens.test.ts` (4 snapshots, live-library
  liveness through the real registry, conversion freeze).
- `pbui-sandbox/src/actions.test.ts`: explicit liveness test (define after
  registry build → next menu; remove → gone).

### Why
- P0 exists so every later PR is reviewed as equivalence against recorded
  behavior; the id fix had to precede the snapshots or the goldens would have
  fossilized positional identity (intern guide Amendment D).

### What worked
- The collision guard proved itself within minutes: pbui-chat's own
  conversation tests hit `duplicate action id "conversation.view.open"` — the
  conversation menu emits one open-tile entry per app, a duplicate the old
  positional ids silently tolerated. Fixed with a `view.open → appId`
  discriminant.

### What didn't work
- First full datalab-ui run: 11 files failed with unresolved
  `@hyperslop-systems/workbench-protocol` — unbuilt workspace dep, not my
  change; `pnpm -r build` fixed it. Recorded because the same trap will hit
  every fresh checkout.
- `pnpm install --frozen-lockfile`: `ERR_PNPM_FETCH_403` on plot (stale
  token), fixed via env-var token override as above.

### What I learned
- pbui-chat's `src/conversations` tests import the *demo* registry, so demo
  adapter changes propagate further than the demo — good: the fence is wider
  than expected.

### What was tricky to build
- Choosing discriminants without over-qualifying: ids must be stable per
  (reference, conceptual action), so discriminants use only fields that
  distinguish same-kind siblings within one menu (channel, dir, decision,
  zone, appId…), never payload ids that vary per subject.

### What warrants a second pair of eyes
- The discriminant tables are enumerated by hand; a new same-kind sibling in
  a future menu will throw at menu-open time. That is the designed behavior
  (loud beats silently wrong), but confirm the team accepts runtime throws
  here until PR 3/4 replace the adapters entirely.

### What should be done in the future
- P1: the pure kernel under `src/presentation/actions/`.

### Code review instructions
- `git show fbfa492`; run `pnpm -r build && pnpm -r test` from the repo root.
- Read the datalab snapshot file once: the ids are the review surface.

### Technical details
- Suites after P0: root 102, datalab-ui 531, pbui-workbench 131,
  pbui-sandbox 105, pbui-chat 237, chat demo 13 — all green.

## Step 4: P1 — the pure action-selection kernel

Implemented `src/presentation/actions/` in eleven modules plus six test
files: identities (`ids.ts`), the four-state availability model
(`availability.ts`), the validated nominal type graph with BFS shortest
distances (`typeGraph.ts`), the fail-closed condition algebra with named
predicates (`conditions.ts`), the contract types (`types.ts`), the
`defineActions` factories making the exact/inherited payload distinction
visible (`define.ts`), the fail-fast registry with guaranteed-collision
rejection and potential-conflict diagnostics (`registry.ts`), the 16-step
resolver with same-branch compact trace (`resolve.ts`), verbose trace
materialization (`explain.ts`), fresh-perform evaluation (`perform.ts`), and
the Amendment B legacy descriptor family (`legacy.ts`). Exported through
`src/presentation/index.ts`. 50 kernel tests; root suite 152 green.

### Prompt Context

**User prompt (verbatim):** (see Step 3)

**Commit (code):** `b58e23b` — "PBUI-ACTIONS-2 P1: the pure action-selection
kernel"

### What I did
- Wrote the kernel per the source guide §§7–18 with the intern guide's
  amendments; method-syntax interfaces keep exact rules assignable to the
  contribution union (bivariance where we need it).
- Tests: graph (reflexive/transitive/diamond/cycle/isolated), conditions
  (short-circuit first reason, fail-closed unknown predicate), registry
  validation (nine rejection classes incl. rule-id-as-action-id and
  guaranteed collisions), the §24.3 resolver table (specific-over-generic,
  unavailable-suppresses, inapplicable-permits, hidden-suppresses,
  scope/priority/ambiguity, invocation filter), families (stable candidate
  ids, duplicate-key throw, static-vs-family override, unavailable instance),
  invariants (permutation, unrelated-action isolation, bind-only-selected,
  menu-order-never-precedence, label materialization), perform (§24.6 five
  refusal cases plus fresh-verb proof), and the legacy family
  (order/danger/reason preservation, namespaced actions, current-environment
  re-expansion).
- The legacy adapter design decision from the intern guide held: `subject:
  "*"` families make the graph tolerate undeclared query types as isolated
  nodes, so unmigrated products need no graph at all.

### Why
- PR 1 must be UI-independent so PR 2 can be reviewed purely as integration;
  every semantic question is settled and tested here.

### What worked
- The resolver's trace-from-the-same-branch design made the hidden test
  meaningful: the menu is empty AND the trace proves the suppression.

### What didn't work
- Two strict-TS rounds: a discriminated-union spread
  (`status.code` inside a ternary chain) would not narrow — restructured to
  an explicit entry object; and `.find()` in a test grabbed the type-stage
  trace entry instead of the condition-stage one (filter by stage). Both
  caught by tsc/vitest immediately.

### What I learned
- `Math.min(...pool.map(...))` over a partition then filter is clearer than a
  sort for the ladder, and keeps ties visible for the ambiguity branch.

### What was tricky to build
- The `hidden` vs `inapplicable` split shows up in three distinct places
  (status evaluation, partition retention, assembly skip) and the compiler
  cannot prove `inapplicable` never reaches assembly — an explicit
  unreachable throw documents the invariant instead of a cast.

### What warrants a second pair of eyes
- Ambiguity `because` values: the implementation reports
  `incomparable-types` when tied candidates declare different types, else
  `equal-priority`; `equal-specificity`/`equal-scope` are currently never
  emitted. Semantically covered, but the union suggests finer reporting —
  confirm this simplification or refine in PR 5 when real inheritance lands.
- The type-unreachable-contributions-produce-no-trace choice (documented in
  resolve.ts) trades §16 completeness for compactness.

### What should be done in the future
- P2: createPbui integration with optional `actions`/`snapshotFor`,
  `performAction`, ambiguity row.

### Code review instructions
- Start at `resolve.ts` with the source guide §15 beside it; then
  `registry.test.ts` and `resolve.test.ts` as the executable spec.
- `pnpm vitest run src/presentation/actions` and `npx tsc --noEmit`.

### Technical details
- Root suite: 152 tests (102 pre-existing + 50 kernel).

## Step 5: P2 — one selection engine behind ObjectMenu, zero product changes

Integrated the kernel into `createPbui` per Amendments A and B. `actions` and
`snapshotFor` are optional and come together (actions alone throws at
construction); absent, the provider builds an internal registry around
`legacyDescriptorFamily` over the descriptor registry with a trivial
`{revision: 0, scopes: ["global"], product: {environment}}` snapshot — one
live selection engine either way. ObjectMenu resolves `{subject, invocation:
"menu"}` on every render, maps `ResolvedAction` rows keyed by candidate id
(the `unavailable` status carries the one-field disabled/reason invariant
forward), and renders ties as a non-executable `data-part="menu-ambiguity"`
row. The context gains `resolve()` and `performAction()` (fresh revalidation,
fresh verb); `perform(verb)` is untouched for chrome and toolbars.

Every pre-existing test passes unmodified: root 158 (152 + 6 new integration
tests), workbench-protocol 44, pbui-workbench 131, pbui-sandbox 105,
datalab-ui 531, pbui-chat 237, chat demo 13.

### Prompt Context

**User prompt (verbatim):** (see Step 3)

**Commit (code):** `db3269e` — "PBUI-ACTIONS-2 P2: one selection engine
behind ObjectMenu, zero product changes"

### What I did
- `createPbui.tsx`: fourth defaulted generic `ProductFacts =
  LegacyFacts<Environment>` (existing three-arg callers compile untouched);
  engine/snapshot fallback construction; context `resolve`/`performAction`;
  ObjectMenu row mapping and ambiguity rendering.
- `public/presentation-parts.css`: the `menu-ambiguity` hook, styled like a
  reason and explicitly not a button.
- `createPbui.actions.test.tsx`: six integration tests — fresh-verb
  delegation, refusal after state change (onPerform never called), visible
  unavailable row, ambiguity row non-executability, legacy-engine parity with
  environment-sensitive labels, and the actions-without-snapshotFor error.

### Why
- Amendment B's zero-change property is the whole point of P2: the engine
  swap must be reviewable as "the fence still passes", not as a product
  migration.

### What worked
- The `MenuState` question resolved even less invasively than the intern
  guide sketched: the query is derived in ObjectMenu (`invocation: "menu"` is
  constant there), so `MenuState`/`openMenu` did not change at all.
- `performAction` calls `onPerform` synchronously within the click segment
  (the await suspends after the call), so existing synchronous delegation
  tests hold without modification.

### What didn't work
- `toBeDisabled()` — jest-dom matchers are not installed in this repo's
  vitest setup; plain `disabled` property assertion instead. One-line fix.

### What I learned
- Unmigrated products gained real behavior from P2 despite "zero changes":
  revalidation re-runs their descriptor callback at click time, so the stale
  render-time verb can no longer be delegated. The legacy test pins this via
  an environment-sensitive verb.

### What was tricky to build
- The default-generic dance: `ProductFacts = LegacyFacts<Environment>` makes
  the internal casts honest (the fallback pair really is that type), while a
  product supplying its own registry instantiates the generic explicitly.
  The alternative — overloads — duplicated the options type for no gain.

### What warrants a second pair of eyes
- `resolve` in the context closes over `environment` from the current render;
  a menu open across an environment change re-resolves with the new
  environment on next render (correct), but `performAction` uses the
  environment captured when the context value was memoized — same as today's
  `perform`, worth confirming as intended.
- The ambiguity row wording ("N rules tie for <action> — nothing runs") is
  developer-facing; product copy may want it gated to dev builds (source
  guide leaves production policy to products).

### What should be done in the future
- P3: workbench contribution fragments + datalab migration.

### Code review instructions
- `git show db3269e`; the review surface is ObjectMenu's row mapping and the
  engine fallback block. Then `pnpm vitest run src/presentation` — the fence
  plus the new file.

### Technical details
- Suites: root 158, protocol 44, workbench 131, sandbox 105, datalab 531,
  chat 237, demo 13 — 1219 total, all green.

## Step 6: P3 — workbench fragments and the datalab migration

The exit criterion for this phase was "two materially different consumer
styles prove the API", and both landed. pbui-workbench now exports
contribution fragments (`workbenchTypeDefinitions`, `workbenchScopes`,
`workbenchTileContributions()`) — the shared-package pattern replacing the
deprecated `TileDescriptorOptions.extra` seam — with a parity suite pinning
the fragment to `createTileDescriptor` row for row across five tile states.
datalab-ui migrated field, datum, doc, and stage to kernel rules and one
bounded family in a new `src/pbui/actions.ts`; the four descriptors dropped
their `actions()` callbacks (now optional on the product descriptor
interface), which is exactly how the legacy family knows to stay silent for
them. `runtime.tsx` passes the product registry and `snapshotForDatalab`
into `createPbui`.

Equivalence audit before re-pinning goldens: 82 menu rows before and after,
every label and every available verb byte-identical. Two deliberate semantic
changes, both kernel-native: unavailable rows no longer carry verbs
(bind-only-available), and "Make the ACTIVE chart" / "Switch to it" /
"Group by + count on quantitative" are now `inapplicable` rather than
conditionally-not-pushed — same visible menus, honest override semantics.

### Prompt Context

**User prompt (verbatim):** (see Step 3)

**Commit (code):** `e33f213` — "PBUI-ACTIONS-2 P3: workbench contribution
fragments; datalab field/datum/doc/stage on kernel rules"

### What I did
- `packages/pbui-workbench/src/actions.ts` + tests; `extra` deprecated with
  a pointer, deleted later with descriptor actions.
- `packages/datalab-ui/src/pbui/actions.ts`: `DatalabFacts` (schema-only
  derivation with a facts-derived revision string), field/datum/doc/stage
  contributions, flat 15-type graph, registry composing the legacy family
  with the new rules.
- Four descriptor files stripped of actions; adapter guards optional
  callbacks; runtime wired; both test files route migrated types through the
  kernel via one dispatch helper so every behavioral assertion reads as
  before.

### Why
- Partial migration had to be a first-class state: the optional-callback
  convention (absent callback ⇒ rules are the only voice) gives a crisp,
  testable rule for which engine speaks for a type, with no except-lists.

### What worked
- The golden-diff audit protocol: filter the snapshot diff down to
  non-id/non-label lines, count label lines on both sides (82 = 82, no
  singletons). The only surviving diff was `verb: undefined` on disabled
  rows — reviewed and accepted as the kernel invariant.
- Datalab's 519 non-menu tests (apps, organisms, effects, DuckDB) passed
  untouched on the first post-migration run: the UI genuinely only spoke to
  menus through the seams we replaced.

### What didn't work
- `define.exact("tile", …)` inside a generic `Values extends {tile:
  TileRef}` function: TS cannot prove `"tile"` is a key of an unresolved
  generic. Built against the canonical `{tile: TileRef}` and widened on
  return with a documented cast; the constraint guarantees safety.
- A python heredoc edit ran from the wrong cwd (shell had drifted into a
  package dir) — FileNotFoundError, harmless, re-ran from the root. Same
  cwd-drift lesson as the P0 git failure.

### What I learned
- The `inapplicable` state earned its keep on real product logic
  immediately: three previously conditionally-pushed rows became declarative
  tests, and their absence semantics (permits fallback) is now explicit
  instead of accidental.

### What was tricky to build
- The facts/revision design: the revision string must name exactly the
  derived facts so it moves iff they move; deriving it from the environment
  object identity would have missed store changes behind stable closures.
  Fields: activeDocId, targetDocId, fieldType, categoricalFields.

### What warrants a second pair of eyes
- `verb: undefined` on disabled golden rows is an API-visible change for
  anything that read verbs off disabled rows (nothing in-repo does; the
  goldens prove the menus; but external consumers of `actionsFor` shapes
  should be checked at release notes time).
- The datum family's action ids embed the field name
  (`datum.keep.region`); names with unusual characters would produce odd
  ids — the source guide's `stableActionSegment` encoder is deferred until a
  real corpus needs it, noted here so it is a decision, not an oversight.

### What should be done in the future
- P4: chat demo descriptors → rules/families; sandbox wrapper → generated
  family; re-audit chat internals post-TOOLCALL-1 first.

### Code review instructions
- `git show e33f213`; review `actions.ts` beside the four pre-migration
  descriptors in the parent commit; then the golden snapshot diff.
- `pnpm -r build && pnpm -r test` — 1226 tests.

### Technical details
- Suites: root 158, workbench 138, sandbox 105, datalab 531, chat 237,
  demo 13, protocol 44.
