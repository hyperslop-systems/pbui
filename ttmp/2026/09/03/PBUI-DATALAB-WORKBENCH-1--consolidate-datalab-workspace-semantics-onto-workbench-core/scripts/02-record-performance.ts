/**
 * PBUI-DATALAB-WORKBENCH-1 Phase 8: headless timings for the paths the
 * design asks to measure rather than assume (§19.8): the core's index over
 * the default seed, the launcher index and a search over every stage, the
 * work-stage projection, the version-5 migration + pinned merge, and a
 * 15-tile workspace's split/close through the controller.
 *
 * A vitest file (the application modules import CSS, which tsx cannot load).
 * Run from packages/datalab-ui by copying it under test/:
 *   cp ../../ttmp/2026/09/03/PBUI-DATALAB-WORKBENCH-1--(ticket)/scripts/02-record-performance.ts test/_perf.test.ts
 *   pnpm exec vitest run test/_perf.test.ts && rm test/_perf.test.ts
 */
import { test } from "vitest";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { buildWorkbenchIndex } from "@hyperslop-systems/workbench-core";
import "../src/apps/all";
import { datalabManifests } from "../src/appkit/workbenchApps";
import { allApps } from "../src/appkit/registry";
import { buildLauncherIndex, parseLauncherQuery, searchLauncherIndex } from "../src/components/organisms/ViewSwitcher";
import { validate } from "../src/store/persist";
import { projectWorkStage } from "../src/remote/projection";
import { createDatalabRuntime } from "../src/store/runtime";
import { defaultSeed, split, tile, singleStageSeed } from "../src/store/seed";
import { WORK_STAGE_ID } from "../src/store/stageIds";
import { metaOf } from "../src/store/navigation";

test("record performance", () => {
// vitest swallows console output in this package; append to a file instead.
const OUT = process.env.PERF_OUT ?? "perf.log";
const log = (line: string) => appendFileSync(OUT, `${line}\n`);
const apps = datalabManifests();
const time = (label: string, runs: number, fn: () => void) => {
  fn();
  const start = performance.now();
  for (let i = 0; i < runs; i += 1) fn();
  const per = (performance.now() - start) / runs;
  log(`${label.padEnd(44)} ${per.toFixed(3)} ms/op  (${runs} runs)`);
};

const seed = defaultSeed({ apps });
log(`default seed: ${seed.document.workspaces.length} workspaces, ${Object.keys(seed.document.views).length} views, ${seed.document.workspaces.reduce((n, w) => n + leaves(w.tree).length, 0)} tiles`);
time("core index over the default seed", 200, () => buildWorkbenchIndex(seed.document));

const rt = createDatalabRuntime({ seed, apps, ownership: "trust" });
const world = rt.store.getState().world;
const nav = rt.store.getState().navigation;
const descriptors = allApps();
const docNames = Object.fromEntries(Object.entries(world.docs).map(([id, d]) => [id, d.name]));
const workspaces = seed.document.workspaces.map((w) => ({ id: w.id, name: w.name, stageId: metaOf(nav, w.id).stageId, apps: nav.workspace[w.id]?.apps ?? null, tree: w.tree }));
const index = buildLauncherIndex({ apps: descriptors, views: seed.document.views, viewOrder: seed.document.viewOrder, workspaces, stages: nav.stages, currentStageId: WORK_STAGE_ID, currentWorkspaceId: seed.workspaceId, visibleStageIds: nav.stages.map((s) => s.id), docNames });
time("launcher index over every stage", 200, () => buildLauncherIndex({ apps: descriptors, views: seed.document.views, viewOrder: seed.document.viewOrder, workspaces, stages: nav.stages, currentStageId: WORK_STAGE_ID, currentWorkspaceId: seed.workspaceId, visibleStageIds: nav.stages.map((s) => s.id), docNames }));
time("launcher search 'chart' across stages", 500, () => searchLauncherIndex(index, parseLauncherQuery("chart"), { mode: "navigate", targetWorkspaceId: null, allowNewViews: true }));
time("work-stage projection", 200, () => projectWorkStage({ document: rt.core.getState().document, navigation: nav, world }, { id: "wb", name: "wb" }));

const v5 = JSON.parse(readFileSync(resolve(process.cwd(), "test/fixtures/persisted-v5.json"), "utf8"));
time("version-5 migration + pinned merge + validate", 50, () => validate(v5, apps));

// A 15-tile workspace: split to 15 through the controller, then close back.
const big = singleStageSeed("big", split("row", 0.5, tile("chart"), tile("table")), { apps });
const rt15 = createDatalabRuntime({ seed: big, apps, ownership: "trust" });
const tiles = () => leaves(rt15.core.getState().index.workspaceById.get(rt15.core.getState().session.workspaceId)?.tree);
const t0 = performance.now();
while (tiles().length < 15) rt15.controller.splitTile(tiles()[0]!.id, tiles().length % 2 ? "row" : "col");
const t1 = performance.now();
log(`split to 15 tiles through the controller       ${((t1 - t0) / 13).toFixed(3)} ms/split`);
time("core index over 15 tiles", 500, () => buildWorkbenchIndex(rt15.core.getState().document));
const t2 = performance.now();
while (tiles().length > 1) rt15.controller.removePlacement(tiles()[tiles().length - 1]!.id);
log(`close back to 1 tile                            ${((performance.now() - t2) / 14).toFixed(3)} ms/close`);

});
