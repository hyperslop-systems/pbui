---
Title: Porting datalab, agentlogic, and turboproof to the pbui Actions Kernel
Ticket: PBUI-ACTIONS-PORT
Status: active
Topics:
    - pbui
    - actions
    - frontend
    - architecture
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: /home/manuel/code/wesen/hyperslop-systems/agentlogic/ui/src/store/workbenchShell.tsx
      Note: |-
        agentlogic — uses createWorkbench (indirect pbui), no custom descriptors; dep pbui 0.6.0
        agentlogic — createWorkbench (indirect pbui), no custom descriptors; dep pbui 0.6.0
    - Path: /home/manuel/code/wesen/hyperslop-systems/turboproof/ui/src/pbui/descriptors/shared.ts
      Note: |-
        turboproof — the legacy actions() helper manufacturing unstable `${ptype}:${index}:${label}` ids
        turboproof — legacy actions() helper with unstable IDs; the defect the kernel fixes
    - Path: /home/manuel/code/wesen/hyperslop-systems/turboproof/ui/src/pbui/runtime.tsx
      Note: turboproof — legacy createPbui({registry, defaultEnvironment}) on pbui 0.6.0; the call that no longer compiles
    - Path: /home/manuel/workspaces/2026-08-24/use-optkit/pbui/packages/datalab-ui/src/pbui/actions.ts
      Note: datalab-ui — the completed reference migration (rules/families, snapshotFor, translators)
    - Path: /home/manuel/workspaces/2026-08-24/use-optkit/pbui/packages/datalab-ui/src/pbui/runtime.tsx
      Note: datalab-ui createPbui call — the target createPbui shape
    - Path: /home/manuel/workspaces/2026-08-24/use-optkit/pbui/src/presentation/actions/index.ts
      Note: |-
        The new actions kernel public API — the target contract every consumer must meet
        The new actions kernel public API — the target contract
    - Path: /home/manuel/workspaces/2026-08-24/use-optkit/pbui/src/presentation/createPbui.tsx
      Note: |-
        createPbui now REQUIRES actions + snapshotFor + onPerform(verb, envelope); the legacy is deleted
        createPbui now REQUIRES actions+snapshotFor+onPerform(verb,envelope); legacy deleted
    - Path: /home/manuel/workspaces/2026-08-24/use-optkit/pbui/ttmp/2026/08/26/PBUI-ACTIONS-2--type-directed-action-selection-engine-in-the-pbui-package/design-doc/01-intern-guide-implementing-the-action-selection-kernel-in-current-pbui.md
      Note: The migration method — the golden-fence, PR ladder, and Amendment D (stable IDs in PR 0)
    - Path: /home/manuel/workspaces/2026-08-24/use-optkit/pbui/ttmp/2026/08/26/PBUI-ACTIONS-3--post-legacy-simplification-and-kernel-unification-backlog/analysis/01-the-backlog-what-no-legacy-affords-and-what-pulls-each-item.md
      Note: Confirms Phase A (delete legacy) shipped as 0.8.0 and Phase B (perform envelope) as 0.9.0; names agentlogic/turboproof as consumers to adapt
ExternalSources: []
Summary: An evidence-grounded analysis of what work remains to port datalab, agentlogic, and turboproof onto pbui's type-directed action-selection kernel — finding the three in three different states (datalab-ui already migrated and the reference; agentlogic an indirect, descriptor-free dependency bump; turboproof a full legacy-to-kernel migration of 13 actions() callbacks across 8 descriptors) — with per-consumer work breakdowns, sequencing, risks, and the golden-fence method.
LastUpdated: 0001-01-01T00:00:00Z
WhatFor: The implementation contract for the remaining consumer ports onto pbui 0.9.0; tells an intern exactly which files change in which repo and why.
WhenToUse: Before starting any of the three ports; before bumping agentlogic or turboproof's pbui dependency; as the acceptance vocabulary for the port tickets.
---





# Porting datalab, agentlogic, and turboproof to the pbui Actions Kernel

## 1. The question and the one-sentence answer

The pbui presentation layer gained a new action-selection system in the
PBUI-ACTIONS-1/2/3 ticket series: a pure, type-directed kernel that replaces
the old per-descriptor `actions(value, env)` callback with registry-declared
rules, families, a nominal type graph, a four-state availability model, fresh
revalidation at perform, and a vocabulary export. The legacy callback, the
ordered `conversions` array, and `registry.actionsFor` were **deleted** (Phase
A, shipped as pbui 0.8.0); the perform path gained a provenance envelope
(Phase B, shipped as pbui 0.9.0). pbui is now at **0.9.0**, and `createPbui`
**requires** `actions`, `snapshotFor`, and `onPerform(verb, envelope)`.

The question: what work is needed to port datalab, agentlogic, and turboproof
to this new system? The answer, after studying the code, is that the three are
in **three different states** and need three different amounts of work:

