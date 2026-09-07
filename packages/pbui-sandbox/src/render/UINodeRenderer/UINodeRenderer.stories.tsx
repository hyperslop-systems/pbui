import type { Meta, StoryObj } from "@storybook/react-vite";
import { UINodeRenderer } from "./UINodeRenderer";

const meta: Meta<typeof UINodeRenderer> = { title: "Sandbox/Generated Notices", component: UINodeRenderer };
export default meta;

export const SeverityMatrix: StoryObj<typeof UINodeRenderer> = {
  args: {
    onEvent: () => undefined,
    renderReference: (_, label) => <span>{label}</span>,
    tree: {
      kind: "column",
      children: (["neutral", "positive", "warning", "danger"] as const).map((variant) => ({
        kind: "callout",
        props: { variant, title: variant, text: `Generated ${variant} notice; severity is not collapsed.` },
      })),
    },
  },
  decorators: [(Story) => <div style={{ width: 280 }}><Story /></div>],
};
