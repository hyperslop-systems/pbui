import { createActionRegistry, createPresentationTypeGraph, type ActionContribution, type ActionQuery, type PresentationTypeDefinition, type SelectionSnapshot } from "@hyperslop-systems/pbui";
import { linkTypeDefinitions, workbenchLinkContributions, workbenchScopes, workbenchTileContributions, workbenchTypeDefinitions, type LinkFacts, type WorkbenchVerb } from "@hyperslop-systems/pbui-workbench";
import { INSPECTABLE, type Environment, type Values } from "./types";

/*
 * The shop's action registry: the workbench's tile rules, the link rules
 * and the "Link to…" family (PBUI-LINK-1 Phase 2), and the product's own.
 * The type graph declares one abstract type, `inspectable`, that every shop
 * value descends from — the datalab pattern by which an inspector's
 * `subject : <inspectable>` port accepts an order, a customer, a product, a
 * datum, a category or a metal by reachability alone, and the one type the
 * "Link to…" family is declared on.
 */

export const SHOP_TYPES: readonly PresentationTypeDefinition[] = [
  ...workbenchTypeDefinitions,
  ...linkTypeDefinitions,
  { id: INSPECTABLE, abstract: true },
  { id: "order", parents: [INSPECTABLE] },
  { id: "customer", parents: [INSPECTABLE] },
  { id: "product", parents: [INSPECTABLE] },
  { id: "lineItem", parents: [INSPECTABLE] },
  { id: "datum", parents: [INSPECTABLE] },
  { id: "category", parents: [INSPECTABLE] },
  { id: "metal", parents: [INSPECTABLE] },
  { id: "field" },
];

export const SHOP_SCOPES = ["shop", ...workbenchScopes, "global"] as const;

/** The verbs the shop's menus bind: the workbench's, link verbs included. */
export type ShopVerb = WorkbenchVerb;

/** Immutable facts a resolution reads: the host's revision and the link facts (null before a workbench exists). */
export interface ShopFacts {
  hostRevision: number;
  links: LinkFacts | null;
}

export function snapshotForShop(_query: ActionQuery<Values>, environment: Environment): SelectionSnapshot<ShopFacts> {
  const hostRevision = environment.host.revision();
  const workbenchLinks = environment.links;
  const links: LinkFacts | null = workbenchLinks
    ? { snapshot: workbenchLinks.snapshot(), deps: workbenchLinks.deps, sourceOf: (reference) => workbenchLinks.sourceOf(reference) }
    : null;
  return {
    // Menus re-resolve when the host, the link document, or the runtime values change.
    revision: `${hostRevision}:${links?.snapshot.documentRevision ?? 0}:${links?.snapshot.runtimeRevision ?? 0}`,
    scopes: [...SHOP_SCOPES],
    modes: new Set(),
    capabilities: new Set(),
    product: { hostRevision, links },
  };
}

export function createShopActionRegistry(extra: readonly ActionContribution<Values, ShopFacts, ShopVerb>[] = []) {
  return createActionRegistry<Values, ShopFacts, ShopVerb>({
    graph: createPresentationTypeGraph(SHOP_TYPES),
    scopes: [...SHOP_SCOPES],
    contributions: [
      ...workbenchTileContributions<Values, ShopFacts>(),
      ...workbenchLinkContributions<Values, ShopFacts>({ links: (snapshot) => snapshot.product.links, subjects: [INSPECTABLE], scopes: ["shop"] }),
      ...extra,
    ],
  });
}