- **datalab-ui is already ported.** It is the reference migration done in
  PBUI-ACTIONS-2 PR 3/PR 7. Its `createPbui` passes `actions`, `snapshotFor`,
  and `translators`; its `actions.ts` is the kernel; its descriptors are
  representation-only. **No porting work remains.** It is the template for the
  others.
- **agentlogic is an indirect, descriptor-free consumer.** It does not call
  `createPbui` and has **no custom presentation descriptors or `actions()`
  callbacks**; it uses `@hyperslop-systems/pbui-workbench`'s `createWorkbench`,
  which owns the `createPbui` call. Its pbui surface is the workbench shell's
  built-in `<tile>` presentation. Porting it to the new actions system is
  almost entirely a **transitive dependency bump** (pbui 0.6.0 → 0.9.0,
  pbui-workbench 0.2.0 → 0.3.0); the kernel arrives through the shell. The
  agentlogic-specific work is small and is really the PBUI-WORKBENCH-2 shell
  migration, not an actions migration.
- **turboproof is a full legacy consumer.** It calls `createPbui` directly
  with the deleted 0.6.0 signature (`{registry, defaultEnvironment}` — no
  `actions`, no `snapshotFor`, no `onPerform`), and **13 `actions()` callbacks
  across 8 descriptors** manufacture unstable IDs through a `shared.ts`
  helper. This is exactly the shape PBUI-ACTIONS-2 PR 3 migrated datalab-ui
  out of. turboproof needs the **complete kernel migration**: pin to 0.9.0,
  convert every descriptor callback to rules/families with stable IDs, supply
  `actions`/`snapshotFor`/`onPerform(verb, envelope)`, and delete the legacy
  `actions()` helper.

A note on names: the top-level `datalab/` in the workspace is a Go backend
(`module github.com/hyperslop-systems/datalab`) with no pbui surface. The
consumer with a pbui surface is `pbui/packages/datalab-ui`, referred to here
as **datalab-ui**. agentlogic and turboproof are out-of-repo at
`~/code/wesen/hyperslop-systems/{agentlogic,turboproof}/ui`.

## 2. The target: the new actions kernel (pbui 0.9.0)

This section is the contract every consumer must meet. It is condensed from
the PBUI-ACTIONS-2 intern guide; read that guide for the full semantics.

### 2.1 What changed and what was deleted

The old model: a `PresentationDescriptor` owned both representation
(`label`/`describe`/`tone`) **and** a `actions(value, environment)` callback
returning `PresentationAction[]`; `ObjectMenu` called
`registry.actionsFor(reference, environment)` — one exact-type lookup, no
composition, no inheritance, no explanation, stale verbs at click time.
Ad-hoc workarounds (`extra()` seams, registry wrappers, manufactured IDs)
each reinstated array-order semantics and unstable identity.

The new model: representation descriptors are **representation-only**
(`{label, describe?, tone?}`). Actions are declared as **rules** and
**families** in an `ActionRegistry`, resolved by a pure pipeline from
`{reference, query, snapshot}` to `ResolvedAction[]` + trace. The
`conversions` option is replaced by typed **translators**. The deleted
surface (Phase A): `descriptor.actions`, `registry.actionsFor`, the
`conversions` option, the automatic legacy engine and `legacyDescriptorFamily`.
The added requirement: `actions` + `snapshotFor` are required in `createPbui`.
The perform path (Phase B): `onPerform(verb, envelope)` where the envelope
carries `{action, candidateId, invocation, subject, actor?}` — provenance
built from the **fresh** resolved action.

### 2.2 The `createPbui` contract (current)

```ts
// pbui/src/presentation/createPbui.tsx
export interface CreatePbuiOptions<Values, Environment, Verb, ProductFacts> {
  registry: PresentationDescriptorRegistry<Values, Environment>;  // representation only
  actions: ActionRegistry<Values, ProductFacts, Verb>;            // REQUIRED (was optional, then legacy deleted)
  snapshotFor(                                                    // REQUIRED
    query: ActionQuery<Values>, environment: Environment
  ): SelectionSnapshot<Values, ProductFacts>;
  onPerform: (verb: Verb, envelope: PerformEnvelope<Values>) => void | Promise<void>;  // REQUIRED, 2-arg (Phase B)
  actor?: string;                                                  // attribution, copied into each envelope
  translators?: ...;                                               // typed, replaces conversions
  renderMenuHeader?: ...;
  defaultEnvironment: Environment;
}
```

A consumer that passes the old shape (`{registry, defaultEnvironment}`) no
longer typechecks — `actions`, `snapshotFor`, and `onPerform` are required,
and `onPerform` now takes two arguments.

### 2.3 The kernel public API (`pbui/src/presentation/actions/index.ts`)

