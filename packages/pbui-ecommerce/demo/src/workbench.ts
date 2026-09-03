import { createShop, createShopWorkbench, seedShopDocument, type Shop } from "@hyperslop-systems/pbui-ecommerce";
import { parseDocument, type Workbench } from "@hyperslop-systems/pbui-workbench";

export const STORAGE_KEY = "pbui-ecommerce-demo.workbench.v1";

export function createDemoWorkbench(): { shop: Shop; workbench: Workbench; restored: boolean } {
  const shop = createShop();
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  const restored = parseDocument(stored);
  const workbench = createShopWorkbench(shop, {
    initial: restored ?? seedShopDocument(),
    onMutate() {
      try {
        localStorage.setItem(STORAGE_KEY, workbench.serialize());
      } catch {
        // Private mode, quota: the demo still works, it just does not remember.
      }
    },
  });
  return { shop, workbench, restored: restored !== null };
}
