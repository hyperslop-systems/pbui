import type { RuntimeEffect } from "@hyperslop-systems/pbui";

/**
 * Explicit non-durable consequences of a transition (guide K1): planned as
 * data, executed only by `execute` after the document is installed, never by
 * `preview`. Session changes are not effects — they are part of the planned
 * session, applied at install.
 */
export type LocalEffect =
  /** The link kernel's runtime effects (class cells seeded on merge, private values restored on split). */
  | { readonly kind: "link-runtime"; readonly effects: readonly RuntimeEffect[] }
  /** A view was deleted: forget what its ports emitted or attended. */
  | { readonly kind: "forget-view-values"; readonly viewId: string };
