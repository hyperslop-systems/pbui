import type { Meta, StoryObj } from "@storybook/react-vite";
import { InspectorPanel } from "./InspectorPanel";

const meta = {
  title: "Component Library/Organisms/InspectorPanel",
  component: InspectorPanel,
  args: {
    inspected: {
      title: "Person",
      value: { id: "person-1", name: "Grace Hopper", active: true },
    },
  },
} satisfies Meta<typeof InspectorPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { inspected: null, emptyMessage: "Right-click an object and choose Inspect." },
};

export const Unstyled: Story = {
  args: { unstyled: true },
};

export const CustomRenderer: Story = {
  args: {
    renderValue: ({ value }) => (
      <dl>
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{String(item)}</dd>
          </div>
        ))}
      </dl>
    ),
  },
};
