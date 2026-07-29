import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartsPanel, type DocView } from "./ChartsPanel";
import { READINGS, graphicFixture, readings, draft } from "../../../fixtures";

const DOCS: DocView[] = [
  graphicFixture({}, "a", "α"),
  graphicFixture(
    {
      geom: "bar",
      transforms: [draft.summarize(READINGS.station, "mean", READINGS.temp)],
      mapping: { x: READINGS.station, y: "mean_data.temp_c", color: null, size: null, facet: null },
    },
    "b",
    "β",
    50_000,
  ),
];

/**
 * The document manager.
 *
 * The active document is marked by border WEIGHT rather than by colour, because
 * the distinction has to survive a reader who cannot separate the two hues and
 * a screenshot that has been through a photocopier — which is a real thing that
 * happens to a teaching interface.
 */
const meta = {
  title: "Component Library/Organisms/ChartsPanel",
  component: ChartsPanel,
  parameters: { tile: { width: 520, height: 460 }, pbui: { table: readings } },
  args: {
    docs: DOCS,
    activeDocId: "a",
    onNew: () => {},
    onRename: () => {},
    onActivate: () => {},
    onDuplicate: () => {},
    onSnapshot: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof ChartsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two documents; the first is active and has no "set active" button. */
export const TwoDocuments: Story = {};

/**
 * **One document: ✕ is disabled and says why.**
 *
 * A workbench with no documents shows "no documents" in four tiles and offers
 * no route back except the toolbar button. Recoverable, but baffling — so the
 * rule that prevents it is legible where it applies rather than enforced
 * silently in the reducer.
 */
export const TheLastDocument: Story = {
  args: { docs: [DOCS[0]!], activeDocId: "a" },
};

/**
 * A document with no source: the summary reads "no source" rather than an empty
 * string with two separators around it.
 */
export const ADocumentWithNoSource: Story = {
  args: {
    docs: [graphicFixture({ source: { kind: "stream", drop: "" } }, "c", "γ"), ...DOCS],
    activeDocId: "c",
  },
};

/** Many documents, for a look at how the active border reads in a list. */
export const ManyDocuments: Story = {
  args: {
    docs: ["α", "β", "γ", "δ", "ε"].map((name, i) =>
      graphicFixture(
        { geom: (["point", "line", "bar", "area"] as const)[i % 4] },
        `d${i}`,
        name,
        2_000 * (i + 1),
      ),
    ),
    activeDocId: "d2",
  },
};
