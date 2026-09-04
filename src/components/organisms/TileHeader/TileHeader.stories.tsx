import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Chip } from "../../atoms";
import { TileHeader } from "./TileHeader";

const meta = {
  title: "Component Library/Organisms/TileHeader",
  component: TileHeader,
  args: { title: "orders" },
} satisfies Meta<typeof TileHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {};

export const WithChipStatusActions: Story = {
  name: "with a chip, a status and an action",
  args: {
    title: "orders",
    children: <Chip label="in Gold" state="active" size="tiny" />,
    status: "65 orders · $358,661.30 booked",
    actions: (
      <Button size="tiny" variant="framed">
        export
      </Button>
    ),
  },
};
