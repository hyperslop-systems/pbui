import { describe, expect, test } from "vitest";
import { sequentialIds } from "@hyperslop-systems/workbench-core";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import "../src/apps/all";
import { datalabManifests } from "../src/appkit/workbenchApps";
import { createDatalabRuntime, type DatalabRuntime } from "../src/store/runtime";
import { compileSeed, defaultSeed, singleStageSeed, split, tile } from "../src/store/seed";
import { ACCOUNT_SPACE_ID, ACCOUNT_STAGE_ID, WORK_STAGE_ID } from "../src/store/stageIds";
import { worldActions } from "../src/store/world";

/**
 * The controller against the reducer goldens (PBUI-DATALAB-WORKBENCH-1
 * Phase 2 exit gate): every behaviour `test/store.test.ts` and
 * `test/stages.test.ts` pinned on the Redux layout slice, replayed through
 * the controller and the core, headless. Compared on logical views, the
 * placement→view map, workspace names and order, the session, and the
 * refusal — never on action names (design §19.1).
 */

const apps = datalabManifests();
const chrome = { masthead: true, workspaces: true, stageBar: true };

/** One id generator for the seed AND the core, so minted ids never collide with seeded ones. */
function runtime(
  build?: (
    ids: ReturnType<typeof sequentialIds>,
  ) => Parameters<typeof createDatalabRuntime>[0]["seed"],
): DatalabRuntime {
  const ids = sequentialIds();
  const seed = build ? build(ids) : singleStageSeed("build", tile("launcher"), { apps, ids });
  return createDatalabRuntime({ seed, apps, ids, ownership: "trust" });
}

/** A second world document, so a view has something real to bind. */
const addDoc = (rt: DatalabRuntime): string => {
  const action = worldActions.newDoc(null);
  rt.store.dispatch(action);
  return action.payload.id;
};

const doc = (rt: DatalabRuntime) => rt.core.getState().document;
const session = (rt: DatalabRuntime) => rt.core.getState().session;
const currentTree = (rt: DatalabRuntime) =>
  rt.core.getState().index.workspaceById.get(session(rt).workspaceId)?.tree;
/** Every leaf of the current workspace, as `{ id, viewId }`, in reading order. */
const tiles = (rt: DatalabRuntime) =>
  leaves(currentTree(rt)).map((leaf) => ({
    id: leaf.id,
    viewId: leaf.body.case === "leaf" ? leaf.body.value.viewId : "",
  }));
const viewOf = (rt: DatalabRuntime, placementId: string) =>
  doc(rt).views[tiles(rt).find((t) => t.id === placementId)!.viewId]!;
const activeDoc = (rt: DatalabRuntime) => rt.store.getState().world.activeDocId!;

/* ------------------------------------------------------- the tile verbs -- */

