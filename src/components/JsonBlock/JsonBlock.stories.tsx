import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { JsonBlock } from "./JsonBlock";

const meta = {
  title: "Component Library/Molecules/JsonBlock",
  component: JsonBlock,
  args: {
    value: {
      type: "person",
      name: "Ada Lovelace",
      capabilities: ["inspect", "compose"],
    },
  },
} satisfies Meta<typeof JsonBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ThemeOverrides: Story = {
  decorators: [
    (StoryComponent) => (
      <div
        style={
          {
            "--pbui-code-surface": "#111827",
            "--pbui-code-text": "#d1fae5",
          } as CSSProperties
        }
      >
        <StoryComponent />
      </div>
    ),
  ],
};

export const Unstyled: Story = {
  args: { unstyled: true },
};

export const Unserializable: Story = {
  args: { value: { count: 1n } },
};
