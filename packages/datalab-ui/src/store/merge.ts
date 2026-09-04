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
  type Workspace,
} from "@hyperslop-systems/workbench-protocol";
import {
  leafNode,
  leaves,
  newId,
  type IdGenerator,
} from "@hyperslop-systems/workbench-protocol/client";
import { validateWorkbenchDocument, type ManifestCatalog } from "@hyperslop-systems/workbench-core";
import { LAUNCHER_APP_ID } from "./controller";
import {
  landingWorkspaceOf,
  reconcileNavigation,
  type PersistedNavigation,
  type WorkspaceMeta,
} from "./navigation";
import type { DatalabSeed } from "./seed";
import { WORK_STAGE_ID } from "./stageIds";

/**
 * Code-defined stages and workspaces win; user-created ones survive
 * (design §7.3, the successor to `mergeStages`).
 *
 * A pinned stage and its pinned workspaces are taken wholesale from this
 * build's seed: a user who deleted a tile from the account stage in a
 * previous release gets it back; a user who added one loses it, which is
 * what "hardwired" means (DR-29). Everything else — the user's own
 * workspaces, the views they reach, the stages they made — comes from
 * storage. The one thing a pinned stage keeps from storage is which
 * workspace it was last on (DR-60), and that is navigation memory, not a
 * definition.
 *
 * ## Singletons are deduplicated, deliberately
 *
 * The core refuses a document with two views of a `viewCardinality: "one"`
 * application. A restored `explore` workspace still places the `sources`
 * view of the seed it was born under; this build's seed mints a fresh
 * `sources` view for the tour pages. Keeping both would fail validation, and
 * dropping the user's tile would lose a placement. So every kept leaf that
 * shows a superseded singleton view is REPOINTED at the canonical one — the
 * seed's when the seed has one, else the first the user's workspaces reach.
 *
 * ## Reachability, not `viewOrder`
 *
 * "Obsolete pinned views" are the views no KEPT workspace reaches, computed
 * through the trees; a view the user linked into their own workspace from a
 * pinned page is reachable and survives (§7.3, last line).
 */
export interface RestoredLayout {
  document: WorkbenchDocument;
  navigation: PersistedNavigation;
  workspaceId: string;
}

export interface MergeOptions {
  apps: ManifestCatalog;
  ids?: IdGenerator;
}

const viewIdOf = (node: Node): string => (node.body.case === "leaf" ? node.body.value.viewId : "");

function rewriteTree(
  node: Node | undefined,
  rewrite: ReadonlyMap<string, string>,
): Node | undefined {
  if (!node) return node;
  if (node.body.case === "leaf") {
    const viewId = rewrite.get(node.body.value.viewId);
    if (!viewId) return node;
    return create(NodeSchema, { id: node.id, body: { case: "leaf", value: { viewId } } });
  }
  if (node.body.case !== "split") return node;
  const { direction, ratio, a, b } = node.body.value;
  return create(NodeSchema, {
    id: node.id,
    body: {
      case: "split",
      value: { direction, ratio, a: rewriteTree(a, rewrite), b: rewriteTree(b, rewrite) },
    },
  });
}