describe("tiles and views", () => {
  test("the last tile cannot be closed", () => {
    const rt = runtime();
    const [only] = tiles(rt);
    const result = rt.controller.removePlacement(only!.id);
    expect(result.ok).toBe(false);
    expect(tiles(rt)).toHaveLength(1);
  });

  test("splitting makes an empty launcher tile; closing it returns to one tile", () => {
    const rt = runtime();
    const first = tiles(rt)[0]!.id;
    expect(rt.controller.splitTile(first, "row").ok).toBe(true);
    expect(tiles(rt)).toHaveLength(2);
    expect(viewOf(rt, tiles(rt)[1]!.id).appId).toBe("launcher");
    expect(rt.controller.removePlacement(tiles(rt)[1]!.id).ok).toBe(true);
    expect(tiles(rt)).toHaveLength(1);
    expect(Object.keys(doc(rt).views)).toHaveLength(1);
  });

  test("a split that names an application creates that view in one transition, bound to the active document", () => {
    const rt = runtime();
    const first = tiles(rt)[0]!.id;
    const before = rt.core.getState().revision;
    const result = rt.controller.splitTile(first, "col", {
      kind: "application",
      appId: "chart",
      docId: activeDoc(rt),
    });
    expect(result.ok).toBe(true);
    expect(rt.core.getState().revision).toBe(before + 1);
    const created = viewOf(rt, tiles(rt)[1]!.id);
    expect(created.appId).toBe("chart");
    expect(created.documents.primary).toBe(activeDoc(rt));
  });

  test("swapping two tiles moves app, document and label while placement ids stay put", () => {
    const rt = runtime();
    const first = tiles(rt)[0]!.id;
    rt.controller.splitTile(first, "row");
    const [a, b] = tiles(rt).map((t) => t.id);
    const docA = addDoc(rt);
    const docB = addDoc(rt);
    rt.controller.replacePlacement(a!, {
      kind: "application",
      appId: "chart",
      docId: docA,
      title: "left",
    });
    rt.controller.replacePlacement(b!, { kind: "application", appId: "table", docId: docB });
    expect(rt.core.execute({ kind: "placement.swap", a: a!, b: b! }).ok).toBe(true);
    expect(tiles(rt).map((t) => t.id)).toEqual([a, b]);
    expect(viewOf(rt, a!)).toMatchObject({ appId: "table", documents: { primary: docB } });
    expect(viewOf(rt, b!)).toMatchObject({
      appId: "chart",
      documents: { primary: docA },
      title: "left",
    });
  });

  test("renaming a view and then clearing it restores the derived title", () => {
    const rt = runtime();
    const only = tiles(rt)[0]!;
    rt.controller.renameView(only.viewId, "  raw feed  ");
    expect(doc(rt).views[only.viewId]?.title).toBe("raw feed");
    rt.controller.renameView(only.viewId, "   ");
    expect(doc(rt).views[only.viewId]?.title).toBeUndefined();
  });

  test("duplicating a view keeps the document and marks the copy", () => {
    const rt = runtime();
    const only = tiles(rt)[0]!.id;
    const docA = addDoc(rt);
    rt.controller.replacePlacement(only, {
      kind: "application",
      appId: "chart",
      docId: docA,
      title: "mine",
    });
    expect(rt.controller.duplicateView(only).ok).toBe(true);
    const [original, copy] = tiles(rt);
    expect(copy!.viewId).not.toBe(original!.viewId);
    expect(doc(rt).views[copy!.viewId]).toMatchObject({
      appId: "chart",
      documents: { primary: docA },
      title: "mine (copy)",
    });
  });

  test("duplicating an unlabelled view leaves the copy unlabelled", () => {
    const rt = runtime();
    const only = tiles(rt)[0]!.id;
    rt.controller.replacePlacement(only, { kind: "application", appId: "chart" });
    rt.controller.duplicateView(only, "col");
    expect(doc(rt).views[tiles(rt)[1]!.viewId]?.title).toBeUndefined();
  });

  test("a linked duplicate creates a second placement of the same view", () => {
    const rt = runtime();
    const only = tiles(rt)[0]!;
    rt.controller.replacePlacement(only.id, { kind: "application", appId: "chart" });
    expect(rt.controller.createLinkedDuplicate(only.id).ok).toBe(true);
    const [a, b] = tiles(rt);
    expect(a!.viewId).toBe(b!.viewId);
    expect(Object.keys(doc(rt).views)).toHaveLength(1);
  });

  test("renaming and document changes propagate through linked placements", () => {
    const rt = runtime();
    const only = tiles(rt)[0]!.id;
    const docA = addDoc(rt);
    const docB = addDoc(rt);
    rt.controller.replacePlacement(only, { kind: "application", appId: "chart", docId: docA });
    rt.controller.createLinkedDuplicate(only);
    const [a, b] = tiles(rt);
    rt.controller.renameView(b!.viewId, "shared title");
    rt.controller.rebindView(b!.viewId, docB);
    expect(viewOf(rt, a!.id)).toMatchObject({
      title: "shared title",
      documents: { primary: docB },
    });
  });

  test("an independent duplicate diverges without copying its document", () => {
    const rt = runtime();
    const only = tiles(rt)[0]!.id;
    const docA = addDoc(rt);
    const docB = addDoc(rt);
    rt.controller.replacePlacement(only, { kind: "application", appId: "chart", docId: docA });
    rt.controller.duplicateView(only);
    const [original, copy] = tiles(rt);
    rt.controller.rebindView(copy!.viewId, docB);
    expect(viewOf(rt, original!.id).documents.primary).toBe(docA);
    expect(viewOf(rt, copy!.id).documents.primary).toBe(docB);
  });

  test("replacing a placement with an existing view links it; the view it showed goes when nothing else shows it", () => {
    const rt = runtime();
    const source = tiles(rt)[0]!.id;
    rt.controller.replacePlacement(source, { kind: "application", appId: "chart" });
    rt.controller.createLinkedDuplicate(source);
    const target = tiles(rt)[1]!.id;
    rt.controller.replacePlacement(target, { kind: "application", appId: "table" });
    const tableView = viewOf(rt, target).id;
    expect(
      rt.controller.replacePlacement(target, { kind: "existing", viewId: viewOf(rt, source).id })
        .ok,
    ).toBe(true);
    expect(viewOf(rt, target).id).toBe(viewOf(rt, source).id);
    // The core sweeps what the batch left unplaced (design §19.3): no "unplaced" view remains.
    expect(doc(rt).views[tableView]).toBeUndefined();
  });

  test("removing one linked placement leaves its view and the other placement intact", () => {
    const rt = runtime();
    const only = tiles(rt)[0]!;
    rt.controller.replacePlacement(only.id, { kind: "application", appId: "chart" });
    rt.controller.createLinkedDuplicate(only.id);
    const linked = tiles(rt)[1]!;
    expect(rt.controller.removePlacement(linked.id).ok).toBe(true);
    expect(tiles(rt).map((t) => t.viewId)).toEqual([linked.viewId]);
    expect(doc(rt).views[linked.viewId]).toBeDefined();
  });

  test("closing a view removes every placement and repairs an emptied workspace with a launcher", () => {
    const rt = runtime();
    const only = tiles(rt)[0]!;
    rt.controller.replacePlacement(only.id, { kind: "application", appId: "chart" });
    rt.controller.createLinkedDuplicate(only.id);
    const chartView = viewOf(rt, only.id).id;
    // A second workspace showing the SAME view. (Cloning a workspace would
    // not do: the core clones a clone-able application's view, where the old
    // reducer linked it — a deviation recorded in the diary.)
    const first = session(rt).workspaceId;
    const second = rt.controller.createWorkspace({ name: "second" });
    expect(second.ok).toBe(true);
    rt.controller.replacePlacement(tiles(rt)[0]!.id, { kind: "existing", viewId: chartView });
    rt.controller.selectWorkspace(first);
    expect(doc(rt).workspaces).toHaveLength(2);
    expect(rt.controller.closeView(chartView).ok).toBe(true);
    expect(doc(rt).views[chartView]).toBeUndefined();
    for (const workspace of doc(rt).workspaces) {
      const own = leaves(workspace.tree);
      expect(own).toHaveLength(1);
      expect(
        doc(rt).views[own[0]!.body.case === "leaf" ? own[0]!.body.value.viewId : ""]?.appId,
      ).toBe("launcher");
    }
  });

  test("closing a view placed beside others only removes its placements", () => {
    const rt = runtime();
    const first = tiles(rt)[0]!.id;
    rt.controller.splitTile(first, "row", { kind: "application", appId: "chart" });
    const chart = tiles(rt)[1]!;
    expect(rt.controller.closeView(chart.viewId).ok).toBe(true);
    expect(tiles(rt)).toHaveLength(1);
    expect(viewOf(rt, tiles(rt)[0]!.id).appId).toBe("launcher");
    // Nothing was emptied, so no fallback launcher view was minted.
    expect(Object.keys(doc(rt).views)).toHaveLength(1);
  });

  test("docking never leaves the same leaf in two places", () => {
    const rt = runtime();
    const first = tiles(rt)[0]!.id;
    rt.controller.splitTile(first, "row");
    const [a, b] = tiles(rt).map((t) => t.id);
    expect(
      rt.core.execute({ kind: "placement.dock", source: a!, target: b!, edge: "bottom" }).ok,
    ).toBe(true);
    const ids = tiles(rt).map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(2);
  });

  test("a singleton application's existing view is reused rather than minted twice", () => {
    const rt = runtime();
    const first = tiles(rt)[0]!.id;
    rt.controller.splitTile(first, "row", { kind: "application", appId: "sources" });
    rt.controller.splitTile(first, "row", { kind: "application", appId: "sources" });
    const sources = Object.values(doc(rt).views).filter((view) => view.appId === "sources");
    expect(sources).toHaveLength(1);
    expect(tiles(rt).filter((t) => t.viewId === sources[0]!.id)).toHaveLength(2);
  });
});

