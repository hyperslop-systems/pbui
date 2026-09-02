import { Text } from "@hyperslop-systems/pbui";
import { isWorkbenchVerb, tileRefOf, type Workbench } from "@hyperslop-systems/pbui-workbench";
import type { Shop } from "../createShop";
import styles from "./ShopShell.module.css";

export interface ShopShellProps {
  shop: Shop;
  workbench: Workbench;
  /** Show the workspace strip above the surface. Default true. */
  strip?: boolean;
  title?: string;
}

/**
 * The shop as a product: the pbui Provider whose router is the workbench,
 * the tile surface with every tile title a `<tile>` presentation, the
 * launcher, and the object menu and accept banner the presentations need.
 * Stories and the demo both mount exactly this.
 */
export function ShopShell({ shop, workbench, strip = true, title = "gold coin shop" }: ShopShellProps) {
  const { Provider, Presentation, ObjectMenu, AcceptBanner } = shop.pbui;
  return (
    <Provider
      environment={{ host: shop.host }}
      onPerform={(verb) => {
        if (isWorkbenchVerb(verb)) workbench.perform(verb);
      }}
    >
      <div data-part="shop-shell" className={styles.shell} data-strip={strip || undefined}>
        {strip ? (
          <div className={styles.strip}>
            <Text size="small" strong>
              {title}
            </Text>
            <workbench.WorkspaceStrip addLabel="new workspace" />
            <span className={styles.spacer} />
            <Text size="tiny" tone="faint">
              Mod+K opens the launcher
            </Text>
          </div>
        ) : null}
        <div className={styles.surface}>
          <workbench.Surface
            renderTitle={(_view, placement, defaultTitle) => {
              const tile = tileRefOf(workbench, placement.placementId);
              if (!tile) return defaultTitle;
              return (
                <Presentation reference={{ type: "tile", value: tile }} doc={`tile showing ${tile.title}`} inComposite>
                  {defaultTitle}
                </Presentation>
              );
            }}
          />
        </div>
        <workbench.Launcher />
        <ObjectMenu />
        <AcceptBanner />
      </div>
    </Provider>
  );
}
