import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { createWorkbench } from "../../createWorkbenchShell";
import { layout, split, tile } from "@hyperslop-systems/workbench-core";
import { demoApps } from "../../stories/demoApps";

/**
 * The rebalance dialog over a deliberately degenerate layout: press
 * Mod+Shift+K inside the story (or use the button-free store door via the
 * play area) to open it. The `Broken` story starts with the dialog open.
 */
function Harness({ open }: { open: boolean }) {
  const wb = useMemo(() => {
    const workbench = createWorkbench({
      apps: demoApps,
      initial: layout(
        split(
          "row",
          0.92,
          tile("counter"),
          split("col", 0.85, tile("notes"), tile("counter")),
        ),
      ),
    });
    if (open) workbench.dispatch({ kind: "rebalance.open" });
    return workbench;
  }, [open]);
  return (
    <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", height: 480, padding: 8 }}>
      <wb.Surface />
      <wb.Rebalance />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: "Workbench/RebalanceDialog",
  component: Harness,
};
export default meta;

type Story = StoryObj<typeof Harness>;

/** A sliver-and-hog layout with the dialog already open. */
export const Broken: Story = { args: { open: true } };

/** Closed; press Mod+Shift+K to open it over the degenerate layout. */
export const ShortcutClosed: Story = { args: { open: false } };
