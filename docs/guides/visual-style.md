# The PBUI visual style

PBUI consistency comes from shared components and semantic roles, not copied colour values. A panel should remain recognizably part of the workbench when its data is empty, unavailable, long, or still loading. Start with this guide, then build the [first styled panel](first-styled-workbench-panel.md).

## 1. Compose the existing regions

The standard application is an `AppShell` containing the native workbench surface. The shell owns the masthead, workspace strip, canvas and optional status/banner slots. Native tiles own their title bars, borders, placement controls and wiring. Inside a tile, `AppBody` owns padding and scrolling; `Toolbar` owns a non-shrinking control row.

```text
AppShell: masthead / strip / bounded canvas / optional status
  workbench.Surface: native tiles, placement and connection UI
    AppBody: bounded scrolling content
      Toolbar: section label and controls
      feature content: fields, values, notices, results
```

Do not draw a second tile frame around content already inside a native tile. A border distinguishes a region; it is not a default decoration on every nested component. Use `AppBody flush` when a table or other full-width region intentionally owns its own padding.

## 2. Select a component before writing CSS

| Requirement | Prefer | Check before adopting |
|---|---|---|
| Clickable action | `Button` / `IconButton` | Visible or accessible name, disabled reason, explicit form submit if intended |
| Short inline controls | `Toolbar` / `Stack` | Wrapping, committed width, no nested independent frame |
| Controlled input | `TextInput`, `SelectInput`, `TextArea` | `accessibleName` is not a visible label; use `onValueChange(value)` |
| Empty or loading region | `EmptyState` | State-specific message and useful next action/hint |
| Error/warning/information | `Callout` | `variant="danger"`, not the historical proposed `severity` prop |
| Inert type/status marker | `Chip` | A clickable operation is still a Button; state must not rely on colour alone |
| Typed domain object with presentation behavior | Product-bound `pbui.ObjectChip` | Requires the product provider/type declaration; do not redraw the same object label at every call site |
| Field/value detail | `KeyValueList` | Long values must wrap without widening the pane |
| Uppercase section heading | `SectionLabel` | Do not implement a second font/letter-spacing recipe |
| Supporting copy | `Text` | Choose small/tiny/faint by role, not an arbitrary font literal |
| Code editing | `pbui-editor` `CodeEditor` | Controlled state, language, explicit Run and bounded height |
| Window/split/wiring mechanics | `pbui-workbench` | Use the native shell, not a copied title bar or mutation engine |

A domain component is reusable only when its semantics fit. Datalab's TablePanel carries field/datum presentations and row-object semantics; a SQL result with duplicate aliases and positional string/null cells should not be converted into that model just to borrow the table's appearance. Reuse its visual recipe at a lower layer, or propose a genuinely shared primitive after comparing real call sites.

### Native control behavior and shared chrome

`SelectInput variant="framed"` matches the global unclassed-select skin: shared
chevron, padding, line height and focus treatment. The explicit `native` variant
retains platform chrome. Both remain real select elements with native keyboard
interaction. Override `--pbui-select-chevron` for a custom pane palette; forced
colors drops the image and restores the platform arrow. `TextArea` owns
border-box sizing so its 100% width includes padding and borders.

### Typed objects: one representation per kind

`Presentation` supplies behavior without prescribing every child. For a normal
object label, use the product-bound `pbui.ObjectChip` returned by `createPbui`:
it combines that behavior with the shared Chip body and descriptor label. Do not
independently style the same order/product reference in a table, detail header
and line item. Plain Chip remains useful for inert status markers. A custom
Presentation body is appropriate for genuinely different content, not another
copy of the default object label. Avoid adding another framed box around an
already framed object representation.

## 3. Use roles, not convenient colours

The definitive defaults are [core tokens](../../src/tokens.css). This table explains their roles; the [styling contract](../reference/styling-contract.md) describes overrides.

| Role | Use |
|---|---|
| `pane` / `paper` | Ordinary readable surface |
| `pane-alt` | Alternating or secondary surface, not an error state |
| `wash` | Canvas outside tiles |
| `tag-wash` | Neutral marker fill that carries no selection state |
| `selected` | Selected/accepted target; not a general highlight for running, warnings or decoration |
| `selected-wash` | Lighter hover treatment where the component defines it |
| `ink` / `faint` | Primary and supporting text; faint text still needs contrast |
| `danger` / `ok` | Reinforce explicit error/success wording |
| `tone-*` | Object kind, such as field/order/step; not arbitrary task status |
| `border-grid` | Internal tabular separators |
| `border-hair` / `border-firm` | Region and outer framing hierarchy |

The type scale is micro 8.5, tiny 9.5, small 10.5, base 11.5 and title 13px. The space scale is 2, 4, 6, 10, 16 and 24px. Components normally choose these through tokens or bounded props. A missing role deserves a deliberate shared change, not a new size copied across products. Corners are square (`--pbui-radius: 0`); shadows are not a substitute for border hierarchy.

Tokenized does not automatically mean semantically correct. Painting every status `selected` uses a valid token but destroys the distinction between selection and status. Review both name resolution and meaning.

## 4. Design states in text and interaction

A disabled action needs a reason near the control or in the action system, not merely reduced opacity. Error, empty and loading are distinct states. “No rows” must not conceal a failed request. Give the user an explicit next step where one exists.

Every state must survive a greyscale view. Use labels, border treatment or symbols with an accessible explanation alongside colour. Keep focus visible with the shared focus tokens. Native controls retain their keyboard semantics; replacing a button with a clickable div to satisfy a raw-control grep is a regression.

Visible labels and accessible names are separate. `accessibleName="Fixture name"` supplies an accessible name; a visible `<label>` with an associated input supplies the visible explanation. Use unique IDs (for example React `useId`) when multiple panels can mount together.

A shortcut is not the only entry point for a core workflow. Provide visible Applications/Wiring controls when appropriate. Mod means Command on Apple platforms and Control elsewhere; workbench shortcuts respect focus ownership and open transient surfaces.

## 5. Keep content inside the allocated region

`AppBody` combines `flex: 1`, `min-height: 0`, `min-width: 0` and `overflow: auto`. The parent still has to supply a bounded height. In a grid, use `minmax(0, 1fr)` for the flexible content region. A `height: 100%` child cannot invent a height its parent never established.

Use horizontal scrolling for exact wide tabular values when wrapping would obscure their structure. Use wrapping for long prose/identifiers in detail views. Align numeric text with tabular numerals without converting exact decimal or BIGINT strings to JavaScript numbers. Label null and empty values distinctly when the domain distinguishes them.

Dense operational panels need awkward fixtures too. TracePanel uses named grid
areas and a container query for narrow panes; a missing target still occupies a
cell, so outcome/time do not shift columns. Runs and tools use two-line metadata
rows. Long identifiers wrap where their full text matters; intentionally
ellipsized metadata retains its full title and underlying reference behavior.
See **pbui-chat / Operational Panels** for 280px and 640px fixtures.

Avoid nested scroll regions and viewport-relative caps by default. If a feature needs them, test the actual tile at narrow widths and short heights; a large desktop screenshot cannot prove that arrangement works.

## 6. Know what the examples prove

Open **Workbench / Getting Started / Styled Panel** in the workbench Storybook. It includes plain panels, awkward states, a theme override, a details slot and a native workbench. The fixtures are synthetic. Inspect is local and explicit; no rendering or editing performs a request.

The pure stories prove rendering and controlled interaction. The native story proves shell composition. Neither claims business authorization, persistence or backend execution. Those belong in integration tests. The [visual review playbook](../playbooks/visual-review-and-storybook.md) specifies how to inspect and record the difference.
