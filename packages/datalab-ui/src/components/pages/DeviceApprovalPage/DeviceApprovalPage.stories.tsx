import type { Meta, StoryObj } from "@storybook/react-vite";
import { DeviceApprovalPage } from "./DeviceApprovalPage";

const meta = {
  title: "Applications/Workbench/DeviceApprovalPage",
  component: DeviceApprovalPage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DeviceApprovalPage>;

export default meta;
type Story = StoryObj<typeof meta>;

// The production page reads an approval URL. This story only establishes that
// it has a documented, safe state when opened without one.
export const MissingPairingLink: Story = {};