/* ----------------------------------------------------- active placement -- */

describe("active placement", () => {
  test("closing the active tile clears it rather than moving it", () => {
    const rt = runtime();
    const first = tiles(rt)[0]!.id;
    rt.controller.splitTile(first, "row");
    rt.controller.setActivePlacement(first);
    rt.controller.removePlacement(first);
    expect(session(rt).activePlacementId).toBeNull();
    expect(tiles(rt).map((t) => t.id)).not.toContain(first);
  });

  test("closing another tile leaves it alone", () => {
    const rt = runtime();
    const first = tiles(rt)[0]!.id;
    rt.controller.splitTile(first, "row");
    const second = tiles(rt)[1]!.id;
    rt.controller.setActivePlacement(first);
    rt.controller.removePlacement(second);
    expect(session(rt).activePlacementId).toBe(first);
  });

  test("a repeat activation changes nothing", () => {
    const rt = runtime();
    const first = tiles(rt)[0]!.id;
    rt.controller.setActivePlacement(first);
    const before = rt.core.getState();
    expect(rt.controller.setActivePlacement(first)).toMatchObject({ ok: true, changed: false });
    expect(rt.core.getState()).toBe(before);
  });
});

/* ---------------------------------------------------- workspaces, stages -- */

function twoStages(): DatalabRuntime {
  const ids = sequentialIds();
  const seed = compileSeed({
    stages: [
      { id: "s1", name: "one", apps: null, chrome },
      { id: "s2", name: "two", apps: null, chrome },
    ],
    workspaces: [
      {
        id: "s1-a",
        name: "s1-a",
        stageId: "s1",
        spec: split("row", 0.5, tile("chart"), tile("table")),
      },
      {
        id: "s1-b",
        name: "s1-b",
        stageId: "s1",
        spec: split("row", 0.5, tile("chart"), tile("table")),
      },
      {
        id: "s2-a",
        name: "s2-a",
        stageId: "s2",
        spec: split("row", 0.5, tile("chart"), tile("table")),
      },
      {
        id: "s2-b",
        name: "s2-b",
        stageId: "s2",
        spec: split("row", 0.5, tile("chart"), tile("table")),
      },
    ],
    apps,
    ids,
    current: "s1-a",
  });
  return createDatalabRuntime({ seed, apps, ids, ownership: "trust" });
}

