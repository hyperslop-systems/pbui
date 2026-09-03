import { describe, expect, test } from "vitest";
import {
  createWorkbenchCore,
  createWorkbenchLinks,
  sequentialIds,
  validateWorkbenchDocument,
} from "@hyperslop-systems/workbench-core";
import "../src/apps/all";
import { datalabManifests } from "../src/appkit/workbenchApps";
import { WELCOME_DOC_IDS } from "../src/demo/welcome";
import { GRAPHIC_DOCUMENT_FORMAT, isGraphicStub } from "../src/store/graphicSource";
import { compileSeed, defaultSeed, singleStageSeed, split, tile } from "../src/store/seed";
import { WORK_STAGE_ID } from "../src/store/stageIds";
import { shapeOfDocument } from "./helpers/layoutShape";
import shapeGolden from "./fixtures/layout-shape.golden.json";

/**
 * The seed compiler against the Phase 0 golden (PBUI-DATALAB-WORKBENCH-1
 * Phase 1 exit gate): a headless core constructs every pinned Datalab seed
 * and validates it strictly, and the seed's SHAPE is the one the Redux
 * builder produced — same stages, same workspace order, same trees, and
 * the same view shared wherever a singleton is placed twice.
 */

const apps = datalabManifests();

describe("the default seed", () => {
  test("reproduces the frozen shape of defaultLayout()", () => {
    expect(shapeOfDocument(defaultSeed({ apps }))).toEqual(shapeGolden);
  });

  test("validates strictly against the application catalog", () => {
    const seed = defaultSeed({ apps });
    expect(validateWorkbenchDocument(seed.document, { apps })).toEqual({ ok: true });
  });

  test("constructs a headless core that starts on build", () => {
    const seed = defaultSeed({ apps });
    const core = createWorkbenchCore({
      initial: seed.document,
      apps,
      links: createWorkbenchLinks(),
      initialSession: { workspaceId: seed.workspaceId },
    });
    const state = core.getState();
    expect(state.session.workspaceId).toBe(seed.workspaceId);
    expect(state.index.workspaceById.get(seed.workspaceId)?.name).toBe("build");
    expect(seed.navigation.workspace[seed.workspaceId]?.stageId).toBe(WORK_STAGE_ID);
  });

  test("shares one logical view for every singleton placed more than once", () => {
    const seed = defaultSeed({ apps });
    for (const appId of ["sources", "inspector", "about"]) {
      const viewIds = seed.document.viewOrder.filter(
        (id) => seed.document.views[id]?.appId === appId,
      );
      expect(viewIds, `${appId} logical views`).toHaveLength(1);
      expect(
        seed.document.workspaces.filter((space) => JSON.stringify(space.tree).includes(viewIds[0]!))
          .length,
      ).toBeGreaterThan(1);
    }
  });

  test("writes an identity stub for every bound demo document, and nothing else", () => {
    const seed = defaultSeed({ apps });
    const stubs = Object.values(seed.document.documents);
    expect(stubs.length).toBeGreaterThan(0);
    for (const stub of stubs) {
      expect(stub.format).toBe(GRAPHIC_DOCUMENT_FORMAT);
      expect(isGraphicStub(stub)).toBe(true);
    }
    expect(seed.document.documents[WELCOME_DOC_IDS.temperature]).toBeDefined();
    const bound = new Set(
      Object.values(seed.document.views).flatMap((view) => Object.values(view.documents)),
    );
    expect(new Set(Object.keys(seed.document.documents))).toEqual(bound);
  });

  test("is deterministic under sequential ids", () => {
    const a = defaultSeed({ apps, ids: sequentialIds() });
    const b = defaultSeed({ apps, ids: sequentialIds() });
    expect(JSON.stringify(a.document)).toBe(JSON.stringify(b.document));
    expect(a.navigation).toEqual(b.navigation);
  });

  test("two seeds share only code-defined workspace ids", () => {
    const a = defaultSeed({ apps });
    const b = defaultSeed({ apps });
    const bIds = new Set(b.document.workspaces.map((space) => space.id));
    const shared = a.document.workspaces.filter((space) => bIds.has(space.id));
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.every((space) => a.navigation.workspace[space.id]?.pinned)).toBe(true);
  });
});

describe("compileSeed", () => {
  test("refuses a workspace naming an undefined stage", () => {
    expect(() =>
      compileSeed({
        stages: [],
        workspaces: [{ name: "x", stageId: "gone", spec: tile("chart") }],
        apps,
      }),
    ).toThrow(/names a stage "gone"/);
  });

  test("remembers the requested workspace per stage and starts where asked", () => {
    const ids = sequentialIds();
    const seed = compileSeed({
      stages: [
        {
          id: "s",
          name: "s",
          apps: null,
          chrome: { masthead: true, workspaces: true, stageBar: true },
        },
      ],
      workspaces: [
        { id: "a", name: "a", stageId: "s", spec: tile("chart") },
        { id: "b", name: "b", stageId: "s", spec: tile("table") },
      ],
      apps,
      ids,
      current: "b",
      remembered: { s: "b" },
    });
    expect(seed.workspaceId).toBe("b");
    expect(seed.navigation.rememberedWorkspaceByStage).toEqual({ s: "b" });
  });
});

describe("singleStageSeed", () => {
  test("mints a fresh stage per call and offers no stage switcher", () => {
    const a = singleStageSeed("build", tile("chart"), { apps });
    const b = singleStageSeed("build", tile("chart"), { apps });
    expect(a.navigation.stages[0]?.id).not.toBe(b.navigation.stages[0]?.id);
    expect(a.workspaceId).not.toBe(b.workspaceId);
    expect(a.navigation.stages[0]?.chrome.stageBar).toBe(false);
    expect(validateWorkbenchDocument(a.document, { apps })).toEqual({ ok: true });
  });

  test("carries an explicit allow-list onto the stage", () => {
    const seed = singleStageSeed("grammar", split("row", 0.5, tile("chart"), tile("encode")), {
      apps,
      allowed: ["chart", "encode"],
    });
    expect(seed.navigation.stages[0]?.apps).toEqual(["chart", "encode"]);
    expect(seed.document.workspaces[0]?.tree?.body.case).toBe("split");
  });
});
