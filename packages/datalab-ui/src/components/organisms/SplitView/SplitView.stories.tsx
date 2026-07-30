import { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Provider } from "react-redux";
import { NodeView } from "./SplitView";
import { makeStore } from "../../../store";
import { singleStageLayout } from "../../../store/stages";
import { split, type LayoutBuilder, type Node } from "../../../store/layout";
import "../../../apps/all";

type LayoutKind = "one" | "row" | "column" | "nested";

function build(kind: LayoutKind, builder: LayoutBuilder): Node {
  if (kind === "one") return builder.leaf("about");
  if (kind === "row") {
    return split("row", builder.leaf("about"), builder.leaf("launcher"), 0.5);
  }
  if (kind === "column") {
    return split("col", builder.leaf("about"), builder.leaf("launcher"), 0.5);
  }
  return split(
    "row",
    builder.leaf("launcher"),
    split("col", builder.leaf("about"), builder.leaf("trace"), 0.6),
    0.3,
  );
}

function SplitStory({ kind }: { kind: LayoutKind }) {
  const fixture = useMemo(() => {
    const layout = singleStageLayout("story", (builder) => build(kind, builder));
    return {
      store: makeStore({ preloaded: { layout } }),
      node: layout.spaces[0]!.tree,
    };
  }, [kind]);
  return (
    <Provider store={fixture.store}>
      <NodeView node={fixture.node} />
    </Provider>
  );
}

const meta = {
  title: "Component Library/Organisms/SplitView",
  component: SplitStory,
  parameters: { tile: { width: 640, height: 420 } },
  args: { kind: "one" },
} satisfies Meta<typeof SplitStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneLeaf: Story = {};
export const SplitHorizontally: Story = { args: { kind: "row" } };
export const SplitVertically: Story = { args: { kind: "column" } };
export const NestedAndUneven: Story = { args: { kind: "nested" } };
