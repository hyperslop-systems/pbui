import { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Provider } from "react-redux";
import { makeStore } from "../../../store";
import { singleStageLayout } from "../../../store/stages";
import { leaf as placement, split, type Node, type NodeId } from "../../../store/layout";
import { ViewSwitcher } from "./ViewSwitcher";
import "../../../apps/all";

type Scenario = "many" | "none" | "linked-singleton";

function SwitcherStory({ scenario }: { scenario: Scenario }) {
  const fixture = useMemo(() => {
    let placementId: NodeId = "";
    const layout = singleStageLayout("story", (builder) => {
      const launcher = builder.leaf("launcher");
      placementId = launcher.id;
      if (scenario === "none") return launcher;
      if (scenario === "linked-singleton") {
        const trace = builder.leaf("trace") as Extract<Node, { type: "leaf" }>;
        return split("row", launcher, split("col", trace, placement(trace.viewId), 0.5), 0.5);
      }
      return split(
        "row",
        launcher,
        split(
          "col",
          builder.leaf("chart", null, "Yield by station"),
          split("row", builder.leaf("table"), builder.leaf("trace"), 0.5),
          0.5,
        ),
        0.5,
      );
    });
    return {
      store: makeStore({ preloaded: { layout } }),
      placementId,
    };
  }, [scenario]);

  return (
    <Provider store={fixture.store}>
      <ViewSwitcher placementId={fixture.placementId} />
    </Provider>
  );
}

const meta = {
  title: "Component Library/Organisms/ViewSwitcher",
  component: SwitcherStory,
  parameters: { tile: { width: 620, height: 440 } },
  args: { scenario: "many" },
} satisfies Meta<typeof SwitcherStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExistingAndNewViews: Story = {};
export const OnlyNewViews: Story = { args: { scenario: "none" } };
export const LinkedSingletonView: Story = { args: { scenario: "linked-singleton" } };

export const SelectExistingView: Story = {
  play: async ({ canvasElement }) => {
    const option = [...canvasElement.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Yield by station"),
    );
    if (!option) throw new Error("the existing view option did not render");
    option.click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    if (
      [...canvasElement.querySelectorAll<HTMLButtonElement>("button")].some((button) =>
        button.textContent?.includes("Yield by station"),
      )
    ) {
      throw new Error("selecting the existing view did not re-point the placement");
    }
  },
};
