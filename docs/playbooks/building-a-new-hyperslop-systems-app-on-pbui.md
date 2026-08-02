---
Title: Building a new hyperslop-systems app on PBUI
Ticket: AGENTLOGIC-1
Status: active
Topics:
    - pbui
    - frontend
    - product
DocType: playbook
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "The structure, day-one imports, order of work, and traps for building a new single-binary application on PBUI. Consolidates the PBUI-UNIFY-001 bootstrap contract with lessons from building agentlogic after datalab-ui."
LastUpdated: 2026-08-02
WhatFor: "Start a PBUI-family application without re-deriving the layering, import stack, mount discipline, token contract, workbench protocol, or validation strategy."
WhenToUse: "Read before scaffolding a new PBUI application. Complete sections 3 and 4 on day one, section 6 while building the first tiles, and section 8 before the first browser check."
---

# Building a new hyperslop-systems app on PBUI

## What this is

`agentlogic` is the second application built on PBUI, after `datalab-ui`. It is a
single Go binary holding an HTTP API, a SQLite store, a content-addressed blob
store, a conversion pipeline and an embedded React workbench.

This playbook explains what a new application should import, what it must own,
in what order to build it, and which traps cost time in earlier products.
Everything here was paid for once. Shared PBUI chrome and interaction mechanics
must be imported rather than transcribed into each product.

---

## 1 · The shape

```
cmd/<app>/            the binary
cmd/schemagen/        the type generator (section 5)
pkg/
  cli/                cobra commands, flags, stable exit codes
  server/             the HTTP surface: routes, problem+json, auth
  store/              SQLite, forward-only migrations, one file per aggregate
  blob/               content-addressed bytes
  webui/              the embedded SPA, and the mount discipline (section 3)
  <domain>/           the thing the product is actually about
ui/
  src/
    api/client.ts     EVERY network call, in one file (section 7)
    appkit/           the tile registry contract
    apps/             one thin container per tile; all.ts is the only list
    components/       ONE FOLDER PER COMPONENT (section 6a)
      atoms/          the product's own presentation-bound primitives
      molecules/      small shared pieces
      organisms/      presentational panels: props in, pixels out
      pages/          the shell and the front door
    model/            pure derivations, no React
    store/            the world and the layout
    styles/           tokens, fonts, the product's own grammar
    fixtures/         real data for stories, from the test corpus
  .storybook/
```

**`model/` holds no React, and `organisms/` do no data fetching.** That split is
what makes both testable, and it is the first thing to erode if nobody defends
it.

**A tile is a container, not a view.** `apps/<Tile>.tsx` reads the store,
derives what a panel needs, and hands it down. The markup lives in
`organisms/`. A tile that renders three hundred lines of JSX is a tile whose
pieces cannot be storied, reused or looked at in isolation — and it is the
shape every product in this family drifts into if nobody says otherwise.

---

## 2 · The order of work

The order agentlogic went in, with the one change worth making.

| Phase | Work | Why here |
|---|---|---|
| 0 | A golden corpus: one fixture per input shape, including pathological ones | Everything downstream tests against it |
| 0 | **The design tokens** (section 4) | Get this wrong and it silently shapes every later decision |
| 0 | Generate shared types from the Go structs, with a CI staleness check | Section 5 |
| 1 | The pure model: compile, project, diff | No React and no store, so it is testable from day one |
| 1 | The tiles as panels | |
| 1 | **The presentation protocol** (section 6) | *This is the change* |
| 2 | The server: store, blobs, auth, upload | |
| 3 | Storybook | Section 9 |
| 4 | A smoke run against real data | Section 8. Earlier than feels necessary |

**The change:** the presentation protocol belongs in phase 1, beside the tiles,
not after them. agentlogic ported the tiles as read-only panels and the protocol
never arrived. Wrapping 21 sites across 14 finished tiles is a two-week retrofit;
doing it as each tile is built is nearly free.

---

## 3 · Day-one dependencies, imports, and mount discipline

A PBUI-family product shares one look, one window chrome, and one interaction
model. Start from package imports; do not copy the implementations into the
product.

```jsonc
// ui/package.json
"@hyperslop-systems/pbui": "^0.2.0",
"@hyperslop-systems/workbench-protocol": "^0.2.0" // if it has a workbench
```

