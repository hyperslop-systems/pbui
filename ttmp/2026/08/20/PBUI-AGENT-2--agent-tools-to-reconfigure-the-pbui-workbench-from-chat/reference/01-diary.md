---
Title: Diary
Ticket: PBUI-AGENT-2
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - backend
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-chat/demo/src/apps/InventoryApp/InventoryApp.module.css
      Note: The min-width:0 chain that keeps a five-column table scrolling inside its tile instead of pushing past the splitter — failure mode R6 (commit 531df03)
    - Path: repo://packages/pbui-chat/demo/src/apps/InventoryApp/InventoryApp.tsx
      Note: Duplicable data tile; every sku cell is a <product> Presentation, which is what lets an agent-placed tile join accept mode (commit 531df03)
    - Path: repo://packages/pbui-chat/demo/src/apps/MetalsApp/MetalsApp.tsx
      Note: Singleton board; a pure function of the world, so a linked placement has nothing it could show differently (commit 531df03)
    - Path: repo://packages/pbui-chat/demo/src/apps/NotesApp/NotesApp.tsx
      Note: The only caller of documentPut/documentDelete; the debounce, the cap-at-input, the re-seed fence, the unmount flush and the document_in_use demonstration all live here (commit 531df03)
    - Path: repo://packages/pbui-chat/demo/src/apps/SkuApp/SkuApp.tsx
      Note: Doc-bound tile; defines SKU_BINDING and skuTitle. Holds no state, which is what makes 'identical bindings → go to' safe (commit 531df03)
    - Path: repo://packages/pbui-chat/demo/src/apps/createDemoApps.ts
      Note: The four AppDescriptors in one screen — singleton/docBound/duplicable per §7's table; bindings omitted because AppDescriptor had no such field yet (commit 531df03)
    - Path: repo://packages/pbui-chat/demo/src/pbui/descriptors/tile.ts
      Note: 'B2: createTileDescriptor bridged to the chat layer''s wire Reference (dfbab54)'
    - Path: repo://packages/pbui-chat/demo/src/pbui/verbs.ts
      Note: 'B2: the workbench verb kinds, spelled as the package spells them (dfbab54)'
    - Path: repo://packages/pbui-chat/demo/src/workbench.ts
      Note: Registers the four beside createChatApps(chat); also the onMutate that persists the WHOLE document to localStorage, which is why NotesApp is debounced and capped (commit 531df03)
    - Path: repo://packages/pbui-chat/demo/src/world.ts
      Note: TS mirror of pkg/chatserver/demo/data.go plus the four presentation-reference builders; the drift risk this step introduced (commit 531df03)
    - Path: repo://packages/pbui-chat/src/tools/workbenchTools.test.ts
      Note: Step 5 policy bypass and raw replacement regressions (commit af8262e)
    - Path: repo://packages/pbui-chat/src/tools/workbenchTools.ts
      Note: |-
        B1: the six tools, the policy envelope and the undo ring (1c65426)
        Step 5 central policy door and exact raw-batch approval (commit af8262e)
    - Path: repo://packages/pbui-workbench/src/describe.ts
      Note: 'B0: the read side an agent addresses verbs from (13734a1)'
    - Path: repo://packages/pbui-workbench/src/store.ts
      Note: Step 5 separates commit from post-commit hook failure (commit 1be63cf)
    - Path: repo://packages/pbui-workbench/src/workbench.test.ts
      Note: Step 5 post-commit failure regression (commit 1be63cf)
    - Path: repo://pkg/pbuichat/prompt.go
      Note: 'B2: the workspace prompt section, gated on the tile type (668759d)'
ExternalSources: []
Summary: 'Implementation diary for PBUI-AGENT-2: what was built step by step, what failed and with which exact errors, what was tricky and why, and how to review each piece.'
LastUpdated: 2026-08-20T19:32:39.215373256-04:00
WhatFor: Let a second engineer resume this ticket without re-deriving the reasoning, and give a reviewer the failure record that a green working tree hides.
WhenToUse: Read before continuing any tier of PBUI-AGENT-2, and before reviewing a commit on this ticket — each step names where to start and how to validate.
---




# Diary

## Goal

Record the implementation of PBUI-AGENT-2 — giving the PBUI chat agent tools that build and rearrange the user workspace — one step per tier, including the failures, the sharp edges, and the decisions that a diff cannot show.

## Step 1: B3 — four demo tile types

B3 is the product half of the ticket. Everything else in PBUI-AGENT-2 gives the agent verbs for placing tiles; B3 gives it something worth placing. Until now the only applications a workbench held were the chat's own machinery — the conversation, the inspector, the watchlist, the trace, the widget outlet — so "make me a workspace with tiles X" could only ever rearrange the debugger. Four product applications (`inventory`, `sku`, `metals`, `notes`) fix that, and per the guide's §7 each one exists because it exercises a mechanism nothing else in the product exercises: a duplicable data tile whose rows are presentations, a doc-bound detail tile, a singleton, and the first-ever caller of the `WorkbenchDocument.documents` half of the protocol.

The step also introduced `demo/src/world.ts`, a hand-written TypeScript mirror of `pkg/chatserver/demo/data.go`, because every one of the four tiles needs the same eight SKUs the scripted engine resolves `[[product:2049]]` against. That mirror is the most fragile thing this step added and it is called out below at length: nothing enforces the correspondence in either direction, and a disagreement does not crash — it makes a tile and a chat message quote different stock for the same SKU, both looking authoritative.

### Prompt Context

**User prompt (verbatim):** (see the PBUI-AGENT-2 guide §7)

**Assistant interpretation:** Build the four demo applications §7 specifies (`inventory`, `sku`, `metals`, `notes`) inside `packages/pbui-chat/demo/src/apps/`, mirror the Go demo world into `demo/src/world.ts`, and register the four alongside `createChatApps(chat)` in `demo/src/workbench.ts` — touching nothing else, because two other agents were working concurrently in `packages/pbui-workbench/src/` and in `agentlogic/`.

**Inferred user intent:** Make the agent's layout tools demonstrable on a real product surface rather than on the chat's own debugger, and in doing so give the workbench package's untested contracts (doc-binding, singletons, linked placements, the document payload map) their first product-side caller.

**Commit (code):** `531df03` — "PBUI-AGENT-2 B3: four demo tile types, and a TS mirror of the demo world"

> **Note on that commit.** The coordinator's instruction sequence changed twice mid-flight: first "do not commit", then "commit at appropriate intervals", then "do NOT commit or edit any code file, I am committing your work right now". The commit above landed under the second instruction, moments before the third arrived. The tree is otherwise untouched since. If the coordinator's own commit of the same files collides, `531df03` is the one to keep or drop — the content is identical either way.

### What I did

- Read the guide's §7 in full, then `packages/pbui-workbench/src/apps.ts` (the `AppDescriptor` contract), `packages/pbui-chat/src/apps/createChatApps.tsx` and `WidgetApp/WidgetApp.tsx` (the register and the binding-constant pattern), `demo/src/pbui/{types,runtime,descriptors/*}.ts` (the value shapes a presentation must carry), and `pkg/chatserver/demo/data.go` (the world).
- Read the four structural tests that police this code before writing any of it: `packages/pbui-chat/test/{no-raw-controls,no-hex,component-folders,grid-columns}.test.ts`. `no-raw-controls` and `no-hex` cover `demo/src`; `component-folders` and `grid-columns` do not, but I followed both anyway.
- Inventoried the available pbui components with `ls src/components/{atoms,molecules,organisms,foundation,layout}` and read the props of `Meter`, `Sparkline`, `SegmentedBar`, `Chip`, `Callout`, `EmptyState`, `SelectInput`, `Button`, `TextArea`, `Stack`, `Surface`, `Toolbar`, `Text` rather than guessing signatures.
- Wrote `demo/src/world.ts`: `WorldProduct`/`WorldCategory`/`WorldMetal`/`WorldOrder`, the four data tables transcribed from `data.go`, `productById`/`lowStock`/`isLowStock` mirroring `demo.ProductByID`/`demo.LowStock`, and four reference builders (`productReference`, `metalReference`, `categoryReference`, `orderReference`).
- Wrote four applications, one folder each with `Name.tsx` + `Name.module.css` + `index.ts`: `InventoryApp`, `SkuApp` (exporting `SKU_BINDING`, `skuTitle`), `MetalsApp`, `NotesApp` (exporting `NOTE_BINDING`, `NOTE_FORMAT`, `NOTE_SCHEMA_VERSION`, `noteTitle`, `readNote`).
- Wrote `apps/createDemoApps.ts` returning the four `AppDescriptor`s and `apps/index.ts` re-exporting the binding constants.
- Made exactly one change to `demo/src/workbench.ts`: `apps: [...createChatApps(chat), ...createDemoApps()]`.
- Verified with the three gates from the brief, plus two throwaway checks I ran and then deleted (an applier round-trip script and a jsdom render test) — both reproduced verbatim under *Technical details*.

