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
    - Path: repo://packages/pbui-editor/package.json
      Note: Removed stale shell dependency in Phase 1 commit 4c74b31
    - Path: repo://packages/pbui-editor/scripts/consumer-smoke.mjs
      Note: Packed editor validation now proves Workbench independence
    - Path: repo://packages/pbui-plotscript/demo/package.json
      Note: Declares its direct protocol import
    - Path: repo://pnpm-lock.yaml
      Note: Records corrected direct importer edges
    - Path: repo://src/architecture/packageGraph.test.ts
      Note: Real repository laws and failure fixtures
    - Path: repo://src/architecture/packagePolicy.ts
      Note: Explicit 13-node production adjacency from commit 94e28b8
    - Path: repo://src/architecture/rootLayers.test.ts
      Note: Focused root source-layer boundaries
    - Path: repo://ttmp/2026/09/03/PBUI-DEPENDENCY-DAG-1--enforce-the-pbui-repository-dependency-dag/design-doc/01-intern-guide-to-enforcing-pbui-dependency-boundaries.md
      Note: Phase 0 design and implementation contract
    - Path: repo://ttmp/2026/09/03/PBUI-DEPENDENCY-DAG-1--enforce-the-pbui-repository-dependency-dag/reference/02-package-graph-inventory.json
      Note: Measured 13-package 48-edge baseline
    - Path: repo://ttmp/2026/09/03/PBUI-DEPENDENCY-DAG-1--enforce-the-pbui-repository-dependency-dag/reference/03-root-layer-inventory.json
      Note: Measured root cross-layer baseline
    - Path: repo://ttmp/2026/09/03/PBUI-DEPENDENCY-DAG-1--enforce-the-pbui-repository-dependency-dag/reference/04-full-validation-output.txt
      Note: Exact full validation output including the declaration-build failure and retry
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

## Step 3: Phase 1 — correct manifest drift

I made the hard-cutover declaration fixes: editor no longer claims an optional Workbench application or runtime dependency, and the PlotScript demo now directly declares the protocol package it imports. `pnpm install` updated the two importer sections in the lockfile.

The editor’s first packed consumer test exposed a deeper stale assumption: its smoke script still packed and installed Workbench and protocol even though the consumer source only mounts `CodeEditor`. That caused npm to chase unpacked Workbench’s unpublished `workbench-core` dependency. I deleted the stale pack/install paths, then proved the editor tarball works with only PBUI and ordinary React peers.

### Prompt Context

**User prompt (verbatim):** "then implement, commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done.

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Implement the full ticket in reviewable phase commits, keep the strict diary current, and physically print an overall plan plus start/done slips around every phase.

**Inferred user intent:** Make the long-running architecture change observable, auditable, and easy to review both in Git history and on physical work slips.

**Commit (code):** `4c74b317281796511472c779b3f87599bd5493a6` — "Correct PBUI workspace dependency declarations"

### What I did

- Removed `pbui-workbench` from editor dependencies.
- Removed the stale optional-Workbench wording from editor’s package description.
- Added `workbench-protocol` to the PlotScript demo dependencies.
- Updated `pnpm-lock.yaml` with `pnpm install`.
- Removed Workbench and protocol packing/installing from editor consumer smoke.
- Ran editor typecheck, 12 tests, build, and packed consumer smoke.
- Ran PlotScript demo typecheck and production build.
- Printed `P0 DONE` and `P1 START` slips.

### Why

- Internal declarations should equal actual direct package ownership.
- A packed editor test should prove editor independence rather than install unrelated product layers.

### What worked

- Editor typecheck and 12 tests passed immediately.
- Editor consumer smoke passed after removing stale Workbench setup.
- PlotScript demo typecheck and build passed with the explicit protocol declaration.

### What didn't work

The first editor consumer-smoke run failed exactly at:

