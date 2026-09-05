---
Title: Intern guide to enforcing PBUI dependency boundaries
Ticket: PBUI-DEPENDENCY-DAG-1
Status: complete
Topics:
    - pbui
    - architecture
    - refactoring
    - onboarding
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://.github/workflows/ci.yml
      Note: Existing CI path that will execute root architecture tests
    - Path: repo://packages/datalab-ui/test/layers.test.ts
      Note: Successful local layer-policy precedent
    - Path: repo://packages/pbui-editor/package.json
      Note: |-
        Contains the measured extraneous Workbench dependency
        Phase 1 removed the extraneous Workbench edge and retained the documented PBUI CSS-token contract
    - Path: repo://packages/pbui-plotscript/demo/package.json
      Note: |-
        Missing the measured direct protocol dependency
        Phase 1 added direct protocol ownership
    - Path: repo://packages/workbench-core/src/packageGraph.test.ts
      Note: Existing narrow headless package assertion
    - Path: repo://pnpm-workspace.yaml
      Note: Defines the 13 workspace package locations
    - Path: repo://src/chrome/LauncherShell.tsx
      Note: |-
        Broad component-barrel edge targeted by root-layer enforcement
        Phase 4 replaced the broad barrel with direct lower-layer imports
ExternalSources:
    - /tmp/pbui-improvements.md
Summary: Evidence-backed hard-cutover design for making PBUI's package and important source-layer dependency graph executable as tests, correcting current manifest drift, and keeping future package edges explicit.
LastUpdated: 2026-09-03T21:45:00-04:00
WhatFor: Give a new engineer the repository model, policy representation, scanner algorithms, implementation phases, and validation gates needed to enforce the PBUI dependency DAG without introducing a large lint framework.
WhenToUse: Read before adding or removing a PBUI package dependency, moving code across package boundaries, editing package exports, or implementing PBUI-DEPENDENCY-DAG-1.
---



# Intern guide to enforcing PBUI dependency boundaries

## 0. Read this first

This ticket was selected only after rebasing `/tmp/pbui-improvements.md` against current code. The assessment said to complete the presentation-relation migration before enforcing dependency boundaries. That relation migration is already complete: PBUI-KERNEL-1 deleted translator types and adapters, moved acceptance onto canonical relations, migrated Ecommerce, and projected the same compiled relation system into Workbench links.

`PBUI-RELATIONS-CUTOVER-1` records that no-op audit. This guide addresses the next real gap: the monorepo has a sensible package DAG, but most of that DAG is a convention rather than an executable invariant.

The requested posture is a hard cutover with tests rather than elaborate migration protection. Therefore this design intentionally proposes:

- one small data-driven package graph test;
- one focused root-layer test;
- direct correction of existing manifest drift;
- no compatibility aliases;
- no bespoke compiler, daemon, ESLint stack, or generated architecture framework;
- no attempt to forbid every import that could theoretically become undesirable.

The test should fail with a useful sentence, and the engineer should fix the architecture or deliberately edit one visible policy table.

---

## 1. Executive summary

PBUI is a pnpm workspace containing 13 package manifests:

- two foundations: `@hyperslop-systems/pbui` and `workbench-protocol`;
- one headless Workbench core;
- one React Workbench shell;
- product libraries for editor, Ecommerce, Datalab, Sandbox, PlotScript, and Chat;
- three private demonstration applications.

The current graph is acyclic. It also contains two concrete declaration defects discovered by the ticket inventory:

1. `pbui-editor` declares a production dependency on `pbui-workbench`, but no editor source, test, or script imports it;
2. `pbui-plotscript-demo/src/workbench.ts` imports `workbench-protocol/client`, but the demo does not declare `workbench-protocol`.

TypeScript does not reliably expose either problem in this workspace. pnpm links every workspace package into a shared installation, and TypeScript can resolve a transitive or workspace-visible package even when the importing package omitted it from `package.json`. Conversely, an unused dependency remains installable and publishable forever unless something compares declarations with source.

The solution is to express the allowed graph as ordinary TypeScript data and test four properties:

```text
1. every discovered workspace package is represented in policy
2. every internal production import has a direct declaration
3. every internal declared production edge is allowed and used
4. the runtime/peer graph is acyclic
```

A second test should protect the root PBUI component stack and its pure semantic entry points. Datalab’s detailed internal `layers.test.ts` remains authoritative for Datalab; the new root test must not duplicate it.

---

## 2. Problem statement

### 2.1 What a dependency declaration means

A package dependency is an architectural statement, not only an installation detail.

```json
{
  "dependencies": {
    "@hyperslop-systems/workbench-core": "workspace:^"
  }
}
```

This says all of the following:

- source in this package is allowed to name Workbench core;
- a packed artifact may need Workbench core at runtime;
- the package belongs above Workbench core in the repository graph;
- Workbench core must not depend back on this package if the graph is to remain acyclic;
- release order and consumer installation must account for the edge.

An inaccurate declaration therefore has real costs:

- **missing edge:** the package works only because a monorepo or hoisted install accidentally provides the dependency;
- **extraneous edge:** consumers install and reason about a dependency that source does not use;
- **wrong-kind edge:** a production import depends on a dev-only package or a host singleton is bundled instead of peered;
- **forbidden edge:** a foundational package learns about a higher product layer;
- **cycle:** module initialization and release ordering become path-dependent.

