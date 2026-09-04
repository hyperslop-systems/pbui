import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { create } from "@bufbuild/protobuf";
import {
  type DocumentPayload,
  type WorkbenchDocument,
  WorkbenchDocumentSchema,
} from "@hyperslop-systems/workbench-protocol";
import { describe, expect, test } from "vitest";
import {
  assertRemoteEnvelope,
  decodeRemoteGraphics,
  parseRemoteWorkbenchJSON,
  workbenchDocumentJSON,
} from "../src/remote/codec";
import {
  assertRemoteDocumentNamespace,
  type LocalWorkbench,
  projectWorkStage,
} from "../src/remote/projection";
import { graphicStub } from "../src/store/graphicSource";
import type { PersistedNavigation } from "../src/store/navigation";
import { WORK_STAGE_ID } from "../src/store/stageIds";

const fixture = (kind: "valid" | "invalid", name: string): unknown =>
  JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, "../../../contracts/workbench/v1", kind, name),
      "utf8",
    ),
  );

/**
 * A server document as the LOCAL workbench would hold it after adoption: the
 * same workspaces and views, identity stubs where the wire carried full
 * graphics, every workspace filed under the work stage, and the full
 * graphics in the world. What `projectWorkStage` over this must give back is
 * the wire document, byte for byte.
 */
function localOf(remote: WorkbenchDocument): LocalWorkbench {
  const graphics = decodeRemoteGraphics(remote);
  const stubs: Record<string, DocumentPayload> = {};
  for (const id of Object.keys(remote.documents)) stubs[id] = graphicStub(id);
  const navigation: PersistedNavigation = {
    stages: [
      {
        id: WORK_STAGE_ID,
        name: "work",
        apps: null,
        chrome: { masthead: true, workspaces: true, stageBar: true },
      },
    ],
    workspace: Object.fromEntries(
      remote.workspaces.map((workspace) => [
        workspace.id,
        { stageId: WORK_STAGE_ID, pinned: false, apps: null },
      ]),
    ),
    rememberedWorkspaceByStage: {},
  };
  return {
    document: create(WorkbenchDocumentSchema, {
      format: remote.format,
      schemaVersion: remote.schemaVersion,
      id: remote.id,
      name: remote.name,
      workspaces: remote.workspaces,
      views: remote.views,
      viewOrder: remote.viewOrder,
      documents: stubs,
    }),
    navigation,
    world: { docs: graphics, docOrder: Object.keys(graphics) },
  };
}

describe("remote workbench codec", () => {
  test("round-trips one linked view across two workspace placements", () => {
    const source = fixture("valid", "linked-view.json");
    const remote = parseRemoteWorkbenchJSON(source);
    expect(() => assertRemoteEnvelope(remote)).not.toThrow();

    const graphics = decodeRemoteGraphics(remote);
    expect(Object.keys(graphics)).toEqual(["document-chart"]);
    expect(graphics["document-chart"]).toMatchObject({
      id: "document-chart",
      format: "datadrop.gog.document",
      version: 2,
      name: "Mass and yield",
      rootView: "view:root",
    });

    // The same logical view, placed once in each workspace.
    expect(remote.workspaces.map((workspace) => workspace.tree)).toEqual([
      expect.objectContaining({
        id: "placement-overview",
        body: { case: "leaf", value: expect.objectContaining({ viewId: "view-chart" }) },
      }),
      expect.objectContaining({
        id: "placement-detail",
        body: { case: "leaf", value: expect.objectContaining({ viewId: "view-chart" }) },
      }),
    ]);

    const rebuilt = projectWorkStage(localOf(remote), { id: remote.id, name: remote.name });
    expect(workbenchDocumentJSON(rebuilt)).toEqual(source);
  });

  test("rejects a view map key that disagrees with its embedded ID", () => {
    expect(() =>
      assertRemoteEnvelope(parseRemoteWorkbenchJSON(fixture("invalid", "view-key-mismatch.json"))),
    ).toThrow("inconsistent identity");
  });

  test("rejects document bodies that shadow envelope identity", () => {
    const source = structuredClone(fixture("valid", "linked-view.json")) as {
      documents: Record<string, { body: Record<string, unknown> }>;
    };
    source.documents["document-chart"]!.body.id = "shadowed";
    expect(() => decodeRemoteGraphics(parseRemoteWorkbenchJSON(source))).toThrow(
      "body.id is reserved",
    );
  });

  test("rejects collisions with documents owned by code-defined stages", () => {
    const remote = parseRemoteWorkbenchJSON(fixture("valid", "linked-view.json"));
    expect(() => assertRemoteDocumentNamespace(remote, ["document-chart"])).toThrow(
      "collides with a code-defined stage document",
    );
  });
});
