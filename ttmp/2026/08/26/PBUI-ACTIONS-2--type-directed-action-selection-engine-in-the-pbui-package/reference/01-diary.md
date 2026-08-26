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
