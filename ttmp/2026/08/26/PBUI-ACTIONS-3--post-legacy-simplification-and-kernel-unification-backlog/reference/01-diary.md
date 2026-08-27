---
Title: Diary
Ticket: PBUI-ACTIONS-3
Status: active
Topics:
    - pbui
    - actions
    - architecture
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://src/presentation/actions/types.ts
      Note: ActionMetadata.primary and ResolvedAction.primary (commit 6efeaeb)
    - Path: repo://src/presentation/createPbui.tsx
      Note: The integration surface Phase A rewrote (commit 6efeaeb)
ExternalSources: []
Summary: ""
LastUpdated: 2026-08-26T23:11:46.310900534-04:00
WhatFor: ""
WhenToUse: ""
---


# Diary

## Goal

<!-- What is the purpose of this reference document? -->

## Context

<!-- Provide background context needed to use this reference -->

## Quick Reference

<!-- Provide copy/paste-ready content, API contracts, or quick-look tables -->

## Usage Examples

<!-- Show how to use this reference in practice -->

## Related

<!-- Link to related documents or resources -->

## Goal

Record the execution of the post-legacy simplification program: the backlog
adjudication, the Phase A deletion release (pbui 0.8.0), and the follow-on
phases as real consumers pull them.

## Step 1: Ticket, Backlog Adjudication, and the No-Legacy Ruling

The user ruled that pbui has no backwards-compatibility obligations — a
greenfield stance covering external consumers (agentlogic, turboproof) as
well as in-repo products — and asked for a ticket holding the improvement
backlog without pursuing anything the optkit/rag-ttc work does not need.
This step created PBUI-ACTIONS-3 and wrote the adjudicated backlog: twelve
improvements in three phases, each annotated with the concrete consumer that
pulls it.

### Prompt Context

**User prompt (verbatim):** "but yeah actually you already hinted at it, make a ticket PBUI-ACTIONS-3 to keep note of all this, but we don't need to pursue any more than we need since our main focus is rag-ttc and optkit."

**Assistant interpretation:** Create a docmgr ticket capturing the
no-legacy improvement list from the chat, phased so only what OPTKIT
022/023/024 needs actually gets built.

**Inferred user intent:** Keep the design thinking from being lost while
preventing scope creep away from the rag-ttc/optkit main line.

### What I did
- Created PBUI-ACTIONS-3 with `docmgr ticket create-ticket`.
- Wrote `analysis/01-the-backlog-what-no-legacy-affords-and-what-pulls-each-item.md`:
  Phase A (do now, before OPTKIT-022), Phase B (pulled by OPTKIT-024),
  Phase C (no puller; waits), plus the standing decisions and the consumer
  adaptation method.

### Why
- The delete-versus-deprecate adjudication from PBUI-ACTIONS-2 was resolved
  by the user's ruling; the resolution needed a durable home.

### What worked
- The pulling-consumer annotation made the phasing self-evident: only A has
  a reason to run now.

### What didn't work
- N/A

### What I learned
- "No obligations to legacy" resolves not just deletions but API-shape
  questions (required `actions`, descriptor Verb generic) that deprecation
  windows would have frozen.

### What was tricky to build
- Nothing in this step; it is documentation.

### What warrants a second pair of eyes
- The Phase B/C boundary: refusal surfacing (C2) could arguably be pulled by
  OPTKIT-023's seal UX; the backlog records it as polish.

### What should be done in the future
- Phase B lands as one small release immediately before OPTKIT-024 starts.

### Code review instructions
- Read the analysis doc top to bottom; check each item names its puller.

### Technical details
- N/A

## Step 2: Phase A — the 0.8.0 Deletion Release (commit 6efeaeb)

One commit deletes every legacy surface and makes the kernel the only
engine: descriptor `actions()` and the `PresentationAction` row shape,
`actionsFor`, the `conversions` option and `PresentationConversion`, the
automatic legacy engine (`legacyDescriptorFamily`/`LegacyFacts`), and the
0.4.0 `onActivate`/`activateDoc` tombstones. `createPbui` now requires
`actions` + `snapshotFor`; acceptance always resolves through the typed
translator path; descriptors and their registry drop the `Verb` generic and
`PresentationDescriptorRegistry` is the only name. The one new capability is
the PRIMARY invocation: `metadata.primary` marks an action, and a bare left
click performs the unique available primary through fresh revalidation —
zero or several primaries open the menu.

### Prompt Context

**User prompt (verbatim):** "then do 
  1. One pbui cleanup commit now: the deletions you already ruled on (#1–3) plus activate removal (#4). Bump to
     0.8.0. This is the version the OPTKIT design docs target, so the guides never mention a mechanism that's about
     to die.
  2. Update the four design docs against that API (the plan you approved).
  3. 022 → 023 on pbui 0.8.0, no further pbui work required.
  4. Small pbui release with #6 + #11 just before 024, pulled by its actual tasks.
  5. Everything else waits until something pulls it.. 

commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)

Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done."

