/**
 * The four phases, and the one place their order is written down.
 *
 * DATA LAB's identity is a **process**, not a palette: data comes IN from a
 * source, is UNDERSTOOD as pipeline steps, is VISUALIZED as a chart, and is
 * EXPORTED as a document. That ordering is the only thing in the brand that
 * carries meaning, which is why it lives in one exported array that everything
 * maps over rather than being retyped in each of the four places that render
 * it.
 *
 * The colours are aliases of four presentation tones (DATADROP-14 DR-98), so
 * `phaseVar("understand")` and the 4px tone edge on a step chip resolve to the
 * same value. That is deliberate: a reader who learns the vocabulary on the
 * landing page has learned it for the product.
 */

export type Phase = "import" | "understand" | "visualize" | "export";

/** In order. Never reorder; see above. */
export const PHASES: readonly Phase[] = ["import", "understand", "visualize", "export"];

/**
 * The CSS variable for a phase, as a `var(...)` string ready for a style prop.
 *
 * A function rather than a record so that a caller cannot accidentally hold a
 * *resolved* colour: these are aliases, and reading them back as hex — which is
 * what `getComputedStyle` would give — reintroduces exactly the second colour
 * system DR-98 removed.
 */
export function phaseVar(phase: Phase): string {
  return `var(--brand-${phase})`;
}

/**
 * What each phase means, for the places that spell it out.
 *
 * Used by the sign-up tile's benefit list, which is the one surface in the
 * *product* where the phase vocabulary has to mean something concrete rather
 * than decorate a heading.
 */
export const PHASE_BLURB: Record<Phase, string> = {
  import: "upload your own CSVs and event streams",
  understand: "pipelines and snapshots that persist",
  visualize: "workspaces and templates saved to your account",
  export: "API tokens for scripts and CI",
};
