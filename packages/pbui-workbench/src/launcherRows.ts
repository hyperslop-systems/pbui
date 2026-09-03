import type { LauncherShellGroup } from "@hyperslop-systems/pbui";
import { isDocBound, type ManifestCatalog } from "@hyperslop-systems/workbench-core";
import type { Node, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { placementCount } from "@hyperslop-systems/workbench-protocol/client";
import { isAppAvailable, labelOfView, type PresentationRegistry } from "./app";

export const GOTO_PREFIX = "goto:";
export const PLACE_PREFIX = "place:";

/** One launcher row with its MEANING attached, not just an id string. */
export type LauncherRow =
  | { id: string; kind: "view"; viewId: string; appId: string; title: string; detail: string; placements: number; foreign: boolean }
  | { id: string; kind: "app"; appId: string; title: string; detail: string };

/** How the launcher was invoked: globally, or from one tile. */
export interface LauncherInvocation {
  /** The tile a per-pane invocation came from; null for the global one. */
  from: string | null;
  /** The tile a global placement would split — the active one, else the first. */
  target: string | null;
  /** The target's label, for the status line. */
  targetLabel: string;
}

/** How wide the "on screen" rows reach: every placed view (foreign ones marked), or only the current workspace's. */
export type LauncherScope = "document" | "workspace";

export interface LauncherRowsContext {
  document: WorkbenchDocument;
  /** The React projections: titles, groups, blurbs, availability. */
  apps: PresentationRegistry;
  /** The semantic manifests: cardinality, document slots. */
  manifests: ManifestCatalog;
  workspaceId: string;
  invocation: LauncherInvocation;
  /** The trimmed, lower-cased search text. */
  query: string;
  scope?: LauncherScope;
}

function matches(text: string, needle: string): boolean {
  return needle === "" || text.toLowerCase().includes(needle);
}

function hasView(node: Node | undefined, viewId: string): boolean {
  if (!node) return false;
  if (node.body.case === "leaf") return node.body.value.viewId === viewId;
  if (node.body.case === "split") return hasView(node.body.value.a, viewId) || hasView(node.body.value.b, viewId);
  return false;
}

/** Is this view somewhere OTHER than the workspace on screen? Asked of the current tree, so a view linked into two workspaces is local to both. */
function isForeign(document: WorkbenchDocument, workspaceId: string, viewId: string): boolean {
  const here = document.workspaces.find((workspace) => workspace.id === workspaceId);
  return !hasView(here?.tree, viewId);
}

/** The default rows model: what is already on screen, then what could be. */
export function defaultLauncherRows(context: LauncherRowsContext): LauncherRow[] {
  const { document, apps, manifests, workspaceId, invocation, query, scope = "document" } = context;
  const perPane = invocation.from !== null;
  const rows: LauncherRow[] = [];

  for (const viewId of document.viewOrder) {
    const view = document.views[viewId];
    if (!view) continue;
    const placements = placementCount(document, viewId);
    if (placements === 0) continue;
    const title = labelOfView(view, apps.get(view.appId));
    if (!matches(title, query) && !matches(view.appId, query)) continue;
    const foreign = isForeign(document, workspaceId, viewId);
    if (foreign && scope === "workspace") continue;
    rows.push({
      id: `${GOTO_PREFIX}${viewId}`,
      kind: "view",
      viewId,
      appId: view.appId,
      title,
      placements,
      foreign,
      detail: perPane ? "show it here too" : foreign ? "in another workspace" : placements > 1 ? `shown in ${placements} tiles` : "on screen",
    });
  }

  for (const app of apps.list()) {
    const manifest = manifests.get(app.id);
    if (!manifest) continue;
    if (!matches(app.title, query) && !matches(app.id, query)) continue;
    if (!isAppAvailable(app, { workspaceId })) continue;
    // A doc-bound application is a view OF something; with no document to
    // bind it would open empty. Those arrive through `view.show` with documents.
    if (isDocBound(manifest)) continue;
    // A placed singleton is already offered above, as the view it has — but
    // only if that row exists. Scoped to the workspace, a singleton living
    // next door is offered as an application row (place goes there).
    const placedWhereItCounts = document.viewOrder.some((id) => {
      if (document.views[id]?.appId !== app.id) return false;
      return scope === "workspace" ? !isForeign(document, workspaceId, id) : true;
    });
    const singleton = manifest.viewCardinality === "one";
    if (singleton && placedWhereItCounts) continue;
    rows.push({
      id: `${PLACE_PREFIX}${app.id}`,
      kind: "app",
      appId: app.id,
      title: app.title,
      detail: app.blurb ?? (perPane ? "show it here" : singleton ? "one tile" : "a new tile"),
    });
  }

  return rows;
}

/** Group the flat rows for the shell, honouring each application's `group`. */
export function groupLauncherRows(rows: readonly LauncherRow[], apps: PresentationRegistry, perPane: boolean, detailOf?: (row: LauncherRow) => import("react").ReactNode): LauncherShellGroup[] {
  const onScreen: LauncherShellGroup = { label: perPane ? "SHOW HERE" : "ON SCREEN", rows: [] };
  const byGroup = new Map<string, LauncherShellGroup>();
  const fallback = perPane ? "REPLACE WITH" : "NEW TILE";

  for (const row of rows) {
    const entry = { id: row.id, title: row.title, detail: detailOf ? detailOf(row) : row.detail };
    if (row.kind === "view") {
      onScreen.rows.push(entry);
      continue;
    }
    const label = apps.get(row.appId)?.group ?? fallback;
    let group = byGroup.get(label);
    if (!group) {
      group = { label, rows: [] };
      byGroup.set(label, group);
    }
    group.rows.push(entry);
  }

  const named = [...byGroup.entries()].filter(([label]) => label !== fallback).map(([, group]) => group);
  const rest = byGroup.get(fallback);
  return [onScreen, ...named, ...(rest ? [rest] : [])].filter((group) => group.rows.length > 0);
}

export function rowOf(id: string, rows: readonly LauncherRow[]): LauncherRow | null {
  return rows.find((row) => row.id === id) ?? null;
}
