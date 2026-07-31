import { describe, expect, test } from "vitest";
import { remoteWorkbenchLoaded } from "../src/store/remote";
import type { RemoteWorkbenchState } from "../src/remote/types";
import { makeStore } from "../src/store";
import { layoutActions, type Node } from "../src/store/layout";
import { WORK_STAGE_ID } from "../src/store/stages";
import { createGraphicDocument } from "../src/model/graphicAuthoring";

function collectViews(node: Node, target: Set<string>): void {
  if (node.type === "leaf") {
    target.add(node.viewId);
    return;
  }
  collectViews(node.a, target);
  collectViews(node.b, target);
}

describe("remote workbench loading", () => {
  test("replaces the remote graph atomically while preserving code-defined stages", () => {
    const store = makeStore();
    const before = store.getState();
    const preserveViews = new Set<string>();
    for (const space of before.layout.spaces) {
      if (space.stageId !== WORK_STAGE_ID) collectViews(space.tree, preserveViews);
    }
    const preserveDocuments = new Set<string>();
    for (const id of preserveViews) {
      const view = before.layout.views[id];
      for (const documentId of Object.values(view?.documents ?? {})) {
        preserveDocuments.add(documentId);
      }
    }

    const document = createGraphicDocument(
      "document-remote",
      "Remote chart",
      { kind: "stream", drop: "production" },
      100,
    );
    const remote: RemoteWorkbenchState = {
      id: "workbench-remote",
      name: "Remote",
      workspaces: [
        {
          id: "workspace-remote",
          name: "Agent dashboard",
          tree: {
            id: "placement-remote",
            type: "leaf",
            viewId: "view-remote",
          },
        },
      ],
      views: {
        "view-remote": {
          id: "view-remote",
          appId: "chart",
          documents: { primary: document.id },
        },
      },
      viewOrder: ["view-remote"],
      documents: { [document.id]: document },
    };

    store.dispatch(
      layoutActions.openLauncher({ kind: "replace", placementId: "placement-before-load" }),
    );
    store.dispatch(layoutActions.setActivePlacement("placement-before-load"));
    store.dispatch(layoutActions.beginRename("placement-before-load"));

    let notifications = 0;
    let graphWasConsistent = false;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
      const state = store.getState();
      const view = state.layout.views["view-remote"];
      graphWasConsistent =
        view?.documents.primary === document.id && state.world.docs[document.id] === document;
    });
    store.dispatch(
      remoteWorkbenchLoaded({
        state: remote,
        stageId: WORK_STAGE_ID,
        preserveViewIds: [...preserveViews],
        preserveDocumentIds: [...preserveDocuments],
      }),
    );
    unsubscribe();

    const after = store.getState();
    expect(notifications).toBe(1);
    expect(graphWasConsistent).toBe(true);
    expect(after.layout.spaces.filter((space) => space.stageId === WORK_STAGE_ID)).toEqual([
      expect.objectContaining({ id: "workspace-remote", name: "Agent dashboard" }),
    ]);
    expect(after.layout.stages.filter((stage) => stage.id !== WORK_STAGE_ID)).toEqual(
      before.layout.stages.filter((stage) => stage.id !== WORK_STAGE_ID),
    );
    expect(after.layout.stages.find((stage) => stage.id === WORK_STAGE_ID)?.currentSpaceId).toBe(
      "workspace-remote",
    );
    expect(after.layout.pendingImport).toBeNull();
    expect(after.layout.launcher).toBeNull();
    expect(after.layout.activePlacementId).toBeNull();
    expect(after.layout.renamingId).toBeNull();
  });

  test("a remote collision cannot overwrite a preserved document", () => {
    const store = makeStore();
    const before = store.getState();
    const preservedId = before.world.docOrder[0]!;
    const preserved = before.world.docs[preservedId]!;
    const replacement = createGraphicDocument(
      preservedId,
      "Remote collision",
      { kind: "stream", drop: "production" },
      100,
    );

    store.dispatch(
      remoteWorkbenchLoaded({
        state: {
          id: "workbench-remote",
          name: "Remote",
          workspaces: [],
          views: {},
          viewOrder: [],
          documents: { [preservedId]: replacement },
        },
        stageId: WORK_STAGE_ID,
        preserveViewIds: [],
        preserveDocumentIds: [preservedId],
      }),
    );

    expect(store.getState().world.docs[preservedId]).toBe(preserved);
  });
});
