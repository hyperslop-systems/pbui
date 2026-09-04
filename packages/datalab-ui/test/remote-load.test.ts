import { create } from "@bufbuild/protobuf";
import { sequentialIds } from "@hyperslop-systems/workbench-core";
import {
  type WorkbenchDocument,
  WorkbenchDocumentSchema,
} from "@hyperslop-systems/workbench-protocol";
import { describe, expect, test } from "vitest";
import "../src/apps/all";
import { datalabManifests } from "../src/appkit/workbenchApps";
import { createGraphicDocument } from "../src/model/graphicAuthoring";
import { encodeGraphicDocument } from "../src/remote/codec";
import {
  type LocalWorkbench,
  mergeRemoteWorkStage,
  preservedLocalState,
  projectWorkStage,
} from "../src/remote/projection";
import { WORKBENCH_FORMAT, WORKBENCH_SCHEMA_VERSION } from "../src/remote/types";
import { isGraphicStub } from "../src/store/graphicSource";
import { navigationActions } from "../src/store/navigation";
import { remoteWorkbenchLoaded } from "../src/store/remote";
import { createDatalabRuntime, type DatalabRuntime } from "../src/store/runtime";
import { defaultSeed } from "../src/store/seed";
import { WORK_STAGE_ID } from "../src/store/stageIds";

/**
 * Adopting a server workbench over a running runtime (design §14.3): the
 * pure merge decides what to install, and the three installs land in
 * dependency order — world documents, navigation, then the core's document
 * with its session. What the tests pin is the OUTCOME: the work stage is the
 * server's, every other stage is untouched, and nothing that a code-defined
 * stage binds can be overwritten.
 */

const apps = datalabManifests();

function runtime(): DatalabRuntime {
  const ids = sequentialIds();
  return createDatalabRuntime({ seed: defaultSeed({ apps, ids }), apps, ids, ownership: "trust" });
}

const localOf = (rt: DatalabRuntime): LocalWorkbench => ({
  document: rt.core.getState().document,
  navigation: rt.store.getState().navigation,
  world: rt.store.getState().world,
});

const remoteDocument = createGraphicDocument(
  "document-remote",
  "Remote chart",
  { kind: "stream", drop: "production" },
  100,
);

/** One remote workspace holding one view of `appId`, bound to the remote document. */
function remoteWorkbench(appId = "chart"): WorkbenchDocument {
  return create(WorkbenchDocumentSchema, {
    format: WORKBENCH_FORMAT,
    schemaVersion: WORKBENCH_SCHEMA_VERSION,
    id: "workbench-remote",
    name: "Remote",
    workspaces: [
      {
        id: "workspace-remote",
        name: "Agent dashboard",
        tree: { id: "placement-remote", body: { case: "leaf", value: { viewId: "view-remote" } } },
      },
    ],
    views: {
      "view-remote": {
        id: "view-remote",
        appId,
        documents: { primary: remoteDocument.id },
      },
    },
    viewOrder: ["view-remote"],
    documents: { [remoteDocument.id]: encodeGraphicDocument(remoteDocument) },
  });
}

const stageWorkspaceIds = (rt: DatalabRuntime) => {
  const byStage: Record<string, string[]> = {};
  for (const stage of rt.store.getState().navigation.stages) {
    byStage[stage.id] = rt.controller.workspacesOfStage(stage.id).map((workspace) => workspace.id);
  }
  return byStage;
};

