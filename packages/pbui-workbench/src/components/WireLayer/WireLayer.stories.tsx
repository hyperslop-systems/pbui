import type { Meta, StoryObj } from "@storybook/react-vite";
import { linkVerbs, terms } from "@hyperslop-systems/pbui";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useMemo } from "react";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { linksMutation } from "../../links/document";
import { demoApps } from "../../stories/demoApps";

const meta: Meta = { title: "Workbench/WireLayer" };
export default meta;

/** Three tiles wired every way a term can be: follow, held (suspended follow), derived. */
function EveryStyle() {
  const wb = useMemo(() => {
    const workbench = createWorkbench({
      apps: demoApps,
      initial: layout(split("row", 0.45, tile("counter", { title: "Counter A" }), split("col", 0.5, tile("notes"), tile("counter", { title: "Counter B" })))),
    });
    const ids = leaves(workspaceTree(workbench.store.getState().document, workbench.store.getState().workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
    const [a, notes, b] = ids;
    if (a && notes && b) {
      workbench.mutate([
        linksMutation(
          new Map([
            [`${notes}/subject`, terms.hold({ type: "number", value: 3 }, terms.follow(`${a}/count`, "L1"))],
            [`${b}/count`, terms.derived(terms.follow(`${a}/count`, "L2"), "double", "L2")],
          ]),
        ),
      ]);
    }
    workbench.perform(linkVerbs.openMode());
    return workbench;
  }, []);
  return (
    <div style={{ height: 480, display: "grid", gridTemplateRows: "minmax(0, 1fr)" }}>
      <wb.Surface />
    </div>
  );
}

export const Styles: StoryObj = {
  name: "wire styles: dotted for a held (suspended) follow, dashed and labelled for derived",
  render: () => <EveryStyle />,
};
