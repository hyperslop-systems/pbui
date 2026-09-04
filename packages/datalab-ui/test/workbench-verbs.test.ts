import { describe, expect, test } from "vitest";
import { sequentialIds } from "@hyperslop-systems/workbench-core";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import "../src/apps/all";
import { datalabManifests } from "../src/appkit/workbenchApps";
import type { Verb } from "../src/pbui/verbs";
import { makeStore } from "../src/store";
import { createDatalabRuntime } from "../src/store/runtime";
import { singleStageSeed, tile } from "../src/store/seed";
import { actionsForWorkbenchVerb } from "../src/store/workbenchVerbs";

/**
 * The verb seam over the controller (Phase 2): a serialisable verb becomes
 * a thunk, the thunk reaches the controller through the store's extra
 * argument, and the consequence lands in the core — with no React and no
 * workbench instance in sight.
 */
const apps = datalabManifests();

function perform(rt: ReturnType<typeof createDatalabRuntime>, verb: Verb) {
  const thunks = actionsForWorkbenchVerb(verb);
  expect(thunks).not.toBeNull();
  for (const thunk of thunks!) rt.store.dispatch(thunk as never);
}

describe("workbench verbs", () => {
  test("split, rename, link, remove and close reach the core", () => {
    const ids = sequentialIds();
    const rt = createDatalabRuntime({
      seed: singleStageSeed("build", tile("chart"), { apps, ids }),
      apps,
      ids,
      ownership: "trust",
    });
    const tree = () =>
      rt.core.getState().index.workspaceById.get(rt.core.getState().session.workspaceId)?.tree;
    const first = leaves(tree())[0]!;
    perform(rt, { kind: "splitTile", nodeId: first.id, dir: "row" });
    expect(leaves(tree())).toHaveLength(2);
    const viewId = first.body.case === "leaf" ? first.body.value.viewId : "";
    perform(rt, { kind: "beginRenameView", placementId: first.id });
    expect(rt.store.getState().navigation.renamingId).toBe(first.id);
    perform(rt, { kind: "renameView", viewId, title: "mine" });
    expect(rt.store.getState().navigation.renamingId).toBeNull();
    expect(rt.core.getState().document.views[viewId]?.title).toBe("mine");
    perform(rt, { kind: "createLinkedDuplicate", placementId: first.id });
    expect(leaves(tree())).toHaveLength(3);
    perform(rt, { kind: "removePlacement", placementId: leaves(tree())[2]!.id });
    expect(leaves(tree())).toHaveLength(2);
    perform(rt, { kind: "closeView", viewId });
    expect(rt.core.getState().document.views[viewId]).toBeUndefined();
  });

  test("a replace verb opens the launcher against the tile; bundle verbs are thunks; world verbs are not owned", () => {
    const ids = sequentialIds();
    const rt = createDatalabRuntime({
      seed: singleStageSeed("build", tile("chart"), { apps, ids }),
      apps,
      ids,
      ownership: "trust",
    });
    perform(rt, { kind: "openReplaceView", placementId: "n1" });
    expect(rt.store.getState().navigation.launcher).toEqual({ kind: "replace", placementId: "n1" });
    // Export, import and template verbs are owned here too, as thunks that
    // end in a promise; a world verb is not.
    expect(actionsForWorkbenchVerb({ kind: "exportTile", nodeId: "n1" })).toHaveLength(1);
    expect(actionsForWorkbenchVerb({ kind: "importStage" })).toHaveLength(1);
    expect(actionsForWorkbenchVerb({ kind: "newDoc", source: null })).toBeNull();
  });

  test("a store without a workbench refuses a spatial verb loudly", () => {
    const store = makeStore();
    const [thunk] = actionsForWorkbenchVerb({ kind: "splitTile", nodeId: "n", dir: "row" })!;
    expect(() => store.dispatch(thunk as never)).toThrow(/no workbench attached/);
  });
});
