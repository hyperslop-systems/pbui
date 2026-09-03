import type { Meta, StoryObj } from "@storybook/react-vite";
import { linkVerbs } from "@hyperslop-systems/pbui";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useMemo } from "react";
import { Button, Text } from "@hyperslop-systems/pbui";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";

const meta: Meta = { title: "Workbench/LinkAnnouncer" };
export default meta;

/** The live region made visible, so what a screen reader would hear can be seen. */
function Visible() {
  const wb = useMemo(() => createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter", { title: "Counter A" }), tile("notes"))) }), []);
  const ids = () => leaves(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 8, height: 460 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <Button size="tiny" variant="framed" onClick={() => wb.perform(linkVerbs.follow(`${ids()[0]}/count`, `${ids()[1]}/subject`))}>
          link
        </Button>
        <Button size="tiny" variant="framed" onClick={() => wb.perform(linkVerbs.pin(`${ids()[1]}/subject`))}>
          pin
        </Button>
        <Text size="tiny" tone="faint">
          then press “count” in the counter — the announcer line below the surface updates, coalesced per tile
        </Text>
      </div>
      <style>{`[data-part="link-announcer"] { position: static !important; width: auto !important; height: auto !important; clip: auto !important; clip-path: none !important; white-space: normal !important; padding: 4px 8px; border-top: 1px solid currentColor; font-size: 12px; }`}</style>
      <wb.Surface />
    </div>
  );
}

export const Announcements: StoryObj = {
  name: "coordination announcements, coalesced per target",
  render: () => <Visible />,
};
