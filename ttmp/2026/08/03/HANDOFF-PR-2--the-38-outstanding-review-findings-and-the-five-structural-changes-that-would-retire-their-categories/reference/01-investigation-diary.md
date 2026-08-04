---
Title: Investigation diary
Ticket: HANDOFF-PR-2
Status: active
Topics:
    - pbui
    - frontend
    - backend
    - review
    - onboarding
    - refactoring
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://src/components/organisms/FileBrowser/FileBrowser.tsx
      Note: Composite tree selection, focus, and keyboard ownership reviewed in section 3.4.
    - Path: repo://src/presentation/createPbui.tsx
      Note: Shared provider, presentation renderer, menu, accept, and keyboard composition reviewed in sections 3 and 9.
    - Path: repo://src/presentation/types.ts
      Note: Shared presentation and verb contracts reviewed in section 3.
    - Path: repo://src/styles-wiring.test.ts
      Note: Stylesheet wiring false-negative finding covered in the 38-item matrix.
    - Path: ws://turboproof/pkg/filestore/store.go
      Note: Root containment, fingerprints, rename, overlapping roots, directories, and symlink semantics reviewed in section 5.
    - Path: ws://turboproof/pkg/server/handlers_files.go
      Note: Disk-mutating HTTP request validation and payload presence semantics reviewed in section 5.5.
    - Path: ws://turboproof/ui/src/apps/SaveControl.tsx
      Note: Deleted-file save and missing-resource flow reviewed in section 5.6.
    - Path: ws://turboproof/ui/src/hooks/fileTree.ts
      Note: File-tree refresh preservation reviewed in section 5.6.
    - Path: ws://turboproof/ui/src/store/renameBinding.ts
      Note: Open-document URI collision invariant reviewed in section 5.4.
    - Path: ws://turboproof/ui/src/store/sync.tsx
      Note: Missing-versus-failed classification and retry delivery reviewed in section 5.6.
ExternalSources:
    - https://github.com/hyperslop-systems/turboproof/pull/3
    - https://github.com/hyperslop-systems/hyperblog/pull/1
    - https://github.com/hyperslop-systems/agentlogic/pull/3
    - https://github.com/hyperslop-systems/pbui/pull/9
Summary: Chronological evidence trail for the four-repository HANDOFF-PR-2 architecture and code review, including commands, failures, test results, deductions, and review instructions.
LastUpdated: 2026-08-03T21:00:00-04:00
WhatFor: Make the review reproducible and show a future implementer where each conclusion came from.
WhenToUse: Use when validating the companion design document, reproducing the review state, or beginning implementation of a finding.
---











# Diary

## Goal

Reconstruct the live state behind HANDOFF-PR-2, review the four involved
repositories deeply enough to teach a new intern their architecture, test the
ticket's structural proposals against the actual code, and deliver a technical
design and code-review package without falsely marking implementation findings
as fixed.

## Step 1: Establish the request and evidence boundary

I began with the existing ticket rather than the pull requests alone. This was
important because the ticket already contained a manually curated finding list,
an API enumeration script, and the previous design synthesis. I then followed
its links into HANDOFF-PR-1 and PBUI-HARDEN-1 to recover the architectural and
historical context that an isolated diff review would miss.

### Prompt Context

> Read pbui/ttmp/2026/08/03/HANDOFF-PR-2--the-38-outstanding-review-findings-and-the-five-structural-changes-that-would-retire-their-categories  and all the related data and do an in depth code review of the repositories involved.
>
> Create  a detailed analysis / design / archivecture / code review that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

### What I did

- Read the complete existing HANDOFF-PR-2 design, tasks, source snapshot, and
  finding-enumeration script.
- Read the HANDOFF-PR-1 architecture guide and diary, plus PBUI-HARDEN-1's
  design and relevant related documentation.
- Recorded the exact reviewed branches and commits:
  - pbui `task/pbui-api-hardening` at `8133149`;
  - turboproof `task/lint-private-module` at `e9de793`;
  - hyperblog `task/transcript-agent` at `e622489`;
  - agentlogic `task/agentlogic-ui-1` at `d6c0e91`.
- Ran the ticket's GitHub GraphQL enumeration script and compared its result to
  `sources/01-open-findings-2026-08-03.txt`.

### Why

Review comments are mutable external state, while the ticket snapshot is an
auditable baseline. Re-deriving the live count answers two separate questions:
what the ticket believed, and whether that belief still matched GitHub at the
time of this review.

### What worked

The escalated enumeration succeeded and returned exactly 38 unresolved
findings: 12 turboproof, 18 hyperblog, 8 pbui, and 0 agentlogic. Priority totals
were 7 P1 and 31 P2. This exactly matched the ticket source snapshot.

### What didn't work

The first sandboxed invocation failed because GitHub was unreachable:

```text
subprocess.CalledProcessError: Command '['gh', 'api', 'graphql', ...]'
returned non-zero exit status 1
```

