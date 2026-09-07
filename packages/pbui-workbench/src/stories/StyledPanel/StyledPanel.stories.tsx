import type { Meta, StoryObj } from "@storybook/react-vite";
import { Callout } from "@hyperslop-systems/pbui";
import { StyledPanelDemo, StyledWorkbench } from "./StyledPanel";
import styles from "./StyledPanel.module.css";

const meta = {
  title: "Workbench/Getting Started/Styled Panel",
  component: StyledPanelDemo,
  decorators: [(Story, context) => context.parameters.nativeHost ? <Story /> : <div className={[styles.panelHost, context.parameters.narrow ? styles.narrow : ""].join(" ")}><Story /></div>],
  parameters: { docs: { description: { component: "Synthetic DTO/callback panel. Inspect is explicit and local. NativeWorkbench separately mounts the real shell, registry and document. See docs/guides/first-styled-workbench-panel.md." } } },
} satisfies Meta<typeof StyledPanelDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { state: "empty" } };
export const Loading: Story = { args: { state: "loading" } };
export const Error: Story = { args: { state: "error" } };
export const Disabled: Story = { args: { state: "disabled" } };
export const NarrowOverflow: Story = { parameters: { narrow: true }, args: { initialValue: "long-identifier-".repeat(30) } };
export const ThemeOverride: Story = { decorators: [(Story) => <div className={styles.theme}><Story /></div>] };
export const DetailsSlot: Story = { args: { details: <Callout title="Application-owned detail">A plain slot needs no presentation provider.</Callout> } };
export const NativeWorkbench: Story = { parameters: { nativeHost: true }, render: () => <StyledWorkbench /> };
