import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type CSSProperties } from "react";
import { Dialog } from "./Dialog";

const meta = {
  title: "Component Library/Organisms/Dialog",
  component: Dialog,
  parameters: { layout: "fullscreen" },
  args: {
    title: "Import a workspace",
    onClose: () => {},
    children: <textarea aria-label="Workspace bundle" defaultValue="Paste a bundle here" />,
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ThemeOverrides: Story = {
  decorators: [
    (StoryComponent) => (
      <div
        style={
          {
            "--pbui-dialog-surface": "#172554",
            "--pbui-dialog-text": "#dbeafe",
            "--pbui-dialog-border": "#60a5fa",
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

export const LiveClose: Story = {
  render: (args) => {
    function Example() {
      const [open, setOpen] = useState(true);
      return open ? (
        <Dialog {...args} onClose={() => setOpen(false)} />
      ) : (
        <button type="button" onClick={() => setOpen(true)}>
          Reopen
        </button>
      );
    }
    return <Example />;
  },
};
