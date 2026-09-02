import type { Meta, StoryObj } from "@storybook/react-vite";
import { linkVerbs } from "@hyperslop-systems/pbui";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useMemo } from "react";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";

const meta: Meta = { title: "Workbench/PortRail" };
export default meta;

function Rails({ linked }: { linked?: boolean }) {
  const wb = useMemo(() => {
    const workbench = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter", { title: "Counter A" }), tile("notes"))) });
    const [counter, notes] = leaves(workspaceTree(workbench.store.getState().document, workbench.store.getState().workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
    if (linked && counter && notes) workbench.perform(linkVerbs.follow(`${counter}/count`, `${notes}/subject`));
    workbench.perform(linkVerbs.openMode());
    return workbench;
  }, [linked]);
  return (
    <div style={{ height: 420, display: "grid", gridTemplateRows: "minmax(0, 1fr)" }}>
      <wb.Surface />
    </div>
  );
}

export const BackSides: StoryObj = {
  name: "connect mode: every tile flips to its rail; drag the counter's ▸ count onto the notes' ◂ subject",
  render: () => <Rails />,
};

export const WithAWire: StoryObj = {
  name: "a wire already declared: notes.subject follows counter.count",
  render: () => <Rails linked />,
};
