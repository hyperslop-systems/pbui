import { createWorkbench, type CreateWorkbenchOptions, type WorkbenchApp, type WorkbenchShell } from "@hyperslop-systems/pbui-workbench";
import type { WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { createShopApps } from "./apps";
import { createShopHost, type ShopHost } from "./host";
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
  apps: WorkbenchApp[];
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
export function createShopWorkbench(shop: Shop, options: CreateShopWorkbenchOptions = {}): WorkbenchShell {
  const { initial, ...rest } = options;
  return createWorkbench({
    apps: shop.apps,
    initial: initial ?? seedShopDocument(),
    // The link kernel's dependencies are a PROJECTION of the one compiled
    // presentation (PBUI-KERNEL-1 C10): the same graph the menus resolve on
    // (D1), the derivation-exposed relations accept mode also uses (D7), and
    // a relation evaluator that reads the product's facts. The shop's
    // relations read only the host, so the projected context carries the
    // host revision and no link facts.
    links: shop.pbui.presentation.linkDeps({
      contextFor: () => ({ facts: { hostRevision: shop.host.revision(), links: null } }),
      label: labelReference,
    }),
    ...rest,
  });
}
