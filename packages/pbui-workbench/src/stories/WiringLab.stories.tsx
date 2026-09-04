import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppBody, Button, Stack, Text } from "@hyperslop-systems/pbui";
import { layout, split, tile } from "@hyperslop-systems/workbench-core";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useEffect, useMemo, useState } from "react";
import { defineWorkbenchApp, type AppProps } from "../app";
import { createWorkbench } from "../createWorkbenchShell";
import { useEmitPort, usePort } from "../links/hooks";

/**
 * WiringLab (PBUI-WIRING-1 P7): a workbench to wire BY HAND. Six tiles in
 * two rows, four kinds of port, a few links seeded so every wire style is
 * on screen, and the mode open on mount. Mod+Shift+L toggles the wiring;
 * drag an output jack's card onto an input; Shift while dropping pins the
 * link (held), Ctrl shares one cell between two ports (identity).
 */

function SourceApp({ view }: AppProps) {
  const [n, setN] = useState(0);
  const emitCount = useEmitPort(view, "count");
  const emitLabel = useEmitPort(view, "label");
  return (
    <AppBody>
      <Stack gap={2}>
        <Text size="small" tone="faint">
          a producer: two outputs, a number and a label
        </Text>
        <Text size="title" strong>
          {n}
        </Text>
        <div>
          <Button
            variant="framed"
            onClick={() =>
              setN((value) => {
                emitCount({ type: "number", value: value + 1 });
                emitLabel({ type: "text", value: `tick ${value + 1}` });
                return value + 1;
              })
            }
          >
            tick
          </Button>
        </div>
      </Stack>
    </AppBody>
  );
}

function SinkApp({ view }: AppProps) {
  const value = usePort(view, "value");
  const anything = usePort(view, "anything");
  return (
    <AppBody>
      <Stack gap={2}>
        <Text size="small" tone="faint">
          a consumer: a number and anything at all
        </Text>
        <Text size="small">
          value: <b>{value.reference ? JSON.stringify(value.reference.value) : "—"}</b> · {value.badge.explanation}
        </Text>
        <Text size="small">
          anything: <b>{anything.reference ? JSON.stringify(anything.reference.value) : "—"}</b> · {anything.badge.explanation}
        </Text>
      </Stack>
    </AppBody>
  );
}

function TransformApp({ view }: AppProps) {
  const input = usePort(view, "in");
  const emit = useEmitPort(view, "out");
  const incoming = input.reference?.value;
  useEffect(() => {
    if (typeof incoming === "number") emit({ type: "number", value: incoming * 2 });
  }, [incoming, emit]);
  return (
    <AppBody>
      <Stack gap={2}>
        <Text size="small" tone="faint">
          a transform: doubles what comes in
        </Text>
        <Text size="small">
          in: <b>{typeof incoming === "number" ? incoming : "—"}</b> → out: <b>{typeof incoming === "number" ? incoming * 2 : "—"}</b>
        </Text>
      </Stack>
    </AppBody>
  );
}

function WideApp({ view }: AppProps) {
  const alpha = usePort(view, "alpha");
  const beta = usePort(view, "beta");
  const emitGamma = useEmitPort(view, "gamma");
  return (
    <AppBody>
      <Stack gap={2}>
        <Text size="small" tone="faint">
          many ports: two inputs, two outputs
        </Text>
        <Text size="small">
          alpha: <b>{alpha.reference ? JSON.stringify(alpha.reference.value) : "—"}</b>
        </Text>
        <Text size="small">
          beta: <b>{beta.reference ? JSON.stringify(beta.reference.value) : "—"}</b>
        </Text>
        <div>
          <Button variant="framed" size="tiny" onClick={() => emitGamma({ type: "text", value: `gamma @ ${new Date().toLocaleTimeString()}` })}>
            emit gamma
          </Button>
        </div>
      </Stack>
    </AppBody>
  );
}

const sourceApp = defineWorkbenchApp({
  manifest: {
    id: "lab-source",
    ports: [
      { name: "count", direction: "out", contract: "number", doc: "the tick count" },
      { name: "label", direction: "out", contract: "text", doc: "a label for the last tick" },
    ],
  },
  presentation: { title: "source", tone: "var(--pbui-tone-source)", Component: SourceApp },
});

