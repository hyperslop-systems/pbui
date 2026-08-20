import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { chat } from "../../../demo/src/chat";
import { Messages } from "../../messages/Messages";
import { DemoChat, eagle, transcript } from "../../stories/DemoChat";
import { Composer } from "./Composer";

const meta: Meta<typeof Composer> = {
  title: "pbui-chat/Composer",
  component: Composer,
  decorators: [
    (Story) => (
      <DemoChat entities={transcript}>
        <Story />
      </DemoChat>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Composer>;

/** Empty draft; "insert object…" enters accept mode — click any presentation in the transcript story below. */
export const Empty: Story = {};

function SeedDraft() {
  useEffect(() => {
    chat.store.clearDraft();
    chat.store.setDraftText("why is stock low for ");
    chat.store.insertReference(eagle, "the Eagle");
  }, []);
  return null;
}

/** A draft with a typed mention: the chip above the text is the same live presentation as in prose. */
export const WithMention: Story = {
  render: () => (
    <>
      <SeedDraft />
      <Composer />
    </>
  ),
};

/** The transcript and the composer together, as the demo mounts them. */
export const WithTranscript: Story = {
  render: () => (
    <>
      <Messages follow={false} />
      <Composer />
    </>
  ),
};
