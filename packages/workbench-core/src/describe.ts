import { toJson } from "@bufbuild/protobuf";
import { Direction, type AppView, type Node, type WorkbenchDocument, WorkbenchDocumentSchema } from "@hyperslop-systems/workbench-protocol";
import { badgeOf, type BadgeState, type PortDeclaration, type PortDirection } from "@hyperslop-systems/pbui/link-kernel";
import { bindingNames, type WorkbenchAppManifest } from "./apps";
import type { WorkbenchCore } from "./createWorkbenchCore";
import { MISSING_APP_ID, specOf, type LayoutSpec } from "./document";
import type { GeometrySnapshot } from "./geometry";
import type { WorkbenchIndex } from "./graph";
import type { LocalRevision } from "./identity";
import { placementCount } from "./queries";

/**
 * The workbench as a small object an agent can read.
 *
 * `core.serialize()` already answers "what is on screen" — correctly,
 * wastefully, and in a shape that spends a model's attention on node ids and
 * protobuf oneofs. This is the same information addressed the way the
 * commands are: every id a command takes (`placementId`, `viewId`,
 * `splitId`, `appId`) is named here, the layout comes back in the SAME
 * `LayoutSpec` dialect `layout()` accepts, and nothing else is included.
 *
 * Headless by construction: titles and launcher prose are presentation, so
 * the caller passes a `presentations` lookup (the shell does); geometry is
 * a value the caller measured (the shell does), never a DOM this reads.
 */

/** What the description needs from an application's presentation; the shell supplies it, a headless caller may not. */
export interface DescribePresentation {
  title: string;
  titleFor?(view: AppView): string;
  blurb?: string;
  group?: string;
}

export interface DescribedPort {
  name: string;
  direction: PortDirection;
  valueType: string;
  role: string;
  doc: string;
  documentSlot?: true;
  fallbackContext?: string;
}

export interface DescribedApp {
  id: string;
  title: string;
  /** `viewCardinality === "one"`, kept under the name agents have read since the first release. */
  singleton: boolean;
  viewCardinality: "one" | "many";
  duplicatePlacement: "clone" | "link";
  /** The application must be opened from a document (`launch === "requires-bindings"`). */
  docBound: boolean;
  launch: "unbound" | "requires-bindings" | "hidden";
  bindings?: string[];
  ports?: DescribedPort[];
  blurb?: string;
  group?: string;
}

export interface DescribedTile {
  placementId: string;
  viewId: string;
  appId: string;
  title: string;
  documents: Record<string, string>;
  linkedPlacements: number;
  /** Rendered geometry as fractions of the Surface root box; present only when geometry was supplied AND the tile is measured. */
  rect?: { x: number; y: number; w: number; h: number };
}

export interface DescribedSplit {
  splitId: string;
  direction: "row" | "col";
  ratio: number;
}

export interface DescribedBinding {
  port: string;
  viewId: string;
  name: string;
  state: BadgeState;
  badge: string;
  explanation: string;
  source?: string;
}

export interface DescribedLink {
  linkId: string;
  kind: "follow" | "derived" | "held" | "identity";
  source: string;
  destination: string;
  relation?: string;
  classId?: string;
}

export interface DescribedContext {
  key: string;
  valueType: string;
  drivenBy: string[];
  filled: boolean;
}

export interface DescribedWorkspace {
  id: string;
  name: string;
  active: boolean;
  tiles: DescribedTile[];
  tree: LayoutSpec;
  splits: DescribedSplit[];
}

export interface WorkbenchDescription {
  activeWorkspaceId: string;
  activePlacementId: string | null;
  revision: LocalRevision;
  apps: DescribedApp[];
  workspaces: DescribedWorkspace[];
  links?: { bindings: DescribedBinding[]; links: DescribedLink[]; contexts: DescribedContext[] };
  document?: unknown;
}

export interface DescribeOptions {
  /** Narrow to one workspace; an unknown id describes none rather than all. */
  workspaceId?: string;
  /** Include the full protobuf JSON as `document`. Large; ask deliberately. */
  document?: boolean;
  /** Presentation titles/prose per application; absent ⇒ the app id is the title. */
  presentations?(appId: string): DescribePresentation | null;
  /** Measured geometry; absent ⇒ no `rect` on any tile. */
  geometry?: GeometrySnapshot | null;
}

/** The derived tile label, computed the way the tile bar computes it. */
export function titleOfView(view: AppView | undefined, presentation: DescribePresentation | null, viewId: string): string {
  if (!view) return `missing view ${viewId}`;
  return view.title || presentation?.titleFor?.(view) || presentation?.title || view.appId;
}

export function describeWorkbench(core: WorkbenchCore, options: DescribeOptions = {}): WorkbenchDescription {
  // One snapshot for the whole description: two `getState()` calls could
  // straddle a transition and report an activePlacementId that is not in
  // the tree we just described.
  const state = core.getState();
  const doc = state.document;
  const presentation = options.presentations ?? (() => null);
  const rects = options.geometry ? measure(options.geometry) : null;
  const selected = options.workspaceId ? doc.workspaces.filter((workspace) => workspace.id === options.workspaceId) : doc.workspaces;
  const links = describeLinks(core, doc);
  return {
    activeWorkspaceId: state.session.workspaceId,
    activePlacementId: state.session.activePlacementId,
    revision: state.revision,
    apps: core.apps.list().map((manifest) => describeApp(manifest, presentation(manifest.id))),
    ...(links ? { links } : {}),
    workspaces: selected.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      active: workspace.id === state.session.workspaceId,
      tiles: leavesOf(workspace.tree).map((leaf) => describeTile(state.index, doc, leaf, presentation, rects)),
      tree: workspace.tree ? specOf(doc, workspace.tree) : { kind: "tile", appId: MISSING_APP_ID, title: "missing tree" },
      splits: splitsOf(workspace.tree),
    })),
    ...(options.document ? { document: toJson(WorkbenchDocumentSchema, doc) } : {}),
  };
}

