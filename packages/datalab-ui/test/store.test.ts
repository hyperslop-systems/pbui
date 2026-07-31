import { describe, expect, test } from "vitest";
import { readings } from "../src/fixtures";
import { orderedTransformIds, rootView } from "../src/model/graphicAuthoring";
import {
  cloneTree,
  countLeaves,
  findLeaf,
  initialLayout,
  layoutSlice,
  leaf,
  removeLeaf,
  snapRatio,
  split,
  updateNode,
  type LayoutState,
  type Node,
} from "../src/store/layout";
import { TRACE_CAP, worldActions, worldSlice, type WorldState } from "../src/store/world";
import { actionsForVerb, environmentFor } from "../src/store/applyVerb";
import { findSecrets, save, validate } from "../src/store/persist";
import {
  ACCOUNT_SPACE_ID,
  ACCOUNT_STAGE_ID,
  SIGNIN_SPACE_ID,
  WORK_STAGE_ID,
} from "../src/store/stages";

/**
 * The shell reducers: pure functions, tested without a DOM.
 *
 * The list is the guide's §16.2, which was written around the failures that are
 * easy to produce and invisible until a tile disappears or a snapshot quietly
 * follows the document it was copied from.
 */

const world = worldSlice.reducer;
const layout = layoutSlice.reducer;

function withDoc(): { state: WorldState; docId: string } {
  const state = world(undefined, worldActions.newDoc(readings.source));
  return { state, docId: state.docOrder[0] as string };
}

/* ---------------------------------------------------------------- layout -- */

describe("the split tree", () => {
  const tree = () => split("row", leaf("chart"), split("col", leaf("table"), leaf("pipeline")));

  test("updateNode returns the IDENTICAL object when nothing changed", () => {
    // Not a micro-optimisation: it is what lets React.memo skip an untouched
    // subtree when one tile changes, which with fifteen tiles is the difference
    // between a responsive divider drag and a slideshow.
    const t = tree();
    expect(updateNode(t, "absent", (n) => n)).toBe(t);
  });

  test("updateNode shares every untouched subtree", () => {
    const t = tree() as Extract<Node, { type: "split" }>;
    const next = updateNode(t, t.a.id, (n) => ({ ...n, viewId: "encode" }) as Node) as Extract<
      Node,
      { type: "split" }
    >;
    expect(next).not.toBe(t);
    expect(next.b).toBe(t.b);
  });

  test("removeLeaf promotes the sibling", () => {
    const t = tree() as Extract<Node, { type: "split" }>;
    const next = removeLeaf(t, t.a.id);
    expect(next).toBe(t.b);
    expect(countLeaves(next)).toBe(2);
  });

  test("removing an absent leaf is a no-op, not a corruption", () => {
    const t = tree();
    expect(removeLeaf(t, "absent")).toBe(t);
  });

  test("cloneTree shares no node objects and reuses no ids", () => {
    // A clone that reused ids would give React duplicate keys AND make the
    // hit-test return the wrong tile — the bug DR-12 exists to prevent.
    const t = tree();
    const copy = cloneTree(t);

    const ids = (node: Node): string[] =>
      node.type === "leaf" ? [node.id] : [node.id, ...ids(node.a), ...ids(node.b)];
    const objects = (node: Node): Node[] =>
      node.type === "leaf" ? [node] : [node, ...objects(node.a), ...objects(node.b)];

    expect(new Set([...ids(t), ...ids(copy)]).size).toBe(ids(t).length * 2);
    for (const object of objects(copy)) expect(objects(t)).not.toContain(object);
  });

  test("dividers snap only within tolerance", () => {
    expect(snapRatio(0.51)).toEqual({ ratio: 0.5, snapped: true });
    expect(snapRatio(0.6)).toEqual({ ratio: 0.6, snapped: false });
  });
});