Both packages install from the GitHub npm registry. The family Makefiles obtain
`NODE_AUTH_TOKEN` from Vault for `.npmrc`.

Import the stylesheets in this order:

```ts
import "./styles/reset.css";
import "./styles/tokens.css"; // product-owned; PBUI defines no values
import "@hyperslop-systems/pbui/styles.css";
import "@hyperslop-systems/pbui/components.css";
import "@hyperslop-systems/pbui/presentation-parts.css";
import "@hyperslop-systems/pbui/chrome.css";
import "./styles/scrollbars.css";
import "./styles/app.css"; // product grammar and intentional overrides, last
```

`presentation-parts.css` supplies the visible object-menu, hover, acceptance,
and mouse-documentation mechanics. `chrome.css` supplies the tile frame, drop
zone, and launcher hooks. A product may omit one only when it deliberately
styles the corresponding `data-part` contract itself.

For a single-binary Go application, preserve three route boundaries:

```
GET /{$}               the front door, an EXACT match on the empty path
GET /ui/{path...}      the SPA shell, WITH a fallback to index.html
GET /static/{path...}  the hashed bundles, with NO fallback
```

- **Do not mount the SPA at `/` with a catch-all.** Otherwise a mistyped API
  route returns HTML instead of an API 404.
- **Give `/static/` no index fallback.** A stale chunk must fail loudly rather
  than receive HTML and report a misleading syntax error.
- **Use `go:embed all:dist`.** Without `all:`, embed skips names beginning with
  `_` or `.`.

`vite.config.ts` sets `base: "/static/"` and writes `outDir` into the Go tree.
Storybook and every other consumer of that config must override both values so
it cannot overwrite the embedded bundle.

---

## 4 · The tokens, and the trap that shaped everything

**PBUI ships components that read design tokens. PBUI does not define them.**

The values live in `datalab-ui/src/styles/tokens.css`, 61 of them, and that
package does not export the file. agentlogic imported PBUI's stylesheets, defined
none, and ran for weeks with **43 tokens read and 0 defined**.

An undefined custom property makes the declaration invalid at computed-value
time, so `border: var(--pbui-border-hair)` becomes no border. Nothing fails: no
build error, no console warning. Every PBUI component rendered with no border, no
padding and no type scale, and 828 lines of hand-written CSS with 31 hex values
grew up around them to compensate.

**It also steered the architecture.** With the components rendering bare,
reaching for `IconButton` or `Toolbar` looked worse than a raw `<button>`. That
is how the application ended up using 6 of PBUI's ~28 components and none of the
presentation protocol. A CSS defect produced a component-adoption decision.

### Do this on day one

Create product-owned `reset.css`, `tokens.css`, and `scrollbars.css`, using a
current PBUI-family product as the starting vocabulary. Do not copy PBUI's
shared component, presentation, or chrome rules: import those packages as shown
in section 3. Keep tokens **before** every PBUI stylesheet.

Then **add the check that stops undefined tokens returning**:

```bash
C=$(ls dist/assets/*.css)
comm -23 <(grep -o -- 'var(--pbui-[a-z0-9-]*' $C | sed 's/var(//' | sort -u) \
         <(grep -o -- '--pbui-[a-z0-9-]*:'    $C | sed 's/:$//'  | sort -u)
```

Anything it prints is read and undefined. Nine tokens are read by `JsonBlock` and
`Dialog` that datalab does not define either; define them yourself.

### Keep your own grammar separate

`tokens.css` is product-owned but implements the shared PBUI token contract.
Put product-specific vocabulary in `app.css` and never restate a shared token
value there—the two drift the moment you do. agentlogic keeps eleven step-kind
colors and aliases everything else onto `--pbui-*`.

---

## 5 · One schema, generated

The server owns the domain types in Go and the browser needs the same types. Two
hand-written copies drift, and the drift is silent.

`cmd/schemagen` reflects over the Go structs and writes
`ui/src/model/<domain>.generated.ts`. `make schema-check` runs it in `-check`
mode and fails when the file is stale; `ci-check` depends on it.

**Do this before the frontend has types**, not after. Retrofitting means
reconciling two vocabularies that have already diverged.

---

## 6 · The presentation, chrome, and workbench protocols

This is what PBUI is *for*, and it is the layer agentlogic initially omitted.
Wire it while building the first tiles rather than retrofitting finished panels.

