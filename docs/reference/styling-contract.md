# Styling contract

This document owns the shared styling policy. The [visual guide](../guides/visual-style.md) explains the roles; package-local guides document domain rules and stricter tests. Source types and executable examples are authoritative for API spelling.

## Stylesheet ownership

| Import | Owns |
|---|---|
| `@hyperslop-systems/pbui/styles.css` | Core token defaults, foundation typography, components, presentation styles and shared chrome |
| `@hyperslop-systems/pbui-workbench/styles.css` | Workbench shell/surface/wiring component styles |
| `@hyperslop-systems/pbui-editor/styles.css` | Code editor package styles; theme reads core syntax tokens |
| Product styles | Product-wide layout and intentional overrides; component anatomy stays local |

Core's granular `components.css`, `presentation-parts.css` and `chrome.css` exports remain available for deliberate alternative composition. They are not extra imports required after the complete `styles.css`. Do not duplicate the whole import set by habit. Importing a JS component does not remove the consumer's responsibility to load the documented CSS exports.

Runtime and Storybook should share the declared visual foundation. Additional feature styles must be explicit exceptions. In embedded Go applications, Storybook must override Vite's `base` and `outDir` so it cannot overwrite the production assets. Missing CSS often renders silently; a successful build is not proof that a rule reached the browser.

## Tokens and specificity

Core [src/tokens.css](../../src/tokens.css) defines the defaults under `:where(:root)`. The zero specificity permits a consumer's ordinary `:root` to override them. Define only intentional differences, not a second complete palette.

```css
/* An example of semantic aliasing, not a recommendation to change selection. */
:root {
  --product-secondary-surface: var(--pbui-pane-alt);
}
```

When adding a shared token, add its default and relevant test in the same change. Do not invent plausible names such as `--pbui-tone-orders` when the contract is `--pbui-tone-order`. Avoid inline fallback colours that create another unreviewed palette. Read component source for supported component-specific tokens.

A wrapper override reaches descendants only. A portalled menu outside that wrapper will not inherit it. Whole-application themes need an appropriate shared ancestor/portal host or document-root configuration. Test both inline controls and portalled surfaces. A ThemeOverride story is not proof of portal-theme coverage unless it opens those surfaces.

## Token-check scopes

- **Referenced minus defined** variables find potentially missing definitions. Resolve supported fallbacks and inherited scope before calling every match a defect.
- **Defined minus referenced** variables find candidates for unused definitions, not proof of dead public tokens: external consumers, JS themes and inline variable plumbing may read them.
- Neither check proves semantic use, contrast, CSS reachability or visual correctness.

Core's `src/tokens-defined.test.ts` and `src/styles-wiring.test.ts` enforce source-level contracts. Workbench's `test/no-phantom-tokens.test.ts` checks reads against core. Consumers need their own import/build checks; package tests do not automatically inspect consumer CSS. Do not describe one grep as testing both unused and undefined tokens.

## Component CSS and public hooks

Use CSS modules beside reusable components for private anatomy, wrapping and overflow. Use tokens for colours, fonts, borders and shared spacing. Keep product-global rules limited to actual shell/prose/foundation concerns. Avoid selectors reaching into another component's private descendants or hashed module classes.

A public part is a documented extension point. Keep the set small; name a new part only when a real external consumer needs it. An attribute present for testing or internal state is not automatically a permanent theme API. Use supported slots/renderers when changing structure, not increasingly specific selectors against incidental markup. Not every public part needs its own global CSS rule.

Inline styles are appropriate for dynamic geometry, variable plumbing and existing bounded token-based props. They should not become a generic unbounded Box API. Raw native elements are acceptable for semantic structures such as labels, tables and details, or a reasoned primitive gap. Reimplementing a shared control outside the primitive layer needs an explicit reviewed exception.

## Packaging and layers

The shared rule is **package by complexity and keep ownership local**:

- A private/pass-through component may remain beside its only consumer when the package permits it.
- A reusable component with meaningful visual/interaction states gets colocated stories; supporting styles, tests and logic justify a component directory with named exports.
- Do not create empty stylesheets or trivial stories merely to satisfy a numerical rule.
- Core and pbui-workbench enforce stricter component-folder tests. Follow those local tests; this policy does not remove them.
- Controllers own fetches, stores and effects. Presentational panels receive DTOs and callbacks; pure rendering derivations and local interaction state are fine.

Existing domain-specific components may have documented integration exceptions. A dependency graph can permit an import without recommending it for a new pure panel. Distinguish enforced graph constraints from the preferred controller/panel design.

## Editor integration

`CodeEditor` supports `javascript`, `json`, `sql` (MySQL dialect), and `plain`. Use `accessibleName`, controlled `value`/`onValueChange`, `rows` or a bounded fill host, and an explicit `onRun`. Read-only evidence should not reuse editable state as if it were the executed input.

The editor bundles CodeMirror. Extensions using independently installed CodeMirror instances may fail identity checks. Use the package-exported `EditorView`, `EditorState`, `Compartment` and `Prec` where applicable. See the [editor README](../../packages/pbui-editor/README.md). Prefer a compatible published release; local links require React deduplication, and vendored source requires license/provenance and clean-consumer validation, not silent divergence.

There is no family-wide `unstyled` prop. Omitting some CSS in an already styled Storybook iframe is not an unstyled test. Alternative skins require isolated import composition and explicit coverage. Theme and slots should be demonstrated separately from a deliberately unstyled entry point.

## Historical reference

[PBUI-VISUAL-1's after-report](../../ttmp/2026/09/04/PBUI-VISUAL-1--consolidate-the-visual-style-across-pbui-packages-and-demos/design-doc/03-after-the-consolidation-before-after-exhibits-and-what-remains.md) records the consolidation and screenshots. It is provenance, not the current API reference. For example, current Callout takes `variant`, even where a historical design proposed `severity`.
