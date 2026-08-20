import type { Meta, StoryObj } from "@storybook/react-vite";
import { Callout } from "@hyperslop-systems/pbui";
import { DemoChat, formDocument, healthDocument, nestedDocument, tableDocument, transcript } from "../../stories/DemoChat";
import { PbuiWidget } from "./PbuiWidget";

const meta: Meta<typeof PbuiWidget> = {
  title: "pbui-chat/PbuiWidget",
  component: PbuiWidget,
  decorators: [
    (Story) => (
      <DemoChat entities={transcript}>
        <Story />
      </DemoChat>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof PbuiWidget>;

/** Meter, sparkline, segmented bar, stats, refs and verb chips — one invalid chip renders disabled with its reason. */
export const Health: Story = {
  args: { document: healthDocument, instanceId: "m2-w1", status: "READY" },
};

/** A table still streaming: dashed frame, `data-state="streaming"`, headers are `<field>`s and handles are `<row>`s. */
export const StreamingTable: Story = {
  args: { document: tableDocument, instanceId: "m2-w2", status: "STREAMING" },
};

/** A form with an object field: "pick…" enters accept mode for `<product>`. */
export const Form: Story = {
  args: { document: formDocument, instanceId: "m2-w3" },
};

/** Nested documents in a row layout, with a log. */
export const Nested: Story = {
  args: { document: nestedDocument, instanceId: "m2-w4" },
};

/** A document that fails validation renders the reason; the server would have published `pbui.error` instead. */
export const Invalid: Story = {
  args: {
    document: { format: "pbui.widget", schema_version: 1, children: [{ kind: "hologram" } as never] },
    instanceId: "m2-w5",
  },
};

/** What `pbui.error` looks like when the server rejects a document. */
export const ServerError: Story = {
  render: () => (
    <Callout variant="warning" title="widget error">
      children[2] has unknown kind &quot;hologram&quot;
    </Callout>
  ),
};
