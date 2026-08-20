import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Text } from "@hyperslop-systems/pbui";
import { createWorkbench } from "../../createWorkbench";
import { split, tile, workspaces } from "../../document";
import { demoApps } from "../../stories/demoApps";

const workbench = createWorkbench({
  apps: demoApps,
  initial: workspaces([
    { name: "main", spec: split("row", 0.6, tile("counter"), tile("notes")) },
    { name: "scratch", spec: tile("counter") },
    { name: "third", spec: split("col", 0.5, tile("counter"), tile("counter")) },
  ]),
});

const meta: Meta<typeof workbench.WorkspaceStrip> = {
  title: "workbench/WorkspaceStrip",
  component: workbench.WorkspaceStrip,
  render: (args) => (
    <div style={{ display: "grid", gridTemplateRows: "max-content minmax(0, 1fr)", height: "24rem" }}>
      <workbench.WorkspaceStrip {...args} />
      <workbench.Surface />
    </div>
  ),
};
export default meta;

type Story = StoryObj<typeof workbench.WorkspaceStrip>;

export const Default: Story = {};

export const WithAdd: Story = { args: { addLabel: "new" } };

/** What a product does instead: its own row, or its `<workspace>` Presentation. */
export const CustomRow: Story = {
  args: {
    renderWorkspace: (workspace, placement) => (
      <Button size="tiny" variant={placement.active ? "raised" : "bare"} onClick={placement.select}>
        <Text size="tiny" strong={placement.active}>
          {workspace.name} · {placement.tileCount}
        </Text>
      </Button>
    ),
  },
};
