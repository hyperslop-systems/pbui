import type { ActionQuery, PresentationContextInput, PresentationTypeDefinition } from "@hyperslop-systems/pbui";
import { workbenchScopes, type LinkFacts, type WorkbenchVerb } from "@hyperslop-systems/pbui-workbench";
import { INSPECTABLE, type Environment, type Values } from "./types";

/*
 * The shop's own types and its runtime context (PBUI-KERNEL-1). The
 * workbench's tile and link types, rules and descriptors arrive through
 * `createWorkbenchPresentationFragment` in `./runtime.tsx`; what is declared
 * here is the product half: one abstract type, `inspectable`, that every
 * shop value descends from — the datalab pattern by which an inspector's
 * `subject : <inspectable>` port accepts an order, a customer, a product, a
 * datum, a category or a metal by reachability alone, and the one type the
 * "Link to…" family is declared on.
 */

export const SHOP_TYPES: readonly PresentationTypeDefinition[] = [
  { id: INSPECTABLE, abstract: true },
  { id: "order", parents: [INSPECTABLE] },
  { id: "customer", parents: [INSPECTABLE] },
  { id: "product", parents: [INSPECTABLE] },
  { id: "lineItem", parents: [INSPECTABLE] },
  { id: "datum", parents: [INSPECTABLE] },
  { id: "category", parents: [INSPECTABLE] },
  { id: "metal", parents: [INSPECTABLE] },
  { id: "field" },
  // The workspace strip presents `<workspace>` rows; the shop describes them.
  { id: "workspace" },
];

/** The active inner-to-outer stack every shop query resolves in. */
export const SHOP_SCOPES = ["shop", ...workbenchScopes, "global"] as const;

/** The verbs the shop's menus bind: the workbench's, link verbs included. */
export type ShopVerb = WorkbenchVerb;

/** Immutable facts a resolution reads: the host's revision and the link facts (null before a workbench exists). */
export interface ShopFacts {
  hostRevision: number;
  links: LinkFacts | null;
}

/** The semantic revision (C4): menus re-resolve when the host, the link document, or the runtime values change. */
export function shopRevision(facts: Readonly<ShopFacts>): string {
  return `${facts.hostRevision}:${facts.links?.snapshot.documentRevision ?? 0}:${facts.links?.snapshot.runtimeRevision ?? 0}`;
}

/** The product's context projection: what `createPbui` hands `presentation.snapshot` for every query. */
export function shopContextFor(_query: ActionQuery<Values>, environment: Environment): PresentationContextInput<ShopFacts> {
  const hostRevision = environment.host.revision();
  const workbenchLinks = environment.links;
  const links: LinkFacts | null = workbenchLinks
    ? { snapshot: workbenchLinks.snapshot(), deps: workbenchLinks.deps, sourceOf: (reference) => workbenchLinks.sourceOf(reference) }
    : null;
  return { facts: { hostRevision, links } };
}
