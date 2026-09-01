import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Text } from "@hyperslop-systems/pbui";
import { CodeEditor, type CodeEditorProps } from "./CodeEditor";
import type { EditorDiagnostic } from "../diagnostics";

const meta = {
  title: "Editor/CodeEditor",
  component: CodeEditor,
  args: { accessibleName: "script", value: "", onValueChange: () => {} },
} satisfies Meta<typeof CodeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

const SCRIPT = `// A scatter plot from literal data.
const rows = [
  { month: 1, temp: 3.2 }, { month: 2, temp: 4.1 }, { month: 3, temp: 8.7 },
];

return {
  schema: { fields: [
    { id: "field:month", name: "month", column: "month", semanticType: "quantitative", nullable: false },
    { id: "field:temp",  name: "temperature", column: "temp", semanticType: "quantitative", nullable: false, unit: "°C" },
  ]},
  data: { rows, coverage: { kind: "complete", rowCount: rows.length } },
  document: plot({
    id: "monthly-temperature",
    variables: { month: variable.field("field:month"), temp: variable.field("field:temp") },
    composition: composition.cartesian({ x: value.variable("month"), y: value.variable("temp") }),
    layers: [layer({ id: "points", stat: stat.identity(), geom: geom.point(), position: position.identity() })],
  }),
};
`;

/**
 * A controlled editor needs a wrapper, or the story cannot be typed into.
 *
 * The spread comes FIRST. Storybook passes the meta's `args` — including its
 * placeholder `value: ""` and no-op `onValueChange` — into `rest`, and a
 * spread after the explicit props silently overrode both: the editor showed
 * one empty line under a status line claiming 836 characters. Found by a
 * screenshot, not by a test.
 */
function Live(props: Partial<CodeEditorProps> & { initial?: string }) {
  const { initial = "", value: _ignored, onValueChange: _alsoIgnored, ...rest } = props;
  const [value, setValue] = useState(initial);
  const [ran, setRan] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <CodeEditor accessibleName="script" {...rest} value={value} onValueChange={setValue} onRun={(v) => setRan(v)} />
      <Text size="tiny" tone="faint">
        {value.length} chars · {value.split("\n").length} lines{ran !== null ? ` · ran ${ran.length} chars with Mod+Enter` : " · Mod+Enter runs"}
      </Text>
    </div>
  );
}

export const JavaScript: Story = {
  name: "JavaScript, sized by rows",
  render: (args) => <Live {...args} initial={SCRIPT} rows={18} />,
};

export const ReadOnly: Story = {
  name: "read-only listing",
  render: (args) => <Live {...args} initial={SCRIPT} rows={12} readOnly />,
};

const DIAGNOSTICS: EditorDiagnostic[] = [
  { line: 3, column: 5, severity: "error", message: "ReferenceError: month is not defined" },
  { line: 10, severity: "warning", message: "this layer never draws: no rows match" },
  { line: 400, severity: "info", message: "reported beyond the end; clamped to the last line" },
];

export const WithDiagnostics: Story = {
  name: "diagnostics: an error on a token, a warning on a line, one clamped",
  render: (args) => <Live {...args} initial={SCRIPT} rows={18} diagnostics={DIAGNOSTICS} />,
};

export const Json: Story = {
  name: "JSON",
  render: (args) => <Live {...args} initial={'{\n  "format": "hyperslop.plot",\n  "version": 1\n}\n'} rows={6} language="json" />,
};

export const FillsContainer: Story = {
  name: "fills a bounded container (the tile case)",
  render: (args) => (
    <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", height: 260, border: "1px dashed var(--pbui-line)" }}>
      <Live {...args} initial={SCRIPT} />
    </div>
  ),
};
