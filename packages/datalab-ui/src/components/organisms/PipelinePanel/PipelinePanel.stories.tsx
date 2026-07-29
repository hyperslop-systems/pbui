import type { Meta, StoryObj } from "@storybook/react-vite";
import { PipelinePanel, type PipelineStepView } from "./PipelinePanel";
import { READINGS, graphicFixture, fixtureResult, readings, draft } from "../../../fixtures";
import type { GraphicDocument } from "../../../model/graphic";
import { orderedTransformIds } from "../../../model/graphicAuthoring";
import { transformToDraft } from "../../../model/transformEditor";

function viewsFor(document: GraphicDocument): PipelineStepView[] {
  const available = readings.fields.map((field) => field.name);
  return orderedTransformIds(document).map((id) => ({
    step: transformToDraft(document.transforms[id]!),
    available,
  }));
}

function argsFor(document: GraphicDocument) {
  const result = fixtureResult();
  return {
    steps: viewsFor(document),
    outputFields: result.fields.map((field) => field.name),
    outputRows: result.rows.length,
  };
}

/**
 * The pipeline editor, driven by the real engine.
 *
 * Every row count, every dropped-row warning and every dropdown's contents
 * below is computed by canonical transform drafts rather than written down.
 * A story that hand-wrote them would be asserting what the pipeline produces
 * instead of showing it — and would have missed the two states this file exists
 * to make visible.
 *
 * The `pbui.table` parameter matters in every story with a step: the output
 * chips at the bottom are live `<field>` presentations, and without the
 * pipeline's own table behind the environment they resolve against the source
 * and render stale.
 */
const meta = {
  title: "Component Library/Organisms/PipelinePanel",
  component: PipelinePanel,
  parameters: { tile: { width: 640, height: 560 }, pbui: { table: readings } },
  args: {
    docId: "d1",
    steps: [],
    outputFields: readings.fields.map((f) => f.name),
    outputRows: readings.rows.length,
    onAdd: () => {},
    onToggle: () => {},
    onMoveUp: () => {},
    onRemove: () => {},
    onChange: () => {},
  },
} satisfies Meta<typeof PipelinePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An empty chain: the chart draws the table as loaded.
 *
 * The prose matters more than it looks. A blank panel with five buttons does
 * not say whether the chart is showing everything or nothing.
 */
export const Empty: Story = {};

const filtered = graphicFixture({ transforms: [draft.filter(READINGS.temp, ">", "20")] });

/** One canonical filter transform. */
export const OneFilter: Story = {
  parameters: { pbui: { table: readings } },
  args: argsFor(filtered),
};

const chain = graphicFixture({
  transforms: [
    draft.filter(READINGS.temp, ">", "18"),
    draft.summarize(READINGS.station, "mean", READINGS.temp),
    draft.sort("mean_data.temp_c", "desc"),
  ],
});

/**
 * A three-step chain, and the state the extraction was for.
 *
 * Read the third step's dropdown: it offers `mean_data.temp_c`, a column that
 * exists only because the summarize before it produced one. That is
 * the canonical relation compiler doing its job, and it was previously unreachable without
 * building the chain by hand in a browser.
 *
 * The summarize also shows its column-loss note. That note is unconditional
 * rather than conditional on having lost something the user wanted, because the
 * loss is a property of the verb rather than of this chain.
 */
export const AChain: Story = {
  parameters: { pbui: { table: readings } },
  args: argsFor(chain),
};

const dropping = graphicFixture({
  transforms: [draft.derive("ratio", READINGS.temp, "/", READINGS.ok)],
});

/**
 * **A derive step that dropped every row.**
 *
 * DuckDB removes rows whose arithmetic did not produce a finite number, and
 * reports the count under the step that caused it — "something dropped 360
 * rows" is not actionable and "this step did" is.
 *
 * Read the numbers: **360 dropped, 0 out.** That is not a contrived example, it
 * is what happens whenever a derive touches a boolean column. `asNumber`
 * returns NaN for a boolean rather than coercing it to 0 or 1, so every row
 * fails, and the user gets an empty chart plus one red line of explanation.
 *
 * This story is the first time anyone looked at that. Reaching it by clicking
 * needs a specific pair of columns and a specific operator, and the fixture has
 * no column that produces a *partial* drop — every quantitative column here is
 * strictly positive, so division never goes non-finite and log10 never goes
 * undefined. Whether NaN-for-booleans is right is an engine question and a
 * separate ticket; that it is invisible until the output is empty is what a
 * story is for.
 */
export const DroppedRows: Story = {
  parameters: { pbui: { table: readings } },
  args: argsFor(dropping),
};

const disabled = graphicFixture({
  transforms: [{ ...draft.filter(READINGS.temp, ">", "20"), enabled: false }, draft.limit(25)],
});

/**
 * A disabled draft, which is the feature the panel's docstring is about.
 *
 * A step toggled off stays in the chain, keeps its editor, and stops applying.
 * That is what makes a pipeline an experiment rather than a recording — and the
 * output row count beside it is the answer to "what did that step cost me".
 */
export const ADisabledStep: Story = {
  parameters: { pbui: { table: readings } },
  args: argsFor(disabled),
};

/**
 * Every kind at once, for a visual pass over the five editors together.
 *
 * Useful for spotting alignment drift between the step rows, which is the class
 * of defect that only shows up when they are adjacent.
 */
const everyKind = graphicFixture({
  transforms: [
    draft.filter(READINGS.temp, ">", "18"),
    draft.derive("delta", READINGS.temp, "-", READINGS.humidity),
    draft.sort(READINGS.temp, "desc"),
    draft.limit(50),
    draft.summarize(READINGS.station, "count", ""),
  ],
});

export const EveryStepKind: Story = {
  parameters: { pbui: { table: readings } },
  args: argsFor(everyKind),
};
