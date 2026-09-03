import type { Node } from "@hyperslop-systems/workbench-protocol";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";

/**
 * The rebalance law (guide §11.4, Decision 7): a repair may rearrange
 * tiles, never add, drop, or retarget them. Stronger and more useful than
 * "same leaf count": the complete placementId → viewId map is preserved.
 */
export function placementMapOf(tree: Node | undefined): ReadonlyMap<string, string> {
  return new Map(leaves(tree).map((leaf) => [leaf.id, leaf.body.case === "leaf" ? leaf.body.value.viewId : ""]));
}

export function preservesPlacements(before: Node | undefined, after: Node | undefined): boolean {
  const a = placementMapOf(before);
  const b = placementMapOf(after);
  return a.size === b.size && [...a].every(([id, viewId]) => b.get(id) === viewId);
}
