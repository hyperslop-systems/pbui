import { toJson } from "@bufbuild/protobuf";
import {
  Direction,
  type AppView,
  type Node,
  type WorkbenchDocument,
  WorkbenchDocumentSchema,
} from "@hyperslop-systems/workbench-protocol";
import type { PortDeclaration, PortDirection } from "@hyperslop-systems/pbui";
import { leaves, placementCount } from "@hyperslop-systems/workbench-protocol/client";
import { documentSlots, type AppDescriptor } from "./apps";
import { MISSING_APP_ID, specOf, type LayoutSpec } from "./document";
import type { Workbench } from "./types";

/**
 * The workbench as a small object an agent can read.
 *
 * `workbench.serialize()` already answers "what is on screen" — correctly,
 * wastefully, and in a shape that spends a model's attention on node ids and
 * protobuf oneofs. This is the same information addressed the way the verbs
 * are: every id a verb takes (`placementId`, `viewId`, `splitId`, `appId`) is
 * named here, the layout comes back in the SAME `LayoutSpec` dialect
 * `layout()` accepts, and nothing else is included. An agent cannot mutate
 * what it cannot see, and it cannot see a 40 kB document.
 */

/** One declared port, as an agent reads it (PBUI-LINK-1). */
export interface DescribedPort {
  name: string;
  direction: PortDirection;
  valueType: string;
  /** The semantic role the contract declares; equals `valueType` unless the app said otherwise. */
  role: string;
  doc: string;
  /** Set on the ports that are `view.documents` slots. */
  documentSlot?: true;
  /** The context an unbound input reads, when it declares one. */
  fallbackContext?: string;
}

/** One registered application, as offered to whoever is choosing what to place. */
export interface DescribedApp {
  id: string;
  title: string;
  singleton: boolean;
  /** Derived from the ports: does the application declare a document slot? */
  docBound: boolean;
  /** The document-slot names a doc-bound application needs bound; derived from `ports`. */
  bindings?: string[];
  /** Every declared port, document slots included. Absent when the app declares none. */
  ports?: DescribedPort[];
  blurb?: string;
  group?: string;
}

/** One placement: a tile on screen, addressed by the id its verbs take. */
export interface DescribedTile {
  placementId: string;
  viewId: string;
  appId: string;
  /** The derived label — the same words the tile's title bar shows. */
  title: string;
  documents: Record<string, string>;
  /** How many tiles show this view; greater than one ⇒ a linked view. */
  linkedPlacements: number;
  /**
   * Rendered geometry, as fractions of the Surface root box. Present only
   * when `options.geometry` asked for it AND the tile is mounted.
   */
  rect?: { x: number; y: number; w: number; h: number };
}

/** One divider, addressed by the id `split.resize` takes. */
export interface DescribedSplit {
  splitId: string;
  direction: "row" | "col";
  ratio: number;
}

export interface DescribedWorkspace {
  id: string;
  name: string;
  active: boolean;
  tiles: DescribedTile[];
  /** The layout in the dialect `layout()` and `workspace.create` accept. */
  tree: LayoutSpec;
  splits: DescribedSplit[];
}

export interface WorkbenchDescription {
  activeWorkspaceId: string;
  activePlacementId: string | null;
  apps: DescribedApp[];
  workspaces: DescribedWorkspace[];
  /** The full protobuf JSON, only when `options.document` asked for it. */
  document?: unknown;
}

export interface DescribeOptions {
  /**
   * Narrow to one workspace. An id no workspace has describes none rather
   * than falling back to all of them: silently widening turns "tell me about
   * ws-7" into a wall of unrelated tiles, and an empty list is a fact the
   * caller can report as `unknown workspace "ws-7"`.
   */
  workspaceId?: string;
  /**
   * Read `rect` off the DOM. Opt-in because it is the ONLY part of this
   * function that needs a mounted Surface — `describeWorkbench(wb)` must
   * answer from the document alone, so tests, stories and a headless product
   * can call it. Ratios alone do not tell a model that a nine-column table is
   * living in 349 px; this is what does.
   */
  geometry?: boolean;
  /** Include the full protobuf JSON as `document`. Large; ask for it deliberately. */
  document?: boolean;
}