describe("the layout slice", () => {
  const start = (): LayoutState => layout(undefined, { type: "@@init" });
  const viewAt = (state: LayoutState, node: Node) =>
    node.type === "leaf" ? state.views[node.viewId] : undefined;

  test("the last tile cannot be closed", () => {
    const state = start();
    const only = (state.spaces[0] as { tree: Node }).tree as Extract<Node, { type: "leaf" }>;
    const next = layout(state, layoutSlice.actions.closeLeaf(only.id));
    expect(countLeaves((next.spaces[0] as { tree: Node }).tree)).toBe(1);
  });

  test("splitting then closing returns to one tile", () => {
    let state = start();
    const first = (state.spaces[0] as { tree: Node }).tree.id;
    state = layout(state, layoutSlice.actions.splitLeaf({ nodeId: first, dir: "row" }));
    expect(countLeaves((state.spaces[0] as { tree: Node }).tree)).toBe(2);

    const tree = (state.spaces[0] as { tree: Node }).tree as Extract<Node, { type: "split" }>;
    state = layout(state, layoutSlice.actions.closeLeaf(tree.b.id));
    expect(countLeaves((state.spaces[0] as { tree: Node }).tree)).toBe(1);
  });

  test("swapping two tiles moves app, doc and label while geometric ids stay put", () => {
    let state = start();
    const first = (state.spaces[0] as { tree: Node }).tree.id;
    state = layout(state, layoutSlice.actions.splitLeaf({ nodeId: first, dir: "row" }));
    const tree = (state.spaces[0] as { tree: Node }).tree as Extract<Node, { type: "split" }>;
    state = layout(
      state,
      layoutSlice.actions.createViewInPlacement({
        nodeId: tree.a.id,
        appId: "chart",
        docId: "climate",
        title: "temperature by station",
      }),
    );
    state = layout(
      state,
      layoutSlice.actions.createViewInPlacement({
        nodeId: tree.b.id,
        appId: "table",
        docId: "census",
        title: "population by region",
      }),
    );

    state = layout(state, layoutSlice.actions.swapTiles({ a: tree.a.id, b: tree.b.id }));
    const after = (state.spaces[0] as { tree: Node }).tree as Extract<Node, { type: "split" }>;
    // The ids stay put because they name geometry. Everything the user sees as
    // the named view moves together.
    expect(after.a.id).toBe(tree.a.id);
    expect(after.b.id).toBe(tree.b.id);
    expect(viewAt(state, after.a)).toMatchObject({
      appId: "table",
      documents: { primary: "census" },
      title: "population by region",
    });
    expect(viewAt(state, after.b)).toMatchObject({
      appId: "chart",
      documents: { primary: "climate" },
      title: "temperature by station",
    });
  });

  test("renaming a view and then clearing it restores the derived title", () => {
    // `title: ""` must normalise to `undefined`, so there is one representation
    // of "no title" and `Tile`'s `view.title ?? derived` sends it back to the
    // derived title rather than rendering an empty bar (DR-62).
    let state = start();
    const only = (state.spaces[0] as { tree: Node }).tree as Extract<Node, { type: "leaf" }>;
    state = layout(
      state,
      layoutSlice.actions.renameView({ viewId: only.viewId, title: "  raw feed  " }),
    );
    expect(state.views[only.viewId]?.title).toBe("raw feed");

    state = layout(state, layoutSlice.actions.renameView({ viewId: only.viewId, title: "   " }));
    expect(state.views[only.viewId]?.title).toBeUndefined();
  });

  test("duplicating a view keeps the document and marks the copy", () => {
    // The SAME document, not a copy of it: two tiles on one document stay in
    // lockstep because they read one object rather than two copies.
    let state = start();
    const only = (state.spaces[0] as { tree: Node }).tree;
    state = layout(
      state,
      layoutSlice.actions.createViewInPlacement({
        nodeId: only.id,
        appId: "chart",
        docId: "doc-1",
        title: "raw feed",
      }),
    );
    state = layout(state, layoutSlice.actions.duplicateView(only.id));

    const tree = (state.spaces[0] as { tree: Node }).tree as Extract<Node, { type: "split" }>;
    expect(countLeaves(tree)).toBe(2);
    const a = tree.a as Extract<Node, { type: "leaf" }>;
    const b = tree.b as Extract<Node, { type: "leaf" }>;
    expect(state.views[b.viewId]?.appId).toBe("chart");
    expect(state.views[b.viewId]?.documents).toEqual(state.views[a.viewId]?.documents);
    expect(state.views[b.viewId]?.title).toBe("raw feed (copy)");
    expect(b.viewId).not.toBe(a.viewId);
    // A duplicate that reused the id would give React duplicate keys AND make
    // the hit-test return the wrong tile — the class of bug DR-12 removes.
    expect(b.id).not.toBe(a.id);
  });

  test("duplicating an unlabelled leaf leaves it unlabelled", () => {
    // Not "new tile (copy)": the derived title is already doing the work, and
    // a label appearing out of nowhere would make the copy look renamed.
    let state = start();
    const only = (state.spaces[0] as { tree: Node }).tree;
    state = layout(state, layoutSlice.actions.duplicateView(only.id, "col"));
    const tree = (state.spaces[0] as { tree: Node }).tree as Extract<Node, { type: "split" }>;
    expect(tree.dir).toBe("col");
    expect(state.views[(tree.b as Extract<Node, { type: "leaf" }>).viewId]?.title).toBeUndefined();
  });

  test("a linked duplicate creates a second placement of the same view", () => {
    let state = start();
    const only = state.spaces[0]!.tree as Extract<Node, { type: "leaf" }>;
    state = layout(state, layoutSlice.actions.createLinkedDuplicate(only.id));
    const tree = state.spaces[0]!.tree as Extract<Node, { type: "split" }>;
    expect((tree.a as Extract<Node, { type: "leaf" }>).viewId).toBe(
      (tree.b as Extract<Node, { type: "leaf" }>).viewId,
    );
  });

  test("renaming and document changes propagate through linked placements", () => {
    let state = start();
    const only = state.spaces[0]!.tree as Extract<Node, { type: "leaf" }>;
    state = layout(
      state,
      layoutSlice.actions.createViewInPlacement({
        nodeId: only.id,
        appId: "chart",
        docId: "doc-a",
      }),
    );
    state = layout(state, layoutSlice.actions.createLinkedDuplicate(only.id));
    const tree = state.spaces[0]!.tree as Extract<Node, { type: "split" }>;
    const a = tree.a as Extract<Node, { type: "leaf" }>;
    const b = tree.b as Extract<Node, { type: "leaf" }>;

    state = layout(
      state,
      layoutSlice.actions.renameView({ viewId: b.viewId, title: "shared title" }),
    );
    state = layout(
      state,
      layoutSlice.actions.setViewDocument({ viewId: b.viewId, docId: "doc-b" }),
    );

    expect(a.viewId).toBe(b.viewId);
    expect(state.views[a.viewId]).toMatchObject({
      title: "shared title",
      documents: { primary: "doc-b" },
    });
  });

  test("an independent duplicate diverges without copying its document", () => {
    let state = start();
    const only = state.spaces[0]!.tree as Extract<Node, { type: "leaf" }>;
    state = layout(
      state,
      layoutSlice.actions.createViewInPlacement({
        nodeId: only.id,
        appId: "chart",
        docId: "doc-a",
      }),
    );
    state = layout(state, layoutSlice.actions.duplicateView(only.id));
    const tree = state.spaces[0]!.tree as Extract<Node, { type: "split" }>;
    const source = tree.a as Extract<Node, { type: "leaf" }>;
    const copy = tree.b as Extract<Node, { type: "leaf" }>;

    state = layout(
      state,
      layoutSlice.actions.setViewDocument({ viewId: copy.viewId, docId: "doc-b" }),
    );
    expect(state.views[source.viewId]?.documents.primary).toBe("doc-a");
    expect(state.views[copy.viewId]?.documents.primary).toBe("doc-b");
  });

  test("replacing a placement links an existing view and leaves the old view open", () => {
    let state = start();
    const source = state.spaces[0]!.tree as Extract<Node, { type: "leaf" }>;
    const oldViewId = source.viewId;
    state = layout(state, layoutSlice.actions.createLinkedDuplicate(source.id));
    let tree = state.spaces[0]!.tree as Extract<Node, { type: "split" }>;
    const target = tree.b as Extract<Node, { type: "leaf" }>;
    state = layout(
      state,
      layoutSlice.actions.createViewInPlacement({ nodeId: target.id, appId: "chart" }),
    );
    tree = state.spaces[0]!.tree as Extract<Node, { type: "split" }>;
    const chartViewId = (tree.b as Extract<Node, { type: "leaf" }>).viewId;

    state = layout(
      state,
      layoutSlice.actions.replacePlacementWithView({
        nodeId: (tree.a as Extract<Node, { type: "leaf" }>).id,
        viewId: chartViewId,
      }),
    );
    const after = state.spaces[0]!.tree as Extract<Node, { type: "split" }>;
    expect((after.a as Extract<Node, { type: "leaf" }>).viewId).toBe(chartViewId);
    expect((after.b as Extract<Node, { type: "leaf" }>).viewId).toBe(chartViewId);
    expect(state.views[oldViewId]).toBeDefined();
  });

  test("removing one linked placement leaves its view and other placement intact", () => {
    let state = start();
    const only = state.spaces[0]!.tree as Extract<Node, { type: "leaf" }>;
    state = layout(state, layoutSlice.actions.createLinkedDuplicate(only.id));
    const tree = state.spaces[0]!.tree as Extract<Node, { type: "split" }>;
    const linked = tree.b as Extract<Node, { type: "leaf" }>;
    state = layout(state, layoutSlice.actions.closeLeaf(linked.id));

    const remaining = state.spaces[0]!.tree as Extract<Node, { type: "leaf" }>;
    expect(remaining.viewId).toBe(only.viewId);
    expect(state.views[only.viewId]).toBeDefined();
  });

  test("closing a view removes all placements and repairs an emptied workspace", () => {
    let state = start();
    const only = state.spaces[0]!.tree as Extract<Node, { type: "leaf" }>;
    state = layout(state, layoutSlice.actions.createLinkedDuplicate(only.id));
    state = layout(state, layoutSlice.actions.cloneSpace(state.currentSpaceId));
    state = layout(state, layoutSlice.actions.closeView(only.viewId));

    expect(state.views[only.viewId]).toBeUndefined();
    for (const space of state.spaces) {
      expect(countLeaves(space.tree)).toBe(1);
      const replacement = space.tree as Extract<Node, { type: "leaf" }>;
      expect(state.views[replacement.viewId]?.appId).toBe("launcher");
    }
  });

  test("docking never leaves the same leaf in two places", () => {
    let state = start();
    const first = (state.spaces[0] as { tree: Node }).tree.id;
    state = layout(state, layoutSlice.actions.splitLeaf({ nodeId: first, dir: "row" }));
    const tree = (state.spaces[0] as { tree: Node }).tree as Extract<Node, { type: "split" }>;

    state = layout(
      state,
      layoutSlice.actions.dockTile({ from: tree.a.id, to: tree.b.id, zone: "bottom" }),
    );
    const after = (state.spaces[0] as { tree: Node }).tree;
    expect(countLeaves(after)).toBe(2);
    expect(findLeaf(after, tree.a.id)).not.toBeNull();
  });
});

