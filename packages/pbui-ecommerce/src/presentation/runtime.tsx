import { createPbui, definePresentation, type ActionContribution, type CompiledPresentation, type PbuiInstance, type SelectionSnapshot } from "@hyperslop-systems/pbui";
import { createWorkbenchPresentationFragment } from "@hyperslop-systems/pbui-workbench";
import type { ShopHost } from "../host";
import { SHOP_SCOPES, SHOP_TYPES, shopContextFor, shopRevision, type ShopFacts, type ShopVerb } from "./actions";
import { shopDescriptors } from "./registry";
import { createShopRelations } from "./relations";
import { INSPECTABLE, type Environment, type Values } from "./types";

export type ShopPresentation = CompiledPresentation<Values, Environment, ShopFacts, ShopVerb>;
export type ShopPbui = PbuiInstance<Values, Environment, ShopVerb, ShopFacts>;

const p = definePresentation<Values, Environment, ShopFacts, ShopVerb>();

/**
 * The shop's ONE compiled presentation (PBUI-KERNEL-1): the workbench
 * fragment (tile + link types, descriptors, rules, and the "Link to…" family
 * on `inspectable`) plus the shop fragment (its types, descriptors, and the
 * three host relations, exposed to acceptance and to link derivation). The
 * same graph types the ports (D1) and the same relations serve accept mode
 * and `Derived` bindings (D7) — by construction, not by discipline.
 */
export function createShopPresentation(host: ShopHost, extra: readonly ActionContribution<Values, ShopFacts, ShopVerb>[] = []): ShopPresentation {
  return p.create({
    id: "shop.presentation",
    include: [
      createWorkbenchPresentationFragment<Values, Environment, ShopFacts, ShopVerb>({
        links: { links: (snapshot: SelectionSnapshot<ShopFacts>) => snapshot.product.links, subjects: [INSPECTABLE], scopes: ["shop"] },
      }),
      p.fragment({
        id: "shop",
        types: SHOP_TYPES,
        knownScopes: ["shop", "global"],
        descriptors: shopDescriptors,
        relations: createShopRelations(host),
        actions: extra,
      }),
    ],
    defaultActiveScopes: [...SHOP_SCOPES],
    revision: shopRevision,
    version: 1,
  });
}

/**
 * One pbui instance per shop over that presentation. Phase 2 of LINK-1
 * passed the link contributions through `extra`; they now ride the fragment.
 */
export function createShopPbui(host: ShopHost, extra: readonly ActionContribution<Values, ShopFacts, ShopVerb>[] = []): ShopPbui {
  return createPbui<Values, Environment, ShopVerb, ShopFacts>({
    presentation: createShopPresentation(host, extra),
    defaultEnvironment: { host },
    contextFor: shopContextFor,
    renderMenuHeader: (reference, _environment, label) => (
      <>
        &lt;{reference.type}&gt; {label}
      </>
    ),
  });
}
