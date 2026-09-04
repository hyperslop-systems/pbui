import { create } from "@bufbuild/protobuf";
import {
  AppViewSchema,
  Direction,
  NodeSchema,
  WorkbenchDocumentSchema,
  WorkspaceSchema,
  type AppView,
  type Node,
  type WorkbenchDocument,
} from "@hyperslop-systems/workbench-protocol";
import { WORKBENCH_FORMAT, WORKBENCH_SCHEMA_VERSION } from "@hyperslop-systems/workbench-core";
import { graphicStub } from "./graphicSource";
import type {
  PersistedNavigation,
  StageChrome,
  StageDefinition,
  WorkspaceMeta,
} from "./navigation";

/**
 * The version-5 local layout, brought forward (design §13.3).
 *
 * Version 5 stored Datalab's own `spaces / views / viewOrder` beside the
 * stages. The shapes were already the protocol's in all but spelling —
 * DATALAB-VIEW-001 separated logical views from placements — so the
 * migration is a direct transcription: a local `Node` becomes a protocol
 * `Node` under the SAME id, a local `AppView` a protocol `AppView`, a
 * `Workspace` a protocol `Workspace` plus one navigation record for the
 * stage it named. Stage definitions lose their `currentSpaceId`, which
 * becomes the stage's remembered workspace. Every bound document gets an
 * identity stub, because the core validates bindings.
 *
 * Structural only. The pinned merge and the catalog validation happen in
 * `persist.validate`, on the migrated envelope, exactly as for version 6.
 */

/* ------------------------------------------------ the version-5 shapes -- */

interface V5Node5Leaf {
  id: string;
  type: "leaf";
  viewId: string;
}
interface V5NodeSplit {
  id: string;
  type: "split";
  dir: "row" | "col";
  a: V5Node;
  b: V5Node;
  ratio: number;
}
type V5Node = V5Node5Leaf | V5NodeSplit;

interface V5AppView {
  id: string;
  appId: string;
  documents: Record<string, string>;
  title?: string;
}

interface V5Workspace {
  id: string;
  name: string;
  tree: V5Node;
  stageId: string;
  apps?: string[] | null;
  pinned?: boolean;
}

interface V5Stage {
  id: string;
  name: string;
  apps: string[] | null;
  chrome: StageChrome;
  currentSpaceId: string;
  pinned?: boolean;
  audience?: "any" | "anonymous" | "authenticated";
}

interface V5Layout {
  stages: V5Stage[];
  currentStageId: string;
  spaces: V5Workspace[];
  currentSpaceId: string;
  views: Record<string, V5AppView>;
  viewOrder: string[];
}

function isNode(value: unknown): value is V5Node {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<V5Node> & { type?: string };
  if (typeof node.id !== "string") return false;
  if (node.type === "leaf") return typeof (node as { viewId?: unknown }).viewId === "string";
  if (node.type === "split") {
    const s = node as Partial<V5NodeSplit>;
    return (
      (s.dir === "row" || s.dir === "col") &&
      typeof s.ratio === "number" &&
      s.ratio >= 0.05 &&
      s.ratio <= 0.95 &&
      isNode(s.a) &&
      isNode(s.b)
    );
  }
  return false;
}

function isAppView(value: unknown): value is V5AppView {
  if (!value || typeof value !== "object") return false;
  const view = value as Partial<V5AppView>;
  return (
    typeof view.id === "string" &&
    typeof view.appId === "string" &&
    !!view.documents &&
    typeof view.documents === "object" &&
    Object.values(view.documents).every((id) => typeof id === "string") &&
    (view.title === undefined || typeof view.title === "string")
  );
}

function isWorkspace(value: unknown): value is V5Workspace {
  const space = value as Partial<V5Workspace>;
  return (
    !!space &&
    typeof space.id === "string" &&
    typeof space.name === "string" &&
    typeof space.stageId === "string" &&
    isNode(space.tree)
  );
}

function isChrome(value: unknown): value is StageChrome {
  const chrome = value as Partial<StageChrome>;
  return (
    !!chrome &&
    typeof chrome.masthead === "boolean" &&
    typeof chrome.workspaces === "boolean" &&
    typeof chrome.stageBar === "boolean"
  );
}