### 2.2 Why compilation is insufficient

The current CI runs workspace typechecking, tests, builds, Storybook, packed consumer smoke tests, and Datalab checks (`.github/workflows/ci.yml:62-73`). Those are valuable behavior checks. They do not answer “is this direct import declared by this package?” or “did this package add an architecturally forbidden edge?”

The current inventory proves the distinction:

```text
pbui-editor -> pbui-workbench
  manifest: dependencies
  source imports: 0

pbui-plotscript-demo -> workbench-protocol
  manifest: absent
  source imports: packages/pbui-plotscript/demo/src/workbench.ts:3
```

All workspace typechecks and all recursive package tests still pass.

### 2.3 Scope

This ticket covers:

- workspace package discovery;
- internal package dependency declarations;
- internal package source imports;
- dependency-kind rules relevant to runtime architecture;
- cycle detection;
- root PBUI component-layer direction;
- pure `link-kernel`/headless boundary assertions already represented by existing tests;
- CI integration through commands that already run.

### 2.4 Non-goals

This ticket does not:

- replace pnpm;
- impose a general import-style linter;
- ban external dependencies;
- analyze arbitrary JavaScript control flow;
- infer architecture from bundle chunks;
- redesign Datalab’s internal layers;
- merge all existing boundary tests into one framework;
- formalize revisions, operation IDs, or Sandbox capabilities;
- add compatibility behavior for invalid manifests.

---

## 3. Repository map for a new intern

### 3.1 Workspace discovery

`pnpm-workspace.yaml:3-6` includes:

```yaml
packages:
  - "."
  - "packages/*"
  - "packages/pbui-chat/demo"
  - "packages/pbui-plotscript/demo"
  - "packages/pbui-ecommerce/demo"
```

The broad `packages/*` pattern finds the nine library package directories. The explicit nested patterns add three demos. Together with the root package, that produces 13 manifests.

A package-graph test must discover the same set. If it silently misses nested packages, it gives a false green result. Completeness is therefore a first-class assertion.

### 3.2 Current package layers

The conceptual graph is:

```text
Layer 0: semantic foundations

  @hyperslop-systems/pbui       workbench-protocol
              │                         │
              └──────────┬──────────────┘
                         ▼
Layer 1:        workbench-core
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
Layer 2:  pbui-workbench editor   protocol clients
              │          │
      ┌───────┼──────────┼───────────────┐
      ▼       ▼          ▼               ▼
Layer 3: ecommerce    datalab          sandbox
                                      │
                             ┌────────┴────────┐
                             ▼                 ▼
Layer 4:                plotscript            chat

Layer 5: private demos compose product packages above them
```

This is a partial order, not a claim that every package on one row has identical responsibilities.

### 3.3 Package responsibilities

#### `@hyperslop-systems/pbui`

Owns reusable presentation semantics, components, chrome, and visualization primitives. Its `./link-kernel` export is deliberately React-free at the installed boundary.

#### `@hyperslop-systems/workbench-protocol`

Owns protobuf-generated workspace documents and atomic mutations. It is the lowest persistent workspace algebra.

#### `@hyperslop-systems/workbench-core`

Owns headless planning, validation, transaction installation, link collaboration, sources, persistence, synchronization, and rebalance semantics. Its narrow package graph is already tested by `packages/workbench-core/src/packageGraph.test.ts:13-38`.

#### `@hyperslop-systems/pbui-workbench`

Owns the React shell, surfaces, launchers, port rails, wires, and geometric measurement over Workbench core.

#### `@hyperslop-systems/pbui-editor`

Owns CodeMirror integration. Its source imports PBUI but no Workbench package. The package description still says “optional pbui-workbench application,” but no such application is currently exported. The manifest edge at `packages/pbui-editor/package.json:49` is extraneous.

#### Product packages

- **Ecommerce:** reference Workbench product and canonical presentation relations;
- **Datalab:** analytical product, now using core/shell for spatial semantics;
- **Sandbox:** interpreted UI programs and development tools;
- **PlotScript:** plot-specific Sandbox/editor composition;
- **Chat:** chat presentation, Sandbox widgets, Workbench integration, and protocol types.

#### Demo packages

The demos are private top-level applications. They may compose their product’s public dependencies directly, but they must still declare every direct package import. Being private is not permission to rely on hoisting.

---

## 4. Four graphs that must not be confused

The implementation handles four related graphs.

### 4.1 Declared package graph

```text
Gdeclared = dependencies ∪ peerDependencies ∪ devDependencies
```

Each edge has a kind. Kinds must be preserved in diagnostics.

### 4.2 Runtime architecture graph

```text
Gruntime = internal dependencies ∪ internal peerDependencies
```

This graph must be acyclic and must be a subset of the allowed architecture.

Dev dependencies do not participate in the production architecture cycle check. Test tooling is allowed to point broadly.

### 4.3 Source-import graph

```text
Gsource = internal bare imports found in production source
```

Examples:

