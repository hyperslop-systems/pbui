import { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { DatalabWorkbenchProvider } from "../../../appkit/DatalabWorkbenchContext";
import { createDatalabWorkbench, datalabSingleStageSeed } from "../../../appkit/workbench";
import { split, tile, type LayoutSpec } from "../../../store/seed";
import { ViewSwitcher } from "./ViewSwitcher";
import "../../../apps/all";

type Scenario = "many" | "none" | "linked-singleton";

/** Named rather than inline: `test/stories.test.ts` takes the first quoted `title` key in the file as the meta title. */
const CHART_TITLE = "Yield by station";

/**
 * The launcher tile is always the FIRST leaf, so the switcher targets it.
 *
 * `linked-singleton` seeds `trace` twice: the seed compiler shares a
 * singleton's logical view across leaves, so the second `tile("trace")` is a
 * second placement of the same view — the ×2 the switcher has to show.
 */
function specFor(scenario: Scenario): LayoutSpec {
  if (scenario === "none") return tile("launcher");
  if (scenario === "linked-singleton") {
    return split("row", 0.5, tile("launcher"), split("col", 0.5, tile("trace"), tile("trace")));
  }
  return split(
    "row",
    0.5,
    tile("launcher"),
    split(
      "col",
      0.5,
      tile("chart", { title: CHART_TITLE }),
      split("row", 0.5, tile("table"), tile("trace")),
    ),
  );
}

function SwitcherStory({ scenario }: { scenario: Scenario }) {
  const fixture = useMemo(() => {
    const seed = datalabSingleStageSeed("story", specFor(scenario));
    const placementId = leaves(seed.document.workspaces[0]?.tree)[0]?.id ?? "";
    return { workbench: createDatalabWorkbench({ seed }), placementId };
  }, [scenario]);

  return (
    <DatalabWorkbenchProvider workbench={fixture.workbench}>
      <ViewSwitcher placementId={fixture.placementId} />
    </DatalabWorkbenchProvider>
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