export function describeWorkbench(wb: Workbench, options: DescribeOptions = {}): WorkbenchDescription {
  // One snapshot for the whole description: two `getState()` calls could
  // straddle a mutation and report an activePlacementId that is not in the
  // tree we just described.
  const state = wb.store.getState();
  const doc = state.document;
  const rects = options.geometry ? measurePlacements(wb) : null;

  const selected = options.workspaceId
    ? doc.workspaces.filter((workspace) => workspace.id === options.workspaceId)
    : doc.workspaces;

  return {
    activeWorkspaceId: state.workspaceId,
    activePlacementId: state.activePlacementId,
    apps: wb.apps.list().map(describeApp),
    workspaces: selected.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      active: workspace.id === state.workspaceId,
      tiles: leaves(workspace.tree).map((leaf) => describeTile(wb, doc, leaf, rects)),
      // A workspace whose tree the applier never set still has to describe as
      // something, or one broken workspace takes the whole description down.
      tree: workspace.tree ? specOf(doc, workspace.tree) : { kind: "tile", appId: MISSING_APP_ID, title: "missing tree" },
      splits: splitsOf(workspace.tree),
    })),
    ...(options.document ? { document: toJson(WorkbenchDocumentSchema, doc) } : {}),
  };
}

function describeApp(app: AppDescriptor): DescribedApp {
  const slots = documentSlots(app);
  return {
    id: app.id,
    title: app.title,
    singleton: app.singleton,
    // Derived, never stored: the description must never say `undefined`
    // where the reader is deciding whether a tile needs a document.
    docBound: slots.length > 0,
    ...(slots.length > 0 ? { bindings: slots } : {}),
    ...(app.ports && app.ports.length > 0 ? { ports: app.ports.map(describePort) } : {}),
    ...(app.blurb ? { blurb: app.blurb } : {}),
    ...(app.group ? { group: app.group } : {}),
  };
}

function describePort(port: PortDeclaration): DescribedPort {
  return {
    name: port.name,
    direction: port.direction,
    valueType: port.contract.valueType,
    role: port.contract.semanticRole,
    doc: port.doc,
    ...(port.documentSlot ? { documentSlot: true as const } : {}),
    ...(port.fallbackContext ? { fallbackContext: port.fallbackContext } : {}),
  };
}

function describeTile(
  wb: Workbench,
  doc: WorkbenchDocument,
  leaf: Node,
  rects: Map<string, { x: number; y: number; w: number; h: number }> | null,
): DescribedTile {
  const viewId = leaf.body.case === "leaf" ? leaf.body.value.viewId : "";
  const view = doc.views[viewId];
  const rect = rects?.get(leaf.id);
  return {
    placementId: leaf.id,
    viewId,
    // A placement whose view is gone is still on screen as a broken tile, so
    // it is still something the agent may want to close or replace. Dropping
    // it from the list would make it unaddressable.
    appId: view?.appId ?? MISSING_APP_ID,
    title: titleOf(wb, view, viewId),
    documents: { ...(view?.documents ?? {}) },
    linkedPlacements: view ? placementCount(doc, view.id) : 0,
    ...(rect ? { rect } : {}),
  };
}

/**
 * The derived label, computed the way `Tile` and `tileRefOf` compute it: the
 * view's own title, else the application's `titleFor`, else its title, else
 * the raw appId. A fourth spelling would make the agent's "close the Gold
 * Coins tile" miss the tile whose title bar says exactly that.
 */
function titleOf(wb: Workbench, view: AppView | undefined, viewId: string): string {
  if (!view) return `missing view ${viewId}`;
  const app = wb.apps.get(view.appId);
  return view.title || app?.titleFor?.(view) || app?.title || view.appId;
}

function splitsOf(node: Node | undefined, out: DescribedSplit[] = []): DescribedSplit[] {
  if (!node || node.body.case !== "split") return out;
  const { direction, ratio, a, b } = node.body.value;
  out.push({ splitId: node.id, direction: direction === Direction.COLUMN ? "col" : "row", ratio });
  splitsOf(a, out);
  splitsOf(b, out);
  return out;
}

/**
 * Every mounted placement's box, normalised against the Surface root.
 *
 * One `querySelectorAll` rather than a lookup per placement: it needs no id
 * escaping, and it naturally yields only the tiles that are actually
 * rendered — which is the active workspace, since the Surface draws one tree.
 * Returns null when there is no root or the root has no area, the jsdom case:
 * normalising against a zero-width box produces `Infinity`, and a description
 * full of `Infinity` is worse than one with no geometry at all.
 */
function measurePlacements(wb: Workbench): Map<string, { x: number; y: number; w: number; h: number }> | null {
  const root = wb.root();
  if (!root || typeof root.getBoundingClientRect !== "function") return null;
  const box = root.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  const out = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const element of root.querySelectorAll<HTMLElement>("[data-placement-id]")) {
    const id = element.dataset.placementId;
    if (!id) continue;
    const r = element.getBoundingClientRect();
    out.set(id, {
      // Four decimals: a fraction of a screen, well under a pixel on any
      // display, and it keeps the numbers the model reads free of the
      // sub-pixel noise `getBoundingClientRect` returns.
      x: round((r.left - box.left) / box.width),
      y: round((r.top - box.top) / box.height),
      w: round(r.width / box.width),
      h: round(r.height / box.height),
    });
  }
  return out;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
