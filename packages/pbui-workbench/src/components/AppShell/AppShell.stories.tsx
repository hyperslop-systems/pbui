import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, EmptyState, Text } from "@hyperslop-systems/pbui";
import { AppShell } from "./AppShell";

/**
 * The page shell every workbench product mounts: masthead, strip, canvas,
 * status. The stories show the slots filled and empty; the canvas holds a
 * placeholder because the workbench surface needs a document.
 */
const meta: Meta<typeof AppShell> = {
  title: "Workbench/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div style={{ height: 420 }}><Story /></div>],
};
export default meta;

type Story = StoryObj<typeof AppShell>;

const Canvas = () => (
  <div style={{ border: "var(--pbui-border-firm)", background: "var(--pbui-pane)", display: "grid", placeItems: "center" }}>
    <EmptyState message="the workbench surface goes here" hint="every tile below it gets a committed height" />
  </div>
);

export const EverySlot: Story = {
  name: "every slot filled",
  args: {
    wordmark: "Gold coin shop",
    tagline: "agent",
    mastheadActions: (
      <>
        <Button size="tiny" variant="framed">+ conversation</Button>
        <Button size="tiny">reset layout</Button>
      </>
    ),
    strip: (
      <>
        <Button size="tiny" variant="framed" selected>main</Button>
        <Button size="tiny" variant="framed">customers</Button>
        <Button size="tiny" variant="framed">+ workspace</Button>
      </>
    ),
    stripActions: (
      <Text size="tiny" tone="faint">
        Mod+K opens the launcher
      </Text>
    ),
    status: (
      <div style={{ background: "var(--pbui-ink)", color: "var(--pbui-paper)", padding: "var(--pbui-space-1) var(--pbui-space-4)" }}>
        <Text size="small">READY · hover anything</Text>
      </div>
    ),
    children: <Canvas />,
  },
};

export const Embedded: Story = {
  name: "embedded: no masthead, no strip",
  args: { masthead: false, wordmark: "unused", children: <Canvas /> },
};
