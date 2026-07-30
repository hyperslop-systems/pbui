import type { AppDescriptor } from "../../../appkit/registry";
import type { DocId } from "../../../pbui/types";
import type {
  AppId,
  AppView,
  Node,
  NodeId,
  Stage,
  StageId,
  ViewId,
  Workspace,
} from "../../../store/layout";
import { type ParsedLauncherQuery, workspaceAlias } from "./launcherQuery.logic";

/**
 * The launcher's search index: every logical view, grouped by the workspaces
 * that place it, plus the applications that can create a new one.
 *
 * Pure by construction — no React, no store, no registry global. Everything the
 * index needs arrives as an argument, which is what lets the whole of the
 * search semantics be tested without rendering anything (design-doc/02 §15
 * Phase 1). `buildViewSwitcherModel` beside this file keeps answering the
 * older, single-placement question for the embedded switcher; this file answers
 * the cross-workspace one.
 */

export type LauncherResultId = string;

/** One logical view, in one workspace that places it. */
export interface LauncherPlacedRow {
  kind: "placed";
  /** `placed:${workspaceId}:${viewId}` — see §12.2. */
  id: LauncherResultId;
  viewId: ViewId;
  workspaceId: string;
  /** Every occurrence in *this* workspace, in tree order. */
  placementIds: NodeId[];
  /** Occurrences across every workspace, which is what "linked" means. */
  totalPlacementCount: number;
  title: string;
  appId: AppId;
  appTitle: string;
  docName: string | null;
  /**
   * Whether this row's application is offered by the workspace it sits in.
   *
   * Not a filter (§8.4). In navigate mode an out-of-scope row is still a place
   * you can go; in place mode it is offered disabled with a reason, following
   * `pbui/verbs.ts` rather than DR-95's hiding — the excluded set here is one
   * or two specific rows, not twenty-two of twenty-five.
   */
  inScope: boolean;
}

/** A logical view with no placement anywhere. */
export interface LauncherUnplacedRow {
  kind: "unplaced";
  id: LauncherResultId;
  viewId: ViewId;
  title: string;
  appId: AppId;
  appTitle: string;
  docName: string | null;
}

/** An application that can create a new logical view. */
export interface LauncherNewRow {
  kind: "new";
  id: LauncherResultId;
  appId: AppId;
  appTitle: string;
  docBound: boolean;
}

export type LauncherRow = LauncherPlacedRow | LauncherUnplacedRow | LauncherNewRow;

export interface LauncherWorkspaceGroup {
  workspaceId: string;
  name: string;
  stageId: StageId;
  /** One-based position in the current stage's strip, or 0 for another stage. */
  ordinal: number;
  /** `ws3`, or "" when the workspace is not in the current stage. */
  alias: string;
  isCurrent: boolean;
  rows: LauncherPlacedRow[];
}

export interface LauncherIndex {
  currentStageGroups: LauncherWorkspaceGroup[];
  otherStageGroups: LauncherWorkspaceGroup[];
  unplaced: LauncherUnplacedRow[];
  newApplications: LauncherNewRow[];
  /** One-based ordinal to workspace id, for resolving a `wsN` token. */
  workspaceByOrdinal: Map<number, string>;
}

export interface LauncherIndexInput {
  /**
   * Every registered application narrowed by the INSTANCE only — the result of
   * `useScopedApps()`, **not** `useAvailableApps()`.
   *
   * Stage and workspace scope are applied per row below, because a row is
   * scoped by the workspace it concerns (§8.4). Passing an already-narrowed
   * list here is exactly the bug that section exists to prevent: `ws8 yield`
   * would silently omit a view legitimately placed in ws8 whenever ws8's
   * allow-list differs from the current workspace's.
   */
  apps: readonly AppDescriptor[];
  views: Readonly<Record<ViewId, AppView>>;
  viewOrder: readonly ViewId[];
  workspaces: readonly Workspace[];
  stages: readonly Stage[];
  currentStageId: StageId;
  currentWorkspaceId: string;
  /** Document display names only; the index has no use for their contents. */
  docNames: Readonly<Record<DocId, string>>;
}

