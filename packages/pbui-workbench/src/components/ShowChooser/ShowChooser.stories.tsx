import type { Meta, StoryObj } from "@storybook/react-vite";
import { linkVerbs } from "@hyperslop-systems/pbui";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useMemo } from "react";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";

const meta: Meta = { title: "Workbench/ShowChooser" };
export default meta;

/** Two notes-like targets of equal rank: the show cannot guess, so the chooser opens. */
function TwoTargets() {
  const wb = useMemo(() => {
    const workbench = createWorkbench({
      apps: demoApps,
      initial: layout(split("row", 0.4, tile("counter", { title: "Counter A" }), split("col", 0.5, tile("counter", { title: "Counter B" }), tile("counter", { title: "Counter C" })))),
    });
    // Counters have an OUT port only; give the show two INPUT targets by opening notes twice is impossible (singleton),
    // so this story shows the chooser with the notes tile plus a spawn row instead.
    const [a] = leaves(workspaceTree(workbench.store.getState().document, workbench.store.getState().workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
    if (a) workbench.links.runtime.emit(`${a}/count`, { type: "number", value: 7 });
    workbench.perform(linkVerbs.show({ type: "number", value: 7 }, { from: `${a}/count` }));
    return workbench;
  }, []);
  return (
    <div style={{ height: 480, display: "grid", gridTemplateRows: "minmax(0, 1fr)" }}>
      <wb.Surface />
    </div>
  );
}

export const Chooser: StoryObj = {
  name: "a show with nothing on screen to take it: the chooser offers the spawnable notes tile at two placements",
  render: () => <TwoTargets />,
};
