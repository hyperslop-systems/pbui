# `@hyperslop-systems/pbui-editor`

A CodeMirror 6 code editor for PBUI products: JavaScript, JSON and MySQL SQL
highlighting, line numbers, bracket matching, undo history, an inline
diagnostics gutter, and a theme built entirely from pbui tokens.

```tsx
import { CodeEditor } from "@hyperslop-systems/pbui-editor";
import "@hyperslop-systems/pbui-editor/styles.css";

<CodeEditor
  value={source}
  onValueChange={setSource}
  accessibleName="plot script"
  language="javascript"
  diagnostics={[{ line: 3, column: 5, severity: "error", message: "month is not defined" }]}
  onRun={(text) => run(text)}      // Mod+Enter
/>
```

## Why a separate package

`@hyperslop-systems/pbui` has **no runtime dependencies** — React is a peer —
and that is deliberate. CodeMirror is six packages and a few hundred kilobytes;
products that never open an editor should not carry it. This package follows
the same shape as `pbui-workbench`, `pbui-sandbox` and `pbui-chat`: a peer with
its own dependencies and its own `styles.css` export.

CodeMirror is **bundled into** `dist/index.js` rather than externalised. This
keeps the editor's own instance coherent, but does not prevent a consumer from
installing another incompatible copy. Do not mix extensions constructed with
an independently installed CodeMirror instance: that can cause the
"Unrecognized extension value" failure. Use the exported `EditorView`,
`EditorState`, `Compartment` and `Prec` primitives for integrations that need them.

```ts
import { EditorView, Compartment, Prec } from "@hyperslop-systems/pbui-editor";
const editable = new Compartment();
const extension = editable.of(Prec.highest(EditorView.editable.of(false)));
```

This snippet illustrates instance-safe extension construction, not an
`extensions` prop on CodeEditor. Consult the exported editor API before wiring
custom behavior; do not assume arbitrary extension injection is supported.

## The API mirrors `TextArea`

`value` + `onValueChange(value)` — not an event; a required `accessibleName`
that becomes `aria-label`; `rows` measured in lines of content. A call site
moving from `TextArea` to `CodeEditor` changes the import and adds `language`.
Omit `rows` and the editor fills its container, which is the tile case — the
container must then be a bounded box (`minmax(0, 1fr)` in a grid).

## Languages and evidence

| `language` | Grammar |
|---|---|
| `javascript` | JavaScript |
| `json` | JSON |
| `sql` | SQL with the MySQL dialect |
| `plain` | No grammar |

Use `language="sql"` for a MySQL statement and `language="json"` for its
parameters. `readOnly` is appropriate for executed-input evidence; keep that
value separate from the editable draft. Highlighting does not validate query
authorization or execute anything. Changes go through `onValueChange`; Run is
explicit. The MySQL grammar has a story and test in this package.

For foundation imports, token semantics, bounded hosts and package portability,
read the [styling contract](../../docs/reference/styling-contract.md) and
[first-panel tutorial](../../docs/guides/first-styled-workbench-panel.md).

## Keyboard: what is deliberately not bound

`Mod+Shift+K` is `deleteLine` in CodeMirror's `defaultKeymap` and "open the
rebalance dialog" in `@hyperslop-systems/pbui-workbench`, whose listener is on
`window` in the **capture** phase and calls `preventDefault()`. The workbench
wins and the editor never sees the key. `deleteLine` is therefore removed from
the keymap (`src/extensions.ts`, `pbuiKeymap`) rather than left as a chord that
looks bound and does nothing. `Mod+K` (the launcher) is not bound by CodeMirror
at all.

`Mod+Enter` is bound to `onRun` at `Prec.highest`, because `defaultKeymap`
binds it to `insertBlankLine` and would otherwise win.

## Theme

Every colour and font in `src/theme.ts` is a `var(--pbui-*)` read. The six
`--pbui-syntax-*` tokens live in pbui's `src/tokens.css`, not here — a token an
editor reads and nobody defines renders as *no colour*, silently, which is the
failure that file exists to end. `test/tokens-read.test.ts` asserts every token
this package reads has a default there.

## On `no-raw-controls`

pbui's `test/no-raw-controls.test.ts` forbids a raw `<textarea>` outside
`atoms/`. CodeMirror's editing surface is a `contenteditable` div, not a form
control, and this package is the one place it lives. The same argument that
made `TextArea` an atom — one multi-line surface, styled once — is the argument
for this package.

```bash
pnpm --filter @hyperslop-systems/pbui-editor test
pnpm --filter @hyperslop-systems/pbui-editor typecheck
pnpm --filter @hyperslop-systems/pbui-editor build
pnpm --filter @hyperslop-systems/pbui-editor storybook   # port 6010
```

Design and decision records: `ttmp/2026/09/01/PBUI-PLOTKIT-1--*/design-doc/01-*.md`.