```text
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/@hyperslop-systems%2fworkbench-core - Not found
npm error 404  The requested resource '@hyperslop-systems/workbench-core@^0.2.0' could not be found or you do not have permission to access it.
...
Error: Command failed: npm install --no-audit --no-fund
...
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @hyperslop-systems/pbui-editor@0.1.0 consumer:smoke
```

Command:

```bash
pnpm --filter @hyperslop-systems/pbui-editor consumer:smoke
```

Root cause: `consumer-smoke.mjs` still explicitly packed and installed Workbench and protocol. It was not evidence that editor required them; it was stale test scaffolding.

### What I learned

- The unused manifest edge had a matching stale smoke-test assumption, confirming the old optional app had been incompletely removed.
- Packed tests can reveal architectural test coupling even when source ownership is already clean.

### What was tricky to build

- Removing only the manifest edge was insufficient because the smoke fixture authored its own independent consumer manifest. The exact fix was to remove both tarball creation and consumer dependency entries for Workbench and protocol.

### What warrants a second pair of eyes

- Confirm no intended editor Workbench adapter was accidentally omitted from source. Repository search found none, and the package export map exposes only editor APIs and CSS.

### What should be done in the future

- Let the package graph test make the source/declaration mismatch impossible to reintroduce.

### Code review instructions

- Review `packages/pbui-editor/package.json` beside `scripts/consumer-smoke.mjs`.
- Review `packages/pbui-plotscript/demo/src/workbench.ts:3` beside its package manifest.
- Validate with:

  ```bash
  pnpm --filter @hyperslop-systems/pbui-editor consumer:smoke
  pnpm --filter @hyperslop-systems/pbui-plotscript-demo typecheck
  pnpm --filter @hyperslop-systems/pbui-plotscript-demo build
  ```

### Technical details

```text
Editor direct internal runtime dependency: pbui only
PlotScript demo direct protocol subpath: workbench-protocol/client
Lockfile importer edges match both manifests
```

## Step 4: Phase 2 — build the package policy and scanner

I encoded all 13 package nodes and their intended production adjacency in `src/architecture/packagePolicy.ts`. The scanner discovers manifests recursively, gives nested demo files to the deepest package root, classifies production/test/story/script/config imports, normalizes package subpaths, collects declarations by kind, checks export maps, and provides deterministic cycle detection.

The first parser implementation deliberately attempted the installed TypeScript compiler API. TypeScript 7.0.2’s native package does not expose `ScriptKind`, `createSourceFile`, or `preProcessFile`, so the targeted test failed immediately. I replaced compiler coupling with a small tested lexical scanner covering the import forms used by this ESM repository.

### Prompt Context

**User prompt (verbatim):** (same as Step 3)

**Assistant interpretation:** Implement the scanner as a reviewable phase with tests and a focused commit.

**Inferred user intent:** Make graph discovery trustworthy before turning it into repository policy.

**Commit (code):** `208751694a6d86bc8522881aa583f72a7856d575` — "Add PBUI workspace dependency scanner"

### What I did

- Added the explicit 13-node package policy.
- Added package discovery, ownership, import extraction, use classification, declaration collection, export matching, and cycle helpers.
- Added 14 table-driven helper tests.
- Ran targeted tests and root typecheck.
- Printed `P1 DONE`, `P2 START`, `P2 DONE`, and `P3 START` slips at the phase boundaries.

### Why

- Discovery mechanics and architectural policy should be separable and independently reviewable.
- Nested demos are first-class workspace packages; parent attribution would corrupt direct-dependency results.

### What worked

- The lexical scanner produced 720 import occurrences, 47 unique internal source edges, and 48 runtime/peer declarations after Phase 1.
- All 14 helper tests and root typecheck passed.

### What didn't work

Initial command:

```bash
pnpm exec vitest run src/architecture/workspacePackages.test.ts
```

Failure:

```text
TypeError: Cannot read properties of undefined (reading 'TS')
 ❯ extractModuleSpecifiers src/architecture/workspacePackages.ts:117:81
 const scriptKind = fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
```

