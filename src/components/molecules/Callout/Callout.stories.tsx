import type { Meta, StoryObj } from "@storybook/react-vite";
import { Callout } from "./Callout";
import { Button } from "../../atoms";
import { CodeText, Text } from "../../foundation";
import { Stack } from "../../layout";

/**
 * Three of these existed inline, all as `<Surface tone="alt" role="status">`,
 * and none of them announced itself the same way.
 */
const meta = {
  title: "Component Library/Molecules/Callout",
  component: Callout,
  parameters: { tile: false },
  args: { children: null },
} satisfies Meta<typeof Callout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TheThreeItReplaced: Story = {
  render: () => (
    <Stack gap={4}>
      <Callout
        variant="ok"
        title="Published — version 3"
        actions={<Button>Open in a chart</Button>}
      >
        <Text size="small">Four files, 1.2 MB. Readers can see it now.</Text>
      </Callout>

      <Callout variant="warning" title="An unfinished upload is waiting">
        <Text size="small">version 2 · 3 files · 840 kB</Text>
      </Callout>

      <Callout variant="info">
        <Text size="small" prose>
          This page is not a secure context, so the browser cannot compute digests. Files will be
          uploaded in full and the server will hash them as it writes.
        </Text>
      </Callout>
    </Stack>
  ),
};

/**
 * The one-time secret panel.
 *
 * The secret exists in component state and in one HTTP response. It is never in
 * Redux, never in a presentation value and never in a verb (DR-28), so it
 * cannot reach the inspector, the watchlist, the trace or localStorage. The
 * value below is not a real token shape.
 */
export const TheOneTimeSecret: Story = {
  render: () => (
    <Callout
      variant="ok"
      title="Copy this now — it is shown once"
      actions={
        <>
          <Button>Copy</Button>
          <Button>Done</Button>
        </>
      }
    >
      <Stack gap={2}>
        <CodeText wrapAnywhere selectable>
          ddp_exampleexampl_exampleexampleexampleexampleexam
        </CodeText>
        <Text size="tiny" tone="faint" prose>
          datadrop stores only a hash of this. Dismissing the panel is irreversible; if you lose it,
          revoke the token and mint another.
        </Text>
      </Stack>
    </Callout>
  ),
};

/**
 * Four severities, one recipe. The 4px edge is the severity in colour; the
 * glyph in the title is the severity in greyscale. `danger` announces as an
 * alert, the other three as status — which is why a danger variant used to be
 * refused, and why it is drawn as the same box now that the role differs.
 */
export const VariantsSurviveGreyscale: Story = {
  render: () => (
    <Stack gap={3}>
      <Callout variant="info" title="Info">
        <Text size="small">no glyph, neutral edge</Text>
      </Callout>
      <Callout variant="ok" title="Done">
        <Text size="small">✓ prefix, ok edge</Text>
      </Callout>
      <Callout variant="warning" title="Waiting">
        <Text size="small">⚠ prefix, gold edge</Text>
      </Callout>
      <Callout variant="danger" title="Program error (run, E_RUNTIME)" hint="fix the script and run it again" onDismiss={() => {}}>
        <Text size="small">✕ prefix, danger edge, announced as an alert</Text>
      </Callout>
    </Stack>
  ),
};
