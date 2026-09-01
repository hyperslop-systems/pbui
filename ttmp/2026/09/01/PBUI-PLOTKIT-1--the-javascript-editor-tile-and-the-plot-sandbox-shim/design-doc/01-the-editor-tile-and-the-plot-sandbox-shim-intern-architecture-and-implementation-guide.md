---
Title: 'The editor tile and the plot sandbox shim: intern architecture and implementation guide'
Ticket: PBUI-PLOTKIT-1
Status: active
Topics:
    - frontend
    - pbui
    - plotting
    - design
    - architecture
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-sandbox/src/devtools/PlaygroundTile/PlaygroundTile.tsx
      Note: First migration target for the editor
    - Path: repo://packages/pbui-sandbox/src/engine.ts
      Note: The ProgramEngine.evaluate door the shim is prepended to
    - Path: repo://src/chrome/shortcutRouting.ts
      Note: The chord table and isEditableTarget; the Mod+Shift+K conflict lives here
    - Path: repo://src/components/atoms/TextArea/TextArea.tsx
      Note: The API the CodeEditor mirrors, and the surface it replaces
    - Path: repo://src/tokens.css
      Note: Where the new --pbui-syntax-* tokens must be defined
    - Path: ws://plot/src/author/index.ts
      Note: The fourteen modules the shim reproduces
    - Path: ws://plot/src/document.ts
      Note: The branded ids that erase at runtime, which is why the shim is exact
ExternalSources:
    - https://codemirror.net/docs/
    - https://codemirror.net/examples/styling/
    - https://codemirror.net/docs/ref/#state.Compartment
Summary: Design for @hyperslop-systems/pbui-editor (a CodeMirror 6 CodeEditor themed from pbui tokens) and for the plot author-API shim inside pbui-sandbox that lets a sandboxed script build a PlotDocument without importing the plot package.
LastUpdated: 2026-09-01T13:26:39.989882694-04:00
WhatFor: Specify the editor package boundary, the CodeEditor API, the CodeMirror/React bridge, the token theme, and the plot author shim with its parity test.
WhenToUse: Read before creating packages/pbui-editor or packages/pbui-sandbox/src/plot, or before migrating PlaygroundTile and SourceTile onto the new editor.
---



# The editor tile and the plot sandbox shim

> **Who this is for.** Somebody who has never opened these repositories. It
> explains the packages you need, the contracts they already have, and then the
> two pieces of infrastructure this ticket adds. Read §1–§5 before writing any
> code; §6–§9 are the design; §10–§12 are the plan.
>
> **What this ticket delivers.** Two things, both enabling infrastructure:
>
> 1. **`@hyperslop-systems/pbui-editor`** — a CodeMirror 6 `CodeEditor`
>    component with JavaScript syntax highlighting, themed from pbui tokens.
> 2. **The plot sandbox shim** — a small module inside
>    `@hyperslop-systems/pbui-sandbox` that lets a sandboxed JavaScript program
>    construct a `@hyperslop-systems/plot` `PlotDocument` without importing the
>    plot package, plus the `ScriptResult` contract and its runtime guard.
>
> The consumer that puts them together is **PBUI-PLOTSCRIPT-1**
> (`ttmp/2026/09/01/PBUI-PLOTSCRIPT-1--*/`), which builds the runnable
> editor-beside-plot example. This ticket ships nothing user-visible on its own,
> and that is deliberate: both pieces are reusable, and both have consumers
> beyond the plot example.

---

## 1. Where you are

Three checkouts sit side by side in
`/home/manuel/workspaces/2026-09-01/add-plot-editor/`:

```
add-plot-editor/
├── pbui/       ← YOU ARE HERE. A pnpm workspace of React packages.
│   ├── src/                      @hyperslop-systems/pbui            the design system
│   └── packages/
│       ├── pbui-workbench/       @hyperslop-systems/pbui-workbench  tiles + layout
│       ├── pbui-sandbox/         @hyperslop-systems/pbui-sandbox    a JS program runtime
│       ├── pbui-chat/            @hyperslop-systems/pbui-chat
│       ├── workbench-protocol/   the protobuf layout document
│       └── datalab-ui/           @hyperslop-systems/datalab-ui      the Datalab product
├── plot/       ← @hyperslop-systems/plot, the grammar-of-graphics compiler
└── datalab/    ← the Go server; its UI is nine lines that mount datalab-ui
```

`pnpm-workspace.yaml` lists `.`, `packages/*` and `packages/pbui-chat/demo`, so
a new directory under `packages/` is a workspace member the moment it has a
`package.json`.

Everything in this repo is TypeScript, React 19, Vite 8, Vitest 4, Storybook
10, pnpm 10. Packages publish to the GitHub npm registry under
`@hyperslop-systems/`.

---

## 2. `@hyperslop-systems/pbui` — the design system you must fit into

*Source:* `pbui/src/` · *Version 0.9.0*

### 2.1 It has no runtime dependencies, and that is load-bearing