**Assistant interpretation:** Execute the five-step program: Phase A cleanup
release now, then retarget the OPTKIT design docs, then implement
OPTKIT-022 and 023 on pbui 0.8.0, with slips, commits, and diaries
throughout.

**Inferred user intent:** Get the greenfield API locked before any new
consumer (the ragttc workbench) is written against it, so nothing is built
on a mechanism scheduled to die.

**Commit (code):** 6efeaeb — "PBUI-ACTIONS-3 A1-A4: delete legacy surfaces, kernel-only createPbui, primary invocation"

### What I did
- Deleted `src/presentation/actions/legacy.ts` + its test; stripped legacy
  exports from `actions/index.ts` and `presentation/index.ts`.
- `types.ts`: deleted `PresentationAction` (tombstones included),
  `PresentationConversion`, and descriptor `actions()`; descriptor types
  dropped the `Verb` generic.
- `registry.ts`: rewrote as representation-only
  `PresentationDescriptorRegistry` (no `actionsFor`, no legacy alias).
- `createPbui.tsx`: `actions`/`snapshotFor` required (guards deleted —
  the type system enforces them now); `conversions` and the internal legacy
  engine deleted; acceptance always uses `resolveAcceptance` with
  `translators ?? []`; `onActivate`/`activateDoc` tombstone props deleted;
  primary-click resolution added to `Presentation` (click + Enter paths,
  lazy `primaryFor()`, mouse-doc `L: <label>`).
- Kernel: `ActionMetadata.primary?` and `ResolvedAction.primary` threaded
  through `resolve.ts`.
- Consumers: datalab/demo facts drop `LegacyFacts` for an inline
  `environment` field; datalab registry adapter loses its `actions?: never`
  tombstone and Verb generic; chat context/createPbuiChat generics fixed;
  pbui-workbench `createTileDescriptor` 2-generic.
- Tests/stories rewritten onto kernel fixtures: `createPbui.test.tsx`,
  `instanceChrome.test.tsx`, `registry.test.ts`, `Pbui.stories.tsx`,
  `FileBrowser.test.tsx`, `FileBrowser.stories.tsx` (its per-kind menu is
  now a bounded family — the dynamic-membership case families exist for).
  The "automatic legacy engine" suite was deleted; a three-test "primary
  invocation" suite was added to `createPbui.actions.test.tsx`.
- Version 0.7.0 → 0.8.0; `pnpm build && pnpm -r build`; full sweep green.

### Why
- The user's no-legacy ruling; and OPTKIT-022 must be written against the
  final API, not one carrying mechanisms scheduled for deletion.

### What worked
- The deletion surfaced zero behavioral regressions: 1221 tests pass, and
  the only test-count change is the deleted legacy suites versus the new
  primary suite (root 168 → 165).

### What didn't work
- First registry fixture used `id: "person.select"` equal to its action id
  — the kernel's rule-id≠action-id validation would reject it; caught while
  writing, renamed to `test.person.select` before running.

### What I learned
- `activate` was NOT a descriptor-side legacy mechanism as the backlog
  assumed: since 0.4.0 it is a per-instance JSX prop whose real job is
  host-owned clicks (selection/expansion a type-scoped kernel rule cannot
  express). A4 therefore became "delete the tombstone props, add kernel
  primary resolution as the default, keep `activate` as the instance
  override" — recorded in the backlog doc's A4 entry.

### What was tricky to build
- The primary-click cost boundary: `clickDoc` was computed per render, and a
  kernel resolution per rendered presentation would put menu-time work on
  every grid cell (the datalab DR-40 boundary). Symptom would have been
  invisible until a big table rendered. Solution: `primaryFor()` is lazy —
  evaluated on hover, focus, click, and Enter only; the render path does no
  resolution.
- Deciding the multi-primary rule: performing the highest-priority primary
  would reintroduce exactly the guessing the kernel exists to kill. The
  unique-or-menu rule keeps ambiguity user-visible; the third test pins it.

### What warrants a second pair of eyes
- The acceptance path change: products without translators previously got
  exact-type matching only; they now also get graph-subtype satisfaction.
  For every in-repo product the graphs make this a no-op or an upgrade, but
  it is a semantic widening worth a reviewer's glance.
- `PbuiInstance` gained a fourth generic (`ProductFacts = unknown`) — check
  downstream `.d.ts` consumers (agentlogic, turboproof) when they adapt.

### What should be done in the future
- agentlogic and turboproof adapt with the golden-fence method (freeze
  menus, migrate descriptors to rules, diff) when they upgrade to 0.8.0.

### Code review instructions
- Start at `src/presentation/createPbui.tsx` (options, acceptanceFor,
  Presentation click/keydown), then `types.ts`/`registry.ts`, then the
  primary suite in `createPbui.actions.test.tsx`.
- Validate: `pnpm build && pnpm -r build && npx vitest run && pnpm -r test`.

### Technical details
- Suite counts after: root 165, workbench-protocol 44, pbui-workbench 125,
  datalab-ui 533, pbui-sandbox 104, pbui-chat 237, demo 13 = 1221.