function leavesOf(node: Node | undefined): Node[] {
  if (!node) return [];
  if (node.body.case === "leaf") return [node];
  if (node.body.case === "split") return [...leavesOf(node.body.value.a), ...leavesOf(node.body.value.b)];
  return [];
}

function describeLinks(core: WorkbenchCore, doc: WorkbenchDocument): WorkbenchDescription["links"] | null {
  const links = core.links;
  if (!links) return null;
  const snapshot = links.snapshot(doc);
  const bindings: DescribedBinding[] = [];
  for (const definition of snapshot.ports.values()) {
    if (definition.declaration.direction === "out") continue;
    if (definition.declaration.documentSlot && !snapshot.bindings.has(definition.id)) continue;
    const badge = badgeOf(definition, snapshot, links.deps);
    if (badge.state === "none") continue;
    bindings.push({
      port: definition.id,
      viewId: definition.viewId,
      name: definition.declaration.name,
      state: badge.state,
      badge: `${badge.glyph} ${badge.text}`.trim(),
      explanation: badge.explanation,
      ...(badge.sourcePort ? { source: badge.sourcePort } : {}),
    });
  }
  const wires: DescribedLink[] = [];
  for (const [port, binding] of snapshot.bindings) {
    const inner = binding.kind === "hold" ? binding.suspended : binding;
    if (inner.kind !== "follow" && inner.kind !== "derived") continue;
    const source = inner.kind === "follow" ? inner.source : inner.source.kind === "follow" ? inner.source.source : null;
    if (!source) continue;
    wires.push({ linkId: inner.linkId, kind: binding.kind === "hold" ? "held" : inner.kind, source, destination: port, ...(inner.kind === "derived" ? { relation: inner.relationId } : {}) });
  }
  for (const declaration of snapshot.identity) {
    const classId = snapshot.aliases.get(declaration.left);
    wires.push({ linkId: declaration.linkId, kind: "identity", source: declaration.left, destination: declaration.right, ...(classId && classId === snapshot.aliases.get(declaration.right) ? { classId } : {}) });
  }
  const contexts: DescribedContext[] = [...snapshot.contexts.values()].map((context) => ({
    key: context.key,
    valueType: context.valueType,
    drivenBy: [...context.drivenBy],
    filled: Boolean(snapshot.values.context(context.key)),
  }));
  if (bindings.length === 0 && wires.length === 0 && contexts.length === 0) return null;
  return { bindings, links: wires, contexts };
}

function describeApp(app: WorkbenchAppManifest, presentation: DescribePresentation | null): DescribedApp {
  const slots = bindingNames(app);
  return {
    id: app.id,
    title: presentation?.title ?? app.id,
    singleton: app.viewCardinality === "one",
    viewCardinality: app.viewCardinality,
    duplicatePlacement: app.duplicatePlacement,
    // "Must be opened from something": the launch policy, not the mere
    // presence of a binding (an optional context binding launches unbound).
    docBound: app.launch === "requires-bindings",
    launch: app.launch,
    ...(slots.length > 0 ? { bindings: slots } : {}),
    ...(app.ports && app.ports.length > 0 ? { ports: app.ports.map(describePort) } : {}),
    ...(presentation?.blurb ? { blurb: presentation.blurb } : {}),
    ...(presentation?.group ? { group: presentation.group } : {}),
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

function describeTile(index: WorkbenchIndex, doc: WorkbenchDocument, leaf: Node, presentation: (appId: string) => DescribePresentation | null, rects: Map<string, { x: number; y: number; w: number; h: number }> | null): DescribedTile {
  const viewId = leaf.body.case === "leaf" ? leaf.body.value.viewId : "";
  const view = doc.views[viewId];
  const rect = rects?.get(leaf.id);
  return {
    placementId: leaf.id,
    viewId,
    // A placement whose view is gone is still on screen as a broken tile, so
    // it is still something the agent may want to close or replace.
    appId: view?.appId ?? MISSING_APP_ID,
    title: titleOfView(view, view ? presentation(view.appId) : null, viewId),
    documents: { ...(view?.documents ?? {}) },
    linkedPlacements: view ? placementCount(index, view.id) : 0,
    ...(rect ? { rect } : {}),
  };
}

function splitsOf(node: Node | undefined, out: DescribedSplit[] = []): DescribedSplit[] {
  if (!node || node.body.case !== "split") return out;
  const { direction, ratio, a, b } = node.body.value;
  out.push({ splitId: node.id, direction: direction === Direction.COLUMN ? "col" : "row", ratio });
  splitsOf(a, out);
  splitsOf(b, out);
  return out;
}

/** Every measured placement's box as a fraction of the viewport; null when the viewport has no area (the jsdom case). */
function measure(geometry: GeometrySnapshot): Map<string, { x: number; y: number; w: number; h: number }> | null {
  const box = geometry.viewport;
  if (!box || !box.width || !box.height) return null;
  const out = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const [id, r] of geometry.placements) {
    out.set(id, { x: round(r.x / box.width), y: round(r.y / box.height), w: round(r.width / box.width), h: round(r.height / box.height) });
  }
  return out;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
