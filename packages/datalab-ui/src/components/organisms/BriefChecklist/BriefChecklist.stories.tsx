import { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { BriefChecklist } from "./BriefChecklist";
import { DatalabWorkbenchProvider } from "../../../appkit/DatalabWorkbenchContext";
import type { Goal } from "../../../appkit/lessons";
import { createDatalabWorkbench } from "../../../appkit/workbench";
import "../../../apps/all";

/**
 * The capstone: one question, five goals, and no ▶.
 *
 * No steps, no ordering, no "do it for me". The goals tick by watching the
 * world, so **any route that reaches the same state counts** — including one
 * nobody wrote down. That is the difference between this and the rail: the rail
 * teaches a move, the brief asks for an outcome.
 *
 * These goals are live against the workbench the decorator supplies, so
 * `Untouched` really is untouched. Press "I'm stuck" through all five hints to
 * see the terminal message, which matters more than it looks: without it a
 * reader keeps pressing, expecting the answer.
 */
const meta = {
  title: "Component Library/Organisms/BriefChecklist",
  component: BriefChecklist,
  parameters: { tile: false, pbui: {} },
  decorators: [
    (Story) => {
      // One workbench per story: goal g4 reads the core's document, and a
      // play in one story must not tick a goal in the next.
      const workbench = useMemo(() => createDatalabWorkbench(), []);
      return (
        <DatalabWorkbenchProvider workbench={workbench}>
          <div style={{ display: "flex", height: 460, maxWidth: 400 }}>
            <Story />
          </div>
        </DatalabWorkbenchProvider>
      );
    },
  ],
  args: { question: "", goals: [], hints: [] },
} satisfies Meta<typeof BriefChecklist>;

export default meta;
type Story = StoryObj<typeof meta>;

const HINTS = [
  "No sources tile in this layout? Select Replace … from any tile title's menu — or split one with ⬌ and pick from the launcher.",
  "A filter step keeps rows — and right-clicking a mark in the chart writes one for you.",
  "One number per category is a group∑ step, summarising a quantitative field.",
  "After a group∑ the schema collapses to two columns, so the x and y you had before will need re-pointing.",
  "geom_bar wants the category on x and the aggregate on y.",
];

/** Goals over the real store, so nothing here is satisfied until you satisfy it. */
const GOALS: Goal[] = [
  {
    id: "g1",
    label: <>a second chart document exists</>,
    done: (state) => state.world.docOrder.length > 1,
  },
  {
    id: "g2",
    label: <>the active document has a pipeline step</>,
    done: (state) => {
      const doc = state.world.activeDocId ? state.world.docs[state.world.activeDocId] : undefined;
      return Object.keys(doc?.transforms ?? {}).length > 0;
    },
  },
  {
    id: "g3",
    label: <>frozen as a snapshot, so it survives what you do next</>,
    done: (state) => state.world.snapshotOrder.length > 0,
  },
  {
    id: "g4",
    label: <>the evidence beside the picture — a table and a chart, on one document, at once</>,
    done: (_state, workbench) => {
      // Reads the WORKBENCH, not the world — the goal the prototype needs a
      // render-phase probe for and we get from the core's own state: the
      // current workspace's leaves and the views they show.
      const workspace = workbench.index.workspaceById.get(workbench.session.workspaceId);
      if (!workspace) return false;
      const tiles: Array<{ app: string; docId: string | null }> = [];
      for (const leaf of leaves(workspace.tree)) {
        const viewId = leaf.body.case === "leaf" ? leaf.body.value.viewId : "";
        const view = workbench.document.views[viewId];
        if (view) tiles.push({ app: view.appId, docId: view.documents.primary ?? null });
      }
      // `table.docId != null` is load-bearing, and leaving it out was a live
      // bug in this story for about ten minutes. A doc-bound tile whose docId
      // is null follows the ACTIVE document, and the default workspace opens
      // with chart and table both unbound — so `chart.docId === table.docId`
      // was `null === null`, and the goal ticked before the reader had done
      // anything at all.
      //
      // The general lesson for anyone writing a predicate: null in this state
      // means "whatever is active", not "nothing". Two nulls are not evidence
      // of agreement, and a predicate that treats them as such is satisfied by
      // the empty case.
      return tiles.some(
        (table) =>
          table.app === "table" &&
          table.docId != null &&
          tiles.some((chart) => chart.app === "chart" && chart.docId === table.docId),
      );
    },
  },
];

export const Untouched: Story = {
  args: {
    question: (
      <>
        Which island&apos;s <strong>terns</strong> are the heaviest — and can you put the numbers
        next to the picture that convinced you?
      </>
    ),
    goals: GOALS,
    hints: HINTS,
  },
};

/** With ↺, which the section wires to a remount rather than to an undo. */
export const WithReset: Story = {
  args: { ...Untouched.args, onReset: () => window.location.reload() },
};

/**
 * Every goal met.
 *
 * Predicates that are simply true, to show the completion message — which is
 * the last thing a reader of the tour sees and says the thing the whole page
 * has been building to.
 */
export const Complete: Story = {
  args: {
    question: <>Which island&apos;s terns are the heaviest?</>,
    goals: GOALS.map((goal) => ({ ...goal, done: () => true })),
    hints: HINTS,
  },
};
