# Build your first styled workbench panel

This tutorial follows the compiled [StyledPanel example](../../packages/pbui-workbench/src/stories/StyledPanel/StyledPanel.tsx). It demonstrates the visual foundation without an API, credentials or persistence. Read [visual style](visual-style.md) first for the component-selection rules.

![Native styled workbench after explicit inspection](../../ttmp/2026/09/04/PBUI-VISUAL-1--consolidate-the-visual-style-across-pbui-packages-and-demos/various/screenshots-onboarding/styled-workbench.png)

Captured in Chromium at 1200×800 using synthetic data. The
[ticket's figure catalogue](../../ttmp/2026/09/04/PBUI-VISUAL-1--consolidate-the-visual-style-across-pbui-packages-and-demos/various/screenshots-onboarding/01-capture-catalog.md)
contains the other states, a before/after theme-host fix, and capture limitations.

## 1. Run the example

From the PBUI repository root, install the workspace dependencies with the repository's registry authentication configured. Never put a registry token in docs or source. The full workspace includes Datalab's private dependencies; follow the root README if installing only the core subset.

```bash
pnpm install --frozen-lockfile
pnpm --filter @hyperslop-systems/pbui build
pnpm --filter @hyperslop-systems/workbench-core build
pnpm --filter @hyperslop-systems/pbui-workbench typecheck
pnpm --filter @hyperslop-systems/pbui-workbench test
pnpm --filter @hyperslop-systems/pbui-workbench storybook
```

Open port 6008, **Workbench / Getting Started / Styled Panel**. Use NativeWorkbench for the real shell. The neighboring stories cover ready, empty, loading, error, disabled, narrow overflow, a theme override and a details slot. The test source beside the example exercises controlled editing, explicit inspection, disabled actions, named states and visible Wiring access.

This is an in-repository compiled example, not a separate published application. In an external consumer, install compatible releases of `pbui`, `pbui-workbench` and `workbench-core`, with React/React DOM peers; use public imports instead of the example's package-internal relative imports. Run a clean install and production build there as well. The root README's consumer smoke test covers the core package, not every possible workbench consumer combination.

## 2. Load the same foundation in runtime and stories

```ts
import "@hyperslop-systems/pbui/styles.css";
import "@hyperslop-systems/pbui-workbench/styles.css";
```

Core ships defaults; a new consumer should not need a copied palette to make a Button render correctly. Product overrides should be a small explicit difference. If adding a CodeEditor, also load its own stylesheet. Follow the [styling contract](../reference/styling-contract.md) for specificity, portal theming and linked React/CodeMirror identity.

Storybook must load the shared foundation too. Feature-specific styles may differ deliberately, but record the difference and test the shared list. A comment saying “same as production” is not a parity assertion. In this repository the workbench preview and public package build have their own entry points; inspect them before adding another global import.

## 3. Define the panel's inputs

The example exports `StyledPanelProps`: a controlled `value`, a bounded `state`, callbacks and an optional `details` slot. The panel does not fetch or access a store. The demo controller owns state, and its Inspect callback records the value only when the user clicks.

This is the reusable split:

```text
controller: read state, fetch, authorize, dispatch
  → panel: receive data and callbacks, derive pure rendering
      → shared controls and local domain markup
```

A pure calculation such as “is this action disabled?” is appropriate in a panel. A network request or ambient authorization lookup is not. The production controller must still revalidate actions against fresh state.

Look at the actual markup in `StyledPanel.tsx`: AppBody, Toolbar, a visible label linked through `useId`, TextInput with `accessibleName`, Button, EmptyState, Callout and KeyValueList. It demonstrates both accessible and visible naming, and avoids rebuilding shared notices or detail grids.

## 4. Give the panel a native host

The example's `StyledWorkbench` creates one workbench per mount with a lazy state initializer. It registers the fixture using `defineWorkbenchApp`, supplies `layout(tile("styled-fixture"))`, and renders the bound Surface inside AppShell. The following names are the public consumer imports corresponding to its internal imports:

```ts
import { AppShell, createWorkbench, defineWorkbenchApp } from "@hyperslop-systems/pbui-workbench";
import { layout, tile } from "@hyperslop-systems/workbench-core";
```

The shell's height comes from the example's module CSS. Its masthead actions call `workbench.dispatch({ kind: "launcher.open" })` and `workbench.dispatch({ kind: "link.mode.open" })`. Those are shell actions, not layout commands. The real workspace strip, launcher, rebalance dialog and surface are mounted; the example does not transcribe their chrome.

No ports are declared in this first example, so opening Wiring does not demonstrate a connected domain workflow. Add ports and the product presentation graph using the [workbench README](../../packages/pbui-workbench/README.md) when the domain requires links. Presentation-bound menus/help need the actual product provider; a plain panel does not.

## 5. Add only local anatomy

`StyledPanel.module.css` owns the fixed demo host, narrow story width and long-value wrapping. It references shared tokens for borders and the theme override. It does not define a new input, notice, type scale or palette.

These demo dimensions are intentional test geometry, not new global design tokens. Do not add a global “640px panel” role just because the example needs a known viewport region. Use a module for component anatomy; use shared tokens for shared visual roles.

There is no universal `unstyled` prop on PBUI components. Do not invent one in consumer examples. A completely custom skin requires deliberately composing the documented granular CSS exports in an isolated entry point, with its own accessibility and visual tests; changing two tokens is a theme example, not an unstyled-mode proof.

## 6. Verify gestures, then pixels

1. Type in Fixture name. Nothing is inspected until pressing Inspect.
2. Inspect and check the explicit detail; the value is not a server response.
3. Open Loading/Disabled; the action is disabled and a reason remains visible.
4. Open Error/Empty; the copy distinguishes them.
5. Open NarrowOverflow; long content must not widen the host or hide controls.
6. Open NativeWorkbench; use Applications and Wiring without a shortcut.
7. Focus inside the native surface and try the platform's Mod+Shift+L shortcut. Focus outside the surface may intentionally not be owned by it.
8. Inspect focus visibility, labels, console messages and overflow in a real browser. Unit tests do not measure final geometry.

Run `pnpm --filter @hyperslop-systems/pbui-workbench build-storybook` for a static build. Preserve a screenshot and its viewport/story/state when approving appearance. See the [review playbook](../playbooks/visual-review-and-storybook.md).

## 7. Move from fixture to product

Replace only the demo controller with real DTO loading and action routing first. Keep the pure panel and synthetic error/empty stories. Decide which state is document-owned, view-owned, local UI state or private transient input before adding persistence. React remounts during reparenting can erase component-local drafts; stable view identity and explicit lifetime ownership are not CSS concerns.

For Datalab document edits use the [editing playbook](../playbooks/adding-editing-support-to-a-pbui-application.md). Other products may use other state stores, but still must validate persisted documents and keep secrets out of presentation values and generic layout state.
