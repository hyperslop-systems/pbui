# Starting a new pbui-family product: the day-one imports

A pbui-family product (datalab, agentlogic, turboproof, …) shares one look,
one window chrome, and one set of interaction mechanics. Before
PBUI-UNIFY-001 that sharing was a discipline — every product transcribed the
same stylesheet block and the same machinery — and the failure mode was
silent: turboproof once shipped with the object menu rendering unpositioned
at the end of the document, invisible, with every mechanical check passing.
This page is the checklist that replaces the discipline. A new product starts
from imports; it transcribes nothing.

## 1. Dependencies

```jsonc
// ui/package.json
"@hyperslop-systems/pbui": "^0.2.0",
"@hyperslop-systems/workbench-protocol": "^0.2.0"   // if it has a workbench
```

Both install from the GitHub npm registry (`.npmrc` with
`//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`; the family Makefiles
wrap the token from Vault).

## 2. The stylesheet stack, in order

```ts
import "./styles/reset.css";        // product
import "./styles/tokens.css";       // product — pbui DEFINES NO TOKEN VALUES
import "@hyperslop-systems/pbui/styles.css";
import "@hyperslop-systems/pbui/components.css";
import "@hyperslop-systems/pbui/presentation-parts.css"; // menu, affordances, banner, mouse-doc
import "@hyperslop-systems/pbui/chrome.css";             // tile frame, drop zone, launcher
import "./styles/app.css";          // product, last, may override
```

The two PBUI-UNIFY-001 files are the ones a product used to transcribe.
`presentation-parts.css` positions the object menu (`position: fixed`,
`z-index: 100`) and draws the hover/acceptable affordances; without it the
presentation system is wired and invisible. `chrome.css` styles the
`TileFrame`, `DropZoneOverlay`, and `LauncherShell` data-parts. Both are
explicit imports on purpose: a product with a genuinely different look skips
one and styles those `data-part` hooks itself.

## 3. The runtime file (the product's own)

One `createPbui` call binds the product's descriptors and verb union. The
instance now also returns the two chrome strips:

```ts
const instance = createPbui<Values, Environment, Verb>({ registry, defaultEnvironment });
export const PbuiProvider = instance.Provider;
export const Presentation = instance.Presentation;
export const ObjectMenu = instance.ObjectMenu;
export const MouseDocLine = instance.MouseDocLine;   // the Genera footer
export const AcceptBanner = instance.AcceptBanner;   // the accept-mode banner
export const usePbui = instance.usePbui;
```

The descriptors, the verbs, and the tiles are the product. Everything below
this line is imports.

## 4. The window chrome

```ts
import {
  TileFrame, DropZoneOverlay, useTileDrag,       // frame + drag/swap/dock
  LauncherShell, splitDirectionFor,              // Mod+K modal shell
  isModKey, routeWorkbenchKey, isEditableTarget, // keyboard routing
} from "@hyperslop-systems/pbui";
```

- `TileFrame` takes callbacks and a title slot — wrap your `<tile>`
  Presentation there so the object menu and the chrome buttons stay two doors
  to the same verbs. It never sees your document model (that is what lets
  datalab's layout store and the protocol-document products share it).
- `useTileDrag({ id, onSwap, onDock })` owns the registry, the hit test, and
  the banded zone geometry; you translate the callbacks into your verbs
  (~10 lines). Render `DropZoneOverlay` from the reported `zone` — the
  overlay names the outcome before the release.
- `LauncherShell` owns the Dialog, the combobox input, and the keyboard loop.
  Your product owns the rows model and `choose()`. Two invariants are
  documented on the shell — Escape has exactly one owner (the Dialog), and a
  global new view never destroys a working tile (`splitDirectionFor`).

## 5. The workbench document layer (protocol products)

```ts
import {
  applyMutation, splitPlacement, closePlacement, swapPlacements,
  dockPlacement, resizeSplit, snapRatio, createWorkbenchClient,
} from "@hyperslop-systems/workbench-protocol/client";

const client = createWorkbenchClient({
  sourceBinding: "source",     // your binding key
  launcherAppId: "launcher",   // your empty-pane app id
  isBindableDocument: (payload) => /* which documents proof/data tiles bind */ true,
});
```

The TypeScript applier mirrors `pkg/workbench`'s Go applier and is pinned to
it by the shared fixture corpus (`packages/workbench-protocol/fixtures/
mutations/`, asserted from both languages). Do not write a local applier; if
you need a new mutation, extend the proto, implement BOTH sides, and add a
fixture.

## 6. The acceptance rule (learned the hard way)

Add one geometry assertion to your e2e or smoke tests on day one: open the
object menu and assert `position: fixed`, a z-index, and containment in the
viewport at the pointer. Presence in the accessibility tree, successful
synthetic clicks, and role-based queries are all compatible with a fully
invisible UI. Assert geometry, not presence.

## 7. What stays yours

Descriptors and the verb union; the tiles and their registry (plus the
registry↔server-catalog parity fixture if you have a Go catalog); tokens,
reset, scrollbars, and your app.css; any product-specific `data-part` you
emit yourself (style it in your own CSS — datalab's `menu-target` is the
example).