A direct probe also showed:

```text
TypeScript version: 7.0.2
preProcessFile: undefined
module exports: default, module.exports, version, versionMajorMinor
```

### What I learned

- TypeScript 7’s native package cannot be assumed to provide the historical JavaScript compiler API.
- The repository already has a successful regex-based import-boundary precedent in Datalab; a tested lexical scanner is the leaner fit here.

### What was tricky to build

- Static imports, re-exports, side-effect imports, dynamic literal imports, and literal `require()` use different syntax. The final scanner uses three constrained patterns, records match positions, and sorts results back into source order. Computed dynamic imports remain a build concern because no static package can be derived from them.

### What warrants a second pair of eyes

- Review `extractModuleSpecifiers` for unusual import syntax before adding new JavaScript dialects. Its supported grammar is explicit and unit tested.

### What should be done in the future

- If the repository adopts a direct parser dependency for another reason, compare its import extraction against these fixtures before replacing the lexical scanner.

### Code review instructions

- Start with `packagePolicy.ts`, then inspect pure helpers in `workspacePackages.ts` and their table tests.
- Run `pnpm exec vitest run src/architecture/workspacePackages.test.ts && pnpm typecheck`.

### Technical details

```text
13 policy nodes
47 unique internal source edges after manifest cleanup
48 internal runtime/peer declarations
14 helper tests
```

## Step 5: Phase 3 — enforce package graph laws

I added one repository test that compares discovered packages, actual declarations, and direct source imports to the explicit policy. It fails on missing/stale package entries, incorrect package paths, undeclared imports, forbidden edges, unused runtime declarations, private subpaths, and runtime/peer cycles. Six fixture tests prove the important diagnostics rather than relying only on the currently valid graph.

The first real-repository run found that editor’s PBUI edge has no production JavaScript import. Investigation showed this is an intentional non-code runtime contract: editor theme values read PBUI CSS variables and the packed consumer imports PBUI styles. I represented that single edge as a reasoned policy exception and removed the remaining stale Workbench strings from editor’s Vite externals.

### Prompt Context

**User prompt (verbatim):** (same as Step 3)

**Assistant interpretation:** Turn the scanner into blocking architecture laws and test both green and failing graphs.

**Inferred user intent:** Prevent the exact drift found in Phase 0 without excessive framework machinery.

**Commit (code):** `94e28b8c4a14da274e0b03d74d137e4973026681` — "Enforce the PBUI package dependency DAG"

### What I did

- Added `analyzeWorkspaceGraph(...)` with deterministic structured violations.
- Added the real 13-package repository assertion.
- Added fixtures for undeclared, unused, forbidden, cyclic, private-subpath, and missing-policy failures.
- Added one documented CSS-token runtime exception for editor → PBUI.
- Removed stale `pbui-workbench` externalization from editor Vite config.
- Ran 23 architecture tests and root typecheck.

### Why

- The test must prove failure behavior, not merely snapshot today’s green graph.
- Non-code contracts should be explicit and reasoned rather than hidden by weakening unused-edge detection globally.

### What worked

- The corrected repository passes all package laws.
- The fixtures reproduce both original defect classes and a complete cycle path.
- Subpath checks accept protocol/client and pbui/link-kernel only through published export maps.

### What didn't work

The first real graph assertion failed with:

```text
unused-runtime-dependency:
@hyperslop-systems/pbui-editor declares @hyperslop-systems/pbui in dependencies,
but production source does not import it
```

This was not another removable edge. `src/theme.ts` reads PBUI-defined `--pbui-*` CSS tokens, README documents that contract, and packed smoke imports `@hyperslop-systems/pbui/styles.css`.

### What I learned

- “Used” cannot mean only JavaScript import when package contracts include CSS token providers.
- A narrow reasoned exception preserves strict defaults while documenting the one non-code edge.

### What was tricky to build

