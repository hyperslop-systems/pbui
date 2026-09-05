/**
 * PBUI-DATALAB-WORKBENCH-1 Phase 0: freeze what the Redux layout slice does
 * today, BEFORE any of it is replaced by workbench-core.
 *
 * Writes two fixtures under packages/datalab-ui/test/fixtures:
 *
 *   layout-shape.golden.json  — the id-free shape of `defaultLayout()`
 *                               (stages, workspaces, trees, view sharing);
 *                               the seed compiler must reproduce it.
 *   persisted-v5.json         — a real `save()` payload of a store the user
 *                               has changed (renamed and added workspaces, a
 *                               linked duplicate, a custom title, a document
 *                               binding, a moved stage pointer); the
 *                               version-5 migrator must read it.
 *
 * Run from packages/datalab-ui:
 *   pnpm exec tsx ../../ttmp/2026/09/03/PBUI-DATALAB-WORKBENCH-1--(ticket)/scripts/01-freeze-layout-goldens.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { makeStore } from "../../../../../../packages/datalab-ui/src/store";
import { layoutActions, type Node } from "../../../../../../packages/datalab-ui/src/store/layout";
import { save } from "../../../../../../packages/datalab-ui/src/store/persist";
import { ACCOUNT_STAGE_ID, defaultLayout, WORK_STAGE_ID } from "../../../../../../packages/datalab-ui/src/store/stages";
import { shapeOfLayout } from "../../../../../../packages/datalab-ui/test/helpers/layoutShape";

const memory = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
};

const out = resolve(process.cwd(), "test/fixtures");
mkdirSync(out, { recursive: true });

// 1. The seed's shape.
writeFileSync(resolve(out, "layout-shape.golden.json"), `${JSON.stringify(shapeOfLayout(defaultLayout()), null, 2)}\n`);

// 2. A version-5 payload with user changes on top of the seed.
const store = makeStore();
const leaves = (node: Node): Extract<Node, { type: "leaf" }>[] =>
  node.type === "leaf" ? [node] : [...leaves(node.a), ...leaves(node.b)];
const state = () => store.getState().layout;
const explore = state().spaces.find((s) => s.stageId === WORK_STAGE_ID && s.name === "explore")!;
store.dispatch(layoutActions.renameSpace({ spaceId: explore.id, name: "my explore" }));
store.dispatch(layoutActions.addSpace("scratch"));
const scratch = state().spaces.find((s) => s.name === "scratch")!;
const launcherLeaf = leaves(scratch.tree)[0]!;
const docId = store.getState().world.docOrder[0]!;
store.dispatch(layoutActions.splitLeaf({ nodeId: launcherLeaf.id, dir: "row", appId: "chart", docId }));
const chartLeaf = leaves(state().spaces.find((s) => s.id === scratch.id)!.tree).find((leaf) => state().views[leaf.viewId]?.appId === "chart")!;
store.dispatch(layoutActions.renameView({ viewId: chartLeaf.viewId, title: "Yield watch" }));
store.dispatch(layoutActions.createLinkedDuplicate(chartLeaf.id, "col"));
store.dispatch(layoutActions.setSpaceApps({ spaceId: scratch.id, apps: ["chart", "table", "launcher"] }));
store.dispatch(layoutActions.setCurrentStage(ACCOUNT_STAGE_ID));
store.dispatch(layoutActions.setCurrentSpace(explore.id));
save("golden", store.getState().world, store.getState().layout);
const payload = memory.get("golden");
if (!payload) throw new Error("save() refused the payload");
writeFileSync(resolve(out, "persisted-v5.json"), `${JSON.stringify(JSON.parse(payload), null, 2)}\n`);
console.log("wrote layout-shape.golden.json and persisted-v5.json");