```ts
// identities & types
type RuntimeTypeId, RuleId, FamilyId, CandidateId, ActionId, ScopeId, ModeId, PredicateId
type ActionContribution, ActionFamily, ActionQuery, ActionMetadata
type ExactActionRule, InheritedActionRule, ResolvedAction, ResolutionResult
type SelectionSnapshot, SelectionAmbiguity, ResolutionTraceEntry, PerformEnvelope, PerformResult

// construction
createPresentationTypeGraph(defs)        // nominal type graph: validation + BFS distances
createActionRegistry({ graph, scopes, contributions })  // indexes + diagnostics()
defineActions                             // the rule/family declaration DSL
actions.exact(type, …) / actions.inherited(typeNode, …)  // payload-coercion-aware factories

// availability (four states)
available() | unavailable(because, code?) | inapplicable(because) | hidden(because)

// conditions (minimal algebra)
all(…) | mode(id) | capability(id) | predicate(id, fn) | evaluateCondition(…)

// resolution & perform
resolve(query, snapshot) → ResolutionResult          // pure, 16-step pipeline
evaluateFresh(stale, snapshotFor) → FreshDecision    // revalidation at click time
vocabularyOf(registry) → ActionVocabulary            // agent-facing export (Phase B)
```

The five identities that matter for a port (source guide §7): a **runtime
type ID** (a node in the nominal graph), a **rule ID** (one declaration by
one package, globally unique, appears in traces), a **family ID + instance
key → candidate ID** (dynamic contributions; array index and label are
**forbidden** as identity), an **action ID** (the conceptual operation; many
rules can implement one, which is what makes overrides expressible), and menu
`group`/`order` as presentation metadata that must never change which rule wins.

## 3. Consumer state 1 — datalab-ui: DONE (the reference)

datalab-ui (`pbui/packages/datalab-ui`, depends on `workspace:^` pbui =
0.9.0) is the completed migration. It is the template for turboproof.

### 3.1 Evidence it is ported

- `runtime.tsx:56` — `createPbui` is called with the new shape:

```ts
const datadropPbui = createPbui<PresentationValues, PbuiEnvironment, Verb, DatalabFacts>({
  registry: datadropRegistry,
  defaultEnvironment: EMPTY_ENVIRONMENT,
  actions: datadropActionRegistry,        // ← the kernel
  snapshotFor: snapshotForDatalab,          // ← required
  translators: datadropTranslators,         // ← typed translators (P6), replaces conversions
  renderMenuHeader: …,
});
```

- `actions.ts` is the kernel: it imports `createActionRegistry`,
  `createPresentationTypeGraph`, `defineActions`, `available`,
  `unavailable`, `inapplicable` from `@hyperslop-systems/pbui/presentation`,
  declares a `DatalabFacts` snapshot
  (`{environment, activeDocId, targetDocId, targetName, fieldType,
  categoricalFields, …}`), and its header comment states the migration
  history verbatim: *"PBUI-ACTIONS-2 P3 migrated four types, P7 the remaining
  eleven; the descriptors are representation only. Rule ids follow the source
  guide's Appendix B (`datalab.field.map.x`); action ids name the conceptual
  operation. Labels, reasons, and verbs are byte-identical to the descriptor
  callbacks they replaced — the golden tests are the fence."*
- No descriptor in `src/pbui/descriptors/` (15 files: cat, datum, doc, field,
  geom, member, source, stage, step, tile, token, traceEntry, upload, user,
  workspace) emits an `actions()` callback.
- The `translators` field carries the one conversion (`datalab.cat-to-field`)
  as a typed translator with `from`/`to`/`match`/`translate`, replacing the old
  ordered `conversions` callback. The comment dates it: *"PBUI-ACTIONS-2 P6:
  the same conversion as a typed translator."*

### 3.2 What this means for the port

**No work.** datalab-ui is the reference. When turboproof is ported, it
should be checked against datalab-ui's `actions.ts` as the shape of a
product-owned kernel registry: a `*Facts` snapshot type, a type graph built
from `createPresentationTypeGraph`, and `defineActions` rules whose IDs
follow Appendix B (`<product>.<type>.<action>`). The one piece of datalab-ui
that is a reusable pattern, not just a reference, is its **golden-fence
method** (§6.2): the migration was proven by menu golden tests that assert
labels, order, disabled reasons, and verbs did not change, so the diff
between descriptor-callback menus and kernel menus is reviewable as
equivalence.

## 4. Consumer state 2 — agentlogic: indirect, descriptor-free (small port)

agentlogic (`~/code/wesen/hyperslop-systems/agentlogic/ui`) is pinned to
**pbui 0.6.0** and **pbui-workbench 0.2.0**. It is the easiest of the three
to move onto the new actions system, because it does not touch that system
directly.

### 4.1 Evidence it has no actions surface of its own