```ts
import { createWorkbenchCore } from "@hyperslop-systems/workbench-core";
import type { Mutation } from "@hyperslop-systems/workbench-protocol";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
```

All three name a direct package dependency. A type-only import still requires the package’s declarations when a consumer typechecks the emitted API.

### 4.4 Root source-layer graph

This graph describes relative imports inside the root PBUI package:

```text
foundation → atoms → molecules → organisms
                         ↑          ↑
                    chrome utilities

presentation semantic modules → no component implementation
presentation runtime assembly  → semantic modules + ContextHelp/foundation
```

It is more granular than the package graph. Datalab already has its own equivalent.

---

## 5. Existing enforcement worth preserving

### 5.1 Datalab layer test

`packages/datalab-ui/test/layers.test.ts` is the strongest current example:

- `ALLOWED` is a visible layer table (`:22`);
- the test walks every production TypeScript source file;
- forbidden upward imports produce file-level diagnostics (`:236`);
- every new source directory must enter the graph (`:304`);
- every new component directory must enter the component graph (`:335`).

Do not centralize this policy into a generic file. The table is product architecture and belongs beside Datalab tests.

### 5.2 Workbench headless package test

`packages/workbench-core/src/packageGraph.test.ts` protects a narrower invariant:

- no React dependency in Workbench core;
- PBUI’s React peers are optional;
- `pbui/link-kernel` is exported;
- protocol has no React dependency.

Keep it. The new repository test should not weaken its precise headless assertions.

### 5.3 Packed consumer smoke tests

Packed tests prove what an installed consumer sees. They catch missing files, bad export maps, and accidental reliance on workspace source. They answer a different question than the package DAG and remain required.

### 5.4 CI

The root workflow already invokes `pnpm --workspace-root run test`. A root Vitest architecture test automatically runs in CI without adding a new workflow or command.

---

## 6. Evidence gathered for this ticket

### 6.1 Inventory method

Ticket script `scripts/01-inventory-package-graph.mjs`:

1. discovers package manifests;
2. reads internal dependencies by kind;
3. scans source, tests, and scripts for internal bare imports;
4. reports declared and imported edges.

It produced `reference/02-package-graph-inventory.json`:

```text
13 packages
48 internal declared-or-imported edges
1 extraneous production dependency
1 undeclared direct import
```

### 6.2 Defect A: extraneous editor edge

Observed:

```text
@hyperslop-systems/pbui-editor
  -> @hyperslop-systems/pbui-workbench [dependencies]
  source imports = 0
```

Evidence:

- declaration: `packages/pbui-editor/package.json:49`;
- source search under `packages/pbui-editor/src` finds only explanatory prose mentioning Workbench keyboard ownership;
- no exported editor application imports or constructs a Workbench shell.

Hard-cutover action: delete the dependency. Do not retain it “in case” an optional app returns. A future Workbench adapter can live in a separate package or add the edge when source exists.

### 6.3 Defect B: undeclared PlotScript demo edge

Observed:

```text
@hyperslop-systems/pbui-plotscript-demo
  -> @hyperslop-systems/workbench-protocol [undeclared]
```

Evidence:

`packages/pbui-plotscript/demo/src/workbench.ts:3` imports `applyMutations` from `workbench-protocol/client`, while the demo manifest omits the package.

Hard-cutover action: add `@hyperslop-systems/workbench-protocol: workspace:^` to the demo’s dependencies. Do not route the function through another package merely to hide the edge.

### 6.4 Root source observations

Ticket script `scripts/02-inventory-root-layers.mjs` records current cross-layer relative imports in `reference/03-root-layer-inventory.json`.

The main avoidable broad edges are:

```text
src/chrome/LauncherShell.tsx:23 -> ../components barrel
src/chrome/TileFrame.tsx:14     -> ../components barrel
```

The barrel exports organisms as well as foundation and atoms. Chrome actually needs only:

```text
LauncherShell → Dialog + Text + TextInput
TileFrame     → IconButton
```

Hard-cutover action: import those concrete lower-layer entries directly before enforcing the root layer table.

`FileBrowser` importing `chrome/shortcutRouting` is intentional: shortcut classification is a model-free interaction utility. The policy should permit that edge rather than duplicate `isEditableTarget`.

---

## 7. Target architecture

### 7.1 One policy, two scanners

Use one explicit package policy and two small scanners:

```text
src/architecture/packagePolicy.ts
  └── package nodes and allowed production edges

src/architecture/workspacePackages.ts
  ├── discover manifests
  ├── scan imports
  └── graph algorithms

src/architecture/packageGraph.ts
  └── deterministic architecture diagnostics

src/architecture/packageGraph.test.ts
src/architecture/workspacePackages.test.ts

src/architecture/rootLayers.ts
src/architecture/rootLayers.test.ts
```

The policy is reviewed data. The scanners are boring mechanics.

### 7.2 Proposed package policy API

