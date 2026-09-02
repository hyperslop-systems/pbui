import { create } from "@bufbuild/protobuf";
import type { LayoutSpec } from "@hyperslop-systems/pbui-workbench";
import { AppViewSchema, type AppView } from "@hyperslop-systems/workbench-protocol";
import { useMemo, type ReactNode } from "react";
import { createShop, createShopWorkbench, type Shop } from "../createShop";
import { seedShopDocument } from "../seed";
import { ShopShell } from "../ShopShell";

/*
 * Story harnesses. `ShopStory` mounts the whole shell over a layout (the
 * seeded four workspaces, or one spec); `DirectStory` mounts one tile
 * component inside the pbui Provider alone, for tiles whose Phase 1 story
 * needs a `preview` prop the workbench would never pass.
 */

export interface ShopStoryProps {
  spec?: LayoutSpec;
  height?: number;
  strip?: boolean;
}

export function ShopStory({ spec, height = 520, strip = false }: ShopStoryProps) {
  const { shop, workbench } = useMemo(() => {
    const shop = createShop();
    const workbench = createShopWorkbench(shop, { initial: seedShopDocument(spec ? { spec } : {}) });
    return { shop, workbench };
  }, [spec]);
  return (
    <div style={{ height, display: "grid", gridTemplateRows: "minmax(0, 1fr)" }}>
      <ShopShell shop={shop} workbench={workbench} strip={strip} />
    </div>
  );
}

export interface DirectStoryProps {
  height?: number;
  children: (shop: Shop, view: AppView) => ReactNode;
}

export function DirectStory({ height = 360, children }: DirectStoryProps) {
  const shop = useMemo(() => createShop(), []);
  const view = useMemo(() => create(AppViewSchema, { id: "v-story", appId: "story", documents: {} }), []);
  const { Provider, ObjectMenu, AcceptBanner } = shop.pbui;
  return (
    <Provider environment={{ host: shop.host }} onPerform={() => undefined}>
      <div style={{ height, display: "grid", gridTemplateRows: "minmax(0, 1fr)", border: "1px solid color-mix(in srgb, currentColor 20%, transparent)" }}>{children(shop, view)}</div>
      <ObjectMenu />
      <AcceptBanner />
    </Provider>
  );
}