The presentation layering is already defined by the library:

```
@hyperslop-systems/pbui/presentation     createPbui, Presentation, ObjectMenu
  generic over <PresentationValues, Environment, Verb>
        │
        ├── datalab-ui/src/pbui/         15 descriptors
        └── <your app>/src/pbui/         yours
```

Your binding layer is five small product-owned areas:

```
types.ts       PresentationValues, and the environment a descriptor may read
verbs.ts       every action, as DATA
registry.ts    createPresentationRegistry over your descriptor map
runtime.tsx    createPbui and the product-bound runtime exports
descriptors/   one file per type
```

The runtime exports the product-bound presentation parts:

```ts
const instance = createPbui<Values, Environment, Verb>({
  registry,
  defaultEnvironment,
});
export const PbuiProvider = instance.Provider;
export const Presentation = instance.Presentation;
export const ObjectMenu = instance.ObjectMenu;
export const MouseDocLine = instance.MouseDocLine;
export const AcceptBanner = instance.AcceptBanner;
export const usePbui = instance.usePbui;
```

Two rules, both learned by datalab and both worth taking:

- **One descriptor file per type.** Do not spread one type across parallel
  `labelFor`, `describe`, and `actionsFor` conditionals.
- **Verbs are serializable data, never closures.** `actions(value, env)` remains
  pure and tests can assert its exact verb without a store, provider, or DOM.

Import shared window mechanics from PBUI:

```ts
import {
  TileFrame, DropZoneOverlay, useTileDrag,
  LauncherShell, splitDirectionFor,
  isModKey, routeWorkbenchKey, isEditableTarget,
} from "@hyperslop-systems/pbui";
```

Wrap each tile Presentation in `TileFrame` so object menus and chrome buttons
produce the same verbs. Translate `useTileDrag` swap/dock callbacks into product
verbs. Let `LauncherShell` own its dialog, combobox, and keyboard loop while the
product owns the rows and `choose()` behavior.

Protocol-backed products must also import the shared document applier:

```ts
import {
  applyMutation, splitPlacement, closePlacement, swapPlacements,
  dockPlacement, resizeSplit, snapRatio, createWorkbenchClient,
} from "@hyperslop-systems/workbench-protocol/client";
```

Do not write a local mutation applier. Extend the protobuf, implement both Go
and TypeScript sides, and add a shared fixture when a new mutation is needed.
For durable application edits, continue with
[`adding-editing-support-to-a-pbui-application.md`](./adding-editing-support-to-a-pbui-application.md).

---

## 6a · One folder per component, and split the view before you write it

**This is the section every product in the family has ignored, including the
one that wrote it.** PBUI's own `src/components` follows it exactly; `datalab`,
`agentlogic`, `turboproof` and `hyperblog`'s first draft all did not.

### The unit is a folder

```
components/atoms/Meter/
  Meter.tsx           the component, and the doc comment that argues for it
  Meter.module.css    its styles; NOT a shared stylesheet
  Meter.stories.tsx   every state it has
  index.ts            export { Meter }; export type { MeterProps };
```

Four files, every time, at every level — atom, molecule, organism, page. Copy
`pbui/src/components/atoms/Meter/` and change the names.

Each file earns its place:

- **`index.ts`** makes the import path the component's name rather than its
  spelling twice (`from "../atoms/Meter"`, not `"../atoms/Meter/Meter"`). It is
  also the seam that lets a component grow a second file without every caller
  changing.
- **`.module.css`** scopes the styles to the component. A shared `app.css` with
  `.hb-chip`, `.hb-item`, `.hb-row` in it is a global namespace: renaming a
  class means grepping, deleting a component leaves its rules behind forever,
  and two components eventually collide. Product-wide *tokens* stay in
  `styles/tokens.css`; component *rules* do not.
- **`.stories.tsx` beside the component**, not in one file per directory. A
  story is documentation, and documentation that lives away from the thing it
  documents is documentation nobody updates.

### Split the view BEFORE you write it, and reuse first

The order that works:

1. **Look for it in PBUI first.** `Button`, `TextInput`, `TextArea`, `Chip`,
   `Meter`, `EmptyState`, `Callout`, `SegmentedBar`, `DiffHunk`, `Legend`,
   `Stack`, `Toolbar`, `AppBody`, `Surface`, `Text`, `SectionLabel`, `Kbd`,
   `JsonBlock`, `Dialog`, `TileFrame` — about twenty-eight components exist. If
   you are writing a `<button>` with an inline style, the answer is already
   shipped.