```ts
type InternalPackageName =
  | "@hyperslop-systems/pbui"
  | "@hyperslop-systems/workbench-protocol"
  | "@hyperslop-systems/workbench-core"
  | "@hyperslop-systems/pbui-workbench"
  | "@hyperslop-systems/pbui-editor"
  | "@hyperslop-systems/pbui-ecommerce"
  | "@hyperslop-systems/datalab-ui"
  | "@hyperslop-systems/pbui-sandbox"
  | "@hyperslop-systems/pbui-plotscript"
  | "@hyperslop-systems/pbui-chat"
  | "@hyperslop-systems/pbui-ecommerce-demo"
  | "@hyperslop-systems/pbui-plotscript-demo"
  | "@hyperslop-systems/pbui-chat-demo";

type DependencyKind =
  | "dependencies"
  | "peerDependencies"
  | "devDependencies";

interface PackagePolicy {
  path: string;
  private?: boolean;
  allow: readonly InternalPackageName[];
}

const PACKAGES: Record<InternalPackageName, PackagePolicy> = {
  "@hyperslop-systems/pbui": {
    path: ".",
    allow: [],
  },
  "@hyperslop-systems/workbench-protocol": {
    path: "packages/workbench-protocol",
    allow: [],
  },
  "@hyperslop-systems/workbench-core": {
    path: "packages/workbench-core",
    allow: [
      "@hyperslop-systems/pbui",
      "@hyperslop-systems/workbench-protocol",
    ],
  },
  // ...remaining packages...
};
```

`allow` describes production architecture. Dev-only imports need direct declaration and valid package discovery but do not need to appear in the production allowlist unless they also occur in production source.

### 7.3 Why an allowlist rather than level numbers

Levels are useful diagrams but insufficient policy.

If `A` and `B` are both at level 3, a numeric test cannot say whether `A → B` is allowed. An explicit adjacency list can.

```text
numeric policy:     level(A) > level(B)     too coarse
adjacency policy:   B ∈ allowed(A)          exact and reviewable
```

### 7.4 Intended core edges

```text
pbui                 -> none internal
workbench-protocol   -> none internal
workbench-core       -> pbui, protocol
pbui-workbench       -> pbui, core, protocol
pbui-editor          -> pbui
pbui-ecommerce       -> pbui, shell, core, protocol
Datalab              -> pbui, shell, core, protocol
pbui-sandbox         -> pbui, editor, shell, core, protocol
pbui-plotscript      -> pbui, editor, sandbox, shell, core, protocol
pbui-chat            -> pbui, sandbox, shell, core, protocol
```

Demo allowlists are the direct imports their application uses. They sit at the top and do not become dependencies of libraries.

---

## 8. Import scanning

### 8.1 Use a small tested lexical scanner

The installed TypeScript 7.0.2 native package does not expose the historical JavaScript compiler API: `preProcessFile`, `createSourceFile`, and `ScriptKind` are unavailable. The first implementation attempted that API and the unit test failed immediately.

Version one therefore uses three constrained lexical patterns for the module forms present in this ESM repository:

```text
static import/export, including side-effect imports
literal dynamic import("...")
literal require("...")
```

The scanner records source positions and restores source order. Its tests cover type imports, re-exports, star exports, side-effect imports, dynamic imports, require, and ignored computed imports. This is intentionally narrower than a language parser and mirrors the proven Datalab boundary-test approach without adding a parser dependency.

### 8.2 Source ownership

For each workspace package, scan:

- `src/**/*.{ts,tsx,mts,cts}`;
- `test/**/*.{ts,tsx,mts,cts}`;
- package-local `scripts/**/*.{ts,mts,mjs}`;
- Vite/Vitest/Storybook configuration when present.

Do not attribute a nested demo to its parent library. Select the deepest package root containing the file.

Pseudo-code:

```ts
function ownerOf(file, packages) {
  return packages
    .filter(pkg => isInside(file, pkg.path))
    .sort(byLongestPathFirst)[0];
}
```

### 8.3 Package name normalization

Subpaths belong to their package:

```text
@hyperslop-systems/workbench-protocol/client
→ @hyperslop-systems/workbench-protocol

@hyperslop-systems/pbui/link-kernel
→ @hyperslop-systems/pbui
```

Pseudo-code:

```ts
function packageName(specifier: string): string | null {
  if (!specifier.startsWith("@")) return specifier.split("/")[0];
  const [scope, name] = specifier.split("/");
  return scope && name ? `${scope}/${name}` : null;
}
```

### 8.4 Production versus support files

Classify files:

```ts
type ImportUse = "production" | "test" | "story" | "script" | "config";
```

Rules:

- production imports require `dependencies` or `peerDependencies`;
- emitted public type imports also require a production-visible declaration;
- tests/stories/scripts/config may use `devDependencies`;
- every direct import must be declared somewhere appropriate;
- only production/peer edges participate in the architecture allowlist and cycle check.

Do not attempt perfect TypeScript emit analysis. Treat imports under production `src` as production-visible, including `import type`. False cleverness here is worse than one explicit dependency.

---

## 9. Package graph tests

### 9.1 Completeness

```ts
it("represents every workspace package in policy", () => {
  expect(discoveredNames.sort()).toEqual(policyNames.sort());
});
```

This prevents a new package from bypassing all checks.

### 9.2 Direct declaration

```ts
it("declares every direct internal import", () => {
  const violations = imports
    .filter(edge => !declarationAllows(edge));

  expect(violations).toEqual([]);
});
```

Diagnostic:

```text
packages/pbui-plotscript/demo/src/workbench.ts imports
@hyperslop-systems/workbench-protocol/client, but
@hyperslop-systems/pbui-plotscript-demo does not declare
@hyperslop-systems/workbench-protocol in dependencies or peerDependencies
```

### 9.3 Allowed production edges

```ts
it("keeps production edges inside the architecture", () => {
  for (const edge of runtimeEdges) {
    if (!policy[edge.from].allow.includes(edge.to)) report(edge);
  }
});
```

### 9.4 No extraneous internal production edges

```ts
it("has no unused internal runtime declarations", () => {
  const unused = runtimeDeclarations.filter(edge => !sourceUses(edge));
  expect(unused).toEqual([]);
});
```

This test removes `pbui-editor → pbui-workbench`.

Allow a narrow escape hatch only when package metadata has a real non-source reason:

```ts
interface AllowedUnusedEdge {
  from: InternalPackageName;
  to: InternalPackageName;
  because: string;
}
```

The implemented policy has exactly one reasoned non-code exception: `pbui-editor → pbui`. Editor JavaScript does not import PBUI, but `src/theme.ts` reads PBUI-defined CSS variables and the packed consumer imports `@hyperslop-systems/pbui/styles.css`. The removed `pbui-editor → pbui-workbench` edge is not exempted.

### 9.5 Cycle detection

A depth-first search is sufficient for 13 nodes:

```ts
function findCycle(graph) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(node) {
    if (visiting.has(node)) {
      return stack.slice(stack.indexOf(node)).concat(node);
    }
    if (visited.has(node)) return null;

    visiting.add(node);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }
}
```

Failure:

```text
package dependency cycle:
pbui-workbench → pbui-sandbox → pbui-workbench
```

### 9.6 Exported subpaths

A direct internal subpath import must resolve through the target package’s `exports` map when that map exists.

```ts
"@hyperslop-systems/pbui/link-kernel"
→ target exports["./link-kernel"] must exist
```

This catches source reaching into another package’s private filesystem.

Keep this check lexical. Do not reproduce Node’s full conditional-export resolver.

---

## 10. Root PBUI source boundaries

### 10.1 Why add a second test

The package graph cannot see a component atom importing an organism because both are inside `@hyperslop-systems/pbui`. Datalab already protects its internal graph; the root package should protect only its important stable boundaries.

### 10.2 Component stack

Proposed permissions:

```ts
const ROOT_LAYERS = {
  "components/foundation": [],
  "components/layout": ["components/foundation"],
  "components/atoms": [
    "components/foundation",
    "components/layout",
  ],
  "components/molecules": [
    "components/foundation",
    "components/layout",
    "components/atoms",
    "components/format",
  ],
  chrome: [
    "components/foundation",
    "components/atoms",
    "components/Dialog",
    "focus",
    "surfaces",
  ],
  visualization: ["components/format"],
  "components/organisms": [
    "components/foundation",
    "components/layout",
    "components/atoms",
    "components/molecules",
    "components/format",
    "chrome",
    "visualization",
  ],
} as const;
```

`ContextHelp`, `Dialog`, and integration barrels are named exceptions because they are cross-cutting assemblies, not numbered component layers.

### 10.3 Direct imports from chrome

Before enabling the policy, replace broad imports:

```ts
// before
import { Dialog, Text, TextInput } from "../components";

// after
import { Dialog } from "../components/Dialog";
import { Text } from "../components/foundation";
import { TextInput } from "../components/atoms/TextInput";
```

And:

```ts
import { IconButton } from "../components/atoms/IconButton";
```

This makes the source edge match the actual dependency rather than the entire components barrel.

### 10.4 Semantic purity fences

Retain and centralize simple assertions:

```text
src/link-kernel.ts closure imports no React or DOM runtime
workbench-core source imports only pbui/link-kernel, never pbui root
workbench-protocol imports no React
```

The packed boundary test remains the final installed-artifact proof.

### 10.5 What not to encode

Do not immediately encode every `presentation/*` subdirectory as a strict total order. Actions and context share types, and `createPbui.tsx` is intentionally a React assembly over semantic modules and ContextHelp. A rushed table would either bless confusing exceptions or force a refactor unrelated to current defects.

The first version should enforce:

- component direction;
- chrome’s direct low-level imports;
- pure link-kernel closure;
- package boundaries.

Add finer presentation rules later when an actual undesirable edge appears.

---

## 11. Hard-cutover implementation plan

### Phase 0: Commit the inventory as evidence

Files:

- `scripts/01-inventory-package-graph.mjs`;
- `reference/02-package-graph-inventory.json`;
- `scripts/02-inventory-root-layers.mjs`;
- `reference/03-root-layer-inventory.json`.

Actions:

1. Re-run both scripts.
2. Confirm 13 package manifests.
3. Confirm the editor’s extraneous edge.
4. Confirm the PlotScript demo’s undeclared edge.
5. Freeze the before-state output in the diary.

Exit gate: the implementation starts from reproducible evidence rather than a hand-maintained diagram.

### Phase 1: Correct manifest drift

Actions:

1. Delete `@hyperslop-systems/pbui-workbench` from `packages/pbui-editor/package.json`.
2. Add `@hyperslop-systems/workbench-protocol: workspace:^` to `packages/pbui-plotscript/demo/package.json`.
3. Run `pnpm install` so `pnpm-lock.yaml` records the direct importer.
4. Typecheck, test, build, and pack the editor.
5. Typecheck and build the PlotScript demo.

No deprecation or alias is needed.

Exit gate: inventory reports neither undeclared nor extraneous internal production edges.

### Phase 2: Add the package policy and scanner

Create:

```text
src/architecture/packagePolicy.ts
src/architecture/workspacePackages.ts
src/architecture/workspacePackages.test.ts
```

Implement:

- workspace manifest discovery;
- deepest-root source ownership;
- tested lexical import extraction;
- package/subpath normalization;
- file-use classification;
- manifest edge extraction;
- deterministic diagnostics.

Exit gate: 14 helper tests cover import forms, nested ownership, use classification, declaration kinds, cycles, and exports.

### Phase 3: Add graph laws

Create `src/architecture/packageGraph.ts` and `packageGraph.test.ts`, then add tests for:

- policy completeness;
- direct declarations;
- allowed runtime edges;
- unused internal runtime declarations;
- runtime/peer acyclicity;
- exported subpath existence.

Test the scanner itself with temporary miniature package graphs rather than relying only on the real repository.

Example fixture:

```text
A -> B -> C -> A        expected cycle A → B → C → A
A imports B, undeclared expected direct-dependency diagnostic
A declares B, no import expected extraneous-edge diagnostic
```

Exit gate: diagnostics include package, source file, specifier, edge kind, and remediation.

### Phase 4: Enforce focused root layers

Actions:

1. Replace chrome’s component-barrel imports with concrete lower-layer imports.
2. Add `rootLayers.test.ts` with the component/chrome table.
3. Assert every governed directory exists and has files.
4. Assert every first-level numbered component directory is either governed or explicitly cross-cutting.
5. Keep Datalab’s existing test unchanged.

Exit gate: a foundation-to-organism import and a chrome-to-organism import fail in unit fixtures.

### Phase 5: CI and documentation

No workflow step should be added if root `pnpm test` already discovers the tests. Verify that it does.

Update:

- root README architecture section;
- package authoring guidance;
- comments in `pbui-editor/package.json` or README if its old “optional Workbench app” description is stale;
- ticket diary and changelog.

Exit gate: a clean checkout runs the boundary checks through the normal CI command.

### Phase 6: Full validation

