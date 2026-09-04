---
Title: Investigation diary
Ticket: PBUI-DEPENDENCY-DAG-1
Status: active
Topics:
    - pbui
    - architecture
    - refactoring
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://ttmp/2026/09/03/PBUI-DEPENDENCY-DAG-1--enforce-the-pbui-repository-dependency-dag/design-doc/01-intern-guide-to-enforcing-pbui-dependency-boundaries.md
      Note: Phase 0 design and implementation contract
    - Path: repo://ttmp/2026/09/03/PBUI-DEPENDENCY-DAG-1--enforce-the-pbui-repository-dependency-dag/reference/02-package-graph-inventory.json
      Note: Measured 13-package 48-edge baseline
    - Path: repo://ttmp/2026/09/03/PBUI-DEPENDENCY-DAG-1--enforce-the-pbui-repository-dependency-dag/reference/03-root-layer-inventory.json
      Note: Measured root cross-layer baseline
    - Path: repo://ttmp/2026/09/03/PBUI-DEPENDENCY-DAG-1--enforce-the-pbui-repository-dependency-dag/scripts/01-inventory-package-graph.mjs
      Note: Reproducible manifest and source-import inventory
    - Path: repo://ttmp/2026/09/03/PBUI-DEPENDENCY-DAG-1--enforce-the-pbui-repository-dependency-dag/scripts/02-inventory-root-layers.mjs
      Note: Reproducible root source-layer inventory
ExternalSources:
    - /tmp/pbui-improvements.md
Summary: Chronological evidence, design decisions, implementation results, failures, commits, print slips, and validation for PBUI repository dependency-DAG enforcement.
LastUpdated: 2026-09-03T21:50:00-04:00
WhatFor: Make the architecture-guard implementation reproducible and reviewable by an engineer unfamiliar with the repository.
WhenToUse: Read before implementing, reviewing, or continuing PBUI-DEPENDENCY-DAG-1.
---


# Diary

## Goal

Record the evidence-driven hard cutover from conventional PBUI dependency boundaries to executable package and root-layer tests.

## Step 1: Rebase the improvement list and select the real next gap

The requested relation-migration ticket was created, but current code and KERNEL-1 history showed that the proposed migration had already shipped: translator APIs and adapters are gone, Ecommerce declares canonical relations, and links consume the same compiled relation system. I archived the duplicate work as `PBUI-RELATIONS-CUTOVER-1` rather than fabricating a second cutover.

The next unimplemented recommendation is repository dependency-DAG enforcement. I created `PBUI-DEPENDENCY-DAG-1` with seven tasks and redirected the detailed guide there.

### Prompt Context

**User prompt (verbatim):** "create the new docmgr ticket, and Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Create and deliver the next implementation-ready improvement ticket, with enough architecture and repository evidence for a new intern.

**Inferred user intent:** Continue the post-Datalab cleanup on real remaining work rather than preserve stale assumptions from the old assessment.

### What I did

- Created and audited `PBUI-RELATIONS-CUTOVER-1`.
- Searched PBUI and sibling consumers for deleted translator and compatibility APIs.
- Read canonical relation compilation, acceptance, link projection, Ecommerce wiring, and KERNEL-1 completion evidence.
- Archived the redundant ticket and created `PBUI-DEPENDENCY-DAG-1`.

### Why

- `/tmp/pbui-improvements.md` describes a repository state before KERNEL-1.
- The current architecture, not the old priority wording, must determine implementation work.

### What worked

- KERNEL-1 contains explicit completion greps and consumer migration evidence.
- Current Ecommerce has one `PresentationRelation[]` declaration used by both acceptance and derivation.

### What didn't work

- The initial assumption that presentation-relation migration remained was false. Only historical comments retain “translator” terminology.

### What I learned

- Product-domain `host.relations` methods are data access, not presentation compatibility adapters.
- Dependency-DAG enforcement is the first genuinely unimplemented item after the completed cutovers.

### What was tricky to build

- The stale recommendation sounded plausible because “relation” appears throughout product code. The decisive distinction was whether two presentation relation declarations/interpreters existed. They do not.

### What warrants a second pair of eyes

