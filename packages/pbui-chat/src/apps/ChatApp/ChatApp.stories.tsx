import type { Meta, StoryObj } from "@storybook/react-vite";
import { create } from "@bufbuild/protobuf";
import { AppViewSchema } from "@hyperslop-systems/workbench-protocol";
import { DemoChat, eagle, eagles, healthDocument, messageEntity, refsEntity, widgetEntity } from "../../stories/DemoChat";
import { ChatApp } from "./ChatApp";

const meta: Meta = {
  title: "Apps/ChatApp",
};
export default meta;

const view = create(AppViewSchema, { id: "v-chat", appId: "chat" });

export const InATile: StoryObj = {
  name: "the conversation as a tile: transcript, composer, mouse-doc line",
  render: () => (
    <DemoChat
      entities={[
        messageEntity("m1", "user", "which gold eagles are low on stock?"),
        messageEntity("m2", "assistant", "Stock for [[product:2049|the 2024 Eagle]] is below its reorder point; the rest of [[category:7|American Gold Eagles]] is fine."),
        refsEntity("m2", [eagle, eagles]),
        widgetEntity("w-health", healthDocument),
      ]}
    >
      <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", height: 480, border: "var(--pbui-border-hair)" }}>
        <ChatApp placementId="story-chat" view={view} />
      </div>
    </DemoChat>
  ),
};
