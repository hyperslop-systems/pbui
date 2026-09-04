import { Direction, type Node } from "@hyperslop-systems/workbench-protocol";
import type { StageChrome, StageDefinition } from "../../src/store/navigation";
import type { DatalabSeed } from "../../src/store/seed";

/**
 * An id-free description of a layout, for migration goldens
 * (PBUI-DATALAB-WORKBENCH-1 Phase 0).
 *
 * Runtime ids are minted per store, so a golden that carried them would fail
 * on every run. What had to survive the cutover to workbench-core is the
 * SHAPE: which stages exist and in what order, which workspaces belong to
 * each, every tree's arrangement, and — the part a naive port loses — which
 * leaves share one logical view. Views are therefore named by first
 * appearance (`v1`, `v2`, …): a singleton placed in three workspaces shows
 * the same alias three times, and a chart placed twice in one workspace is
 * one alias placed twice.
 *
 * Pinned workspaces keep their ids because those are code-defined and MUST
 * match across builds; user-owned workspaces are described by name only.
 *
 * The golden in `test/fixtures/layout-shape.golden.json` was frozen from the
 * Redux layout slice before the cutover; `shapeOfDocument` reads the same
 * shape off the seed compiler's output, which is how the two are compared.
 */
export type TreeShape =
  | { view: string; app: string; title?: string; doc?: string }
  | { dir: "row" | "col"; ratio: number; a: TreeShape; b: TreeShape };

export interface WorkspaceShape {
  id?: string;
  name: string;
  pinned: boolean;
  apps?: string[] | null;
  tree: TreeShape;
}

export interface StageShape {
  id: string;
  name: string;
  apps: string[] | null;
  chrome: StageChrome;
  audience?: StageDefinition["audience"];
  pinned: boolean;
  /** Which workspace the stage remembers, by name (pinned) or ordinal. */
  current: string;
  workspaces: WorkspaceShape[];
}

export interface LayoutShape {
  currentStage: string;
  currentWorkspace: string;
  stages: StageShape[];
}

/** The shape, read off a workbench document plus navigation metadata — what the seed compiler produces. */
export function shapeOfDocument(seed: DatalabSeed): LayoutShape {
  const { document, navigation, workspaceId } = seed;
  const aliases = new Map<string, string>();
  const alias = (viewId: string): string => {
    let name = aliases.get(viewId);
    if (!name) {
      name = `v${aliases.size + 1}`;
      aliases.set(viewId, name);
    }
    return name;
  };
  const tree = (node: Node | undefined): TreeShape => {
    if (!node) throw new Error("a workspace has no tree");
    if (node.body.case === "leaf") {
      const view = document.views[node.body.value.viewId];
      return {
        view: alias(node.body.value.viewId),
        app: view?.appId ?? "?",
        ...(view?.title ? { title: view.title } : {}),
        ...(view?.documents.primary ? { doc: view.documents.primary } : {}),
      };
    }
    if (node.body.case !== "split") throw new Error("a node has no body");
    const { direction, ratio, a, b } = node.body.value;
    return { dir: direction === Direction.COLUMN ? "col" : "row", ratio, a: tree(a), b: tree(b) };
  };
  const metaOf = (id: string) =>
    navigation.workspace[id] ?? { stageId: "", pinned: false, apps: null };
  const label = (id: string | undefined): string => {
    if (!id) return "";
    const space = document.workspaces.find((candidate) => candidate.id === id);
    if (!space) return "";
    return metaOf(id).pinned ? id : space.name;
  };
  return {
    currentStage: metaOf(workspaceId).stageId,
    currentWorkspace: label(workspaceId),
    stages: navigation.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      apps: stage.apps,
      chrome: stage.chrome,
      ...(stage.audience ? { audience: stage.audience } : {}),
      pinned: stage.pinned === true,
      current: label(navigation.rememberedWorkspaceByStage[stage.id]),
      workspaces: document.workspaces
        .filter((space) => metaOf(space.id).stageId === stage.id)
        .map((space) => {
          const meta = metaOf(space.id);
          return {
            ...(meta.pinned ? { id: space.id } : {}),
            name: space.name,
            pinned: meta.pinned,
            ...(meta.apps !== null ? { apps: meta.apps } : {}),
            tree: tree(space.tree),
          };
        }),
    })),
  };
}