### Why

- **`inventory` is duplicable and its filters are `useState`, not chat-store state.** That is the visible difference between it and the singleton board: two inventory tiles side by side filter independently. If the filters lived in the chat store, a "duplicable" tile would behave exactly like a singleton and the flag would be decorative.
- **Every `sku` cell is a `<product>` presentation, not text.** This is the whole trick of §7.1: a tile the *agent* placed immediately joins accept mode, the object menu and the mouse-doc line with no code beyond the wrapper, and it is the same object the model writes as `[[product:2049|…]]` in prose. A tile printing the id as text would look identical on screen and participate in nothing.
- **`sku` holds no state at all** — everything it draws is a function of `view.documents.product`. That is what makes `openView("sku", {product:"2049"})` twice safely "go to the existing tile", and what makes `duplicable: false` correct: splitting links a second placement of one view rather than cloning a detail panel.
- **`metals` draws a pure function of the world and nothing else.** A singleton's two guarantees (the launcher offers "go to"; a split makes a linked placement) are invisible in a tile whose content varies per placement. There must be nothing here a second copy *could* show differently.
- **`notes` exists to be the first caller of `documentPut`/`documentDelete`.** The layout half of the protocol (`views`, `nodes`, `workspaces`) is proved by every other tile; the payload map and the applier's `document_in_use` guard had no caller in the product at all.
- **The reference builders live in `world.ts`, not in the tiles.** They are the only place a tile spells out a presentation value, and a shape mismatch against `demo/src/pbui/descriptors/` is *silent*: `label()` falls back to `product 2049` and "Keep only this category" quietly disables itself. Nothing throws. One place to get it right, one place to fix it.

### What worked

- **All three gates passed, and the demo typecheck passed on the first run** — including the `@bufbuild/protobuf` import I expected to fail (see below):
  - `pnpm --filter @hyperslop-systems/pbui-chat test` → 11 files, 72 tests passed
  - `pnpm --filter @hyperslop-systems/pbui-chat-demo typecheck` → clean
  - `pnpm --filter @hyperslop-systems/pbui-chat-demo build` → built in 652ms
- **Reading the descriptors before writing the value shapes paid off immediately.** The jsdom render showed `<span aria-label="1/2oz American Gold Eagle 2024" data-ptype="product">` — the real name, not the `product 2051` fallback — which is the only proof that `ProductValue`'s `stock`/`reorderPoint` (Go's `qty`/`reorderAt`) were mapped correctly. A wrong mapping renders a plausible-looking chip with a wrong label and no error anywhere.
- **The `documentPut` shape round-tripped through the real applier on the first try**, and the `documentDelete` refusal fired exactly as the tile's Callout claims. Verbatim output under *Technical details*.
- **`group: SHOP_GROUP` on all four** puts them in their own launcher section, honoured by `groupLauncherRows`, which separates product tiles from agent machinery — §7's own framing of why these apps exist.

### What didn't work

Honesty first: **I hit no compile failure and no gate failure on this step.** The end state was green on the first full run of each gate. What follows is everything that *did* go wrong or had to be reworked, in the order it happened.

**1. The `Meter` `alarm` inversion — written wrong, then fixed.** My first version of `SkuApp` was:

```tsx
<Meter
  fraction={product.reorderAt === 0 ? 0 : 1 - Math.min(1, product.qty / product.reorderAt)}
  alarm
  accessibleName={`stock ${product.qty} against a floor of ${product.reorderAt}`}
  value={`${product.qty} / ${product.reorderAt}`}
/>
```

I had inverted the fraction to a "shortfall" so that `alarm` would redden a low-stock SKU. That contradicts §7.2's mock-up (`▇▇▇░░░░░ 3 / 12`, which fills by qty against the floor) and it makes the bar mean the opposite of what it looks like. Fixed before any gate ran, by patching the file:

```
python3 - <<'PY'  # in packages/pbui-chat/demo/src/apps
...replace the Meter block and add `const low = isLowStock(product);`
PY
```

Final form: `fraction={product.reorderAt === 0 ? 1 : product.qty / product.reorderAt}`, no `alarm`, and `tone={low ? "var(--pbui-danger)" : "var(--pbui-tone-product)"}`.

**2. The throwaway jsdom render test failed on its own assertion.** Command and verbatim tail:

```
$ pnpm --filter @hyperslop-systems/pbui-chat exec vitest run src/zz-scratch-render.test.tsx

 ❯ Object.getElementError ../../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/config.js:37:19
 ❯ getElementError ../../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/query-helpers.js:20:35
 ❯ getMultipleElementsFoundError ../../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/query-helpers.js:23:10
 ❯ src/zz-scratch-render.test.tsx:28:17
     26| test("metals renders three rows", () => {
     27|   render(<Wrap><MetalsApp placementId="p2" view={view("metals")} /></W…
     28|   expect(screen.getByText("gold")).toBeTruthy();
       |                 ^

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

undefined
/home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat:
 ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command failed with exit code 1: vitest run src/zz-scratch-render.test.tsx
```

Not a product bug — but the *reason* is worth keeping. A `<Presentation>` renders `aria-label="gold"` on the wrapper AND the child span's text is `gold`, so testing-library's accessible-name and text-content queries both match and `getByText` sees two nodes. **Anyone writing a real test over a presentation-wrapped label must use `getAllByText`, `getByRole`, or a `testId` — `getByText` on the label will throw once the wrapper is there.** Fixed with `expect(screen.getAllByText("gold").length).toBeGreaterThan(0);`; re-run passed 4/4; file deleted.

**3. `@bufbuild/protobuf` is a phantom dependency of the demo.** `NotesApp` needs `create(MutationSchema, …)` and `create(DocumentPayloadSchema, …)`. The demo does not declare `@bufbuild/protobuf`:

```
$ ls packages/pbui-chat/demo/node_modules/@bufbuild
(no output — not installed there)

$ ls -d packages/pbui-chat/node_modules/@bufbuild && ls packages/pbui-chat/node_modules/@bufbuild
packages/pbui-chat/node_modules/@bufbuild
protobuf
```

It resolves only because `packages/pbui-chat/demo/` sits *inside* `packages/pbui-chat/`, which does declare it, so Node's upward walk finds it. Typecheck and `vite build` both pass today. I did not fix it: adding the dep to `demo/package.json` needs a `pnpm install`, which was out of scope and would have disturbed two agents mid-flight. Flagged for review.

**4. `AppDescriptor.bindings` did not exist when I wrote the descriptors.** §7.2's snippet writes `bindings: [SKU_BINDING]` and calls it "the new field from §5.4", but at the time:

```
$ grep -rn "bindings" packages/pbui-workbench/src/apps.ts
packages/pbui-workbench/src/apps.ts:38:   * workbench then treats a second `openView` with identical bindings as
packages/pbui-workbench/src/apps.ts:42:  /** The title of ONE view; defaults to `title`. …
```

