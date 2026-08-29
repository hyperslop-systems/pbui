import type { Meta, StoryObj } from "@storybook/react-vite";
import { WorkbenchContext } from "../../context";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";
import { RebalanceStatusBadge } from "./RebalanceBadge";

/**
 * The status-bar diagnosis badge: the free DETECT pass, visible only while
 * the active workspace is broken. Click it to open the rebalance dialog.
 */
const meta: Meta<typeof RebalanceStatusBadge> = {
  title: "Workbench/RebalanceBadge",
  component: RebalanceStatusBadge,
};
export default meta;

function host(ratio: number) {
  const wb = createWorkbench({
    apps: demoApps,
    initial: layout(split("row", ratio, tile("counter"), tile("notes"))),
  });
  return function Host() {
    return (
      <WorkbenchContext.Provider value={wb}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span>status bar …</span>
          <RebalanceStatusBadge />
        </div>
        <wb.Rebalance shortcut={false} />
      </WorkbenchContext.Provider>
    );
  };
}

export const BrokenSliver: StoryObj = { render: () => { const Host = host(0.95); return <Host />; } };
export const Healthy: StoryObj = { render: () => { const Host = host(0.5); return <Host />; } };