/* ----------------------------------------------------------------- world -- */

describe("documents", () => {
  test("a new document becomes active and is named in sequence", () => {
    const { state, docId } = withDoc();
    expect(state.activeDocId).toBe(docId);
    expect(state.docs[docId]?.name).toBe("α");

    const next = world(state, worldActions.newDoc(readings.source));
    expect(next.docs[next.activeDocId as string]?.name).toBe("β");
  });

  test("the last document cannot be deleted", () => {
    const { state, docId } = withDoc();
    expect(world(state, worldActions.deleteDoc(docId)).docOrder.length).toBe(1);
  });

  test("deleting the active document reassigns activeDocId", () => {
    // Leaving it dangling makes every ambient verb a silent no-op — the worst
    // possible failure for an interface built on ambient verbs.
    let state = withDoc().state;
    state = world(state, worldActions.newDoc(readings.source));
    const active = state.activeDocId as string;

    const next = world(state, worldActions.deleteDoc(active));
    expect(next.activeDocId).not.toBe(active);
    expect(next.docs[next.activeDocId as string]).toBeDefined();
  });

  test("duplicating a document does not alias its spec", () => {
    let { state, docId } = withDoc();
    state = world(state, worldActions.setMapping({ docId, channel: "y", field: "data.temp_c" }));
    state = world(state, worldActions.duplicateDoc({ docId, id: "copy" }));

    state = world(state, worldActions.setMapping({ docId, channel: "y", field: "data.humidity" }));
    // A spread would have aliased `mapping`, so editing one would edit both.
    expect(state.docs.copy ? rootView(state.docs.copy).encodings.y?.name : null).toBe(
      "data.temp_c",
    );
  });

  test("changing source resets the pipeline and the encoding", () => {
    let { state, docId } = withDoc();
    state = world(state, worldActions.setMapping({ docId, channel: "y", field: "data.temp_c" }));
    state = world(
      state,
      worldActions.setDocSource({ docId, source: { kind: "stream", drop: "other" } }),
    );
    // Keeping them would name columns the new source may not have, producing a
    // chart that refuses to draw with no obvious cause.
    expect(
      state.docs[docId] ? rootView(state.docs[docId]!).encodings.y : undefined,
    ).toBeUndefined();
    expect(state.docs[docId]?.transforms).toEqual({});
  });
});

