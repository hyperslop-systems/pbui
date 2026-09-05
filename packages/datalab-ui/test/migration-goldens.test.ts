import { describe, expect, test } from "vitest";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import "../src/apps/all";
import { datalabManifests } from "../src/appkit/workbenchApps";
import { migrate, PERSISTENCE_VERSION, validate } from "../src/store/persist";
import { defaultSeed } from "../src/store/seed";
import {
  ACCOUNT_STAGE_ID,
  DEMO_SPACE_IDS,
  TOUR_SPACE_IDS,
  WELCOME_SPACE_ID,
  WORK_STAGE_ID,
} from "../src/store/stageIds";
import { shapeOfDocument } from "./helpers/layoutShape";
import shapeGolden from "./fixtures/layout-shape.golden.json";
import v5Payload from "./fixtures/persisted-v5.json";

/**
 * Migration goldens (PBUI-DATALAB-WORKBENCH-1 Phase 0).
 *
 * Frozen from the Redux layout slice BEFORE workbench-core replaced it, by
 * `ttmp/.../scripts/01-freeze-layout-goldens.ts`. Two things had to survive
 * the cutover unchanged, and both are easy to lose in a port:
 *
 *  - the SHAPE of the seed — stages, workspace order, every tree, and which
 *    leaves share one logical view. A seed compiler that calls the layout
 *    builder once per workspace mints a second `sources` view instead of
 *    placing the one that exists, and nothing else fails.
 *  - a real version-5 payload with user changes on top of the seed: the
 *    migrator must read exactly this, not a hand-written approximation.
 *
 * Phase 0 asserted the goldens against the code that produced them; this is
 * the other side of the gate, asserting the same goldens against the seed
 * compiler and the version-5 migrator.
 */

const apps = datalabManifests();

describe("the seed shape golden", () => {
  test("defaultSeed() reproduces the frozen shape", () => {
    expect(shapeOfDocument(defaultSeed({ apps }))).toEqual(shapeGolden);
  });

  test("the golden records singleton sharing across workspaces", () => {
    // `sources` is placed in the welcome start page, in tour 1, in demo 7 and
    // in `explore`: one alias, four placements. This is the property the seed
    // compiler has to carry across workspaces.
    const aliases: string[] = [];
    const walk = (node: unknown): void => {
      const tree = node as { view?: string; app?: string; a?: unknown; b?: unknown };
      if (tree.view) {
        if (tree.app === "sources") aliases.push(tree.view);
        return;
      }
      walk(tree.a);
      walk(tree.b);
    };
    for (const stage of shapeGolden.stages) for (const space of stage.workspaces) walk(space.tree);
    expect(aliases.length).toBeGreaterThan(1);
    expect(new Set(aliases).size).toBe(1);
  });
});

describe("the version-5 persistence golden", () => {
  const viewIdOf = (node: { body: { case?: string; value?: unknown } }): string =>
    node.body.case === "leaf" ? (node.body.value as { viewId: string }).viewId : "";

  test("is a version-5 payload the migrator brings forward and the validator accepts", () => {
    expect(v5Payload.version).toBe(5);
    const migrated = migrate(v5Payload) as { version?: unknown } | null;
    expect(migrated?.version).toBe(PERSISTENCE_VERSION);
    expect(validate(v5Payload, apps)).not.toBeNull();
  });

  test("carries every user change the migrator must preserve", () => {
    const valid = validate(v5Payload, apps)!;
    const { document, navigation, workspaceId } = valid.seed;
    const metaOf = (id: string) => navigation.workspace[id];
    const work = document.workspaces.filter((space) => metaOf(space.id)?.stageId === WORK_STAGE_ID);
    // A renamed workspace and an added one, both user-owned.
    expect(work.map((space) => space.name)).toEqual([
      "build",
      "my explore",
      "gallery",
      "help",
      "scratch",
    ]);
    expect(work.every((space) => metaOf(space.id)?.pinned === false)).toBe(true);
    // The added workspace narrows its allow-list.
    const scratch = work.find((space) => space.name === "scratch")!;
    expect(metaOf(scratch.id)?.apps).toEqual(["chart", "table", "launcher"]);
    // One chart view, named, bound to a document, placed TWICE (a linked duplicate).
    const chartLeaves = leaves(scratch.tree).filter(
      (leaf) => document.views[viewIdOf(leaf)]?.appId === "chart",
    );
    expect(chartLeaves).toHaveLength(2);
    expect(new Set(chartLeaves.map(viewIdOf)).size).toBe(1);
    const chart = document.views[viewIdOf(chartLeaves[0]!)]!;
    expect(chart.title).toBe("Yield watch");
    expect(chart.documents.primary).toBe(valid.world.docOrder[0]);
    // The stage pointers moved: the user is on `my explore` in work, and the
    // account stage remembers its own workspace.
    expect(metaOf(workspaceId)?.stageId).toBe(WORK_STAGE_ID);
    expect(document.workspaces.find((space) => space.id === workspaceId)?.name).toBe("my explore");
    expect(navigation.rememberedWorkspaceByStage[ACCOUNT_STAGE_ID]).toBe("ws-account");
  });

  test("the pinned stages and workspaces come from code, not from the payload", () => {
    // The payload carries its own copy of every pinned definition; a loader
    // that trusted it would let an old build's account page outlive the code
    // that replaced it (DR-29). The definitions must match THIS build.
    const { document, navigation } = validate(v5Payload, apps)!.seed;
    expect(navigation.stages.find((stage) => stage.id === ACCOUNT_STAGE_ID)?.name).toBe("account");
    expect(navigation.stages.every((stage) => stage.pinned)).toBe(true);
    const ids = new Set(document.workspaces.map((space) => space.id));
    for (const id of [WELCOME_SPACE_ID, ...TOUR_SPACE_IDS, ...DEMO_SPACE_IDS]) {
      expect(ids.has(id), `${id} present`).toBe(true);
      expect(navigation.workspace[id]?.pinned, `${id} pinned`).toBe(true);
    }
  });
});