describe("stages remember their workspace", () => {
  test("switching stages remembers each stage's workspace", () => {
    const rt = twoStages();
    rt.controller.selectWorkspace("s1-b");
    rt.controller.selectStage("s2");
    expect(session(rt).workspaceId).toBe("s2-a");
    rt.controller.selectStage("s1");
    expect(session(rt).workspaceId).toBe("s1-b");
  });

  test("switching to a workspace in another stage switches the stage too", () => {
    const rt = twoStages();
    rt.controller.selectWorkspace("s2-b");
    expect(rt.controller.currentStageId()).toBe("s2");
    expect(session(rt).workspaceId).toBe("s2-b");
  });

  test("a stage that lost its remembered workspace lands on its first", () => {
    const rt = twoStages();
    rt.controller.selectWorkspace("s2-b");
    rt.controller.selectStage("s1");
    rt.controller.removeWorkspace("s2-b");
    rt.controller.selectStage("s2");
    expect(session(rt).workspaceId).toBe("s2-a");
  });
});

describe("workspace policy", () => {
  test("a new workspace joins the current stage and is selected", () => {
    const rt = twoStages();
    const result = rt.controller.createWorkspace({ name: "fresh" });
    expect(result.ok).toBe(true);
    const id = result.ok ? result.workspaceId! : "";
    expect(session(rt).workspaceId).toBe(id);
    expect(rt.store.getState().navigation.workspace[id]).toEqual({
      stageId: "s1",
      pinned: false,
      apps: null,
    });
    expect(rt.controller.workspacesOfStage("s1").map((w) => w.name)).toEqual([
      "s1-a",
      "s1-b",
      "fresh",
    ]);
  });

  test("a workspace added to another stage does not steal the pointer", () => {
    const rt = twoStages();
    const result = rt.controller.createWorkspace({ name: "elsewhere", stageId: "s2" });
    expect(result.ok).toBe(true);
    expect(session(rt).workspaceId).toBe("s1-a");
    expect(rt.controller.workspacesOfStage("s2").map((w) => w.name)).toContain("elsewhere");
  });

  test("deleting counts within the STAGE, not the document", () => {
    const rt = twoStages();
    rt.controller.removeWorkspace("s2-b");
    const result = rt.controller.removeWorkspace("s2-a");
    expect(result).toMatchObject({ ok: false, code: "last_workspace_in_stage" });
    expect(doc(rt).workspaces.map((w) => w.id)).toContain("s2-a");
  });

  test("deleting the current workspace lands on a sibling in the same stage", () => {
    const rt = twoStages();
    expect(rt.controller.removeWorkspace("s1-a").ok).toBe(true);
    expect(session(rt).workspaceId).toBe("s1-b");
    expect(rt.store.getState().navigation.workspace["s1-a"]).toBeUndefined();
    expect(rt.store.getState().navigation.rememberedWorkspaceByStage.s1).toBe("s1-b");
  });

  test("cloning copies the tree with fresh ids, the allow-list, and marks the name", () => {
    const rt = twoStages();
    rt.controller.setWorkspaceApps("s1-a", ["chart"]);
    const result = rt.controller.cloneWorkspace("s1-a");
    expect(result.ok).toBe(true);
    const id = result.ok ? result.workspaceId! : "";
    const copy = rt.core.getState().index.workspaceById.get(id)!;
    expect(copy.name).toBe("s1-a′");
    expect(leaves(copy.tree).map((l) => l.id)).not.toEqual(
      leaves(doc(rt).workspaces[0]!.tree).map((l) => l.id),
    );
    expect(rt.store.getState().navigation.workspace[id]).toEqual({
      stageId: "s1",
      pinned: false,
      apps: ["chart"],
    });
    expect(session(rt).workspaceId).toBe(id);
  });

  test("moving a workspace cannot strand its stage, and moving the current one keeps the user in their stage", () => {
    const rt = twoStages();
    expect(rt.controller.moveWorkspaceToStage("s1-a", "s2").ok).toBe(true);
    expect(rt.controller.currentStageId()).toBe("s1");
    expect(session(rt).workspaceId).toBe("s1-b");
    expect(rt.controller.moveWorkspaceToStage("s1-b", "s2")).toMatchObject({
      ok: false,
      code: "last_workspace_in_stage",
    });
  });

  test("a pinned workspace refuses removal, rename and move", () => {
    const rt = runtime((ids) => defaultSeed({ apps, ids }));
    expect(rt.controller.removeWorkspace(ACCOUNT_SPACE_ID)).toMatchObject({
      ok: false,
      code: "pinned_workspace",
    });
    expect(rt.controller.renameWorkspace(ACCOUNT_SPACE_ID, "mine")).toMatchObject({
      ok: false,
      code: "pinned_workspace",
    });
    expect(rt.controller.moveWorkspaceToStage(ACCOUNT_SPACE_ID, WORK_STAGE_ID)).toMatchObject({
      ok: false,
      code: "pinned_workspace",
    });
    expect(rt.core.getState().index.workspaceById.get(ACCOUNT_SPACE_ID)?.name).toBe("profile");
  });

  test("a user workspace renames", () => {
    const rt = twoStages();
    expect(rt.controller.renameWorkspace("s1-b", "renamed").ok).toBe(true);
    expect(rt.core.getState().index.workspaceById.get("s1-b")?.name).toBe("renamed");
  });
});