2. **Then look in your own `atoms/` and `molecules/`.**
3. **Only then write a new one** — as a folder, with its stories, at the lowest
   level that makes sense.

The failure mode is not laziness, it is *momentum*: a tile starts as one file
because the first version is small, and by the time it is four hundred lines
nobody wants to take it apart. Extract as you go. A view written as
container → organism → molecules → atoms costs nothing to write in that order
and is a two-day retrofit afterwards.

**Watch for the §4 interaction.** If PBUI's components look ugly and a raw
`<button>` looks better, your tokens are undefined — go back to section 4. That
is not a styling preference, it is a defect, and acting on the preference is
how `agentlogic` ended up using 6 of PBUI's ~28 components.

### The check

There is no lint for this yet, which is why it keeps slipping. Two questions at
review time catch most of it:

- Does every `components/**` directory contain a folder rather than a `.tsx`?
- Does every component folder contain four files?

PBUI carries `test/no-raw-controls.test.ts`, which forbids a raw `<textarea>`
outside `atoms/`. A product-side equivalent — forbidding `<button>`, `<input>`
and `<textarea>` outside `components/atoms/` — is twenty lines and worth the
twenty lines.

---

## 7 · Keep every network call in one file

`ui/src/api/client.ts` holds every request. Nothing else calls `fetch`.

That is not tidiness. agentlogic promises its demo path makes no network call,
and the test enforcing it asserts that the demo modules import nothing from
`client.ts`. One file is what makes that check simple and reliable.

Any product with an offline mode, a privacy claim or an embeddable widget wants
the same seam.

---

## 8 · Test against real data, earlier than feels necessary

**The highest-value section here.**

agentlogic found twelve defects. Nine were silent, and the suite was green
through every one:

| Found by | Count |
|---|---|
| a test | 2 |
| a screenshot or a live browser | 5 |
| real data | 5 |

A synthetic corpus satisfies the invariants its author thought of. Real data does
not: a project directory long enough to overflow a 64-character slug, three
compactions in one session, a turn that answers without calling a tool, a resumed
session whose first record is a continuation marker.

### Build the smoke run

Two halves, both gated on an environment variable so CI stays green on a machine
with no data:

```bash
APP_SMOKE_DIR=~/real/data APP_SMOKE_EXPORT=/tmp/out go test ./pkg/... -run Smoke
APP_SMOKE_ARCHIVES=/tmp/out pnpm test
```

The Go half walks real inputs and exports the converted archives; the frontend
half compiles those exports. One walk feeds both, and the frontend reads the real
wire format rather than a hand-written fixture.

### Assert invariants, never counts

"Every converted session has at least one turn" holds for anybody's directory.
"The largest session has 2939 turns" holds for one machine.

### Four rules the smoke run taught

- **Never commit real data.** It holds file paths, source code and sometimes
  credentials. Add the output patterns to `.gitignore` before the first line.
- **"Not valid input" is a legitimate outcome.** Of 552 files, 258 were sidecars
  no adapter claims. Decide with the real detector, not by matching an error
  string — the wording will change and the test will not.
- **A test that mirrors the implementation asserts nothing.** The first version
  reused the compiler's own noise filter to decide whether input held work. That
  test passes whatever the filter says. Ask an independent question instead.
- **Three of my own invariants were wrong**, and real data proved it. A red
  assertion on real data is not automatically a defect in the code.

### Print the object

When a real-data assertion fails, stop reading assertion output and print the
thing. A twelve-line probe over one failing case produced:

```
s941 (index 940) freed=-247560
  removed 415 items = 217538 tok
  step.context (counted as stub):
    s941.c         kind=stub   tok=164
    ctx-overhead-2 kind=system tok=464934
```

The 464,934 answers the question in one line. No amount of staring at
`expected -247560 to be greater than 0` produces that sentence.

---

## 9 · Storybook

Copy datalab's config. Three things agentlogic added that are worth taking.

**Load real data.** The stories import the golden corpus with `?raw` and convert
it in the browser, so a story exercises the converter as well as the component.
Needs `server.fs.allow` when the corpus is outside the Vite root. A hand-written
fixture drifts from the corpus the tests use, and then a story can look correct
while the product is wrong.