describe("plot authoring", () => {
  test("analysis and facet scale actions update the canonical view", () => {
    let { state, docId } = withDoc();
    state = world(
      state,
      worldActions.setAnalysis({
        docId,
        analysis: { kind: "histogram", bins: 20 },
      }),
    );
    state = world(
      state,
      worldActions.setFacetScales({
        docId,
        scales: "free-y",
      }),
    );

    const view = rootView(state.docs[docId]!);
    expect(view.analysis).toEqual({ kind: "histogram", bins: 20 });
    expect(view.facetScales).toBe("free-y");
    expect(state.trace.at(-2)?.type).toBe("analysis_set");
    expect(state.trace.at(-1)?.type).toBe("facet_scales_set");
  });

  test("snapshots preserve an analysis recipe independently", () => {
    let { state, docId } = withDoc();
    state = world(
      state,
      worldActions.setAnalysis({
        docId,
        analysis: { kind: "density", points: 128 },
      }),
    );
    state = world(state, worldActions.snapshot(docId, "2026-07-29T00:00:00Z"));
    const snapshotId = state.snapshotOrder[0] as string;
    state = world(
      state,
      worldActions.setAnalysis({
        docId,
        analysis: { kind: "boxplot" },
      }),
    );

    expect(rootView(state.snapshots[snapshotId]!.document).analysis).toEqual({
      kind: "density",
      points: 128,
    });
  });
});

