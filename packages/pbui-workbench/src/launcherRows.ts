import type { LauncherShellGroup } from "@hyperslop-systems/pbui";
import type { Node, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { placementCount } from "@hyperslop-systems/workbench-protocol/client";
import { isAppAvailable, type AppRegistry } from "./apps";

export const GOTO_PREFIX = "goto:";
export const PLACE_PREFIX = "place:";

/**
 * One launcher row with its MEANING attached, not just an id string.
 *
 * The shell speaks in row ids because it must stay ignorant of any product's
 * model; a product's `choose` and `renderDetail` should not have to re-parse
 * `"goto:v-3"` to learn what they are being asked about. `rowOf` maps back.
 */
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

/**
 * How wide the "on screen" rows reach. `"document"` is every placed view in
 * the whole layout, foreign ones marked; `"workspace"` is only what the user
 * is looking at. The default stays `"document"` because the launcher is a
 * go-anywhere palette first, but a product with many workspaces and few
 * tiles each reads better scoped.
 */
export type LauncherScope = "document" | "workspace";

export interface LauncherRowsContext {
  document: WorkbenchDocument;
  apps: AppRegistry;
  workspaceId: string;
  invocation: LauncherInvocation;
  /** The trimmed, lower-cased search text. */
  query: string;
  /** How far the view rows reach; absent reads as `"document"`. */
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

/**
 * Is this view somewhere OTHER than the workspace on screen?
 *
 * Asked of the CURRENT workspace's tree rather than by finding the view's
 * first placement and comparing (PR #23, P2): one view linked into two
 * workspaces has one first placement, so the second workspace would call a
 * view it is displaying "foreign" — and a scoped launcher would drop a row
 * for a tile the user is looking at, with no application row to fall back on
 * for a doc-bound app.
 */
function isForeign(document: WorkbenchDocument, workspaceId: string, viewId: string): boolean {
  const here = document.workspaces.find((workspace) => workspace.id === workspaceId);
  return !hasView(here?.tree, viewId);
}

/**
 * The default rows model: what is already on screen, then what could be.
 *
 * Views first, because the commonest launcher action is "take me back to the
 * thing I already have open" and it should be one keystroke away. In per-pane
 * mode the same rows mean something different — link this pane to that view,
 * show that application here — so only the details change, not the model.
 */
export function defaultLauncherRows(context: LauncherRowsContext): LauncherRow[] {
  const { document, apps, workspaceId, invocation, query, scope = "document" } = context;
  const perPane = invocation.from !== null;
  const rows: LauncherRow[] = [];

  // viewOrder: the order the user met them beats any sort we could invent.
  for (const viewId of document.viewOrder) {
    const view = document.views[viewId];
    if (!view) continue;
    const placements = placementCount(document, viewId);
    // A view nothing places is not "on screen"; it is a leftover.
    if (placements === 0) continue;
    const app = apps.get(view.appId);
    const title = view.title || app?.titleFor?.(view) || app?.title || view.appId;
    if (!matches(title, query) && !matches(view.appId, query)) continue;
    const foreign = isForeign(document, workspaceId, viewId);
    // Scoped: a view of another workspace is not "on screen" at all. Linking
    // this pane to one would still be legal, which is exactly why the choice
    // is the product's — a scoped palette is smaller, not more correct.
    if (foreign && scope === "workspace") continue;
    rows.push({
      id: `${GOTO_PREFIX}${viewId}`,
      kind: "view",
      viewId,
      appId: view.appId,
      title,
      placements,
      foreign,
      detail: perPane
        ? "show it here too"
        : foreign
          ? "in another workspace"
          : placements > 1
            ? `shown in ${placements} tiles`
            : "on screen",
    });
  }

  for (const app of apps.list()) {
    if (!matches(app.title, query) && !matches(app.id, query)) continue;
    if (!isAppAvailable(app, { workspaceId })) continue;
    // A doc-bound application is a view OF something; with no document to
    // bind it would open empty. Those arrive through `openView`.
    if (app.docBound) continue;
    // A placed singleton is already offered above, as the view it has —
    // but only if the row above actually exists. Scoped to the workspace, a
    // singleton living next door has no view row, so suppressing its
    // application row too would make it unreachable from this workspace's
    // launcher; offered, it is `place`'s cross-workspace case (go there) or
    // `placeAt`'s (link it in here).
    const placedWhereItCounts = document.viewOrder.some((id) => {
      if (document.views[id]?.appId !== app.id) return false;
      return scope === "workspace" ? !isForeign(document, workspaceId, id) : true;
    });
    if (app.singleton && placedWhereItCounts) continue;
    rows.push({
      id: `${PLACE_PREFIX}${app.id}`,
      kind: "app",
      appId: app.id,
      title: app.title,
      detail: app.blurb ?? (perPane ? "show it here" : app.singleton ? "one tile" : "a new tile"),
    });
  }

  return rows;
}

/** Group the flat rows for the shell, honouring each application's `group`. */
export function groupLauncherRows(
  rows: readonly LauncherRow[],
  apps: AppRegistry,
  perPane: boolean,
  detailOf?: (row: LauncherRow) => import("react").ReactNode,
): LauncherShellGroup[] {
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

  // The fallback group last, so a product's named groups read before the
  // catch-all rather than after a wall of ungrouped applications.
  const named = [...byGroup.entries()].filter(([label]) => label !== fallback).map(([, group]) => group);
  const rest = byGroup.get(fallback);
  return [onScreen, ...named, ...(rest ? [rest] : [])].filter((group) => group.rows.length > 0);
}

export function rowOf(id: string, rows: readonly LauncherRow[]): LauncherRow | null {
  return rows.find((row) => row.id === id) ?? null;
}
