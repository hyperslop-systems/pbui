import { createPbui, type ActionContribution, type PbuiInstance } from "@hyperslop-systems/pbui";
import type { ShopHost } from "../host";
import { createShopActionRegistry, snapshotForShop, type ShopFacts, type ShopVerb } from "./actions";
import { registry } from "./registry";
import type { Environment, Values } from "./types";

export type ShopPbui = PbuiInstance<Values, Environment, ShopVerb, ShopFacts>;

/**
 * One pbui instance per shop: the descriptors, the action registry over the
 * shop's type graph, and the snapshot builder. Phase 2 passes the link
 * contributions through `extra`.
 */
export function createShopPbui(host: ShopHost, extra: readonly ActionContribution<Values, ShopFacts, ShopVerb>[] = []): ShopPbui {
  return createPbui<Values, Environment, ShopVerb, ShopFacts>({
    registry,
    defaultEnvironment: { host },
    actions: createShopActionRegistry(extra),
    snapshotFor: snapshotForShop,
    renderMenuHeader: (reference, _environment, label) => (
      <>
        &lt;{reference.type}&gt; {label}
      </>
    ),
  });
}
