import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { Text } from "@hyperslop-systems/pbui";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";

const meta: Meta = {
  title: "Workbench/Tile",
};
export default meta;

export const TitleSlot: StoryObj = {
  name: "renderTitle: the product's own title presentation in the bar",
  render: function TitleSlotStory() {
    const wb = useMemo(() => createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) }), []);
    return (
      <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", height: 300 }}>
        <wb.Surface
          renderTitle={(view, placement) => (
            <Text size="tiny" strong title={`view ${view.id}`}>
              {placement.label} · {placement.placementCount === 1 ? "1 place" : `${placement.placementCount} places`}
            </Text>
          )}
        />
      </div>
    );
  },
};

export const UnknownApp: StoryObj = {
  name: "a view of an application this build lacks",
  render: function UnknownAppStory() {
    const wb = useMemo(() => createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("retired-app"))) }), []);
    return (
      <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", height: 300 }}>
        <wb.Surface />
      </div>
    );
  },
};