Open `pbui/package.json`. There is **no `dependencies` key at all** — React and
React-DOM are `peerDependencies`, and the `devDependencies` are the toolchain.
Every consumer of pbui (the Datalab product, `pbui-chat`, and three other
products named in the tree's comments: `agentlogic`, `turboproof`, `hyperblog`)
gets the design system without inheriting anybody else's library choices.

That property is the whole reason this ticket creates a package instead of
adding a component. See Decision D1.

### 2.2 Atoms, and the rule that governs them

`pbui/src/components/atoms/` holds the primitives:

```
Button  CheckboxRow  Chip  CodeLine  IconButton  LinkAction
Meter   SelectInput  Sparkline  Swatch  TextArea  TextInput
```

`pbui/test/no-raw-controls.test.ts` **forbids a raw `<textarea>`, `<input>` or
`<select>` anywhere outside `atoms/`**. The `TextArea` file explains why the
rule exists: four character-identical inline style objects written within hours
of each other.

`TextArea` is the current code-editing surface, and it is the API you are going
to mirror:

```tsx
// pbui/src/components/atoms/TextArea/TextArea.tsx
export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value" | "aria-label"> {
  value: string;
  onValueChange(value: string): void;
  /** Becomes `aria-label`. Say what the field holds. */
  accessibleName: string;
  invalid?: boolean;
  rows?: number;
  /** Monospace and pre-wrapped, for JSON. */
  code?: boolean;
}
```

Note the three conventions, because you will repeat all three:
`onValueChange(value)` unwraps the event because every call site wants the
string; `accessibleName` is **required** and becomes `aria-label`, because a
bare field in a dialog has no visible label to associate with; `rows` is
measured in lines of content rather than in a spacing token, because that is
what the attribute means.

It has no syntax highlighting, no line numbers, no bracket matching, no
auto-indent, and no way to put a diagnostic on a line.

### 2.3 The stylesheet is one file, and its order is asserted

`pbui/src/index.ts` opens with a sixty-line comment that is required reading. In
summary, `dist/pbui.css` is assembled by Vite from the module graph in this
order, and the order *is* the cascade:

```
1. tokens.css              :where(:root) defaults for every token. Zero specificity,
                           so a product's own :root always wins.
2. styles.css              :where() fallbacks for presentation parts.
3. the component modules   *.module.css, hashed names, (0,1,0).
4. the parts files         components.css, presentation-parts.css, chrome.css.
                           Plain attribute selectors, ALSO (0,1,0) — so they must
                           come after 3 to win ties. Imported at the BOTTOM of
                           index.ts for exactly that reason.
```

`pbui/src/styles-wiring.test.ts` asserts the emitted order rather than trusting
it. Two of those layers were once absent and neither absence produced an error:
an undefined CSS custom property invalidates its whole declaration silently at
computed-value time.

### 2.4 Tokens, and the test that guards them

`pbui/src/tokens.css` defines every token on `:where(:root)`, and
`pbui/src/tokens-defined.test.ts` asserts that **every token a component reads
has a default there**. If your theme reads `--pbui-syntax-keyword`, that token
must exist in `tokens.css`. Adding one is a one-line diff; not adding one is a
component that renders with no colour at all, silently, in exactly one product.

### 2.5 Keyboard routing — read this before you bind a key

`pbui/src/chrome/shortcutRouting.ts` is a pure function over a two-row table:

```ts
const ROUTES = [
  { key: "k", shift: false, decision: { kind: "open-launcher" } },   // Mod+K
  { key: "k", shift: true,  decision: { kind: "open-rebalance" } },  // Mod+Shift+K
];

export function isModKey(event, platform) {          // Meta on Apple, Control elsewhere
  return /mac|iphone|ipad/i.test(platform) ? event.metaKey : event.ctrlKey;
}

export function isEditableTarget(target) {
  if (target.isContentEditable) return true;          // ← a CodeMirror surface IS this
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName ?? "");
}
```

`Escape` is deliberately **absent** from the table; the topmost transient
surface owns it, decided by pbui's surface stack rather than here.

The listener lives in `packages/pbui-workbench/src/components/Launcher/Launcher.tsx:121`:

```ts
window.addEventListener("keydown", onKey, true);   // ← CAPTURE phase
// … routeWorkbenchKey(...) … if (decision.kind !== "open-launcher") return;
// event.preventDefault();
```

Capture phase plus `preventDefault()` means **the workbench sees the key first
and the editor never sees it at all.** Two consequences, in §7.3.

---

## 3. `@hyperslop-systems/pbui-workbench` — tiles, views, applications

*Source:* `pbui/packages/pbui-workbench/` · *Version 0.3.1*

You need this only to understand what an "app" is, because
`pbui-editor` optionally exports one and `pbui-sandbox` already does.

### 3.1 Five words

```
 Workspace ── a named binary split tree
      │
 Node ─┬─ split { direction: row|col, ratio, a: Node, b: Node }
       └─ leaf  { viewId }            ← a PLACEMENT: one rectangle on screen
                       │
 AppView { id, appId, documents: Record<string,string>, title? }   ← the LOGICAL view
                       │
 AppDescriptor { id, title, tone, singleton, docBound, bindings, Component }
```

A **placement** is a rectangle. A **view** is the thing shown. Two placements
naming one `viewId` are a *linked* tile — both render from one object, which is
what keeps them in lockstep. An **application** is named by `view.appId` and
nothing else; its state lives in the product's store, never in the tile. That is
what makes swapping two tiles a two-field exchange.

### 3.2 `AppDescriptor`

```ts
// packages/pbui-workbench/src/apps.ts
interface AppDescriptor {
  id: string;
  title: string;
  tone: string;                       // a var(--pbui-tone-*) reference, NEVER a hex literal
  singleton: boolean;                 // at most one logical view of this app?
  duplicable?: boolean;               // defaults to !singleton
  docBound?: boolean;                 // is it a view OF a document in view.documents?
  bindings?: string[];                // binding keys it requires; describeWorkbench reads these
  titleFor?(view: AppView): string;
  group?: string;                     // launcher grouping
  blurb?: string;
  available?(ctx: { workspaceId: string }): boolean;
  Component: ComponentType<{ placementId: string; view: AppView }>;
}
```

Registration is an explicit list — `createAppRegistry([...])`, which throws on a
duplicate id. Never import-side-effects.

### 3.3 The state model, in one paragraph

`createWorkbenchStore(document, hooks)`
(`packages/pbui-workbench/src/store.ts`) is a `useSyncExternalStore` store —
not Redux — over a protobuf `WorkbenchDocument`, plus four browser-local fields
(`workspaceId`, `activePlacementId`, `launcherOpen`, `launcherFrom`,
`rebalanceOpen`) that are deliberately **not** serialised: which transient
surface is open is this browser's business, never the layout's. Every change
goes through `mutate(mutations)`, applied atomically by the protocol's shared
applier, and `onMutate(mutations, next)` fires once per **committed** batch —
which is exactly the hook a persistence layer or an outbox subscribes to.

---

## 4. `@hyperslop-systems/pbui-sandbox` — the JS runtime

*Source:* `pbui/packages/pbui-sandbox/` · *Version 0.3.1*

This package already runs agent-written JavaScript in a tile, safely, with
devtools. This ticket adds one small module to it.

### 4.1 The pieces

| Thing | File | What it is |
|---|---|---|
| `ProgramEngine` | `src/engine.ts:48` | `load / render / event / evaluate / dispose / health`, all async |
| `createEvalEngine()` | `src/engines/` | `new Function` on the calling thread; no isolation, no timeouts |
| `createQuickJsEngine({worker})` | `src/quickjs.ts` | same contracts in QuickJS in a Web Worker, with memory/stack/time limits |
| `createQuickJsDirectEngine()` | `src/quickjs.ts` | QuickJS on the calling thread, for Node and tests |
| conformance suite | `src/engines/conformance.ts` | every engine passes the same tests, `evaluate` included |
| `createProgramLibrary({key})` | `src/library.ts` | programs in `localStorage`, per-program version history, `rollback` |
| `createProgramStateStore()` | `src/state.ts` | program state keyed by view id, so linked tiles share one state |
| `createInstanceRegistry()` | `src/instances.ts` | what is running, plus one global timeline of every load/render/event/intent/error |
| `createScriptApp(host)` | `src/createScriptApp.tsx` | the workbench app a program runs in, doc-bound to `program` |
| devtools | `src/devtools/` | inspector · REPL · timeline · playground · source+versions |
| limits | `src/limits.ts` | `DEFAULT_LIMITS`, `byteLength()` |

### 4.2 The one rule that governs the whole package

At the top of `src/contracts.ts`:

> Everything here crosses an engine boundary as JSON. No functions, no class
> instances, no host objects — that rule is what lets the same program run under
> `eval` today and QuickJS tomorrow.

Internalise that. It is why the shim in §6 is possible and why it is written the
way it is.

### 4.3 `ProgramEngine.evaluate` — the door this ticket uses

```ts
// packages/pbui-sandbox/src/engine.ts
export interface EvaluateInput {
  instanceId: string;
  code: string;
  pluginState: unknown;
  globalState: unknown;
}
export interface EvaluateResult {
  /** Already described by the bootstrap: JSON, with { $type } markers for what JSON cannot carry. */
  value: unknown;
}
```

`evaluate` exists for the REPL tile, which evaluates a line *inside* a live
instance's scope. It is the general-purpose door: arbitrary code in, a JSON
value out, errors rejected with the thrown error's name preserved. The plot
script contract in §7 is `evaluate` with a prepared scope.

### 4.4 The `definePlugin` dialect (which we are *not* using)

For context, because you will read it in the devtools:

```js
definePlugin(({ ui }) => ({
  initialState: { n: 0 },
  widgets: { main: {
    render: (state, global) => ({ kind: "panel", children: [
      { kind: "text", text: `n = ${state.n}` },
      { kind: "button", props: { label: "+1", onClick: { handler: "inc" } } },
    ]}),
    handlers: { inc: (s) => [{ scope: "plugin", actionType: "state/merge", payload: { n: s.n + 1 } }] },
  }},
}));
```

`render` is pure `(pluginState, globalState) → UINode`; handlers never mutate,
they return intents the host reduces. `UINode` is a closed union of thirteen
kinds (`panel row column text badge button input select table meter sparkline
callout ref`) rendered with pbui atoms by `src/render/UINodeRenderer.tsx`.

**There is no `plot` node in that union**, and this ticket does not add one.
See Decision D4.

### 4.5 The two tiles that want a real editor today

- `src/devtools/PlaygroundTile/PlaygroundTile.tsx` — a live-reloading draft
  editor built on `TextArea`. Its debounce-and-remount loop is worth reading;
  PBUI-PLOTSCRIPT-1 copies it.
- `src/devtools/SourceTile/SourceTile.tsx` — a read-only listing rendered as
  `<pre><ol><li><code>` with hand-built line numbers (`SourceListing`, near the
  bottom), plus versions, a `DiffHunk` between any two, and rollback.

Both become consumers of `pbui-editor`, which is how the new API gets proven on
a real call site before anything else depends on it.

---

## 5. `@hyperslop-systems/plot` — only what the shim needs

*Source:* `plot/` · *Version 0.3.1*

The full tour is in PBUI-PLOTSCRIPT-1's guide. Here is the part that determines
the shim's design.

### 5.1 A plot document is JSON

```ts
// plot/src/document.ts:377
interface PlotDocument {
  format: "hyperslop.plot";
  version: 1;
  id: PlotId;
  description?: string;
  variables: Record<VariableId, VariableSpec>;
  composition: CompositionSpec;
  layers: readonly LayerSpec[];
  scales?: ScaleMap;
  coordinate?: CoordinateSpec;
  presentation?: PresentationSpec;
  annotations?: readonly AnnotationSpec[];
  limits?: RenderLimits;
  metadata?: Record<string, JsonValue>;
}
```

### 5.2 Every authoring function is a pure object constructor

`plot/src/author/` is fourteen files of this shape:

```ts
// plot/src/author/geom.ts — the entire module, abbreviated
export const geom = {
  point: (o = {}) => ({ kind: "point", ...o }),
  line:  (o = {}) => ({ kind: "line",  ...o }),
  bar:   (o = {}) => ({ kind: "bar",   ...o }),
  // area, errorbar, ribbon, boxplot
};

// plot/src/author/plot.ts — the entire module
export function plot(input: PlotInput): PlotDocument {
  return { format: PLOT_DOCUMENT_FORMAT, version: PLOT_DOCUMENT_VERSION, ...input };
}
```

No classes. No `this`. No held state. No imports beyond types.

### 5.3 The branded IDs erase at runtime

```ts
// plot/src/document.ts:15-36
export type VariableId = string & { readonly [variableIdBrand]: true };
export function variableId(value: string): VariableId { return value as VariableId; }
export function fieldId(value: string): FieldId       { return value as FieldId; }
export function layerId(value: string): LayerId       { return value as LayerId; }
export function plotId(value: string): PlotId         { return value as PlotId; }
```

`fieldId("field:x")` is a compile-time-only cast; at runtime it is the identity
function on a string.

**Therefore:** a plain JavaScript program, with no TypeScript and no module
loader, can construct a byte-identical `PlotDocument`. A ~140-line shim
reproduces the whole authoring API exactly. That is the hinge of this ticket.

---

# PART II — THE DESIGN

---

## 6. Decision records

### D1 — a new package, not a pbui core component

**Chosen:** `@hyperslop-systems/pbui-editor` at `pbui/packages/pbui-editor/`.

*Why.* CodeMirror 6 is six packages —

```
@codemirror/state            document + selection model
@codemirror/view             the DOM view, the contenteditable surface, gutters
@codemirror/commands         defaultKeymap, history, indent commands
@codemirror/language         syntax-tree plumbing, HighlightStyle, syntaxHighlighting
@codemirror/lang-javascript  the JavaScript/JSX grammar
@lezer/highlight             the tag vocabulary a HighlightStyle maps
```

— and a few hundred kilobytes. §2.1 established that pbui core has zero runtime
dependencies on purpose. Forcing CodeMirror on `pbui-chat`, `hyperblog`,
`turboproof` and `agentlogic`, none of which want an editor, is the wrong trade.
The repo already demonstrates the pattern: `pbui-workbench`, `pbui-sandbox` and
`pbui-chat` are peer packages carrying their own dependencies, each with its own
`styles.css` export.

*Rejected:* a `CodeEditor` atom in `src/components/atoms/`. It would satisfy
`no-raw-controls.test.ts` most literally, and it would put a 300 KB dependency
in the package whose defining property is having none.

### D2 — the shim lives in `pbui-sandbox`, and `plot` is a devDependency there

**Chosen:** `packages/pbui-sandbox/src/plot/` holds the shim source, the
`ScriptResult` contract and its guard. `@hyperslop-systems/plot` is added to
`pbui-sandbox` as a **devDependency**, used only by the parity test.

*Why.* The shim is a *string of JavaScript* injected into an engine scope
(§7.2). It has no import of `plot` at runtime and must not have one — under
QuickJS there is no module loader at all. But the parity test in §8.2 needs the
real package to compare against, and a devDependency is exactly the right
strength for that: the published `pbui-sandbox` bundle carries no plot code, and
CI still fails the moment the shim drifts.

*Rejected:* putting the shim in its own package. It is 140 lines of literals and
a guard; a package for it is ceremony. `pbui-sandbox` already owns "what a
sandboxed program can see".

### D3 — `ScriptResult` is a data contract, not a `definePlugin` program

**Chosen:** a plot script is an async function body evaluated through
`ProgramEngine.evaluate()` that **returns one JSON object**:

```ts
interface ScriptResult {
  document: PlotDocument;   // required
  schema: PlotSchema;       // required
  data: PlotData;           // required
  view?: PlotViewState;     // optional initial interaction state
}
```

*Why.* `definePlugin` exists to make *interactive UI* out of a program: a pure
render, handler intents, host-reduced state. A plot script has none of those
needs — no state, no handlers, exactly one output. Forcing it into the dialect
costs the author a wrapper they gain nothing from:

```js
// as a definePlugin program — every character outside the object is noise
definePlugin(() => ({ widgets: { main: { render: () => ({ kind: "plot", props: { … } }) } } }));

// as a ScriptResult
return { document: plot({ … }), schema: { … }, data: { … } };
```

### D4 — no `plot` UINode in the sandbox's union

**Chosen:** leave `UINode` closed at thirteen kinds.

*Why.* A `PlotDocument` is a thirty-field recursive structure. Putting it inside
a node union whose other twelve members are `{ kind: "text", text: string }`
would make the union's own validator (`src/validate/uiSchema.ts`) responsible
for validating a grammar of graphics. `renderPlot` already does that, totally
and with diagnostics.

*Revisit when:* somebody wants a script that renders a plot **and** buttons.
Then the `plot` node earns its place and `ScriptResult` becomes its degenerate
case.

### D5 — the eval engine is the default; QuickJS is one line away

**Chosen:** consumers get `createEvalEngine()` unless they pass an engine.

*Why.* Every engine passes `src/engines/conformance.ts`, so the swap is a
one-line change by construction. The honest security statement, which belongs in
the package's own comment: *a user evaluating their own code in their own tab is
not a privilege escalation.* The moment a script becomes **shareable** — a
stored template, a portable bundle, an agent-authored script — QuickJS stops
being optional. Write that down where somebody about to add sharing will read
it.

---

## 7. `@hyperslop-systems/pbui-editor`

### 7.1 Package skeleton

```
packages/pbui-editor/
├── package.json          exports { ".", "./styles.css" }; deps = the six CodeMirror
│                         packages; peers = react, react-dom, @hyperslop-systems/pbui
├── tsconfig.json  tsconfig.build.json  vite.config.ts     ← copy from pbui-workbench
├── src/
│   ├── index.ts              the public surface
│   ├── CodeEditor/
│   │   ├── CodeEditor.tsx
│   │   ├── CodeEditor.module.css
│   │   ├── CodeEditor.stories.tsx
│   │   └── CodeEditor.test.tsx
│   ├── theme.ts              EditorView.theme + HighlightStyle over pbui tokens
│   ├── extensions.ts         the composed default extension set
│   ├── diagnostics.ts        EditorDiagnostic → CodeMirror decorations
│   ├── createEditorApp.tsx   optional pbui-workbench AppDescriptor factory
│   └── css.d.ts
└── README.md
```

### 7.2 The component API

```ts
export interface EditorDiagnostic {
  /** 1-based. */
  line: number;
  /** 1-based; omit to mark the whole line. */
  column?: number;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface CodeEditorProps {
  value: string;
  onValueChange(value: string): void;
  /** Becomes aria-label. Say what the document holds — follows TextArea. */
  accessibleName: string;
  language?: "javascript" | "json" | "plain";      // default "javascript"
  readOnly?: boolean;
  lineNumbers?: boolean;                            // default true
  diagnostics?: readonly EditorDiagnostic[];
  /** Mod+Enter. Omit to leave the chord unbound. */
  onRun?(value: string): void;
  /** Lines of visible content when the container does not size the editor. */
  rows?: number;
  className?: string;
}

export function CodeEditor(props: CodeEditorProps): JSX.Element;
```

The API deliberately mirrors `TextArea` (§2.2): `value` + `onValueChange(value)`,
a required `accessibleName`, an optional `rows`. A call site migrating from one
to the other changes the import and adds `language`. Do not invent a second
convention.

Also exported, for products already on the shared workbench:

```ts
export function createEditorApp(options: EditorAppOptions): AppDescriptor;
```

### 7.3 The React ↔ CodeMirror bridge

CodeMirror owns its own DOM and its own state; React must not fight it. The
reconciliation is four rules:

```
 mount        → view = new EditorView({
                  state: EditorState.create({ doc: value, extensions }),
                  parent: hostRef.current,
                })

 value prop   → if (value !== view.state.doc.toString())
                  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })

 user edit    → updateListener: if (update.docChanged) onValueChange(update.state.doc.toString())

 unmount      → view.destroy()
```

**The guard on the value effect is not optional.** Without it, every
`onValueChange` round-trip re-dispatches the whole document, the selection is
mapped through a full replacement, and the cursor jumps to position 0 on every
keystroke. It is the single most common way to get this wrong. Test it
explicitly:

```ts
it("does not dispatch when the incoming value already matches the document", () => {
  const spy = vi.spyOn(view, "dispatch");
  rerender(<CodeEditor value={same} … />);
  expect(spy).not.toHaveBeenCalled();
});
```

Props that change an *extension* rather than the document — `readOnly`,
`language`, the theme — must go behind `Compartment` instances, so a prop change
is a `reconfigure` effect rather than a remount:

```ts
const languageCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

// in the initial extensions
languageCompartment.of(javascript()),
readOnlyCompartment.of(EditorState.readOnly.of(false)),

// on a prop change
view.dispatch({ effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(next)) });
```

Diagnostics are a `StateField` over a `StateEffect`, so setting them is also a
dispatch rather than a re-render:

```ts
const setDiagnostics = StateEffect.define<readonly EditorDiagnostic[]>();
const diagnosticField = StateField.define<DecorationSet>({ … });
view.dispatch({ effects: setDiagnostics.of(next) });
```

Clamp out-of-range lines rather than throwing: a script that reports an error on
line 400 of a 12-line document is a bug in the reporter, not a reason to crash
the tile.

### 7.4 Theming from pbui tokens

```ts
// packages/pbui-editor/src/theme.ts
import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

export const pbuiEditorTheme = EditorView.theme({
  "&":                 { backgroundColor: "var(--pbui-surface)", color: "var(--pbui-ink)" },
  ".cm-content":       { fontFamily: "var(--pbui-font-mono)", caretColor: "var(--pbui-ink)" },
  ".cm-gutters":       { backgroundColor: "var(--pbui-surface-sunken)",
                         color: "var(--pbui-ink-faint)", border: "none" },
  ".cm-activeLine":    { backgroundColor: "var(--pbui-surface-raised)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground":
                       { backgroundColor: "var(--pbui-selection)" },
});

export const pbuiHighlightStyle = HighlightStyle.define([
  { tag: t.keyword,                     color: "var(--pbui-syntax-keyword)" },
  { tag: [t.string, t.special(t.string)], color: "var(--pbui-syntax-string)" },
  { tag: t.number,                      color: "var(--pbui-syntax-number)" },
  { tag: t.comment,                     color: "var(--pbui-ink-faint)", fontStyle: "italic" },
  { tag: t.function(t.variableName),    color: "var(--pbui-syntax-function)" },
  { tag: t.propertyName,                color: "var(--pbui-syntax-property)" },
  { tag: [t.operator, t.punctuation],   color: "var(--pbui-ink-faint)" },
]);
```

Every `--pbui-syntax-*` token that does not already exist must be **added to
`pbui/src/tokens.css`**, never defined locally — §2.4 explains the test that
enforces this and the silent failure it prevents. Six or seven tokens is the
right number; a full editor colour scheme in tokens is not.

### 7.5 The keyboard conflict, written down so nobody rediscovers it

Against the route table in §2.5:

| Chord | CodeMirror `defaultKeymap` | Workbench | Who wins | What to do |
|---|---|---|---|---|
| `Mod+K` | unbound | open launcher | workbench | nothing |
| `Mod+Shift+K` | `deleteLine` | open rebalance dialog | **workbench** | **remove `deleteLine` from the editor keymap** |
| `Escape` | `simplifySelection` | absent from the table | editor | nothing |
| `Mod+Enter` | unbound | absent | editor | bind to `onRun` |

`Mod+Shift+K` is the one that matters. The workbench listener is capture-phase
on `window` and calls `preventDefault()`, so `deleteLine` is silently dead. A
key that appears to be bound and does nothing is worse than one that is not
bound: strip it from the keymap and say why in a comment.

The good news: `isEditableTarget()` returns `true` for
`target.isContentEditable`, and CodeMirror 6's editing surface *is* a
`contenteditable` div. Focus detection already works.

### 7.6 The `no-raw-controls` argument, stated rather than dodged

`pbui/test/no-raw-controls.test.ts` does not reach a peer package, and
CodeMirror's surface is a `contenteditable` div rather than a form control — it
is not the thing the test polices. Put that sentence in the package README
rather than leaving a reader to wonder whether the rule was quietly evaded.

### 7.7 Bundle size

CodeMirror must not be in the critical path of a workbench that never opens an
editor. `createEditorApp`'s `Component` is a `React.lazy` boundary, and
`package.json`'s `sideEffects` lists only `**/*.css` so the rest tree-shakes.

---

## 8. The plot sandbox shim

### 8.1 What it is

`packages/pbui-sandbox/src/plot/` — three files:

```
authorShim.ts     the injected source, as a string constant
scriptResult.ts   the ScriptResult type and isScriptResult() guard
index.ts          the public surface, re-exported from the package root
```

The shim is a **string**, not a module, because it is prepended to the code the
engine evaluates. Under QuickJS there is no module loader and no bundler; under
`eval` there is no reason to behave differently. One code path, both engines —
which is the same argument `src/contracts.ts` makes about JSON.

```ts
// packages/pbui-sandbox/src/plot/authorShim.ts
/**
 * The @hyperslop-systems/plot authoring API, reproduced as source that is
 * prepended to a plot script's body.
 *
 * Every function in plot/src/author/*.ts is a pure object constructor over
 * types whose brands erase at runtime (plot/src/document.ts:15-36), so this
 * shim is exact rather than approximate — `authorShim.test.ts` asserts that
 * against the real package for every exported constructor.
 *
 * It must never import anything: under QuickJS there is no module loader.
 */
export const PLOT_AUTHOR_SHIM = `
const plot = (input) => ({ format: "hyperslop.plot", version: 1, ...input });
const layer = (input) => input;

const variable = {
  field:    (fieldId, o = {}) => ({ kind: "field", fieldId, ...o }),
  constant: (value)           => ({ kind: "constant", value }),
  derived:  (expression, o = {}) => ({ kind: "derived", expression, ...o }),
  unity:    (o = {})          => ({ kind: "unity", ...o }),
};

const value = {
  variable:  (variable) => ({ kind: "variable", variable }),
  afterStat: (output)   => ({ kind: "afterStat", output }),
  constant:  (value)    => ({ kind: "constant", value }),
};

const composition = {
  cartesian: (i) => ({
    dimensions: { ...(i.x ? { x: i.x } : {}), ...(i.y ? { y: i.y } : {}) },
    ...(i.groups ? { groups: i.groups } : {}),
    ...(i.facets ? { facets: i.facets } : {}),
  }),
  algebra: (spec) => ({ dimensions: {}, algebra: spec }),
};

const geom = {
  point:    (o = {}) => ({ kind: "point",    ...o }),
  line:     (o = {}) => ({ kind: "line",     ...o }),
  bar:      (o = {}) => ({ kind: "bar",      ...o }),
  area:     (o = {}) => ({ kind: "area",     ...o }),
  errorbar: (o = {}) => ({ kind: "errorbar", ...o }),
  ribbon:   (o = {}) => ({ kind: "ribbon",   ...o }),
  boxplot:  (o = {}) => ({ kind: "boxplot",  ...o }),
};

const stat = {
  identity:   ()        => ({ kind: "identity" }),
  summary:    (o)       => ({ kind: "summary",    ...o }),
  bin:        (o = {})  => ({ kind: "bin",        ...o }),
  regression: (o)       => ({ kind: "regression", ...o }),
  boxplot:    (o = {})  => ({ kind: "boxplot",    ...o }),
  density:    (o = {})  => ({ kind: "density",    ...o }),
};

const position = {
  identity: () => ({ kind: "identity" }),
  stack:    () => ({ kind: "stack" }),
  fill:     () => ({ kind: "fill" }),
  dodge:    () => ({ kind: "dodge" }),
  jitter:   (o) => ({ kind: "jitter", ...o }),
};

const scale = {
  linear:      (o = {}) => ({ kind: "linear",       ...o }),
  log:         (o = {}) => ({ kind: "log",          ...o }),
  temporal:    (o = {}) => ({ kind: "temporal",     ...o }),
  band:        (o = {}) => ({ kind: "band",         ...o }),
  categorical: (o = {}) => ({ kind: "categorical",  ...o }),
  colorLinear: (o = {}) => ({ kind: "color-linear", ...o }),
  size:        (o = {}) => ({ kind: "size",         ...o }),
  shape:       (o = {}) => ({ kind: "shape",        ...o }),
  opacity:     (o = {}) => ({ kind: "opacity",      ...o }),
};

const algebra = {
  variable: (variable) => ({ kind: "variable", variable }),
  unity:    ()         => ({ kind: "unity" }),
  cross:    (left, right) => ({ kind: "cross", left, right }),
  nest:     (outer, inner, o = {}) => ({ kind: "nest", outer, inner, ...o }),
  blend:    (operands, o = {})     => ({ kind: "blend", operands, ...o }),
};

const presence = {
  auto:       () => ({ kind: "auto" }),
  none:       () => ({ kind: "none" }),
  configured: (options) => ({ kind: "configured", options }),
};

const presentation = {
  compact: (o = {}) => ({
    title: presence.none(), xGuide: presence.none(), yGuide: presence.none(),
    legends: { color: presence.none(), fill: presence.none(), size: presence.none(),
               shape: presence.none(), opacity: presence.none() },
    frame: presence.none(),
    padding: o.padding ?? 2,
  }),
};

// The branded id constructors erase at runtime; they exist so a script copied
// out of the plot README runs unchanged.
const plotId = (v) => v;  const variableId = (v) => v;
const fieldId = (v) => v; const layerId = (v) => v;
`;
```

Compare each block against its source file — `plot/src/author/plot.ts`,
`variable.ts`, `value.ts`, `composition.ts`, `geom.ts`, `stat.ts`,
`position.ts`, `scale.ts`, `algebra.ts`, `presentation.ts`. The
`composition.cartesian` and `presentation.compact` blocks are the only two with
real logic; everything else is spread-into-a-literal.

`guide`, `annotation`, `coordinate` and `transform` are deliberately **not** in
the first shim — nothing in the worked examples uses them, and each one added
without a call site is one more thing to keep in step. Add them when a script
needs them, with a parity case each.

### 8.2 The parity test, which is the whole reason this is safe

```ts
// packages/pbui-sandbox/src/plot/authorShim.test.ts
import { geom, stat, scale, position, composition, value, variable, algebra,
         plot, layer, presence, presentation } from "@hyperslop-systems/plot/author";
import { PLOT_AUTHOR_SHIM } from "./authorShim";

/** Evaluate one expression against the shim alone, as a program would see it. */
const inShim = (expression: string): unknown =>
  new Function(`${PLOT_AUTHOR_SHIM}\nreturn (${expression});`)();

const CASES: Array<[string, unknown]> = [
  ["geom.point({ size: 3 })",                geom.point({ size: 3 })],
  ["geom.bar()",                             geom.bar()],
  ["stat.regression({ method: 'ols' })",     stat.regression({ method: "ols" })],
  ["scale.linear({ zero: true })",           scale.linear({ zero: true })],
  ["position.dodge()",                       position.dodge()],
  ["value.variable('v')",                    value.variable(variableId("v"))],
  ["variable.field('field:x', { label: 'X' })", variable.field(fieldId("field:x"), { label: "X" })],
  ["composition.cartesian({ x: { kind: 'variable', variable: 'a' } })",
     composition.cartesian({ x: value.variable(variableId("a")) })],
  ["presentation.compact({ padding: 8 })",   presentation.compact({ padding: 8 })],
  ["plot({ id: 'p', variables: {}, composition: { dimensions: {} }, layers: [] })",
     plot({ id: plotId("p"), variables: {}, composition: { dimensions: {} }, layers: [] })],
  // … one case per exported constructor, including every geom, stat, scale and position
];

it.each(CASES)("shim %s matches the real author API", (expression, expected) => {
  expect(inShim(expression)).toEqual(expected);
});
```

This test is what turns "a hand-copied duplicate of somebody else's API" into
something maintainable. Without it the shim rots the first time `plot` adds a
field, silently, and the failure surfaces as a diagnostic in a user's tile.

### 8.3 The `ScriptResult` contract and its guard

```ts
// packages/pbui-sandbox/src/plot/scriptResult.ts
import type { PlotData, PlotDocument, PlotSchema } from "@hyperslop-systems/plot";
//        ↑ type-only import: erased at build, so no runtime dependency is added.

export interface ScriptResult {
  document: PlotDocument;
  schema: PlotSchema;
  data: PlotData;
  view?: unknown;
}

export type ScriptResultProblem =
  | { kind: "not-an-object" }
  | { kind: "missing"; field: "document" | "schema" | "data" }
  | { kind: "bad-format"; got: unknown }
  | { kind: "bad-version"; got: unknown }
  | { kind: "not-an-array"; field: "layers" | "fields" | "rows" }
  | { kind: "too-many-rows"; got: number; limit: number };

export function checkScriptResult(
  value: unknown,
  limits = { rows: 200_000 },
): { ok: true; result: ScriptResult } | { ok: false; problem: ScriptResultProblem };
```

Return a *problem*, never throw and never a bare boolean. The tile has to tell
the author what is wrong, in their own editor, on a line if possible — a boolean
gives it nothing to say.

Everything past that guard is `renderPlot`'s job, and `renderPlot` is already
total: an authoring mistake returns the deepest successful stage plus
`diagnostics` rather than throwing (`plot/src/render.ts:33`). The guard's whole
job is to make sure the thing handed to it is *shaped* like a request.

### 8.4 The evaluation seam

```
 source (string from the editor)
     │
     ▼
 `${PLOT_AUTHOR_SHIM}\n${SCOPE_PREAMBLE}\nreturn (async () => {\n${source}\n})();`
     │
     ▼
 engine.evaluate({ instanceId, code, pluginState, globalState })
     │
     ├── resolves → checkScriptResult(value)
     │                 ├── ok    → ScriptResult, ready for renderPlot
     │                 └── !ok   → a problem the tile shows on a line
     │
     └── rejects  → toProgramError(error, "event")
                      → { code: RUNTIME_ERROR | RUNTIME_TIMEOUT | …, message }
```

`toProgramError` (`src/engine.ts`) already normalises a thrown error across the
worker boundary, preserving the error's name and detecting the timeout marker.
Reuse it; do not write a second error mapper.

The package exports one helper so a consumer never assembles that string by
hand:

```ts
export function buildPlotScriptCode(source: string, scope?: readonly string[]): string;
```

---

## 9. What this ticket does NOT do

Stated explicitly, because the boundary between this ticket and
PBUI-PLOTSCRIPT-1 is easy to blur:

- No tile, no app, no workspace. `pbui-editor` exports a component (and an
  optional descriptor factory); `pbui-sandbox` exports a shim and a guard.
- No `sql`, no data access, no DuckDB. The injected scope is extensible by the
  consumer; this ticket ships only the author API in it.
- No debounce loop, no runner, no persistence. Those are the consumer's.
- No changes to Datalab.

---

## 10. Implementation plan

### Phase 1 — `pbui-editor` scaffold (½ day)
- [ ] `packages/pbui-editor/` from `packages/pbui-workbench/`'s `package.json`, `tsconfig*.json`, `vite.config.ts`.
- [ ] Add the six CodeMirror dependencies; peers `react`, `react-dom`, `@hyperslop-systems/pbui`.
- [ ] `pnpm install` at the root; confirm the workspace picks it up.

### Phase 2 — `CodeEditor` (1½ days)
- [ ] The React bridge with the value guard (§7.3) and `Compartment`s for `readOnly` and `language`.
- [ ] `extensions.ts`: line numbers, history, bracket matching, auto-indent, `javascript()`, the `defaultKeymap` **minus `deleteLine`**, `Mod+Enter → onRun`.
- [ ] `theme.ts` (§7.4); add the `--pbui-syntax-*` tokens to `pbui/src/tokens.css`.
- [ ] `diagnostics.ts` with out-of-range clamping.
- [ ] Tests (§11) and stories: default, read-only, with diagnostics, dark, inside a tile.

### Phase 3 — the shim (1 day)
- [ ] `packages/pbui-sandbox/src/plot/authorShim.ts` (§8.1).
- [ ] `scriptResult.ts` with `checkScriptResult` (§8.3).
- [ ] `buildPlotScriptCode` (§8.4).
- [ ] `authorShim.test.ts` — one case per exported constructor (§8.2).
- [ ] Add `@hyperslop-systems/plot` as a **devDependency** of `pbui-sandbox`; verify the built bundle contains no plot code.
- [ ] Re-export from `packages/pbui-sandbox/src/index.ts`.

### Phase 4 — prove the editor on a real call site (1 day)
- [ ] Migrate `PlaygroundTile`'s `TextArea` to `CodeEditor`.
- [ ] Migrate `SourceTile`'s `SourceListing` to a read-only `CodeEditor`, keeping versions, diff and rollback untouched.
- [ ] Re-run the sandbox suite; nothing about program semantics may change.

### Phase 5 — publish (½ day)
- [ ] `pnpm --filter @hyperslop-systems/pbui-editor build` and `consumer:smoke`.
- [ ] Publish, or `link:` for local consumption by PBUI-PLOTSCRIPT-1.

---

## 11. Testing

| Level | What | Where |
|---|---|---|
| Unit | mount/unmount disposes the `EditorView` | `CodeEditor.test.tsx` |
| Unit | an external `value` change replaces the doc; an identical one does **not** dispatch | `CodeEditor.test.tsx` |
| Unit | `onValueChange` fires once per document change, never on a programmatic set | `CodeEditor.test.tsx` |
| Unit | `readOnly` and `language` reconfigure without remounting | `CodeEditor.test.tsx` |
| Unit | diagnostics land on the right lines; an out-of-range line is clamped | `CodeEditor.test.tsx` |
| Unit | `Mod+Enter` calls `onRun`; `Mod+Shift+K` does not delete a line | `CodeEditor.test.tsx` |
| Unit | **shim parity with `plot/author`, one case per constructor** | `plot/authorShim.test.ts` |
| Unit | `checkScriptResult` accepts a valid result and names the problem in ~12 malformed shapes | `plot/scriptResult.test.ts` |
| Unit | `buildPlotScriptCode` output runs under `createEvalEngine` and under `createQuickJsDirectEngine` | `plot/evaluate.test.ts` |
| Story | editor: default, read-only, diagnostics, dark, in a tile | `CodeEditor.stories.tsx` |
| Consumer | `consumer:smoke`, mirroring the other packages | `scripts/consumer-smoke.mjs` |

The shim parity test and the two-engine evaluate test are the two that actually
protect this ticket's contribution. Everything else is ordinary component
hygiene.

---

## 12. File reference index

**pbui core**
- `src/index.ts` — the stylesheet cascade, and the comment explaining it
- `src/tokens.css`, `src/tokens-defined.test.ts` — the token contract
- `src/styles-wiring.test.ts` — the asserted emit order
- `src/components/atoms/TextArea/TextArea.tsx` — the API to mirror
- `src/chrome/shortcutRouting.ts:47` — the chord table; `:96` — `isEditableTarget`
- `test/no-raw-controls.test.ts` — the rule §7.6 addresses

**pbui-workbench**
- `packages/pbui-workbench/src/apps.ts` — `AppDescriptor`, `createAppRegistry`
- `packages/pbui-workbench/src/store.ts` — the `useSyncExternalStore` store and its hooks
- `packages/pbui-workbench/src/components/Launcher/Launcher.tsx:121` — the capture-phase listener
- `packages/pbui-workbench/package.json` — the package config to copy

**pbui-sandbox**
- `packages/pbui-sandbox/README.md` — engines, hosting, devtools
- `packages/pbui-sandbox/src/contracts.ts` — `UINode`, `DispatchIntent`, the JSON-only rule
- `packages/pbui-sandbox/src/engine.ts:26` — `EvaluateInput`; `:48` — `ProgramEngine`; `toProgramError`
- `packages/pbui-sandbox/src/engines/conformance.ts` — the suite every engine passes
- `packages/pbui-sandbox/src/limits.ts` — `DEFAULT_LIMITS`, `byteLength`
- `packages/pbui-sandbox/src/devtools/PlaygroundTile/PlaygroundTile.tsx` — first migration target
- `packages/pbui-sandbox/src/devtools/SourceTile/SourceTile.tsx` — second migration target

**plot**
- `plot/src/document.ts:15-36` — the branded ids and their erasing constructors
- `plot/src/document.ts:199` — `LayerSpec`; `:211-267` — `ScaleSpec`/`ScaleMap`; `:377` — `PlotDocument`
- `plot/src/schema.ts:19` — `PlotField`; `:39` — `PlotData`
- `plot/src/author/*.ts` — the fourteen modules the shim reproduces
- `plot/src/render.ts:33` — `renderPlot`, and its totality

**Companion tickets**
- `pbui/ttmp/2026/09/01/PBUI-PLOTSCRIPT-1--*/` — the consumer, and the full system tour
- `datalab/ttmp/2026/09/01/DATALAB-WORKBENCH-1--*/` — Datalab's cutover to `pbui-workbench`
- `pbui/ttmp/2026/08/21/PBUI-AGENT-3--*/` and `PBUI-SANDBOX-1--*/` — how the sandbox came to be
