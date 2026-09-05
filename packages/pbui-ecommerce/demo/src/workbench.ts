import { createShop, createShopWorkbench, seedShopDocument, type Shop } from "@hyperslop-systems/pbui-ecommerce";
import { manifestsOf, type WorkbenchShell } from "@hyperslop-systems/pbui-workbench";
import { createManifestCatalog, parseWorkbenchDocument } from "@hyperslop-systems/workbench-core";

export const STORAGE_KEY = "pbui-ecommerce-demo.workbench.v1";

export function createDemoWorkbench(): { shop: Shop; workbench: WorkbenchShell; restored: boolean } {
  const shop = createShop();
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  // Validated against the catalog: a stored layout naming a retired tile falls back to the seed.
  const parsed = parseWorkbenchDocument(stored, { apps: createManifestCatalog(manifestsOf(shop.apps)) });
  const restored = parsed.ok ? parsed.document : null;
  const workbench = createShopWorkbench(shop, {
    initial: restored ?? seedShopDocument(),
    onCommit() {
      try {
        localStorage.setItem(STORAGE_KEY, workbench.serialize());
      } catch {
        // Private mode, quota: the demo still works, it just does not remember.
      }
    },
  });
  return { shop, workbench, restored: restored !== null };
}