describe("snapshots", () => {
  test("a snapshot does not follow the document it came from", () => {
    // The single line the whole feature depends on: structuredClone, not a
    // spread. If this fails, every snapshot silently tracks its document.
    let { state, docId } = withDoc();
    state = world(state, worldActions.setMapping({ docId, channel: "y", field: "data.temp_c" }));
    state = world(state, worldActions.snapshot(docId, "2026-07-25T00:00:00Z"));
    const snapshotId = state.snapshotOrder[0] as string;

    state = world(state, worldActions.setMapping({ docId, channel: "y", field: "data.humidity" }));
    const frozen = state.snapshots[snapshotId]?.document;
    expect(frozen ? rootView(frozen).encodings.y?.name : null).toBe("data.temp_c");
  });

  test("restoring does not alias the snapshot's steps", () => {
    let { state, docId } = withDoc();
    state = world(state, worldActions.snapshot(docId, "2026-07-25T00:00:00Z"));
    const snapshotId = state.snapshotOrder[0] as string;
    state = world(state, worldActions.restoreSnapshot({ snapshotId, docId }));

    state = world(state, worldActions.setMapping({ docId, channel: "x", field: "time" }));
    const frozen = state.snapshots[snapshotId]?.document;
    expect(frozen ? rootView(frozen).encodings.x : undefined).toBeUndefined();
  });

  test("deleting a pinned snapshot clears the pin", () => {
    let { state, docId } = withDoc();
    state = world(state, worldActions.snapshot(docId, "2026-07-25T00:00:00Z"));
    const snapshotId = state.snapshotOrder[0] as string;
    state = world(state, worldActions.pinSnapshot({ slot: 0, snapshotId }));
    state = world(state, worldActions.deleteSnapshot(snapshotId));
    // A pin naming a snapshot that is gone renders an empty compare slot with
    // no way to tell why.
    expect(state.pins[0]).toBeNull();
  });
});

describe("canonical transforms", () => {
  test("toggling disables without deleting", () => {
    let { state, docId } = withDoc();
    state = world(
      state,
      worldActions.addTransform({
        docId,
        transform: {
          id: "s1",
          kind: "core:limit",
          input: { kind: "source", sourceId: "pending" },
          enabled: true,
          state: "complete",
          count: 10,
        },
      }),
    );
    state = world(state, worldActions.toggleTransform({ docId, transformId: "s1" }));
    expect(orderedTransformIds(state.docs[docId]!)).toEqual(["s1"]);
    expect(state.docs[docId]?.transforms.s1?.enabled).toBe(false);
  });

  test("moving a transform past either end is a no-op", () => {
    let { state, docId } = withDoc();
    state = world(
      state,
      worldActions.addTransform({
        docId,
        transform: {
          id: "s1",
          kind: "core:limit",
          input: { kind: "source", sourceId: "pending" },
          enabled: true,
          state: "complete",
          count: 10,
        },
      }),
    );
    state = world(state, worldActions.moveTransform({ docId, transformId: "s1", by: -1 }));
    expect(orderedTransformIds(state.docs[docId]!)).toEqual(["s1"]);
    expect(JSON.stringify(state.docs[docId])).not.toContain("typeOverrides");
  });
});

