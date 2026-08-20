import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";

const meta: Meta = {
  title: "Workbench/SplitPane",
};
export default meta;

export const Nested: StoryObj = {
  name: "nested splits, each divider independently resizable",
  render: function NestedStory() {
    const wb = useMemo(
      () =>
        createWorkbench({
          apps: demoApps,
          initial: layout(
            split("col", 0.5, split("row", 0.25, tile("counter"), tile("counter")), split("row", 0.75, tile("notes"), tile("counter"))),
          ),
        }),
      [],
    );
    return (
      <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", height: 420 }}>
        <wb.Surface />
      </div>
    );
  },
};