describe("remote workbench loading", () => {
  test("saves unbound work graphics while excluding documents owned only by local stages", () => {
    const local = localOf(runtime());
    const preservedId = preservedLocalState(local).documentIds[0]!;
    const localOnly = createGraphicDocument(preservedId, "Local demo", { kind: "stream", drop: "production" }, 100);
    local.world = {
      docs: { [preservedId]: localOnly, [remoteDocument.id]: remoteDocument },
      docOrder: [preservedId, remoteDocument.id],
    };

    const projected = projectWorkStage(local, { id: "workbench-remote", name: "Remote" });
    expect(Object.keys(projected.documents)).toEqual([remoteDocument.id]);
    expect(projected.documents[remoteDocument.id]).toEqual(encodeGraphicDocument(remoteDocument));
    expect(projected.workspaces.every((workspace) => local.navigation.workspace[workspace.id]?.stageId === WORK_STAGE_ID)).toBe(true);
  });

  test("replaces the work stage while preserving code-defined stages", () => {
    const rt = runtime();
    const local = localOf(rt);
    const preserved = preservedLocalState(local);
    const worldBefore = rt.store.getState().world;
    const stagesBefore = stageWorkspaceIds(rt);
    // The default seed starts the user on work/build.
    expect(rt.controller.currentStageId()).toBe(WORK_STAGE_ID);

    const adoption = mergeRemoteWorkStage(
      local,
      remoteWorkbench(),
      rt.core.getState().session.workspaceId,
    );

    rt.store.dispatch(
      remoteWorkbenchLoaded({
        documents: adoption.graphics,
        preserveDocumentIds: adoption.preserveDocumentIds,
      }),
    );
    rt.store.dispatch(navigationActions.replaceNavigation(adoption.navigation));
    expect(
      rt.core.replaceDocument(adoption.document, {
        session: { workspaceId: adoption.workspaceId },
      }),
    ).toEqual({ ok: true });

    // The work stage is the server's, and only the work stage.
    expect(rt.controller.workspacesOfStage(WORK_STAGE_ID).map((workspace) => workspace.id)).toEqual(
      ["workspace-remote"],
    );
    const stagesAfter = stageWorkspaceIds(rt);
    for (const [stageId, ids] of Object.entries(stagesBefore)) {
      if (stageId === WORK_STAGE_ID) continue;
      expect(stagesAfter[stageId]).toEqual(ids);
    }

    // The world holds the remote graphic in full, and everything a
    // code-defined stage binds survived untouched.
    const worldAfter = rt.store.getState().world;
    expect(worldAfter.docs[remoteDocument.id]).toEqual(remoteDocument);
    expect(preserved.documentIds.length).toBeGreaterThan(0);
    for (const id of preserved.documentIds) {
      if (worldBefore.docs[id]) expect(worldAfter.docs[id]).toBe(worldBefore.docs[id]);
    }

    // The workbench holds an identity stub, never the graphic.
    const document = rt.core.getState().document;
    const stub = document.documents[remoteDocument.id];
    expect(stub).toBeDefined();
    expect(isGraphicStub(stub!)).toBe(true);
    expect(document.views["view-remote"]).toMatchObject({
      appId: "chart",
      documents: { primary: remoteDocument.id },
    });

    // The user was in the work stage, so they land on the server's workspace.
    expect(rt.core.getState().session.workspaceId).toBe("workspace-remote");
  });

  test("a remote collision cannot overwrite a preserved document", () => {
    const rt = runtime();
    const local = localOf(rt);
    const preservedId = preservedLocalState(local).documentIds[0]!;
    const replacement = createGraphicDocument(
      preservedId,
      "Remote collision",
      { kind: "stream", drop: "production" },
      100,
    );
    const remote = create(WorkbenchDocumentSchema, {
      ...remoteWorkbench(),
      documents: { [preservedId]: encodeGraphicDocument(replacement) },
    });
    const revision = rt.core.getState().revision;
    const worldBefore = rt.store.getState().world;

    expect(() =>
      mergeRemoteWorkStage(local, remote, rt.core.getState().session.workspaceId),
    ).toThrow(/collides/);

    expect(rt.core.getState().revision).toBe(revision);
    expect(rt.store.getState().world).toBe(worldBefore);
    expect(rt.store.getState().world.docs[preservedId]).toBe(worldBefore.docs[preservedId]);
  });

  test("a remote naming an application this build lacks is refused before installing", () => {
    const rt = runtime();
    const adoption = mergeRemoteWorkStage(
      localOf(rt),
      remoteWorkbench("an-app-that-was-removed"),
      rt.core.getState().session.workspaceId,
    );
    const checked = rt.core.validateDocument(adoption.document);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.diagnostics.length).toBeGreaterThan(0);
  });
});
