import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, JsonBlock, Stack, Text, planIdentityAdd, quotientOf, type SplitPolicy } from "@hyperslop-systems/pbui";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useMemo, useState } from "react";
import { defineWorkbenchApp, type AppProps } from "../app";
import { createWorkbench } from "../createWorkbenchShell";
import { layout, split, tile } from "@hyperslop-systems/workbench-core";
import { useEmitPort, usePort } from "../links/hooks";

/**
 * THE IDENTITY LAB (PBUI-KERNEL-3): the shell's own smallest shared-cell
 * demo. Three pickers each own an INOUT `selection` port. Two of them have
 * the same contract and may share one logical cell; the third has another
 * authority domain and may not — the refusal names the field. The buttons
 * perform the same identity verbs a Ctrl-drag on the port rail would, and
 * the panel below shows the quotient the snapshot exposes.
 */
function Picker({ view, authority }: AppProps & { authority: string }) {
  const selection = usePort<number>(view, "selection");
  const emit = useEmitPort(view, "selection");
  return (
    <div data-part="picker-app">
      <Stack gap={2}>
        <Text size="small" tone="faint">
          authority <code>{authority}</code> · view <code>{view.id}</code>
        </Text>
        <Text size="title" strong>
          {selection.value === null ? "—" : String(selection.value)}
        </Text>
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3].map((n) => (
            <Button key={n} size="tiny" variant="framed" onClick={() => emit({ type: "number", value: n })}>
              pick {n}
            </Button>
          ))}
        </div>
        <Text size="tiny" tone="faint">
          {selection.badge.explanation}
        </Text>
      </Stack>
    </div>
  );
}

const picker = (id: string, title: string, authority: string) =>
  defineWorkbenchApp({
    manifest: { id, ports: [{ name: "selection", direction: "inout", contract: { valueType: "number", semanticRole: "selection", authorityDomain: authority }, doc: `the picked number (${authority})` }] },
    presentation: { title, tone: "var(--pbui-cat-3)", Component: (props: AppProps) => <Picker {...props} authority={authority} /> },
  });

const apps = [picker("picker", "picker", "orders"), picker("sales-picker", "sales picker", "daily_sales")];

function IdentityLab() {
  const wb = useMemo(
    () =>
      createWorkbench({
        apps,
        initial: layout(split("row", 0.34, tile("picker", { title: "Picker A" }), split("row", 0.5, tile("picker", { title: "Picker B" }), tile("sales-picker", { title: "Sales" })))),
      }),
    [],
  );
  const [, tick] = useState(0);
  const [last, setLast] = useState<string>("");
  const views = () => leaves(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
  const share = (rightIndex: 1 | 2) => {
    const v = views();
    const left = `${v[0]}/selection`;
    const right = `${v[rightIndex]}/selection`;
    const plan = planIdentityAdd(left, right, "prefer-left", wb.linkSnapshot(), wb.links.deps);
    setLast(plan.kind === "available" ? plan.explanation : plan.kind === "unavailable" ? `refused (${plan.code}): ${plan.because}` : "ambiguous");
    if (plan.kind === "available") wb.perform(plan.verb);
    tick((n) => n + 1);
  };
  const leave = (splitPolicy: SplitPolicy) => {
    const declaration = wb.linkSnapshot().identity[0];
    if (!declaration) {
      setLast("nothing to leave");
      return;
    }
    wb.perform({ kind: "identity.remove", linkId: declaration.linkId, splitPolicy });
    setLast(`left the cell · ${splitPolicy}`);
    tick((n) => n + 1);
  };
  const snapshot = wb.linkSnapshot();
  const quotient = quotientOf(snapshot);
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr) auto", gap: 8, height: "100vh", padding: 8, boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <Text size="small" strong>
          IDENTITY LAB
        </Text>
        <Button size="tiny" variant="framed" onClick={() => share(1)}>
          A ≡ B (share a cell)
        </Button>
        <Button size="tiny" variant="framed" onClick={() => share(2)}>
          A ≡ Sales (another authority)
        </Button>
        <Button size="tiny" variant="framed" onClick={() => leave("copy")}>
          leave · copy
        </Button>
        <Button size="tiny" variant="framed" onClick={() => leave("history")}>
          leave · history
        </Button>
        <Button size="tiny" variant="framed" onClick={() => leave("reset")}>
          leave · reset
        </Button>
        <Text size="tiny" tone="faint">
          {last || "pick numbers, then share a cell; members read and write the same cell"}
        </Text>
      </div>
      <div style={{ minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)" }}>
        <wb.Surface />
      </div>
      <JsonBlock
        value={{
          cells: quotient.cells.map((cell) => ({ id: cell.id, members: cell.members })),
          cellByPort: Object.fromEntries(quotient.cellByPort),
          diagnostics: quotient.diagnostics,
          declarations: snapshot.identity,
        }}
      />
      <wb.Launcher />
    </div>
  );
}

const meta: Meta<typeof IdentityLab> = {
  title: "Workbench/IdentityLab",
  component: IdentityLab,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof IdentityLab>;

export const Lab: Story = {};
