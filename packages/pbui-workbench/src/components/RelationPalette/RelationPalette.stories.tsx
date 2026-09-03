import type { Meta, StoryObj } from "@storybook/react-vite";
import { createPresentationTypeGraph, linkVerbs } from "@hyperslop-systems/pbui";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useMemo } from "react";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";

const meta: Meta = { title: "Workbench/RelationPalette" };
export default meta;

/** The notes tile's subject may derive from the counter's count through two demo relations. */
function Palette() {
  const wb = useMemo(() => {
    const workbench = createWorkbench({
      apps: demoApps,
      initial: layout(split("row", 0.5, tile("counter", { title: "Counter A" }), tile("notes"))),
      // The narrow link dependencies a product projects from its compiled
      // presentation (PBUI-KERNEL-1 §11.5); the story builds them by hand.
      links: {
        graph: createPresentationTypeGraph([{ id: "number" }, { id: "string" }]),
        relations: [
          { id: "number.double", from: "number", to: "any", label: "doubled" },
          { id: "number.label", from: "number", to: "any", label: "as a label" },
        ],
        relationEvaluation: (id, reference) => ({
          kind: "value",
          reference:
            id === "number.double"
              ? { type: "number", value: Number(reference.value) * 2 }
              : { type: "string", value: `count ${String(reference.value)}` },
        }),
      },
    });
    const [, notes] = leaves(workspaceTree(workbench.store.getState().document, workbench.store.getState().workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
    if (notes) workbench.perform(linkVerbs.openPalette(`${notes}/subject`));
    return workbench;
  }, []);
  return (
    <div style={{ height: 420, display: "grid", gridTemplateRows: "minmax(0, 1fr)" }}>
      <wb.Surface />
    </div>
  );
}

export const Open: StoryObj = {
  name: "the palette for notes.subject: two relations from the counter's count",
  render: () => <Palette />,
};
