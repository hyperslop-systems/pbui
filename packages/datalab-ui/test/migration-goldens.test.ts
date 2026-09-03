import { describe, expect, test } from "vitest";
import { validate } from "../src/store/persist";
import { defaultLayout, ACCOUNT_STAGE_ID, WORK_STAGE_ID } from "../src/store/stages";
import type { Node } from "../src/store/layout";
import { shapeOfLayout } from "./helpers/layoutShape";
import shapeGolden from "./fixtures/layout-shape.golden.json";
import v5Payload from "./fixtures/persisted-v5.json";

/**
 * Migration goldens (PBUI-DATALAB-WORKBENCH-1 Phase 0).
 *
 * Frozen from the Redux layout slice BEFORE workbench-core replaces it, by
 * `ttmp/.../scripts/01-freeze-layout-goldens.ts`. Two things must survive
 * the cutover unchanged, and both are easy to lose in a port:
 *
 *  - the SHAPE of the seed — stages, workspace order, every tree, and which
 *    leaves share one logical view. A seed compiler that calls the layout
 *    builder once per workspace mints a second `sources` view instead of
 *    placing the one that exists, and nothing else fails.
 *  - a real version-5 payload with user changes on top of the seed: the
 *    migrator must read exactly this, not a hand-written approximation.
 *
 * Phase 0 asserts the goldens against the code that produced them, so the
 * fixtures are proven readable before anything depends on them; later
 * phases assert the same goldens against the seed compiler and the
 * version-5 migrator.
 */

describe("the seed shape golden", () => {
  test("defaultLayout() reproduces the frozen shape", () => {
    expect(shapeOfLayout(defaultLayout())).toEqual(shapeGolden);
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
  const leaves = (node: Node): Extract<Node, { type: "leaf" }>[] =>
    node.type === "leaf" ? [node] : [...leaves(node.a), ...leaves(node.b)];

  test("is a version-5 payload the current validator accepts", () => {
    expect(v5Payload.version).toBe(5);
    expect(validate(v5Payload)).not.toBeNull();
  });

  test("carries every user change the migrator must preserve", () => {
    const valid = validate(v5Payload)!;
    const layout = valid.layout;
    const work = layout.spaces.filter((space) => space.stageId === WORK_STAGE_ID);
    // A renamed workspace and an added one, both user-owned.
    expect(work.map((space) => space.name)).toEqual([
      "build",
      "my explore",
      "gallery",
      "help",
      "scratch",
    ]);
    expect(work.every((space) => !space.pinned)).toBe(true);
    // The added workspace narrows its allow-list.
    const scratch = work.find((space) => space.name === "scratch")!;
    expect(scratch.apps).toEqual(["chart", "table", "launcher"]);
    // One chart view, named, bound to a document, placed TWICE (a linked duplicate).
    const chartLeaves = leaves(scratch.tree).filter(
      (leaf) => layout.views[leaf.viewId]?.appId === "chart",
    );
    expect(chartLeaves).toHaveLength(2);
    expect(new Set(chartLeaves.map((leaf) => leaf.viewId)).size).toBe(1);
    const chart = layout.views[chartLeaves[0]!.viewId]!;
    expect(chart.title).toBe("Yield watch");
    expect(chart.documents.primary).toBe(valid.world.docOrder[0]);
    // The stage pointers moved: the user is on `my explore` in work, and the
    // account stage remembers its own workspace.
    expect(layout.currentStageId).toBe(WORK_STAGE_ID);
    expect(layout.spaces.find((space) => space.id === layout.currentSpaceId)?.name).toBe(
      "my explore",
    );
    expect(layout.stages.find((stage) => stage.id === ACCOUNT_STAGE_ID)?.currentSpaceId).toBe(
      "ws-account",
    );
  });
});
