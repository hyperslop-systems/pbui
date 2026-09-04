import { leavesOfWorkspace } from "@hyperslop-systems/workbench-core";
import type { Goal, LessonWorkbench } from "../../appkit/lessons";
import { orderedTransformIds, rootSource, rootView } from "../../model/graphicAuthoring";
import { CENSUS_COLUMNS } from "../fixtures";

/**
 * ✦ — The brief.
 *
 * No rail, no ▶, no ordering. One question, five things that have to be true,
 * and hints that never become the answer. Every goal is a predicate over
 * `RootState`, so **any route that reaches the same state counts**, including
 * ones nobody wrote down.
 *
 * The question uses the census dataset rather than the stream because it has a
 * genuine grouping question in it — twenty-four stations across three regions,
 * with a population and an area each — and "which region is densest" cannot be
 * answered by looking.
 */

function leaves(workbench: LessonWorkbench) {
  const out: Array<{ app: string; docId: string | null }> = [];
  for (const node of leavesOfWorkspace(workbench.index, workbench.session.workspaceId)) {
    if (node.body.case !== "leaf") continue;
    const view = workbench.document.views[node.body.value.viewId];
    if (view) out.push({ app: view.appId, docId: view.documents.primary ?? null });
  }
  return out;
}

export const briefQuestion = (
  <>
    Which <strong>region</strong> has the highest average population per station — and can you put
    the numbers next to the picture that convinced you?
  </>
);

export const briefGoals: Goal[] = [
  {
    id: "e1",
    label: <>the census dataset is loaded into a document</>,
    done: (state) =>
      Object.values(state.world.docs).some((doc) => rootSource(doc)?.dataset === "census"),
  },
  {
    id: "e2",
    label: <>one number per region — grouped and summarised</>,
    done: (state) =>
      Object.values(state.world.docs).some((doc) =>
        orderedTransformIds(doc).some((id) => {
          const transform = doc.transforms[id];
          return (
            transform?.enabled &&
            transform.kind === "core:aggregate" &&
            transform.groupBy[0]?.name === CENSUS_COLUMNS.region
          );
        }),
      ),
  },
  {
    id: "e3",
    label: <>a bar chart, with the category on x and the aggregate on y</>,
    done: (state) =>
      Object.values(state.world.docs).some((doc) => {
        const view = rootView(doc);
        return (
          view.mark === "bar" &&
          view.encodings.x?.name === CENSUS_COLUMNS.region &&
          view.encodings.y?.name.startsWith("mean_")
        );
      }),
  },
  {
    id: "e4",
    label: <>frozen as a snapshot, so it survives what you do next</>,
    done: (state) => state.world.snapshotOrder.length > 0,
  },
  {
    id: "e5",
    label: <>the evidence beside the picture — a table and a chart, on one document, at once</>,
    done: (_state, workbench) => {
      const all = leaves(workbench);
      // `docId != null` is load-bearing. A doc-bound tile whose docId is null
      // follows the ACTIVE document, so two unbound tiles compare `null ===
      // null` and the goal would tick before the reader had done anything —
      // which it did, for about ten minutes, in the story that first used this
      // shape. Null means "whatever is active", not "nothing".
      return all.some(
        (table) =>
          table.app === "table" &&
          table.docId != null &&
          all.some((chart) => chart.app === "chart" && chart.docId === table.docId),
      );
    },
  },
];

/**
 * Ordered navigational → conceptual → mechanical, and never the answer.
 *
 * A reader stuck on *where* a control is is not helped by the reasoning, and
 * one stuck on the reasoning is not helped by being told where to click.
 */
export const briefHints = [
  "No sources tile in this layout? Select Replace … from any tile title's menu — or split one with ⬌ and pick from the launcher.",
  "The census dataset is in the lab drop, beside the temps stream. Loading it re-points the active document.",
  "One number per region: that is group∑ by region, summarising population.",
  "After a group∑ the schema collapses to two columns, so the x and y you had before will need re-pointing — the OUT strip in the pipeline tile shows what is available.",
  "geom_bar wants the category on x and the aggregate on y. The encoding tile says so if you get it the wrong way round.",
  "⚑ snapshot is in the chart tile's header, and again in the snapshots tile.",
  "For the last one: split a tile, choose table in the launcher, and check its DOC strip names the same document as the chart.",
];