describe("stage policy", () => {
  test("a pinned stage refuses removal and rename", () => {
    const rt = runtime((ids) => defaultSeed({ apps, ids }));
    expect(rt.controller.removeStage(ACCOUNT_STAGE_ID)).toMatchObject({
      ok: false,
      code: "pinned_stage",
    });
    expect(rt.controller.renameStage(ACCOUNT_STAGE_ID, "mine")).toMatchObject({
      ok: false,
      code: "pinned_stage",
    });
    expect(rt.store.getState().navigation.stages.find((s) => s.id === ACCOUNT_STAGE_ID)?.name).toBe(
      "account",
    );
  });

  test("a user stage can be added and removed, and takes its workspaces with it", () => {
    const rt = twoStages();
    const added = rt.controller.addStage("client demo");
    expect(added.ok).toBe(true);
    const stage = rt.store.getState().navigation.stages.find((s) => s.name === "client demo")!;
    expect(rt.controller.currentStageId()).toBe(stage.id);
    expect(rt.controller.workspacesOfStage(stage.id)).toHaveLength(1);
    expect(rt.controller.removeStage(stage.id).ok).toBe(true);
    expect(rt.store.getState().navigation.stages.some((s) => s.id === stage.id)).toBe(false);
    expect(rt.controller.workspacesOfStage(stage.id)).toHaveLength(0);
    expect(doc(rt).workspaces).toHaveLength(4);
    expect(rt.controller.currentStageId()).toBe("s1");
  });

  test("the last stage cannot be removed", () => {
    const rt = runtime();
    const only = rt.store.getState().navigation.stages[0]!;
    expect(rt.controller.removeStage(only.id)).toMatchObject({ ok: false, code: "last_stage" });
  });
});