/** Where a result would land, and what kinds of result are legal. */
export interface LauncherSearchContext {
  /**
   * `place` assigns to an explicit target placement — the launcher tile or
   * Replace. `navigate` switches workspace and focuses an existing placement
   * and never mutates the layout (Decision 6).
   */
  mode: "place" | "navigate";
  /** The workspace a placed result would land in. Null in navigate mode. */
  targetWorkspaceId: string | null;
  /**
   * Whether new-view rows may be offered.
   *
   * Always true in place mode. In navigate mode, true only when the active
   * placement is already a launcher tile — otherwise `+chart` has nowhere to go
   * that is not a silent split or a destroyed working tile.
   */
  allowNewViews: boolean;
  /**
   * The view already in the target placement, excluded in place mode.
   *
   * `buildViewSwitcherModel` has always dropped the current view, and Replace
   * would otherwise offer the tile's own contents as something to replace them
   * with — a row that dispatches a no-op. Excluded by *view* rather than by
   * row, because the same logical view can appear under several workspaces and
   * every one of those rows assigns the same `viewId`.
   *
   * Null in navigate mode: going to another placement of the view you are
   * looking at is a real destination.
   */
  excludeViewId?: ViewId | null;
}

export interface LauncherResults {
  groups: LauncherWorkspaceGroup[];
  unplaced: LauncherUnplacedRow[];
  newApplications: LauncherNewRow[];
  /** Rows across every section, for the count and for keyboard traversal. */
  rows: LauncherRow[];
  /** Set when the query names a workspace that the current stage lacks. */
  missingWorkspace: { ordinal: number; available: string[] } | null;
  /** Presentation limits applied because the query text was empty (§7.3). */
  limited: boolean;
}

/** Rendering limits for an empty query. Removed as soon as text is typed. */
const EMPTY_QUERY_ROWS_PER_OTHER_WORKSPACE = 3;
const EMPTY_QUERY_UNPLACED = 5;
const EMPTY_QUERY_NEW_APPLICATIONS = 8;

const normalize = (value: string): string => value.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * The effective application allow-list for one workspace.
 *
 * Instance ∩ stage ∩ workspace, intersected rather than overridden, mirroring
 * `intersectScopes` in `appkit/AppScope.tsx`. Adding a constraint can never
 * remove one, which is the property that makes an embedded instance's narrowing
 * impossible for a stage to undo.
 */
function scopeFor(
  workspace: Workspace,
  stages: readonly Stage[],
  instanceApps: ReadonlySet<AppId>,
): ReadonlySet<AppId> {
  const stage = stages.find((candidate) => candidate.id === workspace.stageId);
  const narrow = (allowed: ReadonlySet<AppId>, list: AppId[] | null | undefined) =>
    list == null ? allowed : new Set([...allowed].filter((id) => list.includes(id)));
  return narrow(narrow(instanceApps, stage?.apps), workspace.apps);
}

/** Every leaf in tree order. */
function leaves(node: Node, into: Extract<Node, { type: "leaf" }>[] = []) {
  if (node.type === "leaf") into.push(node);
  else {
    leaves(node.a, into);
    leaves(node.b, into);
  }
  return into;
}

/**
 * Build the complete index once per layout change.
 *
 * The view registry alone cannot answer "which workspace?", so this walks every
 * workspace tree (§8.1). Trees are small — a workspace holds single-digit
 * tiles — so this is a `useMemo` away from free and deliberately has no cache
 * or Redux selector layer behind it.
 */
