import type { RuntimeEffect } from "@hyperslop-systems/pbui/link-kernel";
import type { WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";

/**
 * Explicit non-durable consequences of a transition (guide K1): planned as
 * data, executed only by `execute` after the document is installed, never by
 * `preview`. Session changes are not effects — they are part of the planned
 * session, applied at install.
 */
export type LocalEffect =
  /** The link kernel's runtime effects (class cells seeded on merge, private values restored on split). */
  | { readonly kind: "link-runtime"; readonly effects: readonly RuntimeEffect[] }
  /** A view was deleted or changed application: forget what its old ports emitted or attended. */
  | { readonly kind: "forget-view-values"; readonly viewId: string };

/** Runtime consequences derived from the semantic before/after state, independent of how a mutation batch spelled the transition. */
export function linkLifecycleEffects(before: WorkbenchDocument, after: WorkbenchDocument): LocalEffect[] {
  const effects: LocalEffect[] = [];
  for (const [viewId, view] of Object.entries(before.views)) {
    const next = after.views[viewId];
    if (!next || next.appId !== view.appId) effects.push({ kind: "forget-view-values", viewId });
  }
  return effects;
}
