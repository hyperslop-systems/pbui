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
