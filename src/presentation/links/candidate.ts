import { terms, type Binding } from "./terms";
import type { PortId } from "./types";
import type { LinkVerb } from "./verbs";

/*
 * The term a verb persists (PBUI-KERNEL-2 P3; guide §12.7). A planner must
 * check THE term the apply step will write, not a look-alike: the follow
 * planner and the apply case for `port.follow` used to each spell
 * `terms.follow(source, id)`, and the derive pair each spelled
 * `Derived(Follow(source, id), ρ, id)`. One function now spells each shape
 * once; the planner checks it under `PLAN_LINK_ID`, the apply step stores
 * it under a minted id, and a law holds the two to be the same term.
 */

/** The verbs that write a term to a destination port. The rest move, freeze, cut or clear. */
export type TermVerb = Extract<LinkVerb, { kind: "port.follow" | "port.bind" | "port.derive" | "port.ambient" }>;

/** The link id a planner's candidate carries. Never persisted: apply mints a real one. */
export const PLAN_LINK_ID = "__plan__";

export function isTermVerb(verb: LinkVerb): verb is TermVerb {
  return verb.kind === "port.follow" || verb.kind === "port.bind" || verb.kind === "port.derive" || verb.kind === "port.ambient";
}

/** The port the verb writes. */
export function destinationOf(verb: TermVerb): PortId {
  switch (verb.kind) {
    case "port.follow":
    case "port.derive":
      return verb.destination;
    case "port.bind":
    case "port.ambient":
      return verb.port;
  }
}

/** The link id the term will carry: the verb's own, else `mint()`; `undefined` for terms that carry none. */
export function linkIdFor(verb: TermVerb, mint: () => string): string | undefined {
  switch (verb.kind) {
    case "port.follow":
    case "port.derive":
      return verb.linkId ?? mint();
    case "port.bind":
    case "port.ambient":
      return undefined;
  }
}

/** The exact term `verb` persists on `destinationOf(verb)`, carrying `linkId` where the grammar has one. */
export function candidateTermOf(verb: TermVerb, linkId: string = PLAN_LINK_ID): Binding {
  switch (verb.kind) {
    case "port.follow":
      return terms.follow(verb.source, linkId);
    case "port.bind":
      return terms.constant(verb.reference);
    case "port.derive":
      return terms.derived(terms.follow(verb.source, linkId), verb.relation, linkId);
    case "port.ambient":
      return terms.ambient(verb.context);
  }
}