- Peer and runtime declarations both participate in architecture and cycle checks, while dev declarations only satisfy tests/tools. Production imports declared only in dev dependencies must still fail.
- Duplicate declaration kinds and repeated file imports had to collapse into deterministic diagnostics, otherwise CI output would be noisy and order-sensitive.

### What warrants a second pair of eyes

- Confirm the editor → PBUI CSS-token contract should remain a dependency rather than become a peer. Either kind is architectural; current packed behavior is green.
- Review package allowlist additions as architecture changes, not test maintenance.

### What should be done in the future

- Remove the editor exception if editor gains a direct public PBUI import or owns independent token defaults.

### Code review instructions

- Read `analyzeWorkspaceGraph` in violation order, then the six failure fixtures.
- Temporarily remove PlotScript demo’s protocol declaration and confirm the real repository test names `src/workbench.ts`.

### Technical details

```text
Graph laws: completeness + path + declaration + allowlist + usage + exports + cycle
One non-code runtime exception: editor → PBUI CSS tokens
23 package architecture/helper tests
```

## Step 6: Phase 4 — enforce focused root PBUI layers

I replaced chrome’s two all-components barrel imports with concrete Dialog, Text, TextInput, and IconButton entries. The new root test governs the stable component stack, chrome, and visualization while explicitly listing cross-cutting component directories. It allows the intentional FileBrowser-to-shortcut-routing direction and rejects lower components reaching upward.

This is intentionally smaller than Datalab’s source graph. Root presentation assembly has legitimate ContextHelp/type collaboration that should not be forced into a speculative total order by this ticket.

### Prompt Context

**User prompt (verbatim):** (same as Step 3)

**Assistant interpretation:** Add the useful stable root boundaries, prove them with fixtures, and avoid over-regulating integration modules.

**Inferred user intent:** Gain immediate architectural feedback without a broad cleanup project disguised as a test.

**Commit (code):** `747eb24fa80d1d7b75477ec3644ddc5fe0f17b53` — "Enforce root PBUI source layer boundaries"

### What I did

- Narrowed `LauncherShell.tsx` and `TileFrame.tsx` imports.
- Added root-layer classification and production-source walking.
- Added the focused dependency policy.
- Added five real/fixture/completeness tests.
- Ran all 51 root test files and 859 tests.
- Printed `P3 DONE`, `P4 START`, `P4 DONE`, and `P5 START` slips.

### Why

- Package tests cannot detect an atom importing an organism inside the same package.
- Direct imports reveal chrome’s actual dependencies and avoid loading/reviewing the broad component barrel.

### What worked

- The initial focused policy passed after the two narrow import changes.
- A fixture proves foundation → atoms fails.
- A fixture proves organisms → chrome shortcut utility remains allowed.
- Root baseline increased from 48 files / 831 tests to 51 files / 859 tests, all green.

### What didn't work

- N/A in Phase 4.

### What I learned

- The current root stack is already clean once chrome’s barrel imports are made precise.
- `ContextHelp`, `Dialog`, `InspectorPanel`, and `JsonBlock` are cross-cutting component assemblies rather than numeric component layers.

### What was tricky to build

- Imports resolve to both files (`components/format`) and directories (`components/foundation`). Layer classification strips extensions but preserves the first component group.
- Stories and tests compose across layers by design, so the production walker excludes them just as Datalab’s policy does.

### What warrants a second pair of eyes

- Review the intentional organism → chrome direction. Today it targets only the model-free `shortcutRouting` utility; if chrome later imports organisms, the reverse edge remains blocked by chrome’s allowlist.

### What should be done in the future

- Add presentation sublayers only in response to a concrete undesirable edge, not as speculative completeness.

### Code review instructions

- Review the two narrowed chrome imports first, then `ROOT_LAYER_POLICY` and the forbidden/allowed fixtures.
- Run `pnpm exec vitest run src/architecture/rootLayers.test.ts && pnpm test`.

### Technical details

