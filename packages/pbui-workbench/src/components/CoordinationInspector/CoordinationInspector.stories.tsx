import type { Meta, StoryObj } from "@storybook/react-vite";
import { linkVerbs } from "@hyperslop-systems/pbui";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useMemo } from "react";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";
import { coordinationInspectorApp } from "./CoordinationInspector";

const meta: Meta = { title: "Workbench/CoordinationInspector" };
export default meta;

function Inspector() {
  const wb = useMemo(() => {
    const workbench = createWorkbench({
      apps: [...demoApps, coordinationInspectorApp],
      initial: layout(split("row", 0.5, split("col", 0.5, tile("counter", { title: "Counter A" }), tile("notes")), tile("coordination"))),
    });
    const [counter, notes] = leaves(workspaceTree(workbench.store.getState().document, workbench.store.getState().workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
    if (counter && notes) {
      workbench.perform(linkVerbs.follow(`${counter}/count`, `${notes}/subject`));
      workbench.links.runtime.emit(`${counter}/count`, { type: "number", value: 4 });
    }
    return workbench;
  }, []);
  return (
    <div style={{ height: 480, display: "grid", gridTemplateRows: "minmax(0, 1fr)" }}>
      <wb.Surface />
    </div>
  );
}

export const Tile: StoryObj = {
  name: "the coordination tile beside a linked pair: ports, wires, contexts, invariants",
  render: () => <Inspector />,
};