describe("the trace ring", () => {
  test("drops from the front at the cap", () => {
    let { state, docId } = withDoc();
    for (let i = 0; i < TRACE_CAP + 25; i++) {
      state = world(state, worldActions.setGeom({ docId, geom: i % 2 ? "line" : "point" }));
    }
    expect(state.trace).toHaveLength(TRACE_CAP);
    // Newest kept, oldest dropped — the opposite would make the tail useless.
    expect(state.trace[state.trace.length - 1]?.seq).toBeGreaterThan(TRACE_CAP);
  });
});

/* ------------------------------------------------------------- verb seam -- */

describe("verbs become actions", () => {
  // Both lookups over the same fixture, so schema and rows agree (DR-40).
  const env = (state: WorldState) =>
    environmentFor(
      state,
      () => readings,
      () => readings.fields,
    );

  /**
   * `actionsForVerb` takes the WHOLE state since DATADROP-8 (DR-68), and may
   * return a thunk. These world-verb cases never do, so the helper narrows the
   * result back to a plain action rather than every call site casting.
   */
  const world1 = (state: WorldState) => ({ world: state, layout: initialLayout() });
  const only = (results: unknown[]) => results[0] as Parameters<typeof world>[1];

  test("a verb naming a document targets that document", () => {
    const { state, docId } = withDoc();
    const action = only(
      actionsForVerb(
        { kind: "setMapping", docId, channel: "y", field: "data.temp_c" },
        world1(state),
        env(state),
      ),
    );
    const next = world(state, action);
    expect(rootView(next.docs[docId]!).encodings.y?.name).toBe("data.temp_c");
  });

  test("an ambient verb resolves at application time, not at menu-build time", () => {
    // The active document can change while a menu is open, so a null docId is
    // resolved by the reducer rather than baked into the verb.
    let { state } = withDoc();
    state = world(state, worldActions.newDoc(readings.source));
    const second = state.activeDocId as string;

    const action = only(
      actionsForVerb(
        { kind: "setMapping", docId: null, channel: "y", field: "data.temp_c" },
        world1(state),
        env(state),
      ),
    );
    const next = world(state, action);
    expect(rootView(next.docs[second]!).encodings.y?.name).toBe("data.temp_c");
  });

  test("addFilter mints a step against the schema as of the pipeline's end", () => {
    const { state, docId } = withDoc();
    const action = only(
      actionsForVerb(
        { kind: "addFilter", docId, field: "data.station", op: "=", value: "north" },
        world1(state),
        env(state),
      ),
    );
    const next = world(state, action);
    const transform = next.docs[docId]?.transforms[orderedTransformIds(next.docs[docId]!)[0]!];
    expect(transform).toMatchObject({ kind: "core:filter", enabled: true });
    expect(JSON.stringify(transform)).toContain("data.station");
    expect(JSON.stringify(transform)).toContain("north");
  });

  test("addFilter keeps a blank descriptor predicate inactive", () => {
    const { state, docId } = withDoc();
    const action = only(
      actionsForVerb(
        { kind: "addFilter", docId, field: "data.temp_c", op: "=", value: "" },
        world1(state),
        env(state),
      ),
    );
    const next = world(state, action);
    const transform = next.docs[docId]?.transforms[orderedTransformIds(next.docs[docId]!)[0]!];
    expect(transform).toMatchObject({ kind: "core:filter", enabled: false });
  });
});

/* ----------------------------------------------------------- persistence -- */

