import { Button, Text } from "@hyperslop-systems/pbui";
import { ShopShell, seedShopDocument } from "@hyperslop-systems/pbui-ecommerce";
import { useMemo } from "react";
import { STORAGE_KEY, createDemoWorkbench } from "./workbench";

export function App() {
  const { shop, workbench, restored } = useMemo(createDemoWorkbench, []);
  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // nothing to clear
    }
    workbench.reset(seedShopDocument);
  };
  return (
    <ShopShell
      shop={shop}
      workbench={workbench}
      mastheadActions={
        <>
          <Text size="tiny" tone="faint">
            {restored ? "restored from this browser" : "seeded"}
          </Text>
          <Button size="tiny" variant="framed" onClick={reset}>
            reset to the seed
          </Button>
        </>
      }
    />
  );
}
