import type { ReactNode } from "react";
import { Text } from "@hyperslop-systems/pbui";
import { AppShell, PortBadge, isWorkbenchVerb, portRefOf, tileRefOf, type WorkbenchShell } from "@hyperslop-systems/pbui-workbench";
import type { Shop } from "../createShop";

export interface ShopShellProps {
  shop: Shop;
  workbench: WorkbenchShell;
  /** Show the workspace strip above the surface. Default true. */
  /** False for an embedded shop (the stories): no masthead, no strip, just the tiles. */
  strip?: boolean;
  title?: string;
  /** Right-aligned controls in the masthead (a demo's reset button). */
  mastheadActions?: ReactNode;
}

/**
 * The shop as a product: the pbui Provider whose router is the workbench,
 * the tile surface with every tile title a `<tile>` presentation and every
 * binding badge a `<port>` presentation (so both get the object menu), the
 * launcher, and the object menu and accept banner the presentations need.
 * Stories and the demo both mount exactly this.
 */
export function ShopShell({ shop, workbench, strip = true, title = "gold coin shop", mastheadActions }: ShopShellProps) {
  const { Provider, Presentation, ObjectMenu, AcceptBanner, MouseDocLine } = shop.pbui;
  return (
    <Provider
      environment={{ host: shop.host, links: workbench }}
      onPerform={(verb) => {
        if (isWorkbenchVerb(verb)) workbench.perform(verb);
      }}
      // A row that failed fresh revalidation (PBUI-KERNEL-1 §14.2): the shop
      // demo has no status line, so refusals are telemetry only.
      onRefuse={(refusal) => console.warn(`shop: refused ${refusal.action ?? "action"} (${refusal.code})${refusal.because ? ` — ${refusal.because}` : ""}`)}
    >
      <AppShell
        data-part="shop-shell"
        masthead={strip}
        wordmark={title}
        mastheadActions={mastheadActions}
        strip={strip ? <workbench.WorkspaceStrip addLabel="workspace" /> : undefined}
        stripActions={
          strip ? (
            <Text size="tiny" tone="faint">
              Mod+K opens the launcher · right-click anything to link it · Mod+Shift+L shows the wiring
            </Text>
          ) : undefined
        }
        status={strip ? <MouseDocLine /> : undefined}
        banner={<AcceptBanner />}
      >
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
            renderPort={(port, node) => (
              <Presentation reference={{ type: "port", value: port }} doc={port.doc} inComposite>
                {node}
              </Presentation>
            )}
            renderWire={(link, node) => (
              <Presentation reference={{ type: "link", value: link }} doc={`${link.destinationTitle} ← ${link.sourceTitle}`} svg>
                {node}
              </Presentation>
            )}
            renderBadges={(_view, _placement, badges) => {
              const snapshot = workbench.linkSnapshot();
              return badges.map((badge) => {
                const port = portRefOf(badge, snapshot);
                if (!port) return <PortBadge key={badge.port} badge={badge} />;
                return (
                  <Presentation key={badge.port} reference={{ type: "port", value: port }} doc={badge.explanation} inComposite>
                    <PortBadge badge={badge} />
                  </Presentation>
                );
              });
            }}
          />
      </AppShell>
      <workbench.Launcher />
      <ObjectMenu />
    </Provider>
  );
}
