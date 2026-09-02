import type { RelationId } from "../relations/types";
import type { PresentationReference, PresentationValues } from "../types";

/**
 * Typed acceptance (PBUI-ACTIONS-2 P6, revised by PBUI-KERNEL-1 §11.3).
 *
 * An accept request names the types it wants. A click on a reference is
 * resolved in two steps:
 *
 * - SUBTYPING IS SUBSTITUTABILITY, NOT CONVERSION. If the concrete reference
 *   type reaches an accepted target, the request is satisfied with the
 *   ORIGINAL reference; downstream code may still dispatch on the concrete
 *   type. Relations run only when subtyping does not apply.
 * - Otherwise the acceptance-EXPOSED relations whose declared codomain
 *   reaches a wanted type run; candidates reduce by nearest scope then
 *   highest priority. AMBIGUITY IS A CHOICE, NEVER A GUESS: a genuine tie is
 *   an explicit chooser; declaration order never picks.
 */

/** One candidate outcome of an accept gesture. */
export interface AcceptanceOption<Values extends PresentationValues> {
  /** null means direct subtype satisfaction; otherwise the relation that produced `result`. */
  relation: RelationId | null;
  result: PresentationReference<Values>;
}

export type AcceptanceResolution<Values extends PresentationValues> =
  | { kind: "none" }
  | { kind: "accepted"; option: AcceptanceOption<Values> }
  | { kind: "ambiguous"; options: readonly AcceptanceOption<Values>[] };
