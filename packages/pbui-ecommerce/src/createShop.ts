import { createPresentationTypeGraph } from "@hyperslop-systems/pbui";
import { createWorkbench, type AppDescriptor, type CreateWorkbenchOptions, type Workbench } from "@hyperslop-systems/pbui-workbench";
import type { WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { createShopApps } from "./apps";
import { createShopHost, type ShopHost } from "./host";
import { SHOP_TYPES } from "./presentation/actions";
import { createShopRelations } from "./presentation/relations";
import { createShopPbui, type ShopPbui } from "./presentation/runtime";
import { labelReference } from "./presentation/values";
import { seedShopDocument } from "./seed";

/**
 * Everything the tiles share: the host they read, the pbui instance whose
 * `Presentation` they render, and their own descriptors. Built once by the
 * product and handed to `createShopWorkbench` (or to `createWorkbench`
 * directly, with `shop.apps`).
 */
export interface Shop {
  host: ShopHost;
  pbui: ShopPbui;
  apps: AppDescriptor[];
}

export interface CreateShopOptions {
  /** A host other than the in-memory fixtures — PBUI-DATALAB-1's, one day. */
  host?: ShopHost;
}

export function createShop(options: CreateShopOptions = {}): Shop {
  const host = options.host ?? createShopHost();
  const pbui = createShopPbui(host);
  const shop: Shop = { host, pbui, apps: [] };
  shop.apps = createShopApps(shop);
  return shop;
}

export type CreateShopWorkbenchOptions = Omit<CreateWorkbenchOptions, "apps" | "initial"> & { initial?: WorkbenchDocument };

/** A workbench over the shop's apps, seeded with the four scenes unless told otherwise. */
export function createShopWorkbench(shop: Shop, options: CreateShopWorkbenchOptions = {}): Workbench {
  const { initial, ...rest } = options;
  const relations = createShopRelations(shop.host);
  return createWorkbench({
    apps: shop.apps,
    initial: initial ?? seedShopDocument(),
    // The kernel types ports against the SAME graph the menus resolve on (D1), and derives through the same relations accept mode uses (D7).
    links: {
      graph: createPresentationTypeGraph(SHOP_TYPES),
      label: labelReference,
      relations: relations.map(({ id, from, to, label }) => ({ id, from, to, ...(label ? { label } : {}) })),
      relation: (id, reference) => relations.find((relation) => relation.id === id)?.apply(reference, shop.host),
    },
    ...rest,
  });
}