- It does **not** call `createPbui`. `grep -rn createPbui src` returns nothing.
- It has **no** `createPresentationRegistry`, no `PresentationDescriptor`,
  no `actions()` callback, no custom presentation types. `grep -rn
  "Presentation\b|reference={|actions(" src` returns nothing relevant.
- It builds its shell through `createWorkbench` from pbui-workbench
  (`src/store/workbenchShell.tsx:35-36,117`):

```ts
import { createWorkbench, defineApp } from "@hyperslop-systems/pbui-workbench";
export function createShell(options: ShellOptions = {}): Workbench {
  return createWorkbench({
    apps: allApps().map(toDescriptor),
    initial: options.initial ?? defaultWorkbench(),
    splitPolicy: { app: LAUNCHER_APP },
    binding: { source: TRANSCRIPT_BINDING, isBindable: …, unbound: [LAUNCHER_APP] },
    ...(options.onMutate ? { onMutate: options.onMutate } : {}),
    ...(options.onRejected ? { onRejected: options.onRejected } : {}),
  });
}
```

- Its object menus are pbui-workbench's built-in `<tile>` presentation
  (split/close/swap/dock/inspect), contributed by the shell. agentlogic's
  own apps (`apps/all.ts`, registered via `appkit/registry.ts`) are tiles,
  not presentation types with actions.

### 4.2 What "port to the actions kernel" means for agentlogic

Because agentlogic's pbui usage is fully mediated by pbui-workbench, the
actions kernel is **transitive**: pbui-workbench 0.3.0 is built against pbui
0.9.0 and its internal `createPbui` call supplies the kernel. agentlogic
gets the new system by **bumping two dependencies**:

1. `@hyperslop-systems/pbui` 0.6.0 → 0.9.0
2. `@hyperslop-systems/pbui-workbench` 0.2.0 → 0.3.0

There is no agentlogic `actions()` callback to convert and no
`createPbui` signature to fix. The work that remains is the **shell
migration** documented in PBUI-WORKBENCH-2 (which agentlogic has partly
already done — it already passes `splitPolicy`, `binding`, `onMutate`,
`onRejected`, the PBUI-WORKBENCH-2 §5.A/§5.C options):

- **Workspaces** (PBUI-WORKBENCH-2 §5.B): agentlogic seeds four workspaces
  switched by a button strip (`pages/Workbench/Workbench.tsx:55-73`). If
  pbui-workbench 0.3.0 ships the `workspace.select` verb and `WorkspaceStrip`,
  agentlogic's strip should perform `workspace.select` rather than calling
  `setCurrentWorkspaceId` directly, so the verb and the strip are one door.
- **Tile replace/link** (§5.C): agentlogic's `replaceApp` (which retargets a
  launcher view or links an existing singleton) maps onto `tile.replace` /
  `tile.link`; confirm the 0.3.0 verbs cover the cases and migrate the
  product's helper to them.
