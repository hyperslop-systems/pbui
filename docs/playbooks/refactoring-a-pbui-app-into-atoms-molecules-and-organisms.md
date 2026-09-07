# Refactoring a PBUI app into reusable panels and components

Use this when an existing application mixes state, large JSX renderers and a global component stylesheet. The goal is shared behavior and visual consistency, not a prescribed file count. Read the [visual guide](../guides/visual-style.md) and [styling contract](../reference/styling-contract.md) before moving files.

## 1. Establish a baseline

Run the affected package's actual typecheck, tests, production build and Storybook build. Record commands/results and inspect the current UI at explicit viewport sizes. Count duplicated controls and identify which existing PBUI primitives replace them; do not use a component count as proof of quality.

Check shared styles and tokens before choosing components. A shared control that appears worse than a raw element may be missing its CSS or theme. Fix that foundation as a separate checkpoint before adding compensating CSS. Core defines defaults; product overrides should contain only deliberate differences.

Capture representative screenshots with known state and fonts. If no pre-change baseline exists, state that and perform a real rendered review rather than claiming pixel parity. Unexpected console errors must be investigated, not ignored because the image looks plausible.

## 2. Decide which kind of change this is

For a **structure-only refactor**, preserve rendering and behavior. Unexpected visual differences indicate a regression. For **intentional visual alignment**, state the target differences before editing: shared controls, label hierarchy, border semantics, scroll behavior, etc. Compare against both the old UI and the appropriate family reference.

Do not hide behavior changes inside a mechanical file move. Discoveries such as draft loss on reparenting need their own explanation/tests, even when found during styling work.

## 3. Reuse before extracting

Start with the component-selection table in the visual guide. Replace local buttons, inputs, empty states, notices and facts grids with the shared APIs where semantics match. Read their current props first:

- `accessibleName` does not draw a visible label. Preserve both when required.
- `Button` defaults to `type="button"`; form submission must be explicit.
- Select options use `disabledBecause`, not parallel disabled/reason fields.
- `Callout` takes `variant`, not the name proposed in an old design document.
- An inert Chip is not a clickable button.

Do not import an entire domain runtime just to borrow table geometry. Preserve exact/positional values, duplicate labels and domain-specific interactions. A shared lower-level primitive is preferable when the higher-level component's semantics do not fit.

## 4. Separate controller and panel

The controller reads stores, fetches, authorizes and dispatches. A panel takes DTOs/callbacks and renders a feature. Pure derived availability and local UI state are allowed; ambient network access is not part of a new reusable panel's contract.

```text
apps/ThingApp          state/effects and mapping
components/ThingPanel props → shared controls and domain content
```

The atoms/molecules/organisms vocabulary describes composition complexity, not permission to conceal side effects. Some existing domain organisms integrate providers/stores deliberately; document such exceptions rather than treating a permissive dependency graph as the recommended pattern.

## 5. Package and move one slice at a time

A reusable component with states/styles/tests normally becomes:

```text
ThingPanel/
  ThingPanel.tsx
  ThingPanel.module.css       only when it owns rules
  ThingPanel.stories.tsx
  ThingPanel.test.tsx         when focused behavior needs tests
  index.ts                   named exports
```

Small private/pass-through composition can remain beside its consumer if the package allows it. Core and workbench enforce stricter folder rules through local tests; keep those green. Do not create empty modules or trivial stories to satisfy an arithmetic requirement.

For each slice:

1. Replace existing shared-control equivalents.
2. Extract a DTO/callback panel, with explicit lifetime ownership.
3. Move its private rules into a colocated module; delete the old rules in the same change.
4. Fix imports and add controlled stories covering meaningful states.
5. Run targeted tests/typecheck and inspect the rendered result.
6. Commit the complete slice, then continue.

Global rules should end up describing actual shell/prose concerns. A selector reaching from one component into another's private child makes the result depend on its caller and prevents reliable isolated stories. Use a prop, slot or documented part instead.

## 6. Review the styling contract, not only token spelling

Check shared size/space roles, border hierarchy, state semantics, focus and contrast. `selected` should not become a general-purpose fill. A referenced-minus-defined token check only detects missing definitions; it cannot detect an unused declared token or prove correct contrast.

Inspect long values and short/narrow hosts. AppBody needs a committed parent height. Tables may scroll horizontally while detail identifiers wrap. Test the exact data representation: styling numeric strings should not coerce them to numbers.

## 7. Evidence and definition of done

Use [visual review and Storybook](visual-review-and-storybook.md). A pure-panel fixture is not a native workbench test. A native workbench story needs the real document/registry/provider where applicable. Keep fixtures synthetic or explicitly sanitized; captured server data can contain credentials even if the UI hides them.

A refactor is ready when:

- Replaced shared controls preserve visible/accessibility labels and gestures.
- Controller/panel and state-lifetime boundaries are explicit.
- Local rules are colocated; shared tokens are not duplicated.
- Meaningful states have stories; exceptions identify genuine pass-through components.
- Raw-control survivors name a real semantic/library gap, not a TODO.
- Targeted and full affected-package checks pass, with remaining warnings identified.
- Rendered comparison shows only intended changes at known viewports.
- Console errors, narrow geometry and keyboard access were reviewed.

No mechanism proves appearance from TypeScript alone. Keep screenshots and a short receipt of what was inspected, what failed and what was fixed. The [compiled first-panel example](../guides/first-styled-workbench-panel.md) is the current starting point; historical migration anecdotes remain available in git rather than interleaved with current API instructions.
