import { createActionRegistry, createPresentationTypeGraph, type ActionContribution, type ActionQuery, type PresentationTypeDefinition, type SelectionSnapshot } from "@hyperslop-systems/pbui";
import { workbenchScopes, workbenchTileContributions, workbenchTypeDefinitions, type WorkbenchVerb } from "@hyperslop-systems/pbui-workbench";
import { INSPECTABLE, type Environment, type Values } from "./types";

/*
 * The shop's action registry: the workbench's tile rules plus, from Phase 2,
 * the link contributions (badge menus, "Link to…", "Show details…"). The
 * type graph declares one abstract type, `inspectable`, that every shop
 * value descends from — the datalab pattern by which an inspector's
 * `subject : <inspectable>` port accepts an order, a customer, a product, a
 * datum, a category or a metal by reachability alone.
 */

export const SHOP_TYPES: readonly PresentationTypeDefinition[] = [
  ...workbenchTypeDefinitions,
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

/** The verbs the shop's menus bind: the workbench's, and (Phase 2) the link verbs that join that union. */
export type ShopVerb = WorkbenchVerb;

/** Immutable facts a resolution reads; the host's revision is what a menu over a live host re-resolves on. */
export interface ShopFacts {
  hostRevision: number;
}

export function snapshotForShop(_query: ActionQuery<Values>, environment: Environment): SelectionSnapshot<ShopFacts> {
  const hostRevision = environment.host.revision();
  return {
    revision: hostRevision,
    scopes: [...SHOP_SCOPES],
    modes: new Set(),
    capabilities: new Set(),
    product: { hostRevision },
  };
}

export function createShopActionRegistry(extra: readonly ActionContribution<Values, ShopFacts, ShopVerb>[] = []) {
  return createActionRegistry<Values, ShopFacts, ShopVerb>({
    graph: createPresentationTypeGraph(SHOP_TYPES),
    scopes: [...SHOP_SCOPES],
    contributions: [...workbenchTileContributions<Values, ShopFacts>(), ...extra],
  });
}
