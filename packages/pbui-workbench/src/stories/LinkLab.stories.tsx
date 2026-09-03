import type { Meta, StoryObj } from "@storybook/react-vite";
import { linkVerbs } from "@hyperslop-systems/pbui";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useMemo, useState } from "react";
import { Button, Text } from "@hyperslop-systems/pbui";
import { createWorkbench } from "../createWorkbenchShell";
import { layout, split, tile } from "@hyperslop-systems/workbench-core";
import { demoApps } from "./demoApps";

/**
 * THE LINK LAB (PBUI-LINK-1 Phase 2): the shell's own smallest linking demo.
 * A counter tile emits its count; a notes tile reads its `subject` port. The
 * buttons perform the same verbs a product's badge menu would — this package
 * has no pbui instance of its own, so there is no object menu here; the
 * badge in the notes tile's header is the plain `PortBadge`.
 */
function LinkLab() {
  const wb = useMemo(() => createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter", { title: "Counter A" }), tile("notes"))) }), []);
  const [, tick] = useState(0);
  const views = () => leaves(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
  const perform = (make: (counter: string, notes: string) => ReturnType<typeof linkVerbs.follow>) => {
    const [counter, notes] = views();
    if (!counter || !notes) return;
    wb.perform(make(counter, notes));
    tick((n) => n + 1);
  };
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 8, height: "100vh", padding: 8, boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <Text size="small" strong>
          LINK LAB
        </Text>
        <Button size="tiny" variant="framed" onClick={() => perform((c, n) => linkVerbs.follow(`${c}/count`, `${n}/subject`))}>
          notes.subject → follow counter.count
        </Button>
        <Button size="tiny" variant="framed" onClick={() => perform((_c, n) => linkVerbs.pin(`${n}/subject`))}>
          pin
        </Button>
        <Button size="tiny" variant="framed" onClick={() => perform((_c, n) => linkVerbs.resume(`${n}/subject`))}>
          resume
        </Button>
        <Button size="tiny" variant="framed" onClick={() => perform((_c, n) => linkVerbs.detach(`${n}/subject`))}>
          detach
        </Button>
        <Button size="tiny" variant="framed" onClick={() => perform((_c, n) => linkVerbs.clear(`${n}/subject`))}>
          clear
        </Button>
        <Text size="tiny" tone="faint">
          press “count” in the counter after linking; the badge in the notes header says what the port reads
        </Text>
      </div>
      <div style={{ minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)" }}>
        <wb.Surface />
      </div>
      <wb.Launcher />
    </div>
  );
}

const meta: Meta<typeof LinkLab> = {
  title: "Workbench/LinkLab",
  component: LinkLab,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof LinkLab>;

export const Lab: Story = {};