Run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm consumer:smoke
pnpm -r typecheck
pnpm -r test
pnpm -r build
pnpm --filter @hyperslop-systems/pbui-editor pack:check
pnpm --filter @hyperslop-systems/workbench-core boundary
```

Then run `docmgr doctor` and upload the implementation bundle.

---

## 12. Testing strategy

### 12.1 Unit tests for graph mechanics

Test pure functions:

- `packageName(specifier)`;
- `ownerOf(file)`;
- `classifyFile(file)`;
- `declaredEdges(manifest)`;
- `findCycle(graph)`;
- `exportAllows(specifier, manifest)`.

Use table-driven tests. These are small deterministic algorithms.

### 12.2 Mutation tests against the real repository model

In memory, mutate discovered policy/manifests:

```ts
it("catches an undeclared direct import", ...)
it("catches an unused internal dependency", ...)
it("catches a forbidden upward edge", ...)
it("prints the complete cycle", ...)
it("catches a package absent from policy", ...)
it("accepts exported pbui/link-kernel", ...)
it("rejects a private source subpath", ...)
```

### 12.3 Root layer tests

At minimum:

- foundation cannot import atoms;
- atoms cannot import molecules;
- molecules cannot import organisms;
- chrome cannot import the components barrel or organisms;
- organisms may import chrome shortcut utilities;
- stories are exempt from production direction but still require declared packages.

### 12.4 Existing behavior suites

Boundary work must not replace behavior tests. The baseline measured during this design is:

```text
root PBUI:          48 test files / 831 tests
workbench protocol:  3 test files /  40 tests
workbench core:     31 test files / 243 tests
workbench shell:    23 test files / 116 tests
Datalab:            55 test files / 602 tests
PBUI editor:         2 test files /  12 tests
Ecommerce:           7 test files /  35 tests
Sandbox:            18 test files / 224 tests
PlotScript:          5 test files /  32 tests
Chat:               25 test files / 241 tests
Chat demo:           3 test files /  13 tests
```

All recursive typechecks and tests passed. The two manifest defects are therefore specifically architecture defects, not current behavior failures.

### 12.5 Packed validation

Removing the editor dependency must be tested from its tarball. Workspace tests can still hide packaging mistakes. The editor’s `consumer:smoke` and `pack:check` are the appropriate proof.

---

## 13. Decision records

### Decision D1: Hard cutover manifest corrections

- **Context:** One internal dependency is unused and one direct import is undeclared.
- **Options considered:** Keep exceptions; warn only; directly correct manifests and make tests blocking.
- **Decision:** Correct both manifests and enable blocking tests in the same change.
- **Rationale:** The repository is alpha and every package is controlled together. Compatibility provides no value.
- **Consequences:** Lockfile and package declarations change immediately; CI prevents recurrence.
- **Status:** accepted.

### Decision D2: Tests over a new lint framework

- **Context:** Datalab already proves a small Vitest graph check is effective; the repository has no ESLint architecture stack.
- **Options considered:** ESLint import plugins; Nx dependency constraints; custom CLI; Vitest tests.
- **Decision:** Use data-driven Vitest tests and a small tested lexical import scanner.
- **Rationale:** Tests run in existing CI, report domain-specific failures, and add no dependency/toolchain layer.
- **Consequences:** The scanner remains repository code and must have its own unit tests.
- **Status:** accepted.

### Decision D3: Explicit adjacency, not inferred levels

- **Context:** Numeric package levels cannot represent every allowed sibling/product edge.
- **Options considered:** Level numbers; automatic inference from current graph; explicit adjacency list.
- **Decision:** Check an explicit allowlist.
- **Rationale:** Architecture changes become deliberate reviewable policy edits rather than silently accepted current state.
- **Consequences:** Adding a package requires one policy entry.
- **Status:** accepted.

### Decision D4: Production source must have direct dependencies

- **Context:** pnpm workspace visibility can hide transitive imports.
- **Options considered:** Permit transitive workspace imports; require direct declaration.
- **Decision:** Every internal bare import requires a direct declaration appropriate to its file use.
- **Rationale:** Packed consumers and independent release order require direct ownership.
- **Consequences:** The PlotScript demo adds protocol explicitly.
- **Status:** accepted.

### Decision D5: Remove unused internal runtime declarations

- **Context:** Extraneous edges enlarge the architectural graph and installation surface.
- **Options considered:** Ignore unused declarations; report warnings; fail with narrow documented exemptions.
- **Decision:** Fail on unused internal `dependencies`/`peerDependencies`; support narrow reasoned non-code contracts.
- **Rationale:** Internal edges are few and intentional. The removed editor → Workbench edge had no source justification; editor → PBUI has a concrete CSS-token contract exercised by packed smoke.
- **Consequences:** Future optional integrations must add actual source or live in an adapter package. Non-code runtime contracts must be visible in policy with a reason.
- **Status:** accepted.

### Decision D6: Keep product-internal policies local

- **Context:** Datalab has a rich internal graph that evolves with product architecture.
- **Options considered:** One global policy for every source directory; package-level global policy plus local internal tests.
- **Decision:** Global tests own package boundaries and root PBUI’s stable layers; Datalab retains its local policy.
- **Rationale:** This avoids a central architecture file that must understand every product implementation detail.
- **Consequences:** Multiple boundary tests exist, each with one clear owner.
- **Status:** accepted.

### Decision D7: First version is deliberately bounded

- **Context:** It is possible to turn dependency analysis into a compiler project.
- **Options considered:** Full Node resolution, emitted-type analysis, bundle graph parsing, lexical package checks.
- **Decision:** Lexically scan the repository's supported module forms, normalize package names/subpaths, inspect manifests/exports, and stop there.
- **Rationale:** The known defects and intended invariant do not require more machinery; tests provide more value than speculative protection.
- **Consequences:** Exotic computed dynamic imports are outside version one and should be caught by build/consumer smoke.
- **Status:** accepted.

---

## 14. Risks and mitigations

### Risk: false green from missing packages

Mitigation: compare discovered package names with policy names and assert the count is nonzero and currently 13.

### Risk: nested demos attributed to parent packages

Mitigation: deepest matching package root owns the source file.

### Risk: type-only imports misclassified

Mitigation: production `src` type imports still require production-visible dependency declarations. Avoid emit simulation.

### Risk: an unused dependency is used only by generated output

Mitigation: scan scripts/config and inspect package exports. If a real non-source edge exists, add a reasoned exemption with a test. Do not pre-populate exemptions.

### Risk: root-layer table ossifies ordinary refactoring

Mitigation: govern only foundation/atoms/molecules/organisms, chrome, visualization, and pure semantic boundaries. Do not encode every directory.

### Risk: tests and architecture policy drift apart

Mitigation: package completeness and layer-directory completeness fail on unregistered additions.

### Risk: cyclic peer dependencies

Mitigation: include internal peer edges in cycle detection because they are still consumer-level architecture requirements.

### Risk: source subpath exists locally but is not published

Mitigation: compare bare subpath imports with the target manifest’s `exports` keys and retain packed consumer smoke.

---

## 15. Alternatives rejected

### Keep relying on pnpm and TypeScript

Rejected because the current undeclared demo import passes typecheck and the unused editor dependency is invisible.

### Adopt Nx or another workspace orchestrator

Rejected. PBUI does not need a new build graph platform to test 13 packages and 48 edges.

### Add ESLint import rules

Rejected for version one. Datalab’s Vitest precedent is already understood and gives better architecture-specific messages.

### Infer policy from the current graph

Rejected. That would bless both current defects and every future accidental edge.

### Test only cycles

Rejected. An acyclic graph can still contain forbidden or undeclared edges.

### Enforce every internal relative import immediately

Rejected. It would overfit integration code and distract from the stable component and package boundaries.

---

## 16. Intern implementation walkthrough

If you are implementing this ticket, follow this sequence exactly.

1. Read all 13 `package.json` files and draw the graph once by hand.
2. Run the two ticket inventory scripts and compare their output to this guide.
3. Correct the two manifest defects and regenerate the lockfile.
4. Run the editor and PlotScript demo validation before writing graph tests.
5. Create the architecture test helpers with unit fixtures first.
6. Add policy completeness and direct-declaration tests.
7. Add allowed-edge, unused-edge, cycle, and export-subpath tests.
8. Reintroduce each original defect temporarily and confirm the expected failure sentence.
9. Replace chrome barrel imports and add the root-layer test.
10. Run root tests before recursive tests; root is not one of pnpm’s 12 recursive child projects.
11. Build before downstream typechecking when a root PBUI declaration changes, because workspace packages resolve PBUI through `dist`.
12. Run packed editor and Workbench boundary checks.
13. Update the diary with exact failures and commands.
14. Run `docmgr doctor` and upload the final implementation bundle.

Review order:

```text
packagePolicy.ts
  ↓