- **Persistence/sync** (§5.F): agentlogic's `workbenchContext.tsx` owns the
  localStorage + server-sync + 409-rebase loop. It can stay product-owned
  (the loop's per-mutation `applyMutation` rebase must not be routed through
  the shell's atomic `mutate`), but it should subscribe to `wb.store` instead
  of owning the document. This is a shell concern, not an actions concern.

### 4.3 The actions-specific risk for agentlogic

There is exactly one: **the `onPerform` envelope**. If any agentlogic code
supplies an `onPerform` handler (it does not appear to — `grep` found none,
because the shell owns perform), that handler must change from
`onPerform(verb)` to `onPerform(verb, envelope)`. Since agentlogic's verbs
flow through `wb.perform(verb)` and the shell's internal router, the envelope
is absorbed by pbui-workbench. **Verify** by grepping for `onPerform` and
`PbuiProvider` after the bump; if neither appears in product code, the
envelope change is a no-op for agentlogic.

### 4.4 Effort

Small. A dependency bump plus a shell-feature audit against PBUI-WORKBENCH-2
§6.1. The actions kernel itself requires zero product code changes because
agentlogic declares no actions. Estimate: a day, dominated by the workspace
verb migration and re-testing the four-workspace switch, transcript binding,
and two-tab SSE convergence.

## 5. Consumer state 3 — turboproof: full legacy migration (the real work)

turboproof (`~/code/wesen/hyperslop-systems/turboproof/ui`) is pinned to
**pbui 0.6.0** and is the consumer that actually needs the actions port. It
is in exactly the state datalab-ui was in before PBUI-ACTIONS-2 PR 3.

### 5.1 Evidence it is on the deleted legacy API

- `runtime.tsx:48` calls `createPbui` with the 0.6.0 signature that **no
  longer compiles** against pbui 0.9.0:

```ts
const instance = createPbui<PresentationValues, PbuiEnvironment, Verb>({
  registry,                 // ← a descriptor registry with actions() callbacks
  defaultEnvironment: EMPTY_ENVIRONMENT,
  // no actions, no snapshotFor, no onPerform — all three are now required
});
```

- `descriptors/shared.ts:38-41` exports the legacy `actions()` helper that
  manufactures the unstable IDs PBUI-ACTIONS-2 Amendment D explicitly warned
  about:

```ts
/** actions assigns stable ids: `${ptype}:${index}:${label}`. */
export function actions(ptype: string, specs: readonly ActionSpec[]): PresentationAction<Verb>[] {
  return specs.map((spec, index) => ({ id: `${ptype}:${index}:${spec.label}`, … }));
}
```

  (Note the word "stable" in the comment — it is not; a label edit or an
  inserted row changes identity, which breaks overrides, traces, and
  revalidation. This is the exact defect the kernel's family/rule IDs fix.)

- **13 `actions:` callbacks** across 8 descriptors, each a pure
  `actions: (value) => actions("<ptype>", […rows…])` returning rows with
  `{label, verb, disabledBecause?}`:

```text
descriptors/file.ts:28       actions: (file)    => actions("files.node", …)
descriptors/goal.ts:16       actions: (handle) => actions(…)
descriptors/hypothesis.ts:19 actions: (handle) => actions(…)
descriptors/rest.ts:17,58,104,133,159,190,234   six callbacks (step, entry, item, tile, workspace, …)
descriptors/tacticLine.ts:18 actions: (handle) => actions(…)
descriptors/term.ts:20       actions: (handle) => actions(…)
```

- `types.ts:56` still documents the deleted contract: *"actions(value,
  environment) pure and the verb serialisable."*
- The verb union (`verbs.ts`) has **25 kinds** (e.g. `newFile`, `renameFile`,
  `deleteFile`, `splitTile`, `closeTile`, `swapTiles`, `dockTile`).
- `Workbench.tsx:253` passes `onPerform={perform}` — the **single-argument**
  form; Phase B changed it to `onPerform(verb, envelope)`. The `perform`
  interpreter (`Workbench.tsx:95-238`) is the product's verb router that
  turns these 25 verbs into `workbenchActions.perform({mutations})` Redux
  dispatches (and the layout arms for the shell — though turboproof is on the
  old per-product shell, not pbui-workbench; see §5.4).
- Accept mode: turboproof uses `pbui.accept(...)` directly
  (`Workbench.tsx:326,344`) with a product `AcceptBridge`, **not** the
  `conversions` registry option — so there is no `conversions` array to
  migrate to translators. Accept stays product-owned.

### 5.2 What the port is

turboproof needs the **complete datalab-ui migration**, applied to its own
8 types. Concretely:

1. **Pin pbui to 0.9.0** (and, if it adopts the shell, pbui-workbench 0.3.0
   — see §5.4). The `createPbui` call stops compiling, which is the intended
   forcing function.
2. **Convert all 13 `actions()` callbacks to kernel rules/families** with
   stable Appendix-B IDs. Each `<ptype>` becomes a runtime type node in a
   `createPresentationTypeGraph`; each callback's rows become `defineActions`
   rules. The `actions()` helper in `shared.ts` is deleted.
3. **Build a `TurboproofFacts` snapshot** and `snapshotFor` function.
   turboproof's facts are simpler than datalab's (no schema/table cost
   boundary): the `disabledBecause` strings in the current callbacks (e.g.
   "cannot delete a non-empty folder") become `predicate` conditions or
   inline `unavailable(because)` returns.
4. **Fix `createPbui`** to pass `actions`, `snapshotFor`, and the
   two-argument `onPerform(verb, envelope)`.
5. **Stable IDs in PR 0** (Amendment D): before recording golden fixtures,
   replace the `${ptype}:${index}:${label}` IDs with deliberate
   `<product>.<type>.<action>` IDs, so a later row insertion does not shift
   every identity. This is the single highest-value step, because it is what
   makes the migration reviewable as equivalence.
6. **Delete `types.ts:56`'s old contract doc** and the `actions` import from
   `shared.ts`; descriptors keep `label`/`describe`/`tone` only.

### 5.3 The per-descriptor conversion (the unit of work)

Each of the 8 descriptors follows the same transform. Using `file.ts` as the
worked example:

**Before** (`descriptors/file.ts`, legacy):

```ts
import { actions, type ProductDescriptor } from "./shared";
export const fileDescriptor: ProductDescriptor<"file"> = {
  label: (file) => file.name,
  tone: "neutral",
  actions: (file) =>
    file.isDirectory
      ? actions("files.node", [
          { label: "New file here…", verb: { kind: "newFile", placementId: file.placementId, parentId: file.nodeId, entry: "file" } },
          { label: "New folder here…", verb: { kind: "newFile", …, entry: "directory" } },
          { label: "Rename…", verb: { kind: "renameFile", … } },
          { label: "Delete folder", verb: { kind: "deleteFile", … }, disabledBecause: "folder is not empty" },
        ])
      : actions("files.node", [ { label: "Rename…", … }, { label: "Delete file", … } ]),
};
```

**After** (kernel, in a new `src/pbui/actions.ts`):

```ts
import { defineActions, available, unavailable, predicate } from "@hyperslop-systems/pbui/presentation";

// type graph node: { id: "file", parents: ["object"] }  (object + inherited inspect/watch in PR 5)

defineActions("turboproof.file.new", {
  type: "file", action: "file.new", label: "New file here…",
  verb: (file) => ({ kind: "newFile", placementId: file.placementId, parentId: file.nodeId, entry: "file" }),
  when: predicate("file.isDirectory", (file) => file.value.isDirectory ? available() : inapplicable("not a directory")),
});
defineActions("turboproof.file.delete", {
  type: "file", action: "file.delete", label: (file) => file.value.isDirectory ? "Delete folder" : "Delete file",
  verb: (file) => ({ kind: "deleteFile", placementId: file.placementId, nodeId: file.nodeId }),
  when: predicate("file.deletable", (file) =>
    file.value.isDirectory && !file.value.isEmpty ? unavailable("folder is not empty") : available()),
  danger: true,
});
// … rename, new-folder, etc.
```

and `descriptors/file.ts` shrinks to:

```ts
export const fileDescriptor: ProductDescriptor<"file"> = {
  label: (file) => file.name,
  tone: "neutral",
  // no actions() — the kernel owns the menu
};
```

The `disabledBecause: "folder is not empty"` string becomes an
`unavailable("folder is not empty")` — byte-identical text, now a first-class
availability state the resolver can surface and revalidate. The menu a user
sees does not change; what changes is that the row has a stable action ID
(`turboproof.file.delete`), a revalidatable condition, and a candidate ID
the trace can name.

### 5.4 A decision the port forces: shell or not

turboproof today runs its **own** workbench shell (`components/organisms/`:
`NodeView`, `Tile`, `LauncherDialog`, `Workbench.tsx`'s 353-line `perform`
interpreter) on top of pbui's chrome kit, not on `pbui-workbench`. The
actions port can be done **without** moving to pbui-workbench — turboproof
keeps its shell and only migrates the presentation/actions layer. But the
actions port and the shell unification (PBUI-WORKBENCH-2) are separable,
and PBUI-WORKBENCH-2 §6.2 already plans turboproof's shell migration.

**Recommendation:** do the **actions port first, shell second**. They are
independent: the actions port touches `runtime.tsx`, `descriptors/*`,
`shared.ts`, and the `onPerform` signature; the shell port touches
`organisms/*`, `Workbench.tsx`'s interpreter, and the Redux slice. Doing
actions first means turboproof's menus are on the kernel and its 25-verb
router is the only `onPerform` adaptation needed; the shell migration then
replaces the interpreter with `wb.perform` separately. This matches the
PBUI-ACTIONS-2 PR ladder (kernel before shell) and keeps each PR reviewable.

If turboproof instead moves to pbui-workbench **and** the actions kernel at
once, the `onPerform` envelope and the `wb.perform` migration collide in
one diff; avoid that.

### 5.5 Effort

Medium-large. 8 descriptors, 13 callbacks, ~25 verbs, one new `actions.ts`
(~150–250 lines mirroring datalab-ui's), a `snapshotFor`, and the
`onPerform` signature change. The golden-fence (§6.2) is the discipline
that keeps it honest. Estimate: 2–3 days for a contributor who reads
datalab-ui's `actions.ts` first.

## 6. The method: the golden-fence (from PBUI-ACTIONS-2)

The three ports are not done by writing kernel code; they are done by
**proving the menu did not change**. The method, run once per consumer:

### 6.1 PR 0 — freeze and stable IDs

1. **Fix unstable IDs first** (Amendment D): replace turboproof's
   `${ptype}:${index}:${label}` IDs with deliberate `<product>.<type>.<action>`
   IDs while still on the legacy `actions()` helper. (datalab-ui and
   agentlogic are already past this — datalab-ui done, agentlogic N/A.)
2. **Record golden menu fixtures**: for each presentation type, snapshot the
   rendered menu — labels, order, disabled reasons, verbs, group — as a
   golden test. These goldens are the migration fence: a menu that changes
   during the port is a finding, not a fixup.

### 6.2 The migration PR — descriptors to rules

1. Create the product `actions.ts` with the type graph, `*Facts` snapshot,
   `snapshotFor`, and `defineActions` rules whose labels/reasons/verbs are
   **byte-identical** to the descriptor callbacks they replace.
2. Delete the `actions()` callbacks from descriptors; pass `actions` +
   `snapshotFor` to `createPbui`.
3. The golden tests must pass unmodified. The only accepted diff class is
   `verb: undefined` on disabled rows (a known equivalence).
4. Delete the legacy `actions()` helper (`shared.ts`) and the old contract
   doc in `types.ts`.

### 6.3 The review filter

Review the migration diff filtered to **non-id, non-label lines**. If the
only changes are IDs becoming structured and labels moving from callbacks
to rule metadata, the migration is equivalence. If `disabledBecause`
strings, verb shapes, or menu order changed, that is a semantic change and
must be argued separately.

## 7. Sequencing

| Phase | Consumer | Work | Done when |
|---|---|---|---|
| 0 | turboproof | PR 0: stable IDs on the legacy helper + golden menu fixtures | goldens recorded; IDs are `<product>.<type>.<action>`; `turboproof.workbench` tests green |
| 1 | turboproof | `actions.ts` (type graph, facts, snapshot, rules for all 13 callbacks); `createPbui` fixed; `onPerform(verb, envelope)` | goldens pass unmodified; `shared.ts` `actions()` helper deleted; `pnpm typecheck` clean on pbui 0.9.0 |
| 2 | agentlogic | bump pbui 0.6→0.9, pbui-workbench 0.2→0.3; audit `onPerform`/`PbuiProvider` (expect none); migrate workspace strip to `workspace.select` if 0.3 ships it | four workspaces switch; transcript binding resolves; reload restores; two-tab SSE converges; no `createPbui` or `actions()` in product code |
| 3 | (optional) turboproof | shell migration to pbui-workbench (PBUI-WORKBENCH-2 §6.2) — separate from actions | the 353-line `perform` interpreter replaced by `wb.perform`; `organisms/*` deleted |

Phase 0 and 1 are the actions port. Phase 2 is independent and can run in
parallel with Phase 0/1 (different repo). Phase 3 is explicitly out of scope
for "port to the actions system" but is named so it is a decision rather
than a drift.

datalab-ui has no phase — it is done and is the reference read in Phase 0.

## 8. Risks and invariants to preserve

- **No two action models.** The legacy adapter was deleted in Phase A on
  purpose; do not reinvent a per-descriptor callback "just for one row."
  Every menu row is a kernel rule or family instance.
- **Stable IDs before goldens.** Recording goldens against `${index}`-derived
  IDs fossilizes the instability; Amendment D exists because of this.
  turboproof's `shared.ts` is the textbook case.
- **`onPerform` is two-argument now.** Any `onPerform(verb)` handler is a
  compile error after the bump; the envelope's `actor` is attribution, not
  authorization (authorization stays in product routers and the chat
  gateway). turboproof's `Workbench.tsx:253` `perform` must change.
- **`disabledBecause` strings are load-bearing UX.** They must be
  byte-identical across the migration; the golden fence checks this. A
  string like "folder is not empty" becomes `unavailable("folder is not
  empty")`, not a paraphrase.
- **Fail closed.** Unknown predicate, invalid graph, duplicate IDs — throw
  at registration or refuse at resolution; never default to available.
  turboproof's `isEmpty`/`isDirectory` checks become predicates that return
  `unavailable`, not booleans.
- **Do not migrate the shell and the actions in one diff** (turboproof).
  They touch different files and different concerns; combining them makes
  the review unreviewable and breaks the golden fence (the shell migration
  changes geometry, which the actions goldens do not cover).
- **agentlogic's rebase loop must stay per-mutation.** If agentlogic's
  sync is migrated to a pbui-workbench sync module, the 409-rebase that
  applies `applyMutation` one at a time must not be routed through the
  shell's atomic `mutate` — that is a shell concern but it interacts with
  the `onMutate` hook the actions-adjacent bump enables.

## 9. What is deliberately not in scope

- **The pbui-workbench shell migration** (PBUI-WORKBENCH-2) for turboproof
  and datalab-ui. That is a separate, larger effort (store injection,
  workspaces, replace/link/rebind, launcher slot, placement mode,
  persistence/sync). The actions port is a prerequisite, not a subset.
- **hyperblog.** PBUI-WORKBENCH-2 names hyperblog as a fourth consumer, but
  it has its own tree type, no persistence, and uses the protocol only on
  the Go side; it is not in the user's question and is a larger shell
  migration than an actions migration.
- **PBUI-ACTIONS-3 Phase C items** (one condition system, refusal surfacing,
  product-definition builder, etc.). They have no puller among these three
  consumers and wait until something needs them.

## 9a. The `./datalab` Go backend: two touchpoints, neither an actions port

The workspace's top-level `datalab/` is the Go backend
(`module github.com/hyperslop-systems/datalab`). It is related to pbui in two
ways, and the actions kernel touches **neither** — but the relationship is
worth recording because it is easy to misread.

**Go side — `pkg/workbench` (the workbench document protocol, not actions).**
datalab imports `github.com/hyperslop-systems/pbui/pkg/workbench` and the
proto at `gen/go/hyperslop/pbui/workbench/v1` in four files:
`pkg/workbenchapp/{catalog,documents}.go`, `pkg/store/workbenches.go`, and
`pkg/server/handlers_workbenches.go`. What it uses is the server-side half of
the workbench **document** protocol: `ApplicationDescriptor`,
`ApplicationCatalog`, `BindingRule`, `DocumentValidator`, `Validate`,
`ApplyMutations`, `Dependencies`. `pkg/workbenchapp/catalog.go` builds the
server-visible app catalog (`DefaultCatalog()` listing the 22 datalab-ui
apps + `launcher` + the 4 document-bound apps); `documents.go` is a
`DocumentValidator`; `graphic_validation.go` validates graphic specs. **None
of this is the actions kernel.** The kernel is pure TypeScript —
`pbui/src/presentation/actions/` has 18 `.ts` files and **zero** `.go` files,
and the only Go-side mention of "action" is `workbenchActions.perform` in
Redux dispatches, which is a product noun, not the kernel. The pbui Go
`pkg/workbench` API is unchanged across the kernel work (the last
`pkg/workbench` commits are the PBUI-UNIFY-001 Phase 3 protocol-parity work,
predating PBUI-ACTIONS-1/2/3), and every symbol datalab imports still exists
in current pbui. datalab's Go pin is
`v0.0.0-20260730225710-6f20852567e1` (Jul 30); bumping it to v0.9.0 is
optional housekeeping, not a port — no code change follows.

**Frontend side — `datalab/ui/` is a nine-line shell.** `datalab/ui` is its
own package (`datadrop-datalab-shell`) whose `src/main.tsx` is:

```ts
import { DatalabApp } from "@hyperslop-systems/datalab-ui";
import "@hyperslop-systems/datalab-ui/styles.css";
// ...
createRoot(container).render(<DatalabApp />);
```

It does **not** call `createPbui`, declares no presentation types, no
descriptors, no `actions()`, no `snapshotFor`, no `onPerform`. It renders
`<DatalabApp/>` from the **published** `@hyperslop-systems/datalab-ui`
0.1.5 (a library dependency, not the workspace link). All of datalab's
actions-kernel surface lives inside datalab-ui, which is already ported
(§3). So `datalab/ui` itself has zero actions-kernel code to migrate; its
only requirement is that it consume a **published datalab-ui that contains
the kernel migration**. The workspace datalab-ui is at 0.1.5 depending on
`workspace:^` pbui 0.9.0, so the kernel is in the source; whether the
published 0.1.5 on the registry predates or postdates the migration is a
release question, not a code question. If the published 0.1.5 predates the
kernel, `datalab/ui` bumps its datalab-ui dependency to the next released
version — a one-line change in `ui/package.json`.

**Net for `./datalab`:** no actions port. The Go side is action-kernel-
agnostic by construction (the kernel is TS-only); the frontend side is a
shell that inherits datalab-ui's ported state through a library dependency.
The only follow-on is a datalab-ui version bump in `datalab/ui/package.json`
if the published 0.1.5 predates the kernel migration.

## 10. Glossary

| Term | Meaning here |
|---|---|
| **actions kernel** | the pbui 0.9.0 type-directed action-selection engine (`src/presentation/actions/`); rules, families, type graph, availability quartet, fresh revalidation, vocabulary export |
| **legacy descriptor actions** | the deleted `descriptor.actions(value, env)` callback + `registry.actionsFor` + `conversions`; the 0.6.0 model |
| **rule / family / candidate** | a static action declaration; a bounded dynamic generator; one concrete competitor in a resolution |
| **action ID** | the conceptual operation rules compete to implement (`file.delete`); several rules can implement one |
| **stable IDs** | `<product>.<type>.<action>` and family+instance-key; never `${index}` or `${label}` |
| **snapshot** | immutable, revisioned, query-local facts the resolver reads instead of live stores |
| **availability quartet** | available / unavailable (visible + one reason) / inapplicable (absent, permits fallback) / hidden (absent, suppresses fallback) |
| **fresh revalidation** | resolve again at click time; same action AND same candidate must win; the fresh verb is delegated |
| **perform envelope** | `onPerform(verb, {action, candidateId, invocation, subject, actor?})` — Phase B provenance |
| **translator** | typed, scoped, explained replacement for the ordered `conversions` callback |
| **golden fence** | menu snapshots (labels, order, disabled reasons, verbs) recorded before the migration and asserted unmodified after |
| **createWorkbench** | the pbui-workbench shell constructor that owns `createPbui`; how agentlogic reaches pbui indirectly |