A direct diagnostic made the cause explicit:

```text
error connecting to api.github.com
check your internet connection or https://githubstatus.com
```

The same read-only script succeeded when re-run with approved network access.
No review state was mutated.

### What I learned

The prior undercount was not present in this ticket. The 38-item snapshot is a
reliable basis for the new review, and agentlogic has no currently unresolved
review thread even though its code is useful as a downstream reference.

### What was tricky

The related material spans four repositories and multiple ticket generations.
The useful boundary was not “every document mentioning PBUI”; it was documents
that explained the shared presentation protocol, the workbench wire format, or
the origin of the open findings.

### What deserves a second pair of eyes

GitHub thread resolution can change after this diary is written. Before
implementation begins, rerun `scripts/01-list-open-findings.py` and compare
identifiers, not just counts.

### What I should do in the future

Keep the live-enumeration script beside every handoff built from review threads.
Counts copied into prose should always be derived outputs.

### Code review instructions

Use `sources/01-open-findings-2026-08-03.txt` as the immutable review snapshot
and the script as the freshness check. Do not infer that a passing test suite or
a resolved thread means the underlying category is retired.

### Technical details

The script uses GitHub's GraphQL review-thread connection, filters unresolved
and non-outdated threads, and derives priority labels from comment content. It
is intentionally read-only.

## Step 2: Trace the runtime boundaries in code

I reviewed the system from shared protocol outward: PBUI's presentation and
accept machinery, each product's workbench catalog and React root, then the
backend boundaries where persistence, authorization, and filesystem behavior
enter. This direction exposed category-level problems more clearly than walking
the 38 comments in numeric order.

### What I did

- Traced PBUI `ObjectPresentation`, `Presentation`, `Verb`, `PbuiProvider`,
  accept dispatch, menu composition, composite selection, and FileBrowser.
- Traced turboproof's rooted `filestore`, fingerprint-based save, rename API,
  HTTP handlers, open-document binding, file-tree refresh, connection sync, and
  save UI.
- Traced hyperblog's corpus loader, tier model, search, HTTP corpus and private
  workbench handlers, verb reducer, accept effects, pane tree, placement
  bindings, world state, and tile registry.
- Compared agentlogic's workbench catalog and ChangesPanel keyboard ownership as
  a downstream reference.
- Searched call sites rather than trusting API declarations, including every
  hyperblog `useWorld` use and every read of placement bindings.
- Ran Go, frontend, and TypeScript checks in every repository.

### Why

Most findings occur where locally sensible modules compose. A handler can be
correct for valid JSON while the HTTP boundary accepts an unsafe request; a
tile can render correctly while ignoring its placement binding; a file store
can protect ordinary paths while treating symlinks inconsistently. The review
therefore had to reconstruct ownership and dataflow, not merely inspect the
commented line.

### What worked

All four Go suites passed with `GOWORK=off go test ./...`. The frontend results
were:

| repository | test result | typecheck |
|---|---:|---|
| pbui | 12 files, 94 tests | passed |
| turboproof | 17 files, 131 tests | passed |
| hyperblog | 4 files, 25 tests | passed |
| agentlogic | 14 passed + 1 skipped files, 121 passed + 1 skipped tests | passed |

These results provide a clean baseline and confirm that the findings mostly
describe missing boundary tests and invariants rather than already-failing
unit behavior.

### What didn't work

The turboproof and hyperblog pnpm commands emitted a warning that their `.npmrc`
could not substitute `${NODE_AUTH_TOKEN}`. Dependencies were already available,
and tests and typechecks completed successfully, so the warning did not block
validation. No environment value was read or introduced for this review.

No browser/server smoke was attempted. The request was a review and design
deliverable, and the repository suites plus source trace supplied the needed
evidence without starting mutable long-running services.

### What I learned

The original seven-category diagnosis is sound, but three refactor boundaries
needed correction:

1. A reader-safe corpus must be materialized data that cannot expose the raw
   corpus, not a wrapper that still retains it.
2. Hyperblog needs layout, accept, and domain verb languages; accept is an
   effectful orchestration boundary, not a pure reducer operation.
3. Keyboard reuse should stop at an event-ownership predicate. FileBrowser,
   PBUI presentation rows, and agentlogic changes have different commands and
   state machines.

Two defects were discovered beyond the 38-thread matrix:

- Hyperblog advertises `bindings.term`, but `TermApp` and reader highlighting
  read the ambient cursor and no tile consumes that binding.
- `performLayout` communicates out of a React state updater by mutating a local
  `handled` boolean, then immediately reads it. Classification must be pure and
  occur before scheduling the update.

### What was tricky

Symlinks require two valid identities: a namespace entry and a content target.
A single “follow” or “do not follow” policy is insufficient. The coherent
design is operation-specific: rename/delete address the link entry; read,
fingerprint, save, and directory traversal dereference an in-root target; locks
for content mutation use the canonical target.