```text
Governed: foundation → layout → atoms → molecules → organisms
Additional: chrome, visualization
Cross-cutting inventory: ContextHelp, Dialog, InspectorPanel, JsonBlock
Root result: 51 files / 859 tests passed
```

## Step 7: Phase 5 — integrate, validate, and prepare delivery

The architecture tests need no bespoke CI step: root `pnpm test`, already run by `.github/workflows/ci.yml`, discovers all three architecture test files. I documented the package-authoring contract in the root README and excluded test-only scanner support from declaration emission so architecture tooling does not become part of the published PBUI surface.

The complete validation sweep passed after that packaging correction: frozen install, root typecheck/test/build/consumer smoke, all recursive package typechecks/tests/builds, editor pack check, and Workbench’s packed headless boundary. The committed validation transcript records both the initial failure and successful retry.

### Prompt Context

**User prompt (verbatim):** (same as Step 3)

**Assistant interpretation:** Complete release-path integration, run all relevant gates, retain exact evidence, and prepare final documentation delivery.

**Inferred user intent:** Finish the ticket with proof that architecture enforcement is blocking, package-safe, and non-regressive.

**Commit (code):** `d7e2299a027eeccae9c5fea58ce6e6a688029eec` — "Integrate PBUI architecture checks into release gates"

### What I did

- Added the explicit chrome → organism rejection fixture, bringing architecture tests to 29.
- Excluded `src/architecture/**` from `tsconfig.build.json` declaration emission.
- Added dependency-boundary authoring guidance to root README.
- Ran the frozen-install and full root/recursive/pack/boundary validation sequence.
- Stored all output in `reference/04-full-validation-output.txt`.
- Confirmed no CI workflow modification is needed because root `pnpm test` is already blocking.

### Why

- Test support uses Node filesystem APIs and is not a public PBUI runtime module.
- A policy hidden only in test source is easy for package authors to miss; README makes the same-change expectation explicit.

### What worked

- Root: 51 files / 860 tests passed.
- Protocol: 3 files / 40 tests passed.
- Workbench core: 31 files / 243 tests passed.
- Workbench shell: 23 files / 116 tests passed.
- Datalab: 55 files / 602 tests passed.
- Editor: 2 files / 12 tests passed.
- Ecommerce: 7 files / 35 tests passed.
- Sandbox: 18 files / 224 tests passed.
- PlotScript: 5 files / 32 tests passed.
- Chat: 25 files / 241 tests passed.
- Chat demo: 3 files / 13 tests passed.
- All 12 child package typechecks and builds passed.
- Root packed consumer, editor pack check, and Workbench no-React boundary passed.

### What didn't work

The first full sweep reached root declaration build and failed:

```text
src/architecture/packageGraph.ts(1,31): error TS2591: Cannot find name 'node:path'.
src/architecture/rootLayers.ts(1,53): error TS2591: Cannot find name 'node:fs'.
src/architecture/workspacePackages.ts(1,53): error TS2591: Cannot find name 'node:fs'.
ELIFECYCLE Command failed with exit code 2.
```

Command:

```bash
pnpm build
```

Root cause: `tsconfig.build.json` included every non-test file under `src`, so test-support modules were being declaration-emitted with `types: []`. The fix was not to add Node types to the public library; it was to exclude `src/architecture/**`, which is unexported test infrastructure.

Expected warnings remained:

- npm reports unknown pnpm environment keys during throwaway consumer installs;
- Vite reports large demo chunks;
- Chat demo reports QuickJS Node built-ins externalized for browser compatibility;
- Datalab reports one ineffective dynamic import.

None failed a command and all predate this ticket.

### What I learned

- A file under `src` can be outside the runtime bundle yet still enter declaration emission. Test-support directories need an explicit build exclusion.
- The normal CI command is sufficient integration; adding a second architecture command would create redundant paths.

### What was tricky to build

- Validation order matters: root PBUI must build before downstream package typechecks consume its `dist` declarations.
- Packed consumer smoke is slow but essential because it validates the installed surface that workspace linking hides.
- The full validation transcript includes ANSI control bytes from parallel Vite output; it remains readable and preserves exact command evidence.