describe("splitting to make room for a new view", () => {
  const leavesOf = (node: Node): Extract<Node, { type: "leaf" }>[] =>
    node.type === "leaf" ? [node] : [...leavesOf(node.a), ...leavesOf(node.b)];
  const currentTree = (state: LayoutState) =>
    state.spaces.find((s) => s.id === state.currentSpaceId)?.tree as Node;

  test("a split with no application still makes an empty launcher tile", () => {
    // The title bar's split button names none, and that is the original
    // behaviour this must not change.
    const state = initialLayout();
    const first = leavesOf(currentTree(state))[0] as Extract<Node, { type: "leaf" }>;
    const next = layout(state, layoutSlice.actions.splitLeaf({ nodeId: first.id, dir: "row" }));
    const added = leavesOf(currentTree(next)).find((leaf) => leaf.id !== first.id);
    expect(next.views[added?.viewId ?? ""]?.appId).toBe("launcher");
  });

  test("a split that names an application creates that view in one action", () => {
    // One dispatch, not two: splitting and then filling would render an empty
    // launcher tile for a frame before the real view replaced it.
    const state = initialLayout();
    const first = leavesOf(currentTree(state))[0] as Extract<Node, { type: "leaf" }>;
    const next = layout(
      state,
      layoutSlice.actions.splitLeaf({
        nodeId: first.id,
        dir: "col",
        appId: "chart",
        docId: "doc-1",
      }),
    );
    const added = leavesOf(currentTree(next)).find((leaf) => leaf.id !== first.id);
    expect(next.views[added?.viewId ?? ""]).toMatchObject({
      appId: "chart",
      documents: { primary: "doc-1" },
    });
    // The tile that was split survives untouched — nothing is replaced.
    expect(leavesOf(currentTree(next)).map((leaf) => leaf.id)).toContain(first.id);
  });
});