**Render tiles from the registry, not from an import.** A tile self-registers and
has no default export. Looking it up by id renders what the launcher renders, and
a story fails loudly if a tile stops registering itself.

**A global toolbar control for the typeface** is worth the twenty lines. Write
the token on `document.documentElement`, not on a wrapper — a wrapper misses
anything that portals out of it. Name installed font families rather than loading
files, which keeps commercial and trial fonts out of the repository.

---

## 10 · Fonts

If the product uses a licensed typeface: **ship none, and make the platform
monospace the default.**

`--font-dir` serves the operator's own copy and `--font-url-base` points
elsewhere. The `@font-face` rules are **generated by the server**, so the default
configuration declares no face, requests nothing and logs nothing.

**Generate the preference alongside the faces.** The first version declared the
faces server-side while a committed stylesheet named the family first in
`--pbui-font`. Availability and preference then lived in two files, and the
bundle asked for a font a default deployment does not have. It worked, because
an absent family is skipped — and "what does this deployment render" could not
be answered from either file alone. One flag should decide both.

The first version put the rules in the bundle and let them 404. The CSS fallback
worked perfectly, and it logged two red console errors on every load of a default
deployment. **Console errors that are "expected" teach a reader to ignore console
errors.**

Two more:

- Serve `.woff2` and nothing else. A font package arrives with a licence-numbered
  README and the `.otf` originals beside the web formats, and the flag publishes
  whatever it is given.
- Do not use `immutable` on a name with no content hash. `/static/` bundles are
  hashed, so a year is safe there; `Regular.woff2` is the same URL at the next
  version. A year-long immutable cache also makes your own fallback untestable in
  a browser, because the cached face survives removing the flag.

---

## 11 · The traps, as a checklist

Each cost real time in agentlogic.

- [ ] **The tokens are defined.** Run the grep in section 4. This is the big one.
- [ ] **Every component is a folder of four files**, and the view was split
      into organisms and molecules before it was written. Section 6a. Every
      product in this family has skipped this; the retrofit is days.
- [ ] **The shared presentation and chrome styles are imported.** Open an object
      menu and assert fixed positioning, z-index, and viewport containment;
      accessibility-tree presence does not prove visible geometry.
- [ ] **A flex parent gives its tile a committed height.** `height: 100%` inside
      flex resolves against a height flex has not committed, and every tile
      collapses to its content. Use a one-cell grid.
- [ ] **SQLite names the violated index's COLUMNS, not the index.** Matching on
      the index name never fires, and a duplicate insert becomes a 500.
- [ ] **A view may not hold a parameter.** For per-tenant scoping, put the key in
      a TEMP table first — and a temp object lives on its connection, so take a
      dedicated one.
- [ ] **A token is a header and a session is a cookie.** Holding a working CLI
      token does not sign you into the browser; something must bridge them.
- [ ] **PBUI's `Button` is `type="button"`.** Inside a `<form>` it will not
      submit, and the form silently does nothing.
- [ ] **React flushes child effects before parent effects.** A provider that
      initialises state in its own effect always beats a child setting it on
      mount.
- [ ] **Window every table, and check the ordering.** Real data produced 4380
      rows in one tile. A plain window over insertion-ordered data hid 636 of 638
      rows the tile existed to show — the fix would have been a regression.
- [ ] **Measure the thing you meant to measure.** Three times on this project a
      number looked impossible and was a number about something else: a click
      that never moved the playhead, a row count spanning three tiles, and a font
      width that cannot distinguish two monospaces with the same advance.

---

## 12 · Write it down as you go

Two documents, both of which paid for themselves.

**A diary**, in the `diary` skill's format, written when the work happens. It is
why this playbook could be written at all: every defect, how it was found, and
which test guards it.

**A next-steps document** naming the open work in order, each item with entry
points, open decisions and what "done" means. A list of checkboxes is not a
handoff — `tasks.md` said "port the P0 tiles", it was ticked, and the tiles were
built as panels with the interaction model missing entirely.

**State acceptance as a gesture** wherever a checkbox could be true while the
work is half done. "Right-click every kind of object a tile draws and get its
verbs" cannot be ticked by a tile that merely renders.