export function mergePinned(
  seed: DatalabSeed,
  restored: RestoredLayout,
  options: MergeOptions,
): DatalabSeed | null {
  const ids = options.ids ?? newId;
  const singletonApps = new Set(
    options.apps
      .list()
      .filter((app) => app.viewCardinality === "one")
      .map((app) => app.id),
  );

  // 1. The seed's pinned workspaces and the views they reach.
  const seedPinned = seed.document.workspaces.filter(
    (workspace) => seed.navigation.workspace[workspace.id]?.pinned,
  );
  const seedPinnedIds = new Set(seedPinned.map((workspace) => workspace.id));
  const seedReachable = new Set(
    seedPinned.flatMap((workspace) => leaves(workspace.tree).map(viewIdOf)),
  );
  const seedViews: Record<string, AppView> = {};
  const seedViewOrder = seed.document.viewOrder.filter((id) => seedReachable.has(id));
  for (const id of seedViewOrder) seedViews[id] = seed.document.views[id]!;

  // 2. The user's workspaces: everything stored that this build does not pin.
  const kept = restored.document.workspaces.filter((workspace) => !seedPinnedIds.has(workspace.id));
  const keptReachable = new Set(kept.flatMap((workspace) => leaves(workspace.tree).map(viewIdOf)));

  // 3. Singleton canon: the seed's view wins; else the first the user reaches.
  const canonical = new Map<string, string>();
  for (const id of seedViewOrder) {
    const view = seedViews[id]!;
    if (singletonApps.has(view.appId) && !canonical.has(view.appId)) canonical.set(view.appId, id);
  }
  const rewrite = new Map<string, string>();
  const keptViews: Record<string, AppView> = {};
  const keptViewOrder: string[] = [];
  for (const id of restored.document.viewOrder) {
    if (!keptReachable.has(id)) continue;
    const view = restored.document.views[id];
    if (!view) continue;
    if (seedViews[id]) continue; // the same id already in the seed: the seed's copy stands
    if (singletonApps.has(view.appId)) {
      const canon = canonical.get(view.appId);
      if (canon) {
        rewrite.set(id, canon);
        continue;
      }
      canonical.set(view.appId, id);
    }
    keptViews[id] = view;
    keptViewOrder.push(id);
  }

  // 4. Assemble: pinned first (seed order), then the user's (stored order).
  const workspaces: Workspace[] = [
    ...seedPinned,
    ...kept.map((workspace) =>
      create(WorkspaceSchema, {
        id: workspace.id,
        name: workspace.name,
        tree: rewriteTree(workspace.tree, rewrite),
      }),
    ),
  ];
  const views = { ...keptViews, ...seedViews };
  const viewOrder = [...seedViewOrder, ...keptViewOrder];
  // Every stored stub survives (an unbound one is the source's to sweep);
  // the seed's stubs for the pinned pages come along.
  const documents = { ...restored.document.documents, ...seed.document.documents };

  // 5. Navigation: definitions from code, the user's stages and memory from storage.
  const seedStageIds = new Set(seed.navigation.stages.map((stage) => stage.id));
  const stages = [
    ...seed.navigation.stages,
    ...restored.navigation.stages.filter((stage) => !seedStageIds.has(stage.id)),
  ];
  const workspaceMeta: Record<string, WorkspaceMeta> = {};
  for (const workspace of seedPinned)
    workspaceMeta[workspace.id] = seed.navigation.workspace[workspace.id]!;
  for (const workspace of kept) {
    const stored = restored.navigation.workspace[workspace.id];
    // A workspace this build does not pin is the user's whatever storage says.
    workspaceMeta[workspace.id] = {
      stageId: stored?.stageId ?? "",
      pinned: false,
      apps: stored?.apps ?? null,
    };
  }
  let navigation: PersistedNavigation = {
    stages,
    workspace: workspaceMeta,
    rememberedWorkspaceByStage: { ...restored.navigation.rememberedWorkspaceByStage },
  };
  navigation = reconcileNavigation(
    navigation,
    workspaces.map((workspace) => workspace.id),
  );

  // 6. Repair: a stage left with no workspace at all gets one launcher tile.
  for (const stage of navigation.stages) {
    if (Object.values(navigation.workspace).some((meta) => meta.stageId === stage.id)) continue;
    const view = create(AppViewSchema, { id: ids("v"), appId: LAUNCHER_APP_ID, documents: {} });
    const workspaceId = ids("ws");
    views[view.id] = view;
    viewOrder.push(view.id);
    workspaces.push(
      create(WorkspaceSchema, { id: workspaceId, name: "build", tree: leafNode(view.id, ids) }),
    );
    navigation = {
      ...navigation,
      workspace: {
        ...navigation.workspace,
        [workspaceId]: { stageId: stage.id, pinned: false, apps: null },
      },
    };
  }
  navigation = reconcileNavigation(
    navigation,
    workspaces.map((workspace) => workspace.id),
  );

  const document = create(WorkbenchDocumentSchema, {
    format: restored.document.format,
    schemaVersion: restored.document.schemaVersion,
    id: restored.document.id || seed.document.id,
    name: restored.document.name || seed.document.name,
    workspaces,
    views,
    viewOrder,
    documents,
  });
  const checked = validateWorkbenchDocument(document, { apps: options.apps });
  if (!checked.ok) return null;

  // 7. Where to start: where the user was, if that workspace survived; else
  // the work stage's remembered workspace (the gate in `Workbench` moves a
  // signed-out visitor on from there), never the first page in document
  // order, which is the sign-in stage.
  const present = new Set(workspaces.map((workspace) => workspace.id));
  const workspaceId = present.has(restored.workspaceId)
    ? restored.workspaceId
    : (landingWorkspaceOf(navigation, [...present], WORK_STAGE_ID) ?? workspaces[0]!.id);

  return { document, navigation: { ...navigation }, workspaceId };
}

/** The direction enum, re-exported for migrators building trees by hand. */
export { Direction };
