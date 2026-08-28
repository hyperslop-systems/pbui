import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";
import { rebalanceSettingsApp } from "./RebalanceSettings";

/**
 * The settings tile placed beside a working tile. Edits commit into the
 * workbench document as the `pbui.rebalance-config` payload; open the
 * rebalance dialog (Mod+Shift+K) to see the config take effect.
 */
function Harness() {
  const wb = useMemo(
    () =>
      createWorkbench({
        apps: [...demoApps, rebalanceSettingsApp],
        initial: layout(split("row", 0.55, tile("counter"), tile("rebalance-settings"))),
      }),
    [],
  );
  return (
    <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", height: 520, padding: 8 }}>
      <wb.Surface />
      <wb.Rebalance />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: "Workbench/RebalanceSettings",
  component: Harness,
};
export default meta;

type Story = StoryObj<typeof Harness>;

export const Default: Story = {};
