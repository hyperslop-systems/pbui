import type { Meta, StoryObj } from "@storybook/react-vite";
import { create } from "@bufbuild/protobuf";
import { AppViewSchema } from "@hyperslop-systems/workbench-protocol";
import { DemoChat, healthDocument, widgetEntity } from "../../stories/DemoChat";
import { WidgetApp } from "./WidgetApp";

const meta: Meta = {
  title: "Apps/WidgetApp",
};
export default meta;

export const BoundToAWidget: StoryObj = {
  name: "documents.widget names the live instance",
  render: () => (
    <DemoChat entities={[widgetEntity("w-health", healthDocument)]}>
      <div style={{ display: "grid", height: 360, border: "var(--pbui-border-hair)" }}>
        <WidgetApp placementId="story-widget" view={create(AppViewSchema, { id: "v-w", appId: "widget", documents: { widget: "w-health" } })} />
      </div>
    </DemoChat>
  ),
};

export const Gone: StoryObj = {
  name: "the widget left the timeline",
  render: () => (
    <DemoChat>
      <div style={{ display: "grid", height: 160, border: "var(--pbui-border-hair)" }}>
        <WidgetApp placementId="story-widget" view={create(AppViewSchema, { id: "v-w", appId: "widget", documents: { widget: "w-missing" } })} />
      </div>
    </DemoChat>
  ),
};