- None for the pivot; the audit commands and prior ticket completion record are explicit.

### What should be done in the future

- Periodically annotate the original improvement list with completed ticket IDs or regenerate priorities from current code.

### Code review instructions

- Read `PBUI-RELATIONS-CUTOVER-1`’s audit and compare Ecommerce’s `presentation/relations.ts`, `runtime.tsx`, and `createShop.ts`.

### Technical details

```text
canonical relation declaration
  → compiled RelationSystem
      → acceptance
      → presentation.linkDeps() → Workbench derivation
```

## Step 2: Phase 0 — freeze package and root-layer evidence

I mapped package manifests and source imports with two ticket-local scripts, wrote the intern guide, and ran the existing baseline. The package graph has 13 nodes and 48 observed internal edges. It is acyclic, but two declaration defects survive all current tests: editor declares an unused Workbench shell dependency, and the PlotScript demo directly imports protocol/client without declaring protocol.

The root import inventory also showed that chrome imports the all-components barrel even though it needs only Dialog, foundation Text, TextInput, and IconButton. The design uses direct imports and a focused component-layer test rather than attempting to regulate every presentation directory.

### Prompt Context

**User prompt (verbatim):** "hardcutover, and do overdo it on the cautiousness, this is still something that gains more from being tested than being overprotective

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Design a coordinated hard cutover, prioritize executable tests, and avoid speculative protection or compatibility machinery.

**Inferred user intent:** Establish useful architecture laws quickly and concretely rather than turn dependency checking into a framework project.

### What I did

- Added and ran `scripts/01-inventory-package-graph.mjs`.
- Added and ran `scripts/02-inventory-root-layers.mjs`.
- Stored deterministic JSON outputs under `reference/`.
- Read all package manifests, workspace patterns, CI, Datalab’s layer test, Workbench’s package test, root component imports, and the suspicious editor edge.
- Ran root PBUI tests, recursive package tests, and recursive typechecks.
- Authored the detailed dependency-DAG intern guide with APIs, algorithms, diagrams, phases, decisions, tests, risks, and file references.
- Printed the overall phase plan and Phase 0 start slips successfully through the remote Almanach service.

### Why

- A graph policy should begin from measured declarations/imports rather than a diagram inferred from package names.
- Ticket-local evidence makes the two initial failures reproducible.

### What worked

- All existing behavior tests and typechecks passed.
- The inventory still found one undeclared and one extraneous edge, proving the new test answers a question current validation does not.
- Datalab’s small Vitest implementation provides an appropriate precedent.

### What didn't work

- N/A in Phase 0.

### What I learned

- Root PBUI is not included in the 12 recursive child-project test runs; `pnpm test` at root is a separate required command.
- The repository currently contains 13 manifests because the three nested demos are explicit workspace entries.
- Broad component barrels obscure the true layer edge even when runtime behavior is correct.

### What was tricky to build

- The scanner must attribute nested demo files to the deepest package root; otherwise demo imports appear to belong to their parent package.
- Runtime, peer, and dev declarations are different architecture claims. Only runtime/peer edges should participate in production cycle checks, but every direct import still needs an appropriate declaration.

### What warrants a second pair of eyes

- Review the proposed initial package adjacency list, especially whether Chat intentionally depends directly on Sandbox.
- Confirm the root component test’s limited scope is sufficient; it deliberately does not impose a total order on all presentation subdirectories.

### What should be done in the future

- Implement Phases 1–5 and preserve the scripts as before-state evidence.

### Code review instructions

- Start with design §§3–7, then compare the two JSON inventories with package manifests.
- Re-run:

  ```bash
  node <ticket>/scripts/01-inventory-package-graph.mjs .
  node <ticket>/scripts/02-inventory-root-layers.mjs .
  pnpm test
  pnpm -r typecheck
  pnpm -r test
  ```

### Technical details

```text
Packages: 13
Observed internal edges: 48
Extraneous: pbui-editor → pbui-workbench
Undeclared: pbui-plotscript-demo → workbench-protocol/client
Baseline: root 831 tests; Datalab 602; all recursive suites green
Printing: overall PLAN + P0 START succeeded
```