function isStage(value: unknown): value is V5Stage {
  const stage = value as Partial<V5Stage>;
  return (
    !!stage &&
    typeof stage.id === "string" &&
    typeof stage.name === "string" &&
    typeof stage.currentSpaceId === "string" &&
    (stage.apps === null || Array.isArray(stage.apps)) &&
    isChrome(stage.chrome)
  );
}

export function isV5Layout(value: unknown): value is V5Layout {
  const layout = value as Partial<V5Layout>;
  if (!layout || typeof layout !== "object") return false;
  if (!Array.isArray(layout.spaces) || !layout.spaces.every(isWorkspace)) return false;
  if (!Array.isArray(layout.stages) || !layout.stages.every(isStage)) return false;
  if (!layout.views || typeof layout.views !== "object") return false;
  if (!Object.entries(layout.views).every(([id, view]) => isAppView(view) && id === view.id))
    return false;
  if (!Array.isArray(layout.viewOrder)) return false;
  if (
    layout.viewOrder.length !== Object.keys(layout.views).length ||
    new Set(layout.viewOrder).size !== layout.viewOrder.length ||
    !layout.viewOrder.every((id) => typeof id === "string" && !!layout.views?.[id])
  ) {
    return false;
  }
  const known = (node: V5Node): boolean =>
    node.type === "leaf" ? !!layout.views?.[node.viewId] : known(node.a) && known(node.b);
  return (
    layout.spaces.every((space) => known(space.tree)) && typeof layout.currentSpaceId === "string"
  );
}

/* ------------------------------------------------------ the transcription -- */

function node(local: V5Node): Node {
  if (local.type === "leaf") {
    return create(NodeSchema, {
      id: local.id,
      body: { case: "leaf", value: { viewId: local.viewId } },
    });
  }
  return create(NodeSchema, {
    id: local.id,
    body: {
      case: "split",
      value: {
        direction: local.dir === "row" ? Direction.ROW : Direction.COLUMN,
        ratio: local.ratio,
        a: node(local.a),
        b: node(local.b),
      },
    },
  });
}

export interface MigratedV5 {
  document: WorkbenchDocument;
  navigation: PersistedNavigation;
  workspaceId: string;
}

/** A structurally valid version-5 layout as a workbench document plus navigation. */
export function migrateV5Layout(layout: V5Layout): MigratedV5 {
  const views: Record<string, AppView> = {};
  const boundDocumentIds = new Set<string>();
  for (const id of layout.viewOrder) {
    const view = layout.views[id]!;
    views[id] = create(AppViewSchema, {
      id,
      appId: view.appId,
      documents: { ...view.documents },
      ...(view.title?.trim() ? { title: view.title.trim() } : {}),
    });
    for (const documentId of Object.values(view.documents)) boundDocumentIds.add(documentId);
  }
  const documents = Object.fromEntries([...boundDocumentIds].map((id) => [id, graphicStub(id)]));
  const document = create(WorkbenchDocumentSchema, {
    format: WORKBENCH_FORMAT,
    schemaVersion: WORKBENCH_SCHEMA_VERSION,
    id: "datalab",
    name: "Datalab",
    workspaces: layout.spaces.map((space) =>
      create(WorkspaceSchema, { id: space.id, name: space.name, tree: node(space.tree) }),
    ),
    views,
    viewOrder: [...layout.viewOrder],
    documents,
  });

  const stages: StageDefinition[] = layout.stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    apps: stage.apps === null ? null : [...stage.apps],
    chrome: { ...stage.chrome },
    ...(stage.pinned ? { pinned: true } : {}),
    ...(stage.audience ? { audience: stage.audience } : {}),
  }));
  const workspace: Record<string, WorkspaceMeta> = {};
  for (const space of layout.spaces) {
    workspace[space.id] = {
      stageId: space.stageId,
      pinned: space.pinned === true,
      apps: space.apps ?? null,
    };
  }
  const rememberedWorkspaceByStage: Record<string, string> = {};
  for (const stage of layout.stages) {
    if (stage.currentSpaceId) rememberedWorkspaceByStage[stage.id] = stage.currentSpaceId;
  }
  return {
    document,
    navigation: { stages, workspace, rememberedWorkspaceByStage },
    workspaceId: layout.currentSpaceId,
  };
}