— comments only, no field. Writing it would have been a compile error, so I omitted it from `sku` and `notes`. **The field has since landed as part of B0.** The coordinator is adding `bindings: [SKU_BINDING]` and `bindings: [NOTE_BINDING]` during integration; the descriptors as committed do not have them.

### What I learned

- **`Meter`'s `alarm` encodes a direction, not just a colour.** It reddens a bar past 0.75/0.9 *full*. Any meter whose "bad" state is an *empty* bar must not use it — the atom's own story says as much ("a meter showing 12 of 30 lessons complete does not want it"), and the tone prop is the escape hatch. `var(--pbui-danger)` is a legal token, so signalling danger without `alarm` costs nothing.
- **The demo's tone tokens are hex literals in exactly one exempt file** (`demo/src/styles/tokens.css`, whitelisted in `no-hex.test.ts` as `TOKEN_SHEETS`). Everything else, including a `tone=` prop in TSX, must be a `var()` reference. `no-hex` scans `.tsx` for quoted hex strings, so a colour passed as a prop is caught the same as one in CSS.
- **`Reference` values must be type *aliases*, not interfaces**, to satisfy `Record<string, unknown>` where a verb carries one — `demo/src/pbui/types.ts` says so in a comment and it is why `ProductValue` and friends are `type X = {…}`. My `world.ts` builders lean on that.
- **`defaultLauncherRows` deliberately skips `docBound` apps** ("a doc-bound application is a view OF something; with no document to bind it would open empty. Those arrive through `openView`"). So `sku` and `notes` are *not* reachable from the launcher by design — only through the agent's tools or an object menu. That is correct, but it means a reviewer pressing Mod+K will not see them and may think the registration failed.
- **`store.mutate` returns only a boolean.** The `MutationError`'s `code`/`path`/`detail` go exclusively to the store's `onRejected` callback, which the demo wires to a `console.warn`. A component cannot recover the reason for a refusal; it can only know *that* one happened. That constrained the notes tile's error UI.
- **Grid items are blockified**, so `text-align: right` on a `<Text>` (a `<span>`) works when it is a direct grid child — which is what `MetalsApp`'s `.spot` relies on.

### What was tricky to build

**1. The note cap had to be applied at input, not at save — and getting that backwards is an infinite write loop.**
*Cause:* the save effect fires whenever `draft !== written.current`. *Symptom I reasoned my way to before writing it:* if `save()` capped the text (`written.current = text.slice(0, MAX)`) while `draft` kept the full string, the two could never converge, so the effect would re-arm on every render and fire a **whole-document localStorage write forever** — a hot loop that only manifests after someone types 4001 characters, i.e. never in review. *Fix:* cap in `onValueChange` (`setDraft(next.slice(0, MAX_NOTE_CHARS))`) plus `maxLength` on the `TextArea`, so `draft` is *structurally* incapable of exceeding the cap and `written`/`draft` always converge. The reasoning is a comment on the exact line.

**2. Why the debounce and the cap exist at all is not "performance" — it is silent total layout loss.**
*Cause:* `demo/src/workbench.ts` persists the **whole** document to `localStorage` on every committed batch (`onMutate: () => persistDocument()`), and on boot does `parseDocument(storage()?.getItem(KEY)) ?? defaultLayout()`. *Symptom this defends:* a note large enough to hit the per-origin quota, or a half-written entry, makes `parseDocument` return `null` — and the fallback silently resets **every workspace, split ratio and view** to the four default tiles, with no message. The user loses their layout, not their note, which is the wrong thing to lose and the wrong place to look for the cause. *Fix:* 500 ms debounce (writes proportional to sentences, not characters) plus a 4000-char cap that keeps one note far below any plausible quota. Both numbers carry that reasoning in a comment block at the top of the file.

**3. Re-seeding the editor from the document without stomping the caret.**
*Cause:* the tile must re-seed when the payload changes underneath it (the tile was rebound to another note, or the **agent** wrote one), but the tile is also what writes the payload — so a naive `useEffect` on `stored.text` re-seeds from the tile's own save. *Symptom:* the caret jumps to the end of the textarea on every debounce tick. *Fix:* a `written` ref holding the last text this tile committed, set synchronously inside `save()`. The re-seed effect is fenced on `stored.text !== written.current`, so a save the tile just made is recognised as its own echo and ignored.

**4. A tile closed mid-sentence ate the sentence.**
*Cause:* the debounce timer is cleared by the effect's cleanup, which also runs on unmount, so up to 500 ms of typing died with the component. *Fix:* an `owed` ref holding the pending `{id, text}`, plus a `flush` ref refreshed in an unconditional effect and invoked from a mount-only cleanup (`useEffect(() => () => flush.current(), [])`). The indirection through a ref is what lets the empty-dependency cleanup see the *current* pending text rather than the one captured at mount.

**5. Demonstrating `document_in_use` requires deliberately doing the wrong thing.**
*Cause:* the applier refuses `documentDelete` while any view binds the payload — and the notes tile *is* such a view, so the tile can never successfully delete its own note. *Symptom, if handled naively:* a "Discard note" button that is always disabled, or one that silently does nothing. *Fix:* leave the button live, treat `mutate() → false` as the expected outcome, and render a `Callout` naming the guard by name and pointing at the console line the demo's `onRejected` writes (since the boolean carries no detail). The refusal **is** the demonstration §7.3 asks for. I verified against the real applier before shipping — output verbatim below.

