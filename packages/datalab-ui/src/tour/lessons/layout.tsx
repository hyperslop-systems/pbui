import { leavesOfWorkspace } from "@hyperslop-systems/workbench-core";
import type { Lesson, LessonWorkbench } from "../../appkit/lessons";

/** Every leaf of the current workspace, flattened, from the core's state. */
function leaves(workbench: LessonWorkbench) {
  const out: Array<{ id: string; viewId: string; app: string; docId: string | null }> = [];
  for (const node of leavesOfWorkspace(workbench.index, workbench.session.workspaceId)) {
    if (node.body.case !== "leaf") continue;
    const view = workbench.document.views[node.body.value.viewId];
    if (view) {
      out.push({
        id: node.id,
        viewId: view.id,
        app: view.appId,
        docId: view.documents.primary ?? null,
      });
    }
  }
  return out;
}

/**
 * §B — Tiles, documents, workspaces.
 *
 * The confusion worth clearing up before anything else: **tiles are windows,
 * documents are the thing**. Two tiles pointed at one document move together
 * because they are not copies; re-point one and the link is gone, because
 * nothing was ever wired between them.
 *
 * Every predicate here reads the WORKBENCH argument rather than `state.world`
 * (PBUI-DATALAB-WORKBENCH-1): the tree lives in the core, and a predicate
 * gets its state as a value, exactly as it gets the world.
 */
export const layoutLessons: Lesson[] = [
  {
    id: "b1",
    title: "Two tiles, one document",
    manual: true,
    body: (
      <>
        Both tiles are pointed at document <strong>α</strong> — look at their DOC strips.
        Right-click any mark in the chart and choose <strong>Keep only …</strong>. A filter step is
        written into α&apos;s pipeline, so the chart redraws <em>and</em> the table&apos;s rows
        drop, together. Nothing is wired between them: they are two views of one object.
      </>
    ),
  },
  {
    id: "b2",
    title: "Layouts are disposable",
    body: (
      <>
        Split a tile with <strong>⬌</strong> or <strong>⬍</strong> in its title bar, then pick an
        application in the empty one. Drag a title bar&apos;s <strong>⠿</strong> onto another tile:
        the <strong>centre</strong> swaps the two applications, an <strong>edge</strong> docks it
        there. Nothing you do here can lose work, because no application keeps its state in the
        tile.
      </>
    ),
    run: ({ workbench }) => {
      const first = leaves(workbench.core.getState())[0];
      if (first) workbench.splitTile(first.id, "col");
    },
    done: (_state, workbench) => leaves(workbench).length > 2,
  },
  {
    id: "b3",
    title: "Re-point a view at another document",
    body: (
      <>
        The world holds two documents: <strong>α</strong> on the stream and <strong>β</strong> on
        the dataset. Use the dropdown in any DOC strip to point a tile at <strong>β</strong>. The
        tile changes what it is looking at; α is untouched. <strong>＋</strong> in the same strip
        spawns a brand-new document into that tile.
      </>
    ),
    run: ({ getState, workbench }) => {
      const bound = leaves(workbench.core.getState()).filter(
        (leaf) => leaf.app === "chart" || leaf.app === "table",
      );
      const second = getState().world.docOrder[1];
      const target = bound[1] ?? bound[0];
      if (target && second) workbench.rebindView(target.viewId, second);
    },
    // Two DIFFERENT documents visible at once — which is the state the lesson
    // is about, and which a check for "the dropdown changed" would miss when
    // the reader used ＋ instead.
    done: (_state, workbench) => {
      const shown = new Set(
        leaves(workbench)
          .filter((leaf) => leaf.docId != null)
          .map((leaf) => leaf.docId),
      );
      return shown.size > 1;
    },
    predict: {
      q: "You are about to point the right-hand tile at β. Does the left-hand chart change too?",
      options: ["yes, they are linked", "no, they are separate"],
      answer: 1,
      reveal:
        "They were only moving together because they were looking at the same document. Re-point one and the link is gone — nothing was ever wired between the tiles.",
    },
  },
  {
    id: "b4",
    title: "Workspaces are camera positions",
    body: (
      <>
        The strip at the top of the panel switches whole layouts. Nothing is saved or loaded — the
        world is identical in all of them. Press <strong>+ workspace</strong>, build something
        different, then switch back: exactly as you left it.
      </>
    ),
    run: ({ workbench }) => {
      workbench.createWorkspace({ name: "scratch" });
    },
    done: (_state, workbench) => workbench.document.workspaces.length > 1,
  },
  {
    id: "b5",
    title: "Closing a tile destroys nothing",
    manual: true,
    body: (
      <>
        Close a tile with <strong>✕</strong>. Its sibling absorbs the space. Now open a new tile and
        point it back at the same document: everything is still there — pipeline, encoding,
        geometry. Views are cheap. State is not in them.
      </>
    ),
  },
];
