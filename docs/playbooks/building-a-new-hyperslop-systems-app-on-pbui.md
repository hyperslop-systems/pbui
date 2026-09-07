# Building a new hyperslop-systems app on PBUI

Start with the [visual onboarding path](../README.md), especially the [compiled first-panel tutorial](../guides/first-styled-workbench-panel.md). This playbook covers application ownership and delivery. It replaces the old mixed bootstrap/migration narrative: current APIs belong here; historical defects and fixes remain in git and the relevant tickets.

## 1. Decide ownership first

A product owns its domain types, loading/authentication, action execution and persistence policy. PBUI owns shared controls and presentation mechanics. Workbench core owns layout commands and document/view/placement invariants; pbui-workbench supplies the React shell. Do not implement a local mutation engine or copy native tile chrome.

```text
model/        pure domain types and derivations
api/          authenticated transport, DTO decoding and cancellation
store/        product state and lifetime policy
pbui/         product presentation types, descriptors, actions, help and relations
apps/         controllers: state, effects, DTO-to-panel mapping
components/   pure panels, domain composition and shared-control adapters
styles/       product foundation and deliberate overrides
fixtures/     synthetic or reviewed sanitized wire-shaped examples
```

The layout is illustrative, not a mandatory new directory for each noun. A controller fetches and dispatches; a reusable panel receives DTOs and callbacks. Pure derivations and local interaction state are allowed inside panels. A package's permitted dependency graph is not a reason to put hidden network calls in new presentational components.

## 2. Use the current packages

Install compatible published versions of core PBUI, pbui-workbench and workbench-core plus React/React DOM peers. Add pbui-editor only if you need code editing. Do not copy version numbers from an old migration example; inspect package metadata and validate the chosen combination in a clean consumer. Registry authentication stays outside source control.

```ts
import "@hyperslop-systems/pbui/styles.css";
import "@hyperslop-systems/pbui-workbench/styles.css";
import { AppShell, createWorkbench, defineWorkbenchApp } from "@hyperslop-systems/pbui-workbench";
import { layout, tile } from "@hyperslop-systems/workbench-core";
```

The tutorial contains the compiled registration/render example. Declare each application's manifest and presentation once, create a workbench with a valid initial document, then mount its bound Surface/WorkspaceStrip/Launcher/Rebalance inside AppShell. Use `workbench.execute(...)` for layout commands and `workbench.dispatch(...)` for shell actions such as `link.mode.open`. Do not start by manually assembling TileFrame and a product mutation applier; those are lower-level extension work, not the default bootstrap.

For linked development, use `pbuiVite()` from `@hyperslop-systems/pbui/vite` and preserve its React deduplication when merging Vite configuration. An invalid hook dispatcher under a symlink may indicate duplicate React, not a hook bug in the component. A successful linked build still does not prove a registry consumer works.

## 3. Establish the visual foundation before feature CSS

Core token defaults live in `src/tokens.css` and ship through the core stylesheet. Read the [styling contract](../reference/styling-contract.md) for imports and overrides. Do not reproduce the palette in a product file. Use a small explicit set of differences and shared semantic names.

Use Button, TextInput, SelectInput, AppBody, Toolbar, EmptyState, Callout, Chip, KeyValueList and SectionLabel before inventing local equivalents. A missing border or unexpectedly bare component is a reason to inspect imports and computed styles first. A raw control with custom CSS should not become the permanent workaround for a missing shared stylesheet.

A token definition test does not prove contrast or semantic use. `selected` is not a generic status colour. Referenced-minus-defined checks find missing definitions, not unused declarations. See the visual review playbook for the evidence required beyond compilation.

## 4. Package components by complexity

Reusable components with meaningful states have colocated stories and local CSS modules when they own styles. Use named exports and keep pure logic beside the component when appropriate. Small private/pass-through helpers may remain local where the package permits it. Core and workbench have stricter component-folder tests: follow those local constraints, but do not universalize them into empty CSS files and meaningless stories everywhere.

Component rules belong beside the component. Product-global CSS owns genuine shell/prose concerns, not `.product-button` and `.product-empty` replacements. Public parts and render slots are deliberate APIs; private DOM structure is not an override contract.

## 5. Bind presentations as the domain appears

Use the current `definePresentation`/`createPbui` APIs and the workbench presentation fragment documented in the [core README](../../README.md) and [workbench README](../../packages/pbui-workbench/README.md). Descriptors represent types; action declarations own availability and serializable verbs; execution revalidates against fresh state. Do not reintroduce descriptor `actions()` callbacks or old separate registries from historical examples.

Keep presentation values small and nonsecret. Values may appear in inspectors, traces and help. Mount the provider and related menu/help/accept surfaces when the application uses those interactions; a plain DTO panel need not depend on that provider. For ports, use the same presentation graph for link dependencies, not a separate hand-written compatibility table.

Provide visible controls for important shell operations. Mod shortcuts are platform-aware and respect focus ownership. Wiring that can only be discovered by guessing a keyboard chord is incomplete onboarding.

## 6. Define state lifetime before persistence

A placement owns geometry; a view owns application identity and bindings; a document owns domain content. Some inputs should remain private in memory. A React component can remount when a view is rearranged: if unsaved input must survive that transition, associate it with stable view identity and explicit close/credential lifetimes, not only mount-local state.

Persist only validated formats through the product's authorized host. An opaque reference does not authorize access by itself. Restoring a layout or input should not silently execute an operation. The [editing playbook](adding-editing-support-to-a-pbui-application.md) explains Datalab's specific document integration; it does not require every product to adopt Redux or Datadrop's snapshot policy.

## 7. Keep the application boundary reproducible

Centralize authenticated transport so offline stories can be proven network-free. Generate or decode shared DTOs from an authoritative schema and test round trips/staleness. Synthetic fixtures should include awkward values, missing/error states and long identifiers, not just happy-path objects. Reviewed sanitized captures can supplement them; never commit raw private data.

For a Go-embedded frontend, keep API 404s distinct from SPA fallback. Serve hashed assets without an HTML fallback. Use `go:embed all:dist` when hidden/underscore assets are required. Configure Vite's production base/output explicitly, and make Storybook override them so its build cannot replace the embedded application.

For licensed fonts, ship no unlicensed files and avoid expected 404 font requests. Availability and preference should be configured together; test the system-monospace fallback. Do not mark unhashed mutable font URLs immutable.

## 8. Acceptance

Follow [visual review and Storybook](visual-review-and-storybook.md), then record:

- The pure panel's controlled input, empty/loading/error/disabled and overflow states.
- A real native workbench story with a bounded host, current document and required providers.
- Visible and keyboard entry points, labels, focus and console review.
- Runtime/story foundation imports and intentional feature-specific differences.
- Typecheck, tests, production/Storybook builds and clean-consumer validation for package changes.
- Actual integration tests for authorization/persistence/side effects; a rendered fixture proves none of those by itself.

Write a continuation-friendly diary for substantial work, including failed attempts and screenshot conclusions. Commit a working slice before beginning another unrelated refactor. For existing UI, use the [incremental refactoring playbook](refactoring-a-pbui-app-into-atoms-molecules-and-organisms.md).