export function buildLauncherIndex(input: LauncherIndexInput): LauncherIndex {
  const {
    apps,
    views,
    viewOrder,
    workspaces,
    stages,
    currentStageId,
    currentWorkspaceId,
    docNames,
  } = input;

  const appById = new Map(apps.map((app) => [app.id, app]));
  const instanceApps = new Set(apps.map((app) => app.id));

  const titleOf = (view: AppView): string => {
    const app = appById.get(view.appId);
    const docId = view.documents.primary;
    const docName = docId ? docNames[docId] : undefined;
    // The same derivation `Tile` renders, so a search matches what is on screen.
    if (view.title) return view.title;
    return docName ? `${app?.title ?? view.appId} · ${docName}` : (app?.title ?? view.appId);
  };

  const docNameOf = (view: AppView): string | null => {
    const docId = view.documents.primary;
    return docId ? (docNames[docId] ?? null) : null;
  };

  /**
   * A view is listable at all only if its application is in instance scope.
   *
   * Instance scope is "what this page is about" and cannot be left, unlike a
   * stage; a tour panel teaching four applications must not offer a fifth
   * through a search box. `launcher` is excluded because an empty tile is not
   * a destination.
   */
  const listable = (view: AppView | undefined): view is AppView =>
    view !== undefined && view.appId !== "launcher" && instanceApps.has(view.appId);

  const placedIn = new Map<ViewId, number>();
  const occurrences = new Map<string, Map<ViewId, NodeId[]>>();

  for (const workspace of workspaces) {
    const perView = new Map<ViewId, NodeId[]>();
    for (const node of leaves(workspace.tree)) {
      placedIn.set(node.viewId, (placedIn.get(node.viewId) ?? 0) + 1);
      const list = perView.get(node.viewId);
      if (list) list.push(node.id);
      else perView.set(node.viewId, [node.id]);
    }
    occurrences.set(workspace.id, perView);
  }

  const currentStageWorkspaces = workspaces.filter(
    (workspace) => workspace.stageId === currentStageId,
  );
  const workspaceByOrdinal = new Map<number, string>();
  currentStageWorkspaces.forEach((workspace, index) => {
    workspaceByOrdinal.set(index + 1, workspace.id);
  });

  const groupFor = (workspace: Workspace, ordinal: number): LauncherWorkspaceGroup => {
    const scope = scopeFor(workspace, stages, instanceApps);
    const perView = occurrences.get(workspace.id) ?? new Map<ViewId, NodeId[]>();
    const rows: LauncherPlacedRow[] = [];
    // `viewOrder` rather than the map's insertion order, so equal-scoring rows
    // fall back to the same stable order the switcher already uses.
    for (const viewId of viewOrder) {
      const placementIds = perView.get(viewId);
      if (!placementIds) continue;
      const view = views[viewId];
      if (!listable(view)) continue;
      const app = appById.get(view.appId);
      rows.push({
        kind: "placed",
        id: `placed:${workspace.id}:${viewId}`,
        viewId,
        workspaceId: workspace.id,
        placementIds,
        totalPlacementCount: placedIn.get(viewId) ?? 0,
        title: titleOf(view),
        appId: view.appId,
        appTitle: app?.title ?? view.appId,
        docName: docNameOf(view),
        inScope: scope.has(view.appId),
      });
    }
    return {
      workspaceId: workspace.id,
      name: workspace.name,
      stageId: workspace.stageId,
      ordinal,
      alias: ordinal > 0 ? workspaceAlias(ordinal - 1) : "",
      isCurrent: workspace.id === currentWorkspaceId,
      rows,
    };
  };

  const currentStageGroups = currentStageWorkspaces.map((workspace, index) =>
    groupFor(workspace, index + 1),
  );
  const otherStageGroups = workspaces
    .filter((workspace) => workspace.stageId !== currentStageId)
    .map((workspace) => groupFor(workspace, 0));

  const unplaced: LauncherUnplacedRow[] = [];
  for (const viewId of viewOrder) {
    if (placedIn.has(viewId)) continue;
    const view = views[viewId];
    if (!listable(view)) continue;
    const app = appById.get(view.appId);
    unplaced.push({
      kind: "unplaced",
      id: `unplaced:${viewId}`,
      viewId,
      title: titleOf(view),
      appId: view.appId,
      appTitle: app?.title ?? view.appId,
      docName: docNameOf(view),
    });
  }

  // A singleton limits logical VIEWS, not placements: its existing view stays
  // selectable above, while a second logical view of it is not creatable.
  const existingAppIds = new Set(
    viewOrder.flatMap((id) => (views[id] ? [(views[id] as AppView).appId] : [])),
  );
  const newApplications: LauncherNewRow[] = apps
    .filter((app) => app.id !== "launcher" && !(app.singleton && existingAppIds.has(app.id)))
    .map((app) => ({
      kind: "new",
      id: `new:${app.id}`,
      appId: app.id,
      appTitle: app.title,
      docBound: app.docBound,
    }));

  return { currentStageGroups, otherStageGroups, unplaced, newApplications, workspaceByOrdinal };
}

/**
 * Score one row against normalised query text (§7.2).
 *
 * A deterministic token score rather than a fuzzy-search dependency, because
 * the result set is dozens of views and this is exhaustively testable. Typo
 * tolerance can be added later if observed queries justify it; it is not
 * something to guess at now.
 *
 * Returns 0 for no match. Callers treat 0 as "omit", never as "rank last".
 */
