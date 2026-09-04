import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppBody, Button, Stack, Text, createPresentationTypeGraph } from "@hyperslop-systems/pbui";
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
  const shared = usePort(view, "shared");
  const emitShared = useEmitPort(view, "shared");
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
        <Button onClick={() => emitShared({ type: "number", value: Number(shared.value ?? 0) + 1 })}>shared: {String(shared.value ?? 0)}</Button>
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
      { name: "shared", direction: "inout", contract: "number", doc: "a shared counter" },
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

function CrowdedApp({ view }: AppProps) {
  const value = usePort(view, "theta");
  const emit = useEmitPort(view, "one");
  return <AppBody><Text>theta: {String(value.value ?? "—")}</Text><Button onClick={() => emit({ type: "text", value: "one" })}>emit one</Button></AppBody>;
}

const crowdedApp = defineWorkbenchApp({
  manifest: {
    id: "lab-crowded",
    ports: [
      ...["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"].map((name) => ({ name, direction: "in" as const, contract: "any", doc: `input ${name}` })),
      ...["one", "two", "three", "four", "five", "six"].map((name) => ({ name, direction: "out" as const, contract: "text", doc: `output ${name}` })),
    ],
  },
  presentation: { title: "crowded", tone: "var(--pbui-tone-cat)", Component: CrowdedApp },
});

const apps = [sourceApp, sinkApp, transformApp, wideApp, crowdedApp];

export function createWiringLab(crowded = false) {
    const workbench = createWorkbench({
      apps,
      links: {
        graph: createPresentationTypeGraph([{ id: "number" }, { id: "text" }]),
        relations: [{ id: "double", from: "number", to: "number", label: "doubled" }],
        relationEvaluation: (_id, reference) => ({ kind: "value", reference: { type: "number", value: Number(reference.value) * 2 } }),
      },
      initial: layout(
        split(
          "col",
          0.5,
          split("row", 0.33, tile("lab-source", { title: "Source A" }), split("row", 0.5, tile("lab-transform", { title: "Transform" }), tile("lab-sink", { title: "Sink A" }))),
          split("row", 0.33, tile("lab-source", { title: "Source B" }), split("row", 0.5, tile(crowded ? "lab-crowded" : "lab-wide", { title: crowded ? "Crowded" : "Wide" }), tile("lab-sink", { title: "Sink B" }))),
        ),
      ),
    });
    const ids = leaves(workspaceTree(workbench.core.getState().document, workbench.core.getState().session.workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
    const [sourceA, transform, sinkA, sourceB, wide, sinkB] = ids;
    if (!sourceA || !transform || !sinkA || !sourceB || !wide || !sinkB) throw new Error("WiringLab requires six views");
    workbench.links.runtime.emit(`${sourceA}/count`, { type: "number", value: 0 });
    workbench.links.runtime.emit(`${sourceB}/label`, { type: "text", value: "tick 0" });
    workbench.links.runtime.emit(`${sinkA}/shared`, { type: "number", value: 0 });
    const result = workbench.execute([
      { kind: "port.follow", source: `${sourceA}/count`, destination: `${sinkA}/value` },
      { kind: "port.follow", source: `${sourceA}/count`, destination: `${transform}/in` },
      { kind: "port.follow", source: `${sourceB}/label`, destination: `${sinkB}/anything` },
      { kind: "port.pin", port: `${sinkB}/anything` },
      { kind: "port.follow", source: `${transform}/out`, destination: `${wide}/${crowded ? "theta" : "beta"}` },
      { kind: "port.derive", source: `${sourceA}/count`, destination: `${sinkB}/value`, relation: "double" },
      { kind: "identity.add", left: `${sinkA}/shared`, right: `${sinkB}/shared`, mergePolicy: "prefer-left" },
    ]);
    if (!result.ok) throw new Error(`WiringLab seed refused: ${result.because}`);
    return workbench;
}

function WiringLab({ crowded = false }: { crowded?: boolean }) {
  const [generation, setGeneration] = useState(0);
  // Reset intentionally creates a new shell and application tree.
  const wb = useMemo(() => createWiringLab(crowded), [generation, crowded]);
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
          Mod+Shift+L toggles · choose an operation · click or drag output to input · keyboard controls below · Esc leaves the mode
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
/** A tile with fourteen ports in a short viewport: the rail's columns scroll, the jacks stay on the frame. */
export const Crowded: Story = { args: { crowded: true } };
