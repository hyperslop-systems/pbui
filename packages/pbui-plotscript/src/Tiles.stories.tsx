import type { Meta, StoryObj } from "@storybook/react-vite";
import { createAppRegistry, createWorkbench, layout, split, tile } from "@hyperslop-systems/pbui-workbench";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import { useMemo } from "react";
import { createPlotScriptApps } from "./apps";
import { plotScriptMutation } from "./document";
import { createPlotScriptHost } from "./host";

const meta: Meta = { title: "Plotscript/Tiles" };
export default meta;

const SCATTER = `// A scatter plot from literal data.
const rows = [
  { month: 1, temp:  3.2 }, { month: 2, temp:  4.1 }, { month: 3, temp:  8.7 },
  { month: 4, temp: 13.0 }, { month: 5, temp: 18.4 }, { month: 6, temp: 22.9 },
  { month: 7, temp: 25.1 },
];

return {
  schema: { fields: [
    { id: "field:month", name: "month", column: "month", semanticType: "quantitative", nullable: false },
    { id: "field:temp",  name: "temperature", column: "temp", semanticType: "quantitative", nullable: false, unit: "°C" },
  ]},
  data: { rows, coverage: { kind: "complete", rowCount: rows.length }, identity: { fields: ["field:month"] } },
  document: plot({
    id: "monthly-temperature",
    description: "Mean monthly temperature at the greenhouse sensor.",
    variables: { month: variable.field("field:month", { label: "Month" }), temp: variable.field("field:temp", { label: "Temperature" }) },
    composition: composition.cartesian({ x: value.variable("month"), y: value.variable("temp") }),
    layers: [layer({ id: "points", stat: stat.identity(), geom: geom.point(), position: position.identity() })],
  }),
};
`;

function Pair({ source, spec }: { source: string; spec?: "pair" | "plot-only" | "script-only" }) {
  const wb = useMemo(() => {
    const host = createPlotScriptHost();
    const bound = { documents: { plot: "demo" } };
    const tree =
      spec === "plot-only" ? tile("plot-view", bound) : spec === "script-only" ? tile("plot-script", bound) : split("row", 0.5, tile("plot-script", bound), tile("plot-view", bound));
    const initial = applyMutations(layout(tree, { id: "story" }), [plotScriptMutation({ id: "demo", name: "monthly temperature", source, updatedAt: new Date().toISOString() })]);
    return createWorkbench({ apps: createAppRegistry(createPlotScriptApps(host)), initial });
  }, [source, spec]);
  return (
    <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", height: 520 }}>
      <wb.Surface />
    </div>
  );
}

export const EditorBesidePlot: StoryObj = {
  name: "script tile beside plot tile, one document",
  render: () => <Pair source={SCATTER} />,
};

export const PlotAlone: StoryObj = {
  name: "a plot tile with no editor open still draws",
  render: () => <Pair source={SCATTER} spec="plot-only" />,
};

export const InvalidResult: StoryObj = {
  name: "a script that returns the wrong shape: the guard's message in the pane, no plot yet",
  render: () => <Pair source={`const rows = [];\nreturn rows.map(r => r.missing.x);`} />,
};

export const ThrowingScript: StoryObj = {
  name: "a script that throws: the engine's error in the pane",
  render: () => <Pair source={`const rows = [{ v: 1 }];\nreturn rows.map(r => r.missing.x);`} />,
};