describe("persistence is defensive", () => {
  /** A current canonical payload holding one user workspace in the work stage. */
  const currentPayload = (
    spaces: unknown[],
    currentSpaceId: string,
    stages: unknown[] = [],
    currentStageId = WORK_STAGE_ID,
  ) => ({
    version: 4,
    world: { docs: {}, docOrder: [], snapshots: {} },
    layout: {
      stages,
      currentStageId,
      spaces,
      currentSpaceId,
      views: { v: { id: "v", appId: "chart", documents: {} } },
      viewOrder: ["v"],
    },
  });

  test("a payload from another version is refused", () => {
    expect(
      validate({ version: 99, world: {}, layout: { spaces: [], currentSpaceId: "" } }),
    ).toBeNull();
  });

  test("a normalized payload with a known view reference is accepted", () => {
    const tree = { id: "n", type: "leaf", viewId: "v" };
    const valid = validate(
      currentPayload([{ id: "s", name: "x", stageId: WORK_STAGE_ID, tree }], "s"),
    );
    expect(valid?.layout.spaces.find((space) => space.id === "s")?.tree).toEqual(tree);
    expect(valid?.layout.views.v).toEqual({
      id: "v",
      appId: "chart",
      documents: {},
    });
  });

  test("a missing view dictionary is refused", () => {
    const payload = currentPayload([], "");
    const { views: _, ...layout } = payload.layout;
    expect(validate({ ...payload, layout })).toBeNull();
  });

  test("a view dictionary key that disagrees with its view id is refused", () => {
    const payload = currentPayload([], "");
    payload.layout.views.v.id = "another-view";
    expect(validate(payload)).toBeNull();
  });

  test("a dangling placement view reference is refused", () => {
    const tree = { id: "n", type: "leaf", viewId: "missing" };
    expect(
      validate(currentPayload([{ id: "s", name: "x", stageId: WORK_STAGE_ID, tree }], "s")),
    ).toBeNull();
  });

  test("duplicate view-order entries are refused", () => {
    const payload = currentPayload([], "");
    expect(
      validate({
        ...payload,
        layout: {
          ...payload.layout,
          views: {
            ...payload.layout.views,
            second: { id: "second", appId: "table", documents: {} },
          },
          viewOrder: ["v", "v"],
        },
      }),
    ).toBeNull();
  });

  test("a malformed tree is refused rather than rendered", () => {
    expect(
      validate(
        currentPayload(
          [{ id: "s", name: "x", stageId: WORK_STAGE_ID, tree: { id: "n", type: "split" } }],
          "s",
        ),
      ),
    ).toBeNull();
  });

  test("a ratio outside the sane range is refused", () => {
    const tree = {
      id: "n",
      type: "split",
      dir: "row",
      ratio: 12,
      a: { id: "a", type: "leaf", viewId: "v" },
      b: { id: "b", type: "leaf", viewId: "v" },
    };
    expect(
      validate(currentPayload([{ id: "s", name: "x", stageId: WORK_STAGE_ID, tree }], "s")),
    ).toBeNull();
  });

  test("a currentSpaceId naming a missing space falls back to the stage's", () => {
    const tree = { id: "n", type: "leaf", viewId: "v" };
    const valid = validate(
      currentPayload([{ id: "s", name: "x", stageId: WORK_STAGE_ID, tree }], "gone"),
    );
    // The stage's own pointer has already been repaired by mergeStages, so the
    // layout mirror follows it (DR-60). The property under test is the fallback,
    // not the identity of the space it falls back to.
    expect(valid?.layout.currentSpaceId).toBe("s");
    expect(valid?.layout.spaces.map((space) => space.id)).toContain("s");
  });

  test("the hardwired workspaces are restored from code, not from storage", () => {
    // DR-29. A user who deleted the account workspace in a previous release
    // must get it back, and a stored tree under a pinned id must not win.
    const valid = validate(
      currentPayload(
        [
          {
            id: ACCOUNT_SPACE_ID,
            name: "renamed by a user",
            stageId: ACCOUNT_STAGE_ID,
            tree: { id: "n", type: "leaf", viewId: "v" },
          },
        ],
        ACCOUNT_SPACE_ID,
        [],
        ACCOUNT_STAGE_ID,
      ),
    );

    const ids = valid?.layout.spaces.map((space) => space.id) ?? [];
    expect(ids).toContain(SIGNIN_SPACE_ID);
    expect(ids).toContain(ACCOUNT_SPACE_ID);
    // Exactly once: merging must not duplicate a pinned space that was stored.
    expect(ids.filter((id) => id === ACCOUNT_SPACE_ID)).toHaveLength(1);

    const account = valid?.layout.spaces.find((space) => space.id === ACCOUNT_SPACE_ID);
    expect(account?.name).toBe("profile");
    expect(account?.pinned).toBe(true);
  });

  test("user-created spaces survive the merge", () => {
    const valid = validate(
      currentPayload(
        [
          {
            id: "mine",
            name: "mine",
            stageId: WORK_STAGE_ID,
            tree: { id: "n", type: "leaf", viewId: "v" },
          },
        ],
        "mine",
      ),
    );
    expect(valid?.layout.spaces.find((space) => space.id === "mine")?.name).toBe("mine");
    expect(valid?.layout.currentSpaceId).toBe("mine");
  });

  test("credential-shaped keys are detected anywhere in the payload", () => {
    // A snapshot is designed to be shared. One carrying a bearer token is a
    // credential-exfiltration feature, so `save` refuses rather than truncates.
    expect(findSecrets({ a: { b: { token: "x" } } })).toEqual(["a.b.token"]);
    expect(findSecrets({ spec: { source: { drop: "lab" } } })).toEqual([]);
  });

  test("findSecrets survives a cycle", () => {
    const cyclic: Record<string, unknown> = { name: "x" };
    cyclic.self = cyclic;
    expect(findSecrets(cyclic)).toEqual([]);
  });

  /**
   * Transient layout state is excluded from what `save` writes.
   *
   * `save()` enumerates the fields it writes rather than passing the slice
   * whole, which is what makes a new transient field safe *by default* — but
   * only until someone reaches for a spread. This asserts the property rather
   * than the convention (DATALAB-VIEW-001 design-doc/02 §14): the failure it
   * catches produces no error and no visible symptom until the next reload
   * opens a modal over a tile that may no longer exist (DR-69).
   */
  test("no transient layout field reaches storage", () => {
    const written: Record<string, string> = {};
    const previous = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = {
      setItem: (key: string, value: string) => {
        written[key] = value;
      },
      getItem: (key: string) => written[key] ?? null,
      removeItem: (key: string) => {
        delete written[key];
      },
    };

    try {
      const layout: LayoutState = {
        ...initialLayout(),
        launcher: { kind: "replace", placementId: "n" },
        renamingId: "n",
        pendingImport: { target: { kind: "stage" }, prefill: "secret-ish", from: "clipboard" },
        notice: { ok: true, title: "Copied", body: "…" },
        justSignedUp: true,
      };
      save("test-key", worldSlice.getInitialState(), layout);

      const stored = written["test-key"];
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored as string) as { layout: Record<string, unknown> };
      expect(Object.keys(parsed.layout).sort()).toEqual([
        "currentSpaceId",
        "currentStageId",
        "spaces",
        "stages",
        "viewOrder",
        "views",
      ]);
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = previous;
    }
  });
});