export function scoreRow(
  row: { title: string; appId: string; appTitle: string; docName?: string | null },
  workspaceName: string,
  text: string,
): number {
  if (text === "") return 1;
  const query = normalize(text);
  const title = normalize(row.title);

  if (title === query) return 100;
  if (title.startsWith(query)) return 80;
  if (title.split(" ").some((word) => word.startsWith(query))) return 60;
  if (title.includes(query)) return 40;

  const app = normalize(row.appTitle);
  const appId = normalize(row.appId);
  const doc = row.docName ? normalize(row.docName) : "";
  // `query` is non-empty past the guard above, so an absent document — the
  // empty string — cannot prefix-match and needs no separate check.
  if ([app, appId, doc].some((field) => field.startsWith(query))) return 30;

  if (workspaceName && normalize(workspaceName).includes(query)) return 20;

  const haystack = [title, app, appId, doc, normalize(workspaceName)].join(" ");
  if (query.split(" ").every((token) => haystack.includes(token))) return 10;

  return 0;
}

/**
 * Apply a parsed query to an index.
 *
 * Ordering after score is current workspace, then current stage, then workspace
 * order, then `viewOrder` — which the group and row construction above already
 * encode, so a stable sort on score alone preserves it.
 */
export function searchLauncherIndex(
  index: LauncherIndex,
  query: ParsedLauncherQuery,
  context: LauncherSearchContext,
): LauncherResults {
  const text = query.text;
  const searching = text !== "";

  let missingWorkspace: LauncherResults["missingWorkspace"] = null;
  let groups: LauncherWorkspaceGroup[] = [];

  if (query.kind === "new") {
    groups = [];
  } else if (query.kind === "workspace") {
    const ordinal = query.workspaceOrdinal ?? 0;
    const workspaceId = index.workspaceByOrdinal.get(ordinal);
    if (!workspaceId) {
      missingWorkspace = {
        ordinal,
        available: [...index.workspaceByOrdinal.keys()].sort((a, b) => a - b).map((n) => `ws${n}`),
      };
    } else {
      groups = index.currentStageGroups.filter((group) => group.workspaceId === workspaceId);
    }
  } else {
    // Other stages appear only for a non-empty query (§7.3, §17). An empty
    // query that listed every stage would recreate the flat list this design
    // exists to replace.
    groups = searching
      ? [...index.currentStageGroups, ...index.otherStageGroups]
      : [...index.currentStageGroups];
  }

  // Current workspace first; the rest keep their visible strip order.
  groups = [...groups].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));

  // Replacing a placement with what it already shows is a no-op, so the target's
  // own view is not offered in place mode — by view id, since several rows
  // across workspaces all assign the same one.
  const excluded = context.mode === "place" ? (context.excludeViewId ?? null) : null;

  const scored = groups
    .map((group) => {
      const rows = group.rows
        .filter((row) => row.viewId !== excluded)
        .map((row) => ({ row, score: scoreRow(row, group.name, text) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.row);
      const limited =
        !searching && !group.isCurrent ? rows.slice(0, EMPTY_QUERY_ROWS_PER_OTHER_WORKSPACE) : rows;
      return { ...group, rows: limited };
    })
    .filter((group) => group.rows.length > 0);

  const showUnplaced = query.kind === "all" && (context.mode === "place" || context.allowNewViews);
  const unplacedAll = showUnplaced
    ? index.unplaced
        .filter((row) => row.viewId !== excluded)
        .map((row) => ({ row, score: scoreRow(row, "", text) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.row)
    : [];
  const unplaced = searching ? unplacedAll : unplacedAll.slice(0, EMPTY_QUERY_UNPLACED);

  const showNew = context.allowNewViews && query.kind !== "workspace";
  const newAll = showNew
    ? index.newApplications
        .map((row) => ({
          row,
          score: scoreRow({ ...row, title: row.appTitle, docName: null }, "", text),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.row)
    : [];
  const newApplications = searching ? newAll : newAll.slice(0, EMPTY_QUERY_NEW_APPLICATIONS);

  const rows: LauncherRow[] = [
    ...scored.flatMap((group) => group.rows),
    ...unplaced,
    ...newApplications,
  ];

  return {
    groups: scored,
    unplaced,
    newApplications,
    rows,
    missingWorkspace,
    limited: !searching,
  };
}

/**
 * Which placement a navigate result should focus (§19 question 5).
 *
 * The active placement wins when it is one of this view's occurrences in the
 * target workspace, otherwise the first in tree order. One condition, not a
 * mechanism: Phase 3 supplies `activePlacementId` for its own reasons, so
 * preferring it here costs nothing and does the obvious thing when a linked
 * view is placed twice in one workspace.
 */
export function preferredPlacement(
  row: LauncherPlacedRow,
  activePlacementId: NodeId | null,
): NodeId | undefined {
  if (activePlacementId && row.placementIds.includes(activePlacementId)) return activePlacementId;
  return row.placementIds[0];
}