workspacePackages.ts pure helpers
  ↓
packageGraph.ts diagnostics + packageGraph.test.ts assertions
  ↓
rootLayers.test.ts
  ↓
manifest and direct-import changes
```

---

## 17. Completion checklist

### Package graph

- [x] 13 discovered packages exactly match policy.
- [x] Every internal production import has a direct production-visible declaration.
- [x] Every internal test/story/tool import has a direct declaration.
- [x] Every production edge is explicitly allowed.
- [x] No unexplained unused internal runtime declaration remains.
- [x] Runtime plus peer graph is acyclic.
- [x] Internal subpath imports use exported entries.

### Root layers

- [x] Chrome imports concrete lower-level components, not the all-components barrel.
- [x] Foundation does not import higher component layers.
- [x] Atoms do not import molecules or organisms.
- [x] Molecules do not import organisms.
- [x] Link-kernel/headless tests remain green.
- [x] Datalab’s independent layer test remains green.

### Validation

- [x] Root baseline remains green: 51 files / 860 tests, including 29 new architecture tests.
- [x] Recursive package tests remain green.
- [x] Recursive typecheck remains green.
- [x] Root and package builds pass.
- [x] Editor packed consumer smoke passes without Workbench.
- [x] Workbench packed boundary passes.
- [x] Clean lockfile installation passes.
- [x] `docmgr doctor` passes.

---

## 18. File reference map

### Workspace and CI

- `pnpm-workspace.yaml:1-6` — workspace package discovery patterns.
- `.github/workflows/ci.yml:62-73` — existing root and Datalab validation commands.
- `pnpm-lock.yaml` — concrete direct dependency importer graph.

### Existing architecture tests

- `packages/datalab-ui/test/layers.test.ts:22-350` — local layer policy, walker, import checks, and completeness guards.
- `packages/workbench-core/src/packageGraph.test.ts:13-38` — headless package dependency assertions.
- `packages/workbench-core/scripts/consumer-boundary.mjs` — packed no-React boundary validation.

### Corrected baseline defects

- `packages/pbui-editor/package.json` — removed unused `pbui-workbench` dependency.
- `packages/pbui-editor/scripts/consumer-smoke.mjs` — removed stale Workbench/protocol fixture coupling.
- `packages/pbui-plotscript/demo/src/workbench.ts:3` — direct protocol/client import.
- `packages/pbui-plotscript/demo/package.json` — now owns that direct protocol declaration.

### Root-layer evidence

- `src/chrome/LauncherShell.tsx:23` — broad components barrel import.
- `src/chrome/TileFrame.tsx:14` — broad components barrel import.
- `src/components/organisms/FileBrowser/FileBrowser.tsx:6` — intentional organism-to-chrome shortcut utility edge.
- `src/link-kernel.ts` — pure published semantic entry.
- `src/presentation/createPbui.tsx` — React integration assembly, not part of the pure link-kernel closure.

### Evidence generated by this ticket

- `scripts/01-inventory-package-graph.mjs` — package/import inventory.
- `reference/02-package-graph-inventory.json` — 13-package, 48-edge result.
- `scripts/02-inventory-root-layers.mjs` — root relative-import inventory.
- `reference/03-root-layer-inventory.json` — observed root cross-layer edges.

### Prior relation cutover evidence

- `packages/pbui-ecommerce/src/presentation/relations.ts:16` — canonical relation declarations.
- `packages/pbui-ecommerce/src/presentation/runtime.tsx:34` — relations compiled into the presentation.
- `packages/pbui-ecommerce/src/createShop.ts:48` — one `presentation.linkDeps(...)` projection for links.
- `ttmp/2026/09/02/PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-runtime-that-binds-them/reference/01-investigation-diary.md` — completed hard-cutover record.

---

## 19. Final recommendation

Implement the package graph test before doing the revision/operation-identity work. The dependency test is small, immediately catches two real defects, and establishes the repository boundaries within which later identity, conformance, and Sandbox work will live.

Do not expand this into a universal architecture compiler. Correct the manifests, encode the intended 13-node adjacency list, test it, add the focused root component boundaries, and let ordinary behavior/build/pack tests cover the rest.