### What warrants a second pair of eyes

- Verify that excluding all `src/architecture/**` is intentional. None of those modules is exported or used by runtime entries; they exist solely for Vitest.
- Review the one editor CSS-token exception and the initial package adjacency list as the highest-leverage architecture policy choices.

### What should be done in the future

- Continue to use root `pnpm test` as the package-DAG gate.
- Add package policy entries in the same commit as future workspace manifests.

### Code review instructions

- Review commits in order: `4c74b31`, `2087516`, `94e28b8`, `747eb24`, `d7e2299`.
- Inspect `reference/04-full-validation-output.txt` for the exact full sweep.
- Re-run:

  ```bash
  pnpm install --frozen-lockfile
  pnpm typecheck && pnpm test && pnpm build
  pnpm -r typecheck && pnpm -r test && pnpm -r build
  pnpm --filter @hyperslop-systems/pbui-editor consumer:smoke
  pnpm --filter @hyperslop-systems/workbench-core boundary
  ```

### Technical details

```text
Measured graph: 13 nodes, 48 runtime/peer declarations, 47 source edges
Architecture tests: 29
Root tests: 51 files / 860 tests
CI integration: existing root pnpm test command
Validation transcript: reference/04-full-validation-output.txt
```

## Step 8: Publish and close the ticket

I ran the required dry run and uploaded the final five-document implementation bundle to reMarkable. The ticket index, tasks, changelog, guide, and diary now agree that every planned phase and validation gate is complete.

The original design bundle remains separate, preserving the pre-implementation snapshot; the final bundle records what was actually built and the failures encountered.

### Prompt Context

**User prompt (verbatim):** (same as Step 3)

**Assistant interpretation:** Deliver the completed artifact, finish bookkeeping, and print the final phase boundary.

**Inferred user intent:** Leave both a reviewable repository history and a readable offline implementation record.

**Commit (code):** `d7e2299a027eeccae9c5fea58ce6e6a688029eec` — "Integrate PBUI architecture checks into release gates"

**Commit (documentation):** `2cbc7c30f748be3cb1c50ca07d24cb1b4d68e311` — "Document PBUI dependency DAG implementation"

### What I did

- Dry-ran the five-document reMarkable bundle.
- Uploaded `PBUI Dependency DAG Implementation.pdf` successfully.
- Marked the upload task and ticket complete.
- Ran final `docmgr doctor` validation.
- Prepared the `P5 DONE` work slip with the final documentation commit QR.

### Why

- The completed bundle should reflect implementation reality, not only the initial design.
- Separate names avoid overwriting or deleting annotations on the earlier design bundle.

### What worked

- Upload returned `OK: uploaded PBUI Dependency DAG Implementation.pdf -> /ai/2026/09/03/PBUI-DEPENDENCY-DAG-1`.
- All ticket tasks are checked and doctor is clean.

### What didn't work

- N/A during delivery.

### What I learned

- Keeping design and implementation bundles separate provides a useful record of changed assumptions, especially TypeScript 7 parser availability and editor’s CSS-token edge.

### What was tricky to build

- The final upload deliberately used a new document name rather than `--force`; forced replacement would destroy any annotations on the initial design PDF.

### What warrants a second pair of eyes

- N/A for delivery; architecture review points remain in Steps 5–7.

### What should be done in the future

- Proceed to the separate identity/revision semantics ticket after reviewing this package policy.

### Code review instructions

- Read the final implementation bundle or commits `4c74b31` through `d7e2299`.
- Confirm all checks in `tasks.md` are complete.

### Technical details

```text
Remote directory: /ai/2026/09/03/PBUI-DEPENDENCY-DAG-1
Initial bundle: PBUI Dependency DAG Design.pdf
Final bundle: PBUI Dependency DAG Implementation.pdf
Final code commit: d7e2299
```