const sinkApp = defineWorkbenchApp({
  manifest: {
    id: "lab-sink",
    ports: [
      { name: "value", direction: "in", contract: "number", doc: "a number to show" },
      { name: "anything", direction: "in", contract: "any", doc: "anything at all" },
    ],
  },
  presentation: { title: "sink", tone: "var(--pbui-tone-row)", Component: SinkApp },
});

const transformApp = defineWorkbenchApp({
  manifest: {
    id: "lab-transform",
    ports: [
      { name: "in", direction: "in", contract: "number", doc: "the number to double" },
      { name: "out", direction: "out", contract: "number", doc: "twice the input" },
    ],
  },
  presentation: { title: "transform", tone: "var(--pbui-tone-step)", Component: TransformApp },
});

const wideApp = defineWorkbenchApp({
  manifest: {
    id: "lab-wide",
    ports: [
      { name: "alpha", direction: "in", contract: "any", doc: "first input" },
      { name: "beta", direction: "in", contract: "number", doc: "second input, a number" },
      { name: "gamma", direction: "out", contract: "text", doc: "first output" },
      { name: "delta", direction: "out", contract: "any", doc: "second output" },
    ],
  },
  presentation: { title: "wide", tone: "var(--pbui-tone-field)", Component: WideApp },
});

const apps = [sourceApp, sinkApp, transformApp, wideApp];

function WiringLab() {
  const [generation, setGeneration] = useState(0);
  const wb = useMemo(() => {
    const workbench = createWorkbench({
      apps,
      initial: layout(
        split(
          "col",
          0.5,
          split("row", 0.33, tile("lab-source", { title: "Source A" }), split("row", 0.5, tile("lab-transform", { title: "Transform" }), tile("lab-sink", { title: "Sink A" }))),
          split("row", 0.33, tile("lab-source", { title: "Source B" }), split("row", 0.5, tile("lab-wide", { title: "Wide" }), tile("lab-sink", { title: "Sink B" }))),
        ),
      ),
    });
    const ids = leaves(workspaceTree(workbench.core.getState().document, workbench.core.getState().session.workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
    const [sourceA, transform, sinkA, sourceB, wide, sinkB] = ids;
    if (sourceA && transform && sinkA && sourceB && wide && sinkB) {
      // Seeded so every wire style is on screen: a follow in the top row, a
      // follow into the transform, a held link in the bottom row, a follow
      // ACROSS rows (the routing case), and an identity between the two sinks.
      workbench.execute({ kind: "port.follow", source: `${sourceA}/count`, destination: `${sinkA}/value` });
      workbench.execute({ kind: "port.follow", source: `${sourceA}/count`, destination: `${transform}/in` });
      workbench.execute({ kind: "port.follow", source: `${sourceB}/label`, destination: `${sinkB}/anything` });
      workbench.execute({ kind: "port.pin", port: `${sinkB}/anything` });
      workbench.execute({ kind: "port.follow", source: `${transform}/out`, destination: `${wide}/beta` });
      workbench.execute({ kind: "identity.add", left: `${sinkA}/value`, right: `${sinkB}/value`, mergePolicy: "prefer-left" });
    }
    return workbench;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation]);
  useEffect(() => {
    wb.dispatch({ kind: "link.mode.open" });
  }, [wb]);
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 8, height: "100vh", padding: 8, boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <Text size="small" strong>
          WIRING LAB
        </Text>
        <Button size="tiny" variant="framed" onClick={() => wb.dispatch({ kind: "link.mode.open" })}>
          open wiring
        </Button>
        <Button size="tiny" variant="framed" onClick={() => wb.dispatch({ kind: "link.mode.close" })}>
          close wiring
        </Button>
        <Button size="tiny" onClick={() => setGeneration((n) => n + 1)}>
          reset links
        </Button>
        <Text size="tiny" tone="faint">
          Mod+Shift+L toggles · drag an output card onto an input · Shift while dropping pins it · Ctrl shares one cell · Esc leaves the mode · right-click a badge for its verbs
        </Text>
      </div>
      <div style={{ minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)" }}>
        <wb.Surface key={generation} />
      </div>
      <wb.Launcher />
    </div>
  );
}

const meta: Meta<typeof WiringLab> = {
  title: "Workbench/WiringLab",
  component: WiringLab,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof WiringLab>;
export const Lab: Story = {};