**6. Making a wide table live inside a tile without pushing the tile past its splitter.**
*Cause:* a tile body is a flex/grid child, whose default `min-width` is `auto` ("never shrink below my content"). *Symptom this is the known repro for* (the guide's failure mode R6, previously seen in `ChatApp.module.css`): a five-column table widens its tile and squeezes the neighbouring tile off screen instead of scrolling inside itself. *Fix:* `min-width: 0; min-height: 0` at every level of `InventoryApp`'s chrome, the horizontal scroll owned by exactly one `.scroll` container, and `max-width: 32ch` on the one column allowed to be wide (`name`) so it truncates rather than growing the table. `SkuApp.module.css` and `MetalsApp.module.css` state `grid-template-columns` explicitly with `minmax(0, 1fr)` on the track that must be allowed to shrink — an implicit track is `auto` and would let a 160px sparkline or a long accessible label set the column width.

### What warrants a second pair of eyes

- **`@bufbuild/protobuf` is undeclared in `demo/package.json`** and resolves only through the demo's position inside `packages/pbui-chat/`. It works today under this pnpm layout and would break if the demo ever moved or if pnpm's resolution tightened. **Recommend adding `"@bufbuild/protobuf": "2.11.0"` to `packages/pbui-chat/demo/package.json` before merge.** This is the single most likely thing in the step to break someone else's checkout.
- **`world.ts` drifting from `data.go`.** Nothing enforces it, in either direction. The vocabulary has a generator (`pnpm vocab` writes `pkg/chatserver/demo/vocabulary.json` from `src/pbui/vocabulary.ts`, and a Go test fails on disagreement); the world has nothing. Two ranked fixes:
  1. *(preferred)* A Go test that `json.Marshal`s `demo.Products`/`Categories`/`Metals`/`Orders` against an embedded `world.json`, plus a `scripts/import-world.ts` that regenerates `world.ts` from that file — the exact mirror of the existing vocabulary flow, one generator in each direction.
  2. *(cheap)* A Go test asserting `len(demo.Products) == 8` and the exact id set. Catches the common case (someone adds a SKU) with no new machinery.
- **`duplicable: false` on `notes` is my call, not §7's.** §7's table specifies `singleton`/`docBound`/bindings for all four but says nothing about `duplicable` for `notes`. My reasoning: cloning a doc-bound view mints a second view with *identical bindings*, which directly contradicts the "identical bindings → go to the existing tile" rule the same app is meant to demonstrate. Splitting should link. Worth a second opinion.
- **`group: SHOP_GROUP` on all four** changes the launcher for the *existing* chat apps too — they now fall into the default `NEW TILE` group while the shop's four get their own section. Intended, and consistent with §7's framing, but it is a visible change to a surface I was not asked to touch.
- **The `sku` stock meter's tone choice** (`var(--pbui-danger)` at or below the floor) is a deliberate departure from `Meter`'s `alarm`; see *What was tricky* #1. If the design system later grows a "low is bad" mode, this should move to it.

### What should be done in the future

- Add `bindings: [SKU_BINDING]` and `bindings: [NOTE_BINDING]` to the two doc-bound descriptors now that `AppDescriptor.bindings` exists (coordinator is doing this during integration).
- Declare `@bufbuild/protobuf` in `demo/package.json`.
- Add one of the two `world.ts` ↔ `data.go` drift guards above.
- Consider Storybook stories for the four tiles. `component-folders.test.ts` requires a story per component but covers `packages/pbui-chat/src` only, and the demo has no Storybook config — so this needs a config decision first, not just four files.
- `notes` currently reads and writes `{text, updatedAt}`. If the agent is going to pre-fill a note with a research answer (§7.3's motivating use), the payload probably wants a `source`/`provenance` field so the tile can show where the text came from.
- The metals board would be a better demonstration with a real spot-price delta. That needs `data.go` to carry one; inventing it browser-side would let the chat contradict the tile.

### Code review instructions

**Where to start, in this order:**

1. `/home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/demo/src/world.ts` — read the header comment first. Then check the four data tables against `pkg/chatserver/demo/data.go` field by field (Go's `Category` is a category *id*, spelled `categoryId` here), and check the four reference builders against `demo/src/pbui/types.ts` (`ProductValue.stock`/`reorderPoint` ↔ Go `Qty`/`ReorderAt`) and `demo/src/pbui/descriptors/*.ts`.
2. `demo/src/apps/createDemoApps.ts` — the four descriptors in one screen. Check `singleton`/`docBound`/`duplicable` against §7's table.
3. `demo/src/apps/NotesApp/NotesApp.tsx` — the only file with real logic. Read the `SAVE_DEBOUNCE_MS`/`MAX_NOTE_CHARS` comment block, then the `written`/`owed`/`flush` refs, then the Discard button.
4. `demo/src/apps/InventoryApp/InventoryApp.module.css` — the `min-width: 0` chain, against the guide's failure mode R6.
5. `demo/src/workbench.ts` — one line changed.

**How to validate:**

```bash
cd /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui
pnpm --filter @hyperslop-systems/pbui-chat test           # structural tests cover demo/src
pnpm --filter @hyperslop-systems/pbui-chat-demo typecheck
pnpm --filter @hyperslop-systems/pbui-chat-demo build
```

**By hand, in the browser** (`make chat-serve`, then `devctl up`):

- Mod+K → the shop's four apps appear in their own launcher group; **`sku` and `notes` are deliberately absent** (`defaultLauncherRows` skips `docBound` apps). Do not read that as a registration failure.
- Place `inventory` twice; filter one by metal. The other must be unaffected — that is `duplicable` working.
- Place `metals`; press Mod+K again — it must offer "go to", not a second board. Split its tile — both rectangles must be the same board (a linked placement).
- Right-click a SKU cell in `inventory` — the object menu must show the product's real name, not `product 2049`. That is the whole value-shape correctness check.
- In a `notes` tile: type, wait ~½ s, reload the page — the text must survive (it went through `documentPut` into the document, and the document into localStorage). Then press "Discard note" — it must **refuse** with the Callout, and the console must carry `layout change refused: document_in_use at documentDelete.documentId — …`.

### Technical details

**The four descriptors, verbatim as committed** (`demo/src/apps/createDemoApps.ts`):

```ts
export const SHOP_GROUP = "GOLD COIN SHOP";

defineApp({ id: "inventory", title: "inventory", tone: "var(--pbui-tone-product)",
  singleton: false, group: SHOP_GROUP,
  blurb: "the eight SKUs, filterable by metal and category",
  Component: InventoryApp })

defineApp({ id: "sku", title: "SKU", tone: "var(--pbui-tone-product)",
  singleton: false, docBound: true, duplicable: false, group: SHOP_GROUP,
  blurb: "one SKU: stock against its floor, 30-day sales, metal and category",
  titleFor: skuTitle,        // view.title || "2049 · 1oz American Gold Eagle 2024"
  Component: SkuApp })

defineApp({ id: "metals", title: "metals", tone: "var(--pbui-tone-metal)",
  singleton: true, group: SHOP_GROUP,
  blurb: "spot prices and share of stock value",
  Component: MetalsApp })

defineApp({ id: "notes", title: "notes", tone: "var(--pbui-tone-neutral)",
  singleton: false, docBound: true, duplicable: false, group: SHOP_GROUP,
  blurb: "a scratchpad kept in the workbench document itself",
  titleFor: noteTitle,       // view.title || "notes · n-gold-desk"
  Component: NotesApp })
```

`bindings` is absent from `sku` and `notes` because `AppDescriptor` had no such field at the time; it exists now (B0) and is being added during integration.

**Binding constants:**

| constant | value | defined in | re-exported from |
|---|---|---|---|
| `SKU_BINDING` | `"product"` | `apps/SkuApp/SkuApp.tsx` | `apps/SkuApp`, `apps/index.ts`, `apps/createDemoApps.ts` |
| `NOTE_BINDING` | `"note"` | `apps/NotesApp/NotesApp.tsx` | `apps/NotesApp`, `apps/index.ts`, `apps/createDemoApps.ts` |
| `NOTE_FORMAT` | `"pbui.note"` | `apps/NotesApp/NotesApp.tsx` | `apps/NotesApp`, `apps/index.ts` |
| `NOTE_SCHEMA_VERSION` | `1` | `apps/NotesApp/NotesApp.tsx` | `apps/NotesApp`, `apps/index.ts` |

**The exact `documentPut` shape the notes tile sends:**

```ts
create(MutationSchema, {
  body: {
    case: "documentPut",
    value: {
      document: create(DocumentPayloadSchema, {
        id,                          // view.documents[NOTE_BINDING]
        format: NOTE_FORMAT,         // "pbui.note"
        schemaVersion: NOTE_SCHEMA_VERSION,
        body: { text, updatedAt: new Date().toISOString() },
      }),
    },
  },
})
```

`DocumentPayload.body` is a `google.protobuf.Struct` typed in TS as `JsonObject`, so a plain object literal is the correct value — no `structFrom` helper is needed or available.

**Throwaway check #1 — applier round-trip.** Written to `packages/pbui-chat/.scratch-doc-check.mjs`, run with `node packages/pbui-chat/.scratch-doc-check.mjs`, then deleted. It built the exact mutation above against `singleTile("notes", { documents: { note: "n-gold-desk" } })` and then attempted the delete. Verbatim output:

```
after put: {
  "n-gold-desk": {
    "$typeName": "hyperslop.pbui.workbench.v1.DocumentPayload",
    "id": "n-gold-desk",
    "format": "pbui.note",
    "schemaVersion": 1,
    "body": {
      "text": "reorder 2049 before Friday",
      "updatedAt": "2026-08-20T14:22:00.000Z"
    }
  }
}
delete refused as expected: document_in_use documentDelete.documentId — view "v-b9c59f2e-d49b" binding "note" references document
```

That is the evidence for two claims that are otherwise unverifiable from the diff: `readNote` reads `body.text`/`body.updatedAt` off the shape the applier actually stores, and the Callout's wording matches the guard that actually fires.

**Throwaway check #2 — jsdom render.** Written to `packages/pbui-chat/src/zz-scratch-render.test.tsx` (inside `src/` so the package's vitest `include` picked it up), run with `pnpm --filter @hyperslop-systems/pbui-chat exec vitest run src/zz-scratch-render.test.tsx`, then deleted. Four assertions, final run `Test Files 1 passed (1) / Tests 4 passed (4)`:

- `inventory` renders `2049` and the footer `8 of 8 SKUs`; the DOM shows `<span aria-label="1/2oz American Gold Eagle 2024" data-part="presentation" data-pbui="presentation" data-ptype="product">` — the descriptor is reading the value shape correctly.
- `metals` renders three rows, `2298.40` for gold.
- `skuTitle(view)` returns `2049 · 1oz American Gold Eagle 2024`; the tile renders `3 / 5` and `sold 75`.
- `notes` renders `getByLabelText("note n1")` and the `not saved yet` footer, wrapped in a `WorkbenchContext.Provider` (`useWorkbench()` throws outside a Surface).

Setup needed to render these outside the app: `<pbui.Provider environment={{ canApprove: true, sessionId: null }} perform={() => {}}>` from `demo/src/pbui/runtime`, plus `WorkbenchContext.Provider` for `NotesApp` only.

**Deviations from §7, with reasons** (also in the commit message):

| # | Deviation | Why |
|---|---|---|
| 1 | `metals` has 3 rows, no palladium | `data.go` has 3 metals; a 4th gives the agent a `[[metal:palladium]]` the resolver answers with `<unresolved>` |
| 2 | `metals` bar is share-of-stock-value, not a ▲/▼ delta | the Go world carries `shareOfStockValue` and no delta; an invented percentage is a number the resolver cannot back |
| 3 | `sku` meter uses a danger tone, not `alarm` | the bar fills by qty against the floor, so a *short* bar means trouble; `alarm` reddens a *full* bar |
| 4 | `sku`'s numbers differ from the mock (`3 / 5`, cost `2201.18`) | the mock's numbers are not the fixture's; `data.go` wins |
| 5 | `inventory` says `8 of 8 SKUs`, and adds a `low` Chip | with two filters a bare count cannot distinguish "unfiltered" from "filtered to eight"; the Chip makes the fixture's deliberately-low quantities visible |
| 6 | `notes` gained a "Discard note" button | §7.3 asks the tile to expose `document_in_use`; there is no other door to `documentDelete` |
| 7 | `sku`'s facts row adds an `<order>` presentation for `lastOrder` | one more real object in the fixture that had no presentation anywhere |
| 8 | no `.stories.tsx` files | `component-folders.test.ts` covers `packages/pbui-chat/src` only, and the demo has no Storybook config |

**Files added/changed in `531df03`:** 16 files, 961 insertions, 1 deletion.

```
demo/src/world.ts                                      (new)
demo/src/apps/createDemoApps.ts                        (new)
demo/src/apps/index.ts                                 (new)
demo/src/apps/InventoryApp/{InventoryApp.tsx,.module.css,index.ts}  (new)
demo/src/apps/SkuApp/{SkuApp.tsx,.module.css,index.ts}              (new)
demo/src/apps/MetalsApp/{MetalsApp.tsx,.module.css,index.ts}        (new)
demo/src/apps/NotesApp/{NotesApp.tsx,.module.css,index.ts}          (new)
demo/src/workbench.ts                                  (1 line: apps: [...createChatApps(chat), ...createDemoApps()])
```

## Step 2: B0 and B1 — the agent can read the screen, and act on it

Two steps, delegated and kept, in that order. **B0** (a subagent) gave the workbench an introspection API: `specOf` turns a placement tree back into the `LayoutSpec` dialect that built it, and `describeWorkbench` renders apps, tiles, tree and splits as a small object addressed by the ids the verbs take. **B1** (mine) is the six browser-side tools over that: describe, create_workspace, open_tile, switch_workspace, perform, and a raw-mutation escape hatch shipped unavailable.

The load-bearing decision is that **nothing calls `wb.verbs.*`**. Every tool performs a verb through the product's router, which validates it against the vocabulary, records the outcome — including a rejection — and stamps it `actor: "agent"`. One indirection buys the trace, and it is what makes an agent's rearrangement sit in the same panel as a human's.

### Prompt Context

**User prompt (verbatim):** "ok, use agents to get things going in parallel if possible"

**Assistant interpretation:** Fork the merged plan across subagents where the scopes do not overlap, and keep the pieces that cannot be handed off.

**Inferred user intent:** Finish more of the plan per wall-clock hour without the pieces colliding.

**Commits (code):** `13734a1` (B0), `1c65426` (B1 library half), `dfbab54` (B1 registration, with B2)

### What I did
- Briefed three subagents on disjoint scopes — B0 in `packages/pbui-workbench/src`, B3 in `packages/pbui-chat/demo/src`, C1 in the `agentlogic` repo — each with its own gates and an explicit file allow-list.
- Reviewed B0's diff myself rather than taking its report: read `describe.ts` and the `document.ts` addition end to end, then re-ran typecheck, tests, `build` and `build-storybook` (the two it was told to skip, to avoid racing B3's reads of this package's `dist`).
- Wrote `packages/pbui-chat/src/tools/workbenchTools.ts` and its 27 tests.

### Why
- The three scopes touch three different directories, and the only shared resource is `pbui-workbench`'s `dist`, which B3 reads and B0 writes. Telling B0 not to build was the whole mitigation, and it held.
- B1 could not be delegated alongside B0 because it *depends* on B0's output; and its remaining half (registration, router families) touches the same demo files as B3.

### What worked
- B0 came back green and correct, and its judgement calls were better than the brief: `MISSING_APP_ID = ""` for an unresolvable leaf (every caller that validates against the registry rejects `""` loudly, where a plausible placeholder would be re-created as a real tile), and geometry returning nothing at all rather than `Infinity` when the root box has zero area.
- Four hand-rolled depth levels for `LayoutSpecSchema` instead of `z.lazy`: the emitted JSON Schema has no `$ref`, which a test now pins. Four levels is sixteen tiles, twice the default limit, so depth is never the binding constraint.

### What didn't work
- `src/tools/workbenchTools.ts(178,9): error TS2322: Type '{ [x: string]: PolicyDecision | undefined; }' is not assignable to type 'WorkbenchPolicy'.` — spreading a `Partial<Record<K, V>>` over a `Record<K, V>` widens every value. The local is now typed `Record<string, PolicyDecision | undefined>`; `decisionFor` already answered "allow" for a kind nobody has an opinion about.
- `src/tools/workbenchTools.test.ts(10,8): error TS6133: 'Workbench' is declared but its value is never read.`
- **I committed B1 with a failing typecheck.** The command was `pnpm … typecheck 2>&1 | tail -4 && git add … && git commit`, and a pipeline's exit status is `tail`'s, so the `&&` chain saw success. Amended. The lesson is mechanical: redirect to a file and test `$?`, never `| tail` in a gating chain.
- `git commit -m "…\`create\`…"` under zsh printed `(eval):1: command not found: create` and committed the message with the backticked word *deleted*. Command substitution inside double quotes. Amended with `-F file`, which is now the rule for any message containing backticks.

### What I learned
- The `available()` closure is the whole answer to the construction-order problem. `createPbuiChat` builds its extension before the workbench exists (the workbench's apps come from `createChatApps(chat)`), and `RegisterManifestTools` skips an unavailable descriptor — so the tools are simply not offered until `attachWorkbench` runs, rather than being offered and failing.
- …but `attachWorkbench` must then call `client.tools.syncManifest()`. The manifest the server holds is refreshed on connect, on send, and on extension install; without the explicit sync the tools are invisible for exactly one message, which reads as the model ignoring them.
- A subagent's report can be stale about its own side effects. B3 reported "nothing committed" while `531df03` was already in the log — it had committed under a mid-flight instruction and reported from a summary written before. Check `git log`, not the report.

### What was tricky to build
- **Which namespace the tools emit.** The guide's §5.6 invented product verbs (`switchWorkspace`, `closeTile`) that a `local` handler would translate into `WorkbenchVerb`s. Building it, the translation layer turned out to exist only to rename things: four places to keep in step, and a trace whose verb names differ from the tool schema's. The tools now emit `WorkbenchVerb`s unchanged, with a `mapVerb` hook for a product that has its own names; the vocabulary permits dotted identifiers, so `workspace.create` is a legal verb kind. Recorded as a deviation.
- **Making `confirm` unskippable.** The first shape had the tools remember which proposal ids they had seen approved — which is self-certification: the tool decides it was allowed. It is now `isApproved(id)`, supplied by the product, defaulting to *false*. A `confirm`-policy verb is therefore refused until a product wires its proposal state, which is the right way round for a check whose entire job is to not be skippable.
- **Reporting what the verb did when the verb returns nothing.** `router.perform` yields an `Outcome`, not an id, but the model needs the new `workspaceId`/`placementId` for its next call. Both tools diff the document around the call — workspaces before/after for create, tiles before/after for open — and `open_tile` uses the absence of a new placement to report `wentToExisting`, which is the doc-bound de-dup rule surfacing as information rather than as an apparent failure.

### What warrants a second pair of eyes
- Emitting `WorkbenchVerb`s directly (above). It is a deviation from the written design and it is cheap to reverse now, expensive after a second product adopts it.
- `workbench_apply` exists, is advertised-unavailable, and its `execute` returns "not implemented". Either implement it behind the flag or delete it; a tool that would fail if reached is worse than one that does not exist.
- Every tool result is cast through `as unknown as Record<string, unknown>` to satisfy chat-provider's result type. It works and it is ugly; a generic `FrontendTool<TIn, TOut>` that does not force the cast would be better.
- `describeWorkbench` lists views from every workspace. For a product with six workspaces that is a long list in a tool result the model pays for on every call.

### What should be done in the future
- B4: the scripted scenario, the Go e2e over a bridged workbench tool, the "layout changed" widget with its Undo chip, and wiring the demo's `isApproved` to its proposal state — without that last one, no `confirm` verb can be performed at all.
- Retire the `as unknown as` casts if chat-provider's tool types can be loosened upstream.

### Code review instructions
- `packages/pbui-chat/src/tools/workbenchTools.ts`: read `checkPolicy` and `validateLayout` first (they are the safety envelope), then `createWorkspaceTool.execute` and `openTileTool.execute` for the diff-the-document pattern.
- `packages/pbui-workbench/src/describe.ts`: `measurePlacements` and its two guards; `document.ts`'s `specOf` for what it deliberately drops.
- Validate: `pnpm --filter @hyperslop-systems/pbui-workbench test` (109), `pnpm --filter @hyperslop-systems/pbui-chat test` (72), `make ci-check`.

## Step 3: B2 — the tile becomes an object, and the model is told

The demo declares `tile`, `workspace` and `app` as presentation types and the twenty workbench verb kinds, the tile descriptor comes from `createTileDescriptor`, and `SystemPromptSection` grows a `## The workspace` section gated on the vocabulary declaring `tile`. Right-clicking a tile bar in the demo now offers the same split / show-something-else / rename / close verbs the bar buttons perform — which is the third of PBUI-WORKBENCH-2 Phase 2's acceptance gesture, the one that phase could not meet on its own.

### Prompt Context

**User prompt (verbatim):** (see Step 2)

**Assistant interpretation:** Continue the plan: the vocabulary and prompt half of B2, on top of B0/B1 and Phase 2's helper.

**Inferred user intent:** Reach the point where the headline gesture — "make me a workspace with tiles X" — is one model call.

**Commits (code):** `668759d` (the Go prompt section, written ahead of the vocabulary), `dfbab54` (the TypeScript half)

### What I did
- `demo/src/pbui/types.ts`: `TileValue`, `WorkspaceValue`, `AppValue`, plus `Values` and `TONES` entries.
- `demo/src/pbui/verbs.ts`: twenty workbench kinds in the zod union with their `VERB_DOCS`; `describeVerb` delegates its default branch to `describeWorkbenchVerb`.
- `demo/src/pbui/descriptors/{tile,workspace,app}.ts`; `registry.ts`; `vocabulary.ts`; regenerated `pkg/chatserver/demo/vocabulary.json` (+181 lines).
- `demo/src/chat.ts`: twenty `FAMILIES` entries as `local`, and one `isWorkbenchVerb` branch in the local handler so a verb added to the package needs no case here.
- `demo/src/App.tsx`: `renderTitle` renders a `<tile>` Presentation.
- `pkg/pbuichat/prompt.go` + two tests, written before the vocabulary existed and gated so they stayed true either side of it.

### Why
- Writing the Go prompt section first, behind `KnowsType("tile")`, meant it could land and be tested while the TypeScript half was still being written by other hands — and `pbui-chat prompt` stayed byte-identical until the vocabulary was ready.
- The tile descriptor comes from the package rather than this product because the `disabledBecause` strings are the contract: "a workspace keeps at least one tile" must be worded identically everywhere, or the chrome buttons and the object menu disagree about what is possible.

### What worked
- The exhaustive `Record<PresentationType, …>` and `Record<VerbKind, VerbFamily>` maps turned "you forgot the new types" into two compile errors naming exactly what was missing. That is the type system doing the bookkeeping the guide asked a human to do.
- `verbSpecsFromSchema` derived all twenty verb specs from the zod union with no hand-written duplication, and `exportVocabulary` round-tripped into Go's `ParseVocabulary`/`Validate` on the first try — dotted kinds included, since `isIdentifier` permits `.` on both sides.

### What didn't work
- `src/App.tsx(111,14): error TS2741: Property 'children' is missing in type … but required in type 'PresentationProps<Values>'.` — a Presentation renders its label as children; the tile title and its `×N` badge are that content.
- `--- FAIL: TestWorkbenchPromptSectionIsGatedOnTheTileType … prompt names workbench_describe without a tile type`. **My own test's fixture went stale by the thing it was testing**: it used the demo vocabulary as the "no tile type" case, and the demo now has one. Inverted — the negative case builds a stripped vocabulary.
- Then the same test again, still failing: the stripped fixture had to drop `app` too, because that type's `idHint` is "appId, from workbench_describe" — the tool name appears legitimately outside the workspace section.

### What I learned
- A gating test whose negative fixture is production data has a half-life. The moment the product adopts the feature, the test's premise inverts. Building the negative case explicitly costs three lines and does not rot.
- `createTileDescriptor` speaking `TileRef` while the chat layer's descriptors receive a wire `Reference` is a real impedance mismatch, but a twelve-line `toTileRef` adapter is the whole of it — and it is the right place for the seam, because the reference id IS the placement id.

### What was tricky to build
- **Where the two verb namespaces meet.** `FAMILIES` is keyed by the product's `VerbKind`, which now includes the workbench kinds; the local handler needed a branch that recognises them without twenty cases. `isWorkbenchVerb` (a regex over the kind prefix, already in the package for exactly this) plus `performWorkbenchVerb` is the whole handler, and a verb added to `pbui-workbench` tomorrow needs no change here.
- **`tile.replace` is `confirm`, not `allow`.** It reads like a harmless retarget until you notice it destroys whatever the pane was showing — the same loss as a close, with no visual cue that anything was lost. It sits beside `tile.close` and `workspace.delete` in the policy.

### What warrants a second pair of eyes
- The `app` presentation type has no producer yet: nothing mints `[[app:inventory]]`, so it is a type the model is told about and cannot receive. Either the launcher's rows should carry app references, or the type should wait for B4.
- `workspaceDescriptor`'s "Rename…" emits `workspace.rename` with the CURRENT name, on the assumption that a product's inline rename supplies the real one. Performed as-is it is a no-op, which is honest but invisible.
- The tile descriptor's `extra` adds an "Ask the agent about this tile" that emits `view.goTo` — a placeholder verb, not an ask. It should emit `askAgent` with a template once the reference shape settles.

### What should be done in the future
- Wire the demo's `isApproved` to its proposal state (B4). Until then `tile.close`, `tile.replace` and `workspace.delete` are unperformable by the agent by construction — safe, and not yet demonstrable.
- Give `app` a producer, or drop it from the vocabulary.

### Code review instructions
- Read `demo/src/pbui/verbs.ts`'s workbench block and `demo/src/chat.ts`'s `isWorkbenchVerb` branch together — they are the two halves of one decision.
- `demo/src/pbui/descriptors/tile.ts` for the `TileRef` ↔ `Reference` bridge; `pkg/pbuichat/prompt.go`'s `workbenchSection` for the gating.
- Validate: `GOWORK=off go run ./cmd/pbui-chat prompt` (the section appears), `pnpm --filter @hyperslop-systems/pbui-chat-demo vocab` (regenerates clean), `make ci-check`.

## Step 4: PR #11 review — six findings, all real

Codex reviewed the branch and raised six issues. I checked each against the source before touching anything; all six held, and two of them were the kind that only matter once a model is on the other end of the API. The worst is that a *refused* verb was reported to the agent as *applied* — the handlers all refused correctly, and `performWorkbenchVerb` threw the answer away.

### Prompt Context

**User prompt (verbatim):** "Address code review issues: https://github.com/hyperslop-systems/pbui/pull/11"

**Assistant interpretation:** Fetch the review on PR #11, evaluate each finding on its merits, and fix what is real.

**Inferred user intent:** Get the branch to a mergeable state, since the publish that unblocks every remaining migration is waiting behind it.

**Commit (code):** `84f175e` — "Address PR #11 review: six findings, all real"

### What I did
- `gh api /repos/hyperslop-systems/pbui/pulls/11/{reviews,comments}` — one review body with two findings, four inline comments. Read each, then read the code it pointed at before accepting it.
- Fixed all six; added 25 tests, one group per finding.

### Why
- Every finding was a real defect, and four of the six are only reachable through the agent surface, which no existing test exercised end to end.

### What worked
- The review was accurate about code it had not run. The two P1s in particular describe failure modes that are invisible in a unit test of the handler and obvious in a tool result.
- Fixing the P1 (`performWorkbenchVerb` returning `boolean`) needed no changes to any caller that ignores the result — the chrome buttons, the launcher and the drag hook all call the handlers directly and never went through the dispatcher.

### What didn't work
- `demo/src/chat.ts(67,12): error TS1345: An expression of type 'void' cannot be tested for truthiness.` The demo compiles against `pbui-workbench`'s **`dist`**, not its source, so the new signature was invisible until the package was rebuilt. Same trap PBUI-WORKBENCH-1 §7.5 records; it will keep biting until the demo consumes source.
- One existing test failed after the fix: `expected 'no approved proposal with id "p-1" fo…' to be 'no approved proposal with id "p-1"'`. The assertion pinned the message the fix deliberately improved — the refusal now names the operation. Updated rather than reverted.
- A `python3` heredoc failed with `FileNotFoundError` because an earlier `cd packages/pbui-chat` had moved the shell. Third time this session; absolute paths are the only reliable answer.

### What I learned
- **A boolean return is API surface, not a detail.** `performWorkbenchVerb` was declared `void` because nothing needed the answer when a human clicked a button — the button is attached to the thing it operates on, so a refusal is self-evident. The moment a model is the caller, "did that work?" is the only question, and the answer had been discarded at the one place both doors meet.
- **An approval that names only itself authorises everything.** `isApproved(id)` reads like a credential check and is really a coin: one approval, any destructive verb. Passing the verb makes it a check on the actual operation, and spending the id makes it one use. Neither costs anything; both were missing because I wrote the mechanism thinking about *whether* a human agreed rather than *what* they agreed to.
- **`isWorkbenchVerb` is a shape test, not a validity test.** It matches on the `kind` prefix and nothing else, which is right for a router deciding a family and wrong for a gate deciding whether to dispatch. The protocol will happily store any string as an `app_id`, so the layer that accepts model output is the layer that has to check.

### What was tricky to build
- **Where the raw-mutation gate goes.** `workbench_apply` bypasses the per-verb policy by construction: a `MutationBatch` is not verbs, so `checkPolicy` has nothing to look at. Leaving it unimplemented was one answer and deleting it another, but the option is documented public API and a published package with a documented-but-broken option is worse than either. It now inspects the batch for the five mutation cases that destroy something a person may be reading (`workspaceDelete`, `viewDelete`, `viewClose`, `placementClose`, `documentDelete`) and requires an approval for those, so the escape hatch is not also a way around the gate.
- **Getting a real error out of `store.mutate`.** It answers `true`/`false`; the `MutationError`'s code, path and detail go to the workbench's `onRejected`, which the tools do not own. The apply tool therefore dry-runs `applyMutations` against the current document to catch the error, then commits for real. The document is immutable and replaced wholesale, so the dry run cannot affect anything — but it is two applications of the same batch, and worth knowing before anyone puts an expensive validator behind it.

### What warrants a second pair of eyes
- The destructive-case list in `workbench_apply` is a denylist. A mutation case added to the protocol tomorrow is permitted by default. An allowlist would be safer and would need touching every time the protocol grows, which is the trade; I chose the denylist because the tool is off by default and its consumer opts in deliberately.
- `verbProblem` calls `describeWorkbench` once per verb in a batch. Correct, and O(verbs × tiles); the batch limit is 8, so it does not matter yet.
- The raw tool asks `isApproved(id, { kind: "workspace.delete", workspaceId: "" })` for any destructive batch — a stand-in verb, since a batch has none. A product comparing the verb closely will not recognise it. Either the signature should admit "a raw batch", or the tool should stay off.

### What should be done in the future
- B4 still owns wiring the demo's `isApproved` to its proposal state. It is now a two-argument predicate, so the demo must record what each proposal was FOR, not just that it was approved.
- Consider having the demo consume the workspace packages from source rather than `dist`, which would have caught the `void`→`boolean` change at edit time.

### Code review instructions
- `packages/pbui-workbench/src/verbs.ts`: `performWorkbenchVerb` (every case now returns), and `openView`'s de-dup branch.
- `packages/pbui-chat/src/tools/workbenchTools.ts`: `checkPolicy`/`spend`, `verbProblem`/`appProblem`, and `applyTool` end to end.
- `packages/pbui-chat/demo/src/chat.ts`: the `isWorkbenchVerb` branch now throws on a refusal — that throw is what becomes `rejected:…` in the trace.
- Validate: `pnpm --filter @hyperslop-systems/pbui-workbench test` (114), `pnpm --filter @hyperslop-systems/pbui-chat test` (88), `make ci-check`.

## Step 5: PR #11 follow-up — one policy door and honest commit semantics

The second review found three more defects. All were real, but treating them as three local patches would have preserved the underlying problem: policy enforcement lived inside individual tool implementations. The generic tool checked policy, `workbench_create_workspace` partially checked it, `workbench_open_tile` and `workbench_switch_workspace` did not, and raw mutations used a separate destructive-case list plus a fabricated `workspace.delete` verb for approval. I replaced those paths with one high-level policy door and an explicit raw-batch approval contract.

The store finding exposed a different boundary error. `onMutate` runs after the document is committed, but its exception was caught by the same `try` as `applyMutations`; this made a persistence failure look like a rejected mutation. The store now separates apply, commit, and post-commit notification, reports hook failures through `onPostCommitError`, and always returns success for a document already installed.

### Prompt Context

**User prompt (verbatim):** "It's been a minute, but here's a new PR to review: https://github.com/hyperslop-systems/pbui/pull/11

Check all that happened in the meantime and all.

Take a step back if necessary to consider things and see if there's maybe a design problem at play here.

commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)

ticket is PBUI-AGENT-2"

**Assistant interpretation:** Re-read the current branch and ticket history, evaluate the new PR #11 comments in context rather than patching only the cited lines, fix the underlying design issue, test it, commit at coherent boundaries, and record the work in this diary.

**Inferred user intent:** Make PR #11 safe to merge after substantial intervening work, while leaving an evidence-backed continuation record and avoiding another round of one-off policy bypass fixes.

**Commits (code):** `1be63cf` — "Fix post-commit hook failure semantics"; `af8262e` — "Centralize workbench tool policy enforcement"

### What I did
- Read the complete PR commit list, both Codex reviews, all inline comments, the current ticket/task state, and this diary before changing code.
- Split `createWorkbenchStore.mutate` into three phases: apply (may reject), commit, post-commit hook (may fail but cannot uncommit). Added `onPostCommitError` and threaded it through `createWorkbench`; an injected store plus any hook remains a construction error.
- Added a regression where `onMutate` throws `Error("localStorage quota exceeded")`; the workspace still exists, the verb returns success, `onRejected` is untouched, and `onPostCommitError` receives the failure and committed document.
- Added `performWithPolicy`, the only high-level mutation dispatch path in `createWorkbenchTools`. `create_workspace`, `open_tile`, `switch_workspace`, and generic `perform` all use it; specialized schemas now accept `confirmationId` when a product overrides their normally-allow policy to `confirm`.
- Changed approval spending to happen only after an outcome is actually `performed`. A refused handler no longer burns a valid one-shot approval.
- Replaced the raw destructive denylist and fake `{kind:"workspace.delete", workspaceId:""}` approval with `rawPolicyKind` plus `isRawApproved(id, exactBatch)`. `placementReplace` and app-changing `viewConfigure` map to the default-confirm `tile.replace`; title/binding-only `viewConfigure` does not. Raw deletes map to their high-level policy, and `documentDelete` gets an explicit `document.delete: confirm` default.
- Added tests for deny and confirm overrides on specialized tools, switch-policy enforcement, exact raw-batch approval, placement/app replacement gating, and title-only configuration remaining allowed.

### Why
- A security/policy rule copied into six executors is six rules. The new comments were evidence of drift, not isolated omissions. One function must own authorization, dispatch, successful approval spending, and outcome propagation for every high-level tool.
- A post-commit callback is observation, not transaction. Once subscribers can read the new document, no exception can truthfully turn that commit into a rejection; retrying is actively dangerous because creates and splits are not idempotent.
- A raw mutation batch is not a verb. Passing a made-up verb to `isApproved` destroys the operation identity the previous review correctly required. Raw mode therefore needs a raw approval predicate over the exact decoded batch.

### What worked
- The focused store suite passed after threading the new callback through `createWorkbench`: 9 files, 115 tests.
- The focused chat suite passed with the centralized policy path and raw classification: 11 files, 93 tests.
- `make ci-check` passed after both code commits: Go formatting/lint, logcopter, glazed-lint, all Go tests, generation, and build.
- The raw classifier can distinguish `viewConfigure.appId` (replacement, confirmation required) from title-only or binding-only configuration (their corresponding high-level verbs are allow by default).
- Two code commits kept the store transaction-boundary fix separate from the agent-policy redesign.

### What didn't work
- The first store test run failed because `CreateWorkbenchOptions` extended `WorkbenchStoreOptions`, but `createWorkbench` manually forwarded only the two old callbacks. Exact failure:

  `AssertionError: expected "vi.fn()" to be called with arguments: [ ObjectContaining{…}, …(2) ]`

  The test also printed the fallback diagnostic:

  `pbui-workbench: post-commit hook failed Error: localStorage quota exceeded`

  Fix: forward `onPostCommitError` into `createWorkbenchStore` and include it in the injected-store hook guard. The rerun passed 115/115.
- No TypeScript compile or chat test failures occurred after the policy refactor.

### What I learned
- **Policy must wrap capabilities, not tool names.** `workbench_open_tile` and `workbench_perform({view.open})` are two UX affordances for one capability. If each checks independently, one eventually becomes the bypass.
- **Commit and persistence are separate outcomes.** A localStorage/outbox failure can mean “the UI changed, durability did not.” Collapsing both into one boolean makes a retry unsafe and gives the agent a false model of the screen.
- **Raw APIs need raw authorization subjects.** Translating a batch to a convenient stand-in verb repeats the exact approval bug fixed in Step 4: the predicate cannot compare what was proposed with what will execute.
- **Generated union cases still need semantic classification at the model boundary.** `viewConfigure` is not uniformly destructive; the presence of `appId` changes its policy meaning.

### What was tricky to build
- **Keeping approval one-shot without burning it on refusal.** The old generic path called `spend` before the router, despite its comment saying “only after actually attempted”; a stale id or last-tile refusal consumed permission without performing the approved operation. `performWithPolicy` checks first, calls the router, and spends only on `outcome === "performed"`. This ordering is now shared by every high-level tool.
- **Classifying raw replacement without over-gating harmless configuration.** `placementReplace` always changes which view occupies a tile, so it maps to `tile.replace`. `viewConfigure` can replace the app, rename the view, or replace bindings. Only an explicit `appId` maps to `tile.replace`; otherwise the existing `view.setTitle`/`view.rebind` defaults remain effective. Tests pin both sides.
- **Handling an error reporter that itself throws.** `onPostCommitError` is also product code. It is invoked inside its own guard; if it throws, the store logs that reporting failure and still returns true. Nothing after commit is allowed to masquerade as rollback.

### What warrants a second pair of eyes
- `rawPolicyKind` is now an explicit semantic allowlist, which is safer than the former destructive denylist, but every new mutation case still needs a conscious policy review. The default for an unclassified raw case remains allowed because raw mode itself is opt-in.
- `document.delete` is a policy key without a corresponding `WorkbenchVerbKind`. That is intentional for a raw-only capability, but products typing their policy around only exported verb kinds should know this extra key exists.
- `workbench_apply` still commits through `wb.mutate` rather than the router, so raw operations do not produce the same verb trace as high-level tools. This pre-existing design tension is not solved by authorization and should be decided before raw mode is enabled in a product.
- Undo uses `replaceDocument`, which bypasses mutation hooks and trace reporting. In a persisted/server-backed product an undo can therefore change the local document without entering the outbox. Tier 4 should not expose Undo until that contract is resolved.

### What should be done in the future
- Resolve the raw apply/undo trace and persistence contracts before enabling `allowRawMutations` or shipping the Undo widget.
- B4 must implement `isApproved(id, verb)` and `isRawApproved(id, batch)` from proposal state by comparing the exact proposed operation, not merely checking an approved id.
- Consider replacing `WorkbenchPolicy = Record<string, …>` with a typed union of high-level and raw-only capability keys once the raw API settles.

### Code review instructions
- Start at `packages/pbui-workbench/src/store.ts:createWorkbenchStore().mutate`: verify apply errors are the only path to `false`, then follow `onPostCommitError` through `createWorkbench.tsx` and the regression in `workbench.test.ts`.
- Then read `packages/pbui-chat/src/tools/workbenchTools.ts:performWithPolicy`, all four callers, and `rawPolicyKind` through `applyTool`.
- In `workbenchTools.test.ts`, review “cannot bypass a deny policy through the specialized tool”, “accepts a matching one-shot approval”, and the raw replacement/title-only pair.
- Validate with:
  - `pnpm --filter @hyperslop-systems/pbui-workbench test`
  - `pnpm --filter @hyperslop-systems/pbui-workbench typecheck`
  - `pnpm --filter @hyperslop-systems/pbui-chat test`
  - `pnpm --filter @hyperslop-systems/pbui-chat typecheck`
  - `make ci-check`