/* ----------------------------------------------------- the world source -- */

describe("the graphic source keeps the core's stubs in line with the world", () => {
  test("a new world document gets a stub the moment it is added, so a view can bind it in the same tick", () => {
    const rt = runtime();
    const action = worldActions.newDoc(null);
    rt.store.dispatch(action);
    expect(doc(rt).documents[action.payload.id]).toBeDefined();
    const first = tiles(rt)[0]!.id;
    expect(
      rt.controller.replacePlacement(first, {
        kind: "application",
        appId: "chart",
        docId: action.payload.id,
      }).ok,
    ).toBe(true);
  });

  test("a deleted world document's stub goes once nothing binds it", () => {
    const rt = runtime();
    const action = worldActions.newDoc(null);
    rt.store.dispatch(action);
    rt.store.dispatch(worldActions.deleteDoc(action.payload.id));
    expect(doc(rt).documents[action.payload.id]).toBeUndefined();
  });

  test("binding a document the world does not hold is refused as unknown_document", () => {
    const rt = runtime();
    const first = tiles(rt)[0]!.id;
    expect(
      rt.controller.replacePlacement(first, {
        kind: "application",
        appId: "chart",
        docId: "nowhere",
      }),
    ).toMatchObject({ ok: false, code: "unknown_document" });
  });
});
