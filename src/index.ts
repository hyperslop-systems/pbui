/*
 * THE STYLESHEET IS ASSEMBLED HERE, AND THE ORDER OF THESE IMPORTS IS THE
 * CASCADE.
 *
 * Vite's library build collects every CSS file in the module graph into one
 * `dist/pbui.css`, in the order the graph reaches them. That makes this file
 * the definition of pbui's stylesheet, and it is worth stating what each layer
 * is for, because two of them were previously absent and neither absence
 * produced an error.
 *
 *   1. tokens.css        — `:where(:root)` defaults for all forty-four tokens
 *                          the components read. Zero specificity, so a
 *                          product's own `:root` wins regardless of order.
 *                          Added in 0.3.0; before it, an undefined custom
 *                          property invalidated the whole declaration at
 *                          computed-value time, silently.
 *   2. styles.css        — `:where()` fallbacks for the presentation parts,
 *                          so a consumer who imports only this stylesheet
 *                          still gets a legible menu. Also zero specificity.
 *                          Was imported by NOTHING until PBUI-HARDEN-1; the
 *                          file existed, explained itself, and never shipped.
 *   3. the components    — the `export *` lines below, which pull in every
 *                          `*.module.css`. Hashed class names, (0,1,0).
 *   4. the parts files   — components.css, presentation-parts.css, chrome.css.
 *                          Plain attribute selectors, also (0,1,0), so they
 *                          must come AFTER the modules to win ties. They are
 *                          imported at the bottom of this file for that
 *                          reason, and `styles-order.test.ts` asserts the
 *                          emitted order rather than trusting it.
 *
 * # Why 4 is here at all
 *
 * Those three files used to be reachable only as separate subpath exports
 * (`@hyperslop-systems/pbui/components.css` and siblings), which a consumer
 * had to import by hand, in the right order, with no way to detect a missing
 * one. agentlogic missed two of them in its Storybook config and rendered
 * every presentation and every tile frame unlike its own product for weeks.
 *
 * Importing one stylesheet now gets the whole design system. The granular
 * subpaths still exist and still work — a consumer that genuinely wants a
 * different menu look can skip this entry and compose the parts itself — but
 * nobody has to know that to get a correct page.
 */
import "./tokens.css";
import "./styles.css";

export * from "./presentation";
export * from "./surfaces";
export * from "./chrome";
export * from "./components";
export * from "./visualization";

/*
 * LAST, deliberately. See layer 4 above: these carry the same specificity as
 * the component modules, so ties are broken by order, and they must win.
 *
 * ES imports are hoisted and evaluated in source order, so placing them below
 * the re-exports is what puts them after the modules in the emitted CSS. That
 * is subtle enough to be worth a test rather than a comment, which is what
 * `styles-order.test.ts` is.
 */
import "../public/components.css";
import "../public/presentation-parts.css";
import "../public/chrome.css";
