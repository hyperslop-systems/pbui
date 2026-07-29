import type { Meta, StoryObj } from "@storybook/react-vite";
import { TablePanel } from "./TablePanel";
import { fixtureResult, readings } from "../../../fixtures";

/**
 * The pipeline's output relation, computed by the pipeline.
 *
 * The source fixture is a plain JSON-compatible analysis result. Canonical
 * transformed results are exercised by runtime/browser integration tests.
 */
const meta = {
  title: "Component Library/Organisms/TablePanel",
  component: TablePanel,
  parameters: { tile: { width: 620, height: 420 }, pbui: { table: readings } },
  args: { pipeline: fixtureResult(), docId: "d1" },
} satisfies Meta<typeof TablePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The raw table: 360 rows, so the render cap applies and the footer says so.
 *
 * "showing 200 of 360 pipeline rows — the chart uses all of them" is the
 * important sentence. The cap is on rendering, never on the data, and the two
 * claims are easy to confuse in the direction that makes a chart look wrong.
 */
export const Populated: Story = {};

/**
 * Summarized: four rows, one per station, with a derived column name.
 *
 * The header chips are live `<field>` presentations of the *pipeline's* fields,
 * not the source's — `mean_data.temp_c` does not exist in the fixture. That is
 * the property that makes the table a view of the transform rather than of the
 * source.
 */
export const Summarized: Story = {
  // The environment gets the pipeline output, exactly as `useTableFor` gives
  // it to the application. Without this the header chips resolve against the
  // source and `mean_data.temp_c` renders stale — which is the defect this
  // story found.
  parameters: { pbui: { table: readings } },
  args: { pipeline: fixtureResult() },
};

/** A derived column, computed by the pipeline and typed by it. */
export const WithADerivedColumn: Story = {
  parameters: { pbui: { table: readings } },
  args: { pipeline: fixtureResult() },
};

/** Sorted and capped, so the visible rows are the interesting ones. */
export const SortedAndLimited: Story = {
  args: {
    pipeline: fixtureResult(),
  },
};

/**
 * **A filter that matches nothing.**
 *
 * The table has to say so. An empty `<tbody>` under a full header row reads as
 * a loading state or a rendering fault, and the actual cause — a filter that is
 * too narrow — is one step away in the pipeline tile.
 */
export const NoRows: Story = {
  args: {
    pipeline: { ...fixtureResult(), rows: [] },
  },
};

export const NoSource: Story = { args: { pipeline: null, docId: null } };

export const Loading: Story = { args: { pipeline: null, loading: true, docId: null } };
