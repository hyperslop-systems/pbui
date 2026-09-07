# Datalab UI guidelines

Read the shared [visual guide](../../docs/guides/visual-style.md), [styling contract](../../docs/reference/styling-contract.md) and [first-panel tutorial](../../docs/guides/first-styled-workbench-panel.md) first. This file adds Datalab-specific conventions. It is not a second source of shared palette or component policy.

## 1. Shared defaults, local domain policy

Core `../../src/tokens.css` owns the PBUI defaults. Datalab's former `src/styles/tokens.css` was removed by PBUI-VISUAL-1; do not recreate that palette copy. Use shared roles and deliberate product overrides. There is no CSS framework or generic unbounded Box/style-prop API.

Use shared controls before local equivalents. Retain visible labels separately from `accessibleName`; use `onValueChange(value)`, not event-shaped adapters everywhere. State never relies on colour alone. Read current source props instead of copying historical examples (`Callout.variant`, not `severity`; `TextInput.accessibleName`, not `label`).

Datalab's charts have domain palette invariants: `test/tokens.test.ts` checks core colours against the plot palette and contrast requirements. Follow the current generator/test source before changing generated values. Do not hand-edit a copied Datalab palette; `scripts/make-tokens.ts` and the package's `tokens` script are the relevant tooling entry points.

## 2. Ownership and enforced layers

The authoritative allowed-import graph is `test/layers.test.ts`. It has more layers than the early prototype, including analysis, remote and demo. Do not copy an old reduced graph into a new implementation.

For new feature work:

- `model` contains pure domain logic, not React or transport.
- API/remote/store/runtime code owns effects, synchronization and domain state.
- `apps` controllers read the appropriate bound document and pass DTOs/callbacks to panels.
- New presentational panels do not import transport or fetch. Pure derivations and local interaction state are fine.
- Foundation/layout components do not learn domain nouns. Presentation-bound atoms are deliberate domain adapters.

The enforced graph may permit API/store imports in existing organisms. That is a dependency ceiling, not a recommendation to add hidden effects to every new panel. Document existing integration exceptions; do not confuse them with the default controller/panel pattern.

Datalab's TablePanel is one such specialized component: it wraps field/datum presentations and needs the provider in its stories. It is not a generic positional SQL table. New plain components should remain provider-free; pass render slots for optional live domain content where practical.

## 3. Components and local CSS

A small one-off/pass-through component may remain a local `.tsx` file. Promote it to a directory when it owns styles, meaningful stories, focused tests or logic. Reusable stateful/visual components need stories or the specific `@story-exempt:` reason permitted by `test/stories.test.ts`.

```text
components/<layer>/<Name>/
  <Name>.tsx
  <Name>.stories.tsx
  index.ts                 named exports
  <Name>.module.css        only when it owns rules
  <Name>.logic.ts          optional pure derivations, tested directly
```

Keep local anatomy in CSS modules. No copied font literals or colours where shared tokens exist; no cross-component private descendant selectors. Inline styles are for dynamic geometry, variable plumbing and existing bounded token-based APIs, not a new generic styling surface. Do not create empty modules solely for a file count.

Prefer a component's current bounded props and actual call-site needs. A new small/medium/large API with no concrete consumers is not inherently reusable. Raw controls outside atoms need a documented allowance in the relevant test, not a replacement with a keyboard-inaccessible clickable div.

Public `data-part` hooks are deliberate external contracts. Do not expose every internal element. Keep secrets out of presentation values: inspectors, traces and watchlists may display them even if the ordinary panel does not.

## 4. Storybook conventions

The package's checked sidebar prefixes are:

```text
Design System/Foundation/<Primitive>
Design System/Layout/<Primitive>
Design System/Atoms/<Atom>
Design System/PBUI/<Name>
Component Library/Molecules/<Component>
Component Library/Organisms/<Component>
Applications/<Page>
```

Keep the title literal in the meta; `test/stories.test.ts` statically inspects it. Use the actual `.storybook/preview.ts` and decorators rather than assuming another package's setup. Plain atoms need no arbitrary tile height. Height-dependent panels need a bounded host; native application stories additionally need the registry/document/provider they actually use.

Cover populated, empty, loading, error/disabled and the awkward state that is hard to reach through the real server. Layout stories need overflow/narrow cases. Controlled inputs need a Live wrapper. A state is useful when a reviewer can say what is wrong, not merely because it has a different number of rows.

Use synthetic wire-shaped or explicitly reviewed sanitized fixtures. Never commit an authenticated server response indiscriminately. A pure story demonstrates rendering; it does not prove remote persistence or authorization. Follow the shared [visual review playbook](../../docs/playbooks/visual-review-and-storybook.md) for screenshots and console errors.

## 5. Adding a Datalab application

Datalab retains a product-specific app registry in `src/appkit/registry.ts`; generic new products use `defineWorkbenchApp` from pbui-workbench. Do not interchange the two APIs.

1. Build a DTO/callback panel with shared controls and meaningful stories.
2. Add an app controller using current `AppProps` from the Datalab registry; read the named binding instead of whichever document happens to be active.
3. Register with the existing `registerApp` contract and add the import in `src/apps/all.ts`.
4. Review the manifest/catalog adapter and server allowlist if application identity or binding policy changes.
5. Follow the [durable editing playbook](../../docs/playbooks/adding-editing-support-to-a-pbui-application.md) for domain document edits.

Persisted app IDs and bindings are identity, not display labels. Renaming them needs a deliberate migration or hard cutover. UI-local state is not automatically view-local state: moving a tile may remount it.

Workspace behavior now goes through `src/store/runtime.ts`, `src/store/controller.ts` and `src/store/navigation.ts`, backed by workbench-core. The old `store/spaces.ts`/`pinnedSpaces()` recipe no longer describes this package. Read the current runtime/controller rather than rebuilding a local split-tree store.

## 6. Commands and review

From the PBUI repository root:

```bash
pnpm --filter @hyperslop-systems/datalab-ui typecheck
pnpm --filter @hyperslop-systems/datalab-ui test
pnpm --filter @hyperslop-systems/datalab-ui build
pnpm --filter @hyperslop-systems/datalab-ui build-storybook
```

The package uses pnpm/Vitest. Historical `bun --cwd ui` commands refer to an older layout and are not the current procedure. Storybook development uses the package's `storybook` script; inspect its port before starting another server.

Review checklist:

- Correct ownership and allowed imports; new panels have no hidden transport.
- Shared controls, correct props, visible labels and keyboard behavior.
- Tokens encode the intended role; no state depends only on colour.
- Local CSS and packaging match complexity and package tests.
- Meaningful states and bounded hosts in stories; exemptions are specific.
- No secret in fixture, presentation value, screenshot or layout state.
- Typed/long/null values retain domain semantics.
- Tests/builds pass and actual appearance/console/overflow were inspected.

## 7. What tests establish

Inspect the current tests rather than treating this list as a substitute for them. `layers.test.ts` checks dependencies; `stories.test.ts` checks structure/story declarations; `no-raw-controls.test.ts` checks reviewed control use; `tokens.test.ts` checks palette/contrast; `api-surface.test.ts` checks the reviewed mutating endpoint surface. These tests do not certify final rendered appearance or all runtime gestures.

The [core and workbench READMEs](../../docs/README.md) and current source are the API references. Historical decision records remain useful explanations, but their proposed prop names, paths and counts may predate the current implementation.