Hyperblog bindings posed a similar ownership problem. Removing all `useWorld`
would be too broad because global UI state is legitimate. The correct boundary
is a derived `TileScope` created once per placement:

```text
postId = placement.bindings.post ?? cursor.postId
termId = placement.bindings.term ?? cursor.termId
```

Tiles may consume that scope, but should not reconstruct address precedence.

### What deserves a second pair of eyes

- The product decision around free/member entitlement remains intentionally
  unresolved; it is not safe to classify from code alone.
- Turboproof's symlink semantics should be reviewed against operator
  expectations before implementation.
- The private-workbench cache policy should be checked at any reverse proxy in
  front of the Go server, not only in handler tests.
- Browser composition smoke tests should be added after the structural changes;
  current unit tests cannot prove embedded assets and real root wiring work.

### What I should do in the future

For cross-repository UI families, start reviews with the protocol and ownership
model. Then inspect every consumer. This catches semantic drift—such as an
advertised but unused binding—more reliably than reviewing each repository in
isolation.

### Code review instructions

Implement security findings first. Add a failing regression at the true
boundary before changing code. Avoid compatibility adapters: change the shared
API and all four controlled call sites atomically. Keep the 38 ticket tasks open
until their code and regression tests land.

For each category, review both the primary path and its bypass:

- provider construction and initialization placeholders;
- safe projection and all search/index call sites;
- pure reducer and effectful accept/domain routing;
- placement scope and ambient cursor fallbacks;
- focused container and editable/nested interactive descendants;
- missing resource and transient transport failure;
- path spelling, canonical target, namespace entry, and lock key.

### Technical details

The companion design document contains the full architecture diagrams,
pseudocode, API sketches, all-38 finding matrix, revised decisions,
implementation order, test plan, and file reference map. It is intentionally a
design review, not an implementation patch.

## Step 3: Synthesize and deliver the review package

I wrote a standalone intern guide so a reader does not need the pull-request
conversation in their head. The guide begins with the family architecture and
vocabulary, follows real data through each repository, then turns the review
into explicit decisions and an ordered implementation plan.

### What I did

- Added `design-doc/02-intern-architecture-and-code-review-pbui-hyperblog-turboproof-and-agentlogic.md`.
- Included prose, tables, ASCII component/dataflow diagrams, pseudocode,
  proposed APIs, invariants, test cases, all 38 findings, risks, rejected
  alternatives, open product questions, and line-addressable file references.
- Kept the existing implementation TODOs unchecked.
- Related the primary source files to the design and this diary with docmgr.
- Updated ticket navigation and changelog, ran ticket diagnostics, and prepared
  the original design, new review, and diary as one reMarkable bundle.

### Why

The original design is a strong tactical handoff, while the new document is an
onboarding and architecture artifact. Bundling both preserves the concise
finding-centric view and the long-form explanation of why the fixes belong at
particular boundaries.

### What worked

The finished design is more than 1,300 lines and is structured for both sequential
onboarding and reference use. Ticket diagnostics and reMarkable delivery are
recorded in the final ticket changelog and can be reverified using the commands
below.

### What didn't work

No delivery step failed. The render-only dry run selected all three intended
documents, the real upload completed, and the remote listing showed
`HANDOFF-PR-2 — Architecture and Code Review` in the requested directory. The
local Markdown artifacts remain the source of truth regardless of rendering or
cloud state.

### What I learned

A useful intern handoff must explain more than the desired patches. It needs to
name the invariants, identify the owner of each state transition, show how the
wire protocol and React runtime meet, and explain why green unit tests do not
cover the reported failures.

### What was tricky

The report needed to remain honest about scope. The review validates and
redesigns all finding categories, but does not close the findings. Separating
completed research/delivery tasks from open implementation tasks preserves that
distinction.

### What deserves a second pair of eyes

The first implementer should review the six design decisions in section 9 with
the repository owner before beginning phases 3 and 4. The security and data-loss
P1s can proceed first because their desired behavior is already well-defined.

### What I should do in the future

After implementation, append a dated validation note rather than rewriting this
evidence snapshot. That keeps the reasoning reproducible at the reviewed
commits.

### Code review instructions

Start with sections 1–6 of the design. Use section 8 to map every live thread,
section 9 for accepted structural boundaries, section 10 for sequencing, and
section 11 as the regression checklist. Re-run the exact validation matrix after
each cross-repository API change.

### Technical details

Validation commands:

```bash
GOWORK=off go test ./...
pnpm run test
pnpm run typecheck
docmgr doctor --ticket HANDOFF-PR-2 --stale-after 30
```

The reMarkable bundle uses remote directory
`/ai/2026/08/03/HANDOFF-PR-2` and includes the two design documents plus this
diary. `remarquee cloud ls /ai/2026/08/03/HANDOFF-PR-2 --long
--non-interactive` verified the uploaded document by name.
