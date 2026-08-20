import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo } from "react";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";

const meta: Meta = {
  title: "Workbench/Launcher",
};
export default meta;

export const Open: StoryObj = {
  name: "open: a placed singleton is “go to”, the rest “place”",
  render: function OpenStory() {
    const wb = useMemo(() => createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) }), []);
    useEffect(() => {
      wb.verbs.openLauncher();
    }, [wb]);
    return (
      <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", height: 360 }}>
        <wb.Surface />
        <wb.Launcher />
      </div>
    );
  },
};
