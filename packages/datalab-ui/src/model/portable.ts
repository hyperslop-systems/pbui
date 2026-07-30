import type { GraphicDocument } from "./graphic";
import { rootSource } from "./graphicAuthoring";
import { findSecrets } from "./secrets";
import type { SourceRef } from "./table";

/**
 * The portable format: one envelope, three kinds.
 *
 * A tile, a workspace or a whole stage as a small JSON document that survives
 * a chat message, another browser and another account. Pure — no React, no
 * store, no browser API — which is why it is in `model/`: the strictest row in
 * the layer table, and the cheapest place to test.
 *
 * It describes a store shape, so `store/` might look like the natural home. It
 * is not: the format is a *value type*, like `legacy chart format`. It has no lifecycle,
 * no reducer and no persistence, and its whole job is to be converted to and
 * from. The conversions that touch `LayoutState` live in `store/bundles.ts` and
 * import this, which is the right direction.
 *
 * ## What a bundle contains, and what it must never contain
 *
 * **Never a credential.** `findSecrets` guards both directions — the exporter
 * refuses to produce a bundle that trips it and the importer refuses to accept
 * one. The export side is the load-bearing one: a bundle is *designed to be
 * shared*, which makes it a far more dangerous carrier than localStorage.
 *
 * **Necessarily a `SourceRef`.** A bundle names drops, streams and datasets and
 * carries the filters the user typed. That is not data — there is not one row
 * in it — but it is not nothing: an internal drop name may itself be sensitive
 * and a filter value may be worse. The clipboard is the right transport for
 * exactly the reason DATADROP-3 chose a URL fragment over a query parameter:
 * nothing transmits it anywhere unless the user pastes it somewhere.
 *
 * **Importing a bundle grants no access.** A workspace naming a drop the
 * importer cannot read imports fine and shows a 403 in that tile. Authorisation
 * is the server's job; the bundle is a set of references; a client that
 * pre-filtered them would be enforcing a policy it does not know.
 */

export const BUNDLE_VERSION = 3;

export type BundleKind = "tile" | "workspace" | "stage";

/**
 * Caps. A bundle that exceeds any of these is refused, not truncated.
 *
 * A clipboard is a more hostile input than your own localStorage: it holds
 * whatever the last program put there, and a user will paste a log line, half a
 * bundle truncated by a chat client, and a 4 MB minified bundle from a colleague
 * who scripted something. `depth` in particular guards the recursive walkers
 * below against a hand-made tree that would blow the stack.
 */
export const LIMITS = {
  bytes: 512 * 1024, // a 512 kB layout is not a layout
  leaves: 64, // 64 tiles is more than any screen can show
  views: 64,
  docs: 64,
  depth: 24, // split-tree depth
  spaces: 32, // per stage
} as const;

/**
 * A stage's chrome, restated here.
 *
 * Structurally identical to `store/layout.ts`'s `StageChrome` and deliberately
 * not imported from it: `model` may import nothing outside `model`, and the
 * direction of that rule is what keeps this file testable in milliseconds. The
 * two are checked against each other by assignment at the one place they meet,
 * `store/bundles.ts`.
 */
export interface PortableChrome {
  masthead: boolean;
  workspaces: boolean;
  stageBar: boolean;
}

/**
 * A document, by content.
 *
 * No id. See `PortableNode` for why.
 */
export interface PortableDoc {
  name: string;
  graphic: Omit<GraphicDocument, "id" | "name">;
}

/**
 * A split tree, with ids removed and documents referenced BY INDEX (DR-64).
 *
 * This is the most important decision in the format and the easiest to get
 * wrong, because the obvious implementation — `JSON.stringify(node)` — compiles,
 * runs and produces a plausible-looking bundle that is broken in two ways.
 *
 * `id` is a node id unique to the exporting tree. Importing it into the tree it
 * came from — which is exactly what "duplicate by copy and paste" does —
 * produces two nodes with one id, and a duplicate React key is a hit-test that
 * returns the wrong tile.
 *
 * `docId` names a document in the exporting store's `world` slice, which the
 * receiving store has never heard of. Inlining the document at each leaf
 * instead would be simpler to write and would silently destroy the property the
 * world/layout split exists to provide: a workspace with a chart and a table on
 * document α would come back as two tiles on two *independent copies* of α, and
 * changing a filter in the pipeline would stop moving the chart. The user would
 * report that as "import is broken" and would be right.
 *
 * An index preserves sharing exactly. Two leaves with `doc: 0` import to two
 * leaves pointing at one minted document.
 */
export interface PortableView {
  app: string;
  title?: string;
  documents: Record<string, number>;
}

export type PortableNode =
  | { leaf: { view: number } }
  | { split: { dir: "row" | "col"; ratio: number; a: PortableNode; b: PortableNode } };

export interface TilePayload {
  view: PortableView;
  docs: PortableDoc[];
}

export interface WorkspacePayload {
  name: string;
  tree: PortableNode;
  views: PortableView[];
  docs: PortableDoc[];
  /** The workspace's own allow-list, if it had one. */
  apps?: string[] | null;
}

export interface StagePayload {
  name: string;
  apps: string[] | null;
  chrome: PortableChrome;
  spaces: WorkspacePayload[];
  /**
   * Hoisted to the stage, because two workspaces in one stage may share a
   * document and the index argument applies identically one level up. A
   * workspace payload nested here has an empty `docs` and its leaves index into
   * this array.
   */
  docs: PortableDoc[];
  /** Hoisted with documents so links survive across workspaces. */
  views: PortableView[];
}

export type PayloadFor<K> = K extends "tile"
  ? TilePayload
  : K extends "workspace"
    ? WorkspacePayload
    : K extends "stage"
      ? StagePayload
      : never;

export interface Bundle<K extends BundleKind = BundleKind> {
  /**
   * A magic string, checked before anything else.
   *
   * Users paste the wrong thing — a chart permalink, a CSV row, a log line,
   * half a bundle truncated by a chat client. A magic string means the failure
   * message can be "that is not a DATALAB layout" rather than "unexpected token
   * < in JSON at position 0", and the difference between those two sentences is
   * whether the reader knows what to do next.
   */
  format: "datadrop.layout";
  /**
   * Checked for exact equality on the way in.
   *
   * Version 2 will exist; a version-2 bundle pasted into a version-1 build must
   * be refused with "exported by a newer version" rather than partially
   * understood.
   */
  version: number;
  kind: K;
  /** ISO 8601. Informational — shown in the template library, never trusted. */
  exportedAt: string;
  /** Free text the exporter typed, or the object's own name. */
  name: string;
  payload: PayloadFor<K>;
}

export const FORMAT = "datadrop.layout" as const;

/* ------------------------------------------------------------- reasons -- */

/**
 * Every refusal, in one place, because these strings are the specification.
 *
 * `parseBundle` returns a *reason* rather than `null` — the one place it
 * differs in shape from its sibling `persist.validate`. `validate`'s caller
 * falls back to defaults and writes a console warning nobody reads;
 * `parseBundle`'s caller is a dialog with a human in front of it, and "that
 * bundle names 91 tiles; the limit is 64" is a sentence that ends the
 * interaction. A `null` there produces "import failed", which does not.
 */
export const REASONS = {
  notALayout: "that is not a DATALAB layout",
  newer: "that was exported by a newer version of DATALAB",
  older: "that was exported by an older version and cannot be read",
  damaged: "that bundle is damaged",
  credential: "that bundle contains something credential-shaped and was refused",
  wrongKind: (found: BundleKind, wanted: BundleKind) =>
    `that is a ${found}; this ${wanted} can only take a ${wanted}`,
  tooManyTiles: (found: number) =>
    `that bundle names ${found} tiles; the limit is ${LIMITS.leaves}`,
  tooManyViews: (found: number) => `that bundle names ${found} views; the limit is ${LIMITS.views}`,
  tooManyDocs: (found: number) =>
    `that bundle names ${found} documents; the limit is ${LIMITS.docs}`,
  tooManySpaces: (found: number) =>
    `that bundle names ${found} workspaces; the limit is ${LIMITS.spaces}`,
  tooDeep: `that bundle nests tiles more than ${LIMITS.depth} deep`,
  tooBig: (bytes: number) =>
    `that bundle is ${Math.round(bytes / 1024)} kB; the limit is ${LIMITS.bytes / 1024} kB`,
} as const;

export type ParseResult = { ok: true; bundle: Bundle } | { ok: false; reason: string };

/* ---------------------------------------------------------- validation -- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isSource(value: unknown): value is SourceRef {
  if (!isRecord(value)) return false;
  if (value.kind !== "stream" && value.kind !== "dataset") return false;
  return typeof value.drop === "string";
}

function hasCompleteRootRelation(graphic: Record<string, unknown>): boolean {
  if (!isRecord(graphic.sources) || !isRecord(graphic.transforms) || !isRecord(graphic.views)) {
    return false;
  }
  if (typeof graphic.rootView !== "string") return false;
  const view = graphic.views[graphic.rootView];
  if (!isRecord(view)) return false;

  let relation: unknown = view.relation;
  const seenTransforms = new Set<string>();
  while (isRecord(relation)) {
    if (relation.kind === "source") {
      return typeof relation.sourceId === "string" && isRecord(graphic.sources[relation.sourceId]);
    }
    if (relation.kind !== "transform" || typeof relation.transformId !== "string") return false;
    if (seenTransforms.has(relation.transformId)) return false;
    seenTransforms.add(relation.transformId);
    const transform = graphic.transforms[relation.transformId];
    if (!isRecord(transform)) return false;
    relation = transform.input;
  }
  return false;
}

function isGraphic(value: unknown): value is PortableDoc["graphic"] {
  if (!isRecord(value)) return false;
  if (value.format !== "datadrop.gog.document" || value.version !== 1) return false;
  if (!isRecord(value.sources) || Object.values(value.sources).length !== 1) return false;
  if (
    !Object.values(value.sources).every((source) => isRecord(source) && isSource(source.source))
  ) {
    return false;
  }
  return (
    isRecord(value.transforms) &&
    isRecord(value.views) &&
    typeof value.rootView === "string" &&
    isRecord(value.parameters) &&
    hasCompleteRootRelation(value)
  );
}

function isDoc(value: unknown): value is PortableDoc {
  return isRecord(value) && typeof value.name === "string" && isGraphic(value.graphic);
}

/**
 * Structure and depth in one walk.
 *
 * Depth is checked *here* rather than afterwards because the check has to
 * bound the recursion that would otherwise blow the stack on a hand-made
 * bundle — a validator that overflows before reporting its limit is not a
 * validator.
 */
function isPortableNode(value: unknown, depth = 0): value is PortableNode {
  if (depth > LIMITS.depth) return false;
  if (!isRecord(value)) return false;

  if ("leaf" in value) {
    const leaf = value.leaf;
    if (!isRecord(leaf)) return false;
    return Number.isInteger(leaf.view) && (leaf.view as number) >= 0;
  }
  if ("split" in value) {
    const split = value.split;
    if (!isRecord(split)) return false;
    if (split.dir !== "row" && split.dir !== "col") return false;
    if (typeof split.ratio !== "number" || !Number.isFinite(split.ratio)) return false;
    return isPortableNode(split.a, depth + 1) && isPortableNode(split.b, depth + 1);
  }
  return false;
}

/** How deep a portable tree nests. Only called on a structurally valid one. */
function depthOf(node: PortableNode): number {
  return "leaf" in node ? 1 : 1 + Math.max(depthOf(node.split.a), depthOf(node.split.b));
}

/** How many leaves a portable tree has. */
export function countPortableLeaves(node: PortableNode): number {
  return "leaf" in node ? 1 : countPortableLeaves(node.split.a) + countPortableLeaves(node.split.b);
}

/** Every leaf in a portable tree, in order. */
export function portableLeaves(node: PortableNode): Array<{ view: number }> {
  return "leaf" in node
    ? [node.leaf]
    : [...portableLeaves(node.split.a), ...portableLeaves(node.split.b)];
}

function isPortableView(value: unknown): value is PortableView {
  if (!isRecord(value)) return false;
  if (typeof value.app !== "string" || value.app === "") return false;
  if (value.title !== undefined && typeof value.title !== "string") return false;
  if (!isRecord(value.documents)) return false;
  return Object.values(value.documents).every(
    (index) => Number.isInteger(index) && (index as number) >= 0,
  );
}

/**
 * Clamp a split ratio into the range the renderer can draw.
 *
 * The same clamp `persist.validate` applies, and for the same reason: a ratio
 * of 0.001 is a tile one pixel wide with no way to grab its divider.
 */
export function clampRatio(ratio: number): number {
  return Math.min(0.95, Math.max(0.05, ratio));
}

function checkWorkspacePayload(
  payload: unknown,
  ownDocs: boolean,
  ownViews: boolean = ownDocs,
): string | null {
  if (!isRecord(payload)) return REASONS.damaged;
  if (typeof payload.name !== "string") return REASONS.damaged;
  if (!isPortableNode(payload.tree)) return REASONS.damaged;
  if (!Array.isArray(payload.views) || !payload.views.every(isPortableView)) {
    return REASONS.damaged;
  }
  if (ownViews && payload.views.length > LIMITS.views) {
    return REASONS.tooManyViews(payload.views.length);
  }
  if (payload.apps !== undefined && payload.apps !== null) {
    if (!Array.isArray(payload.apps) || !payload.apps.every((a) => typeof a === "string")) {
      return REASONS.damaged;
    }
  }
  if (ownDocs) {
    if (!Array.isArray(payload.docs) || !payload.docs.every(isDoc)) return REASONS.damaged;
    if (payload.docs.length > LIMITS.docs) return REASONS.tooManyDocs(payload.docs.length);
    if (
      (payload.views as PortableView[]).some((view) =>
        Object.values(view.documents).some((index) => index >= (payload.docs as unknown[]).length),
      )
    ) {
      return REASONS.damaged;
    }
  } else if (payload.docs !== undefined && !Array.isArray(payload.docs)) {
    return REASONS.damaged;
  }

  const tree = payload.tree as PortableNode;
  if (
    ownViews &&
    portableLeaves(tree).some((leaf) => leaf.view >= (payload.views as unknown[]).length)
  ) {
    return REASONS.damaged;
  }
  const leaves = countPortableLeaves(tree);
  if (leaves > LIMITS.leaves) return REASONS.tooManyTiles(leaves);
  if (depthOf(tree) > LIMITS.depth) return REASONS.tooDeep;
  return null;
}

/**
 * Text in, a bundle or a reason out. Never throws, never partially applies.
 *
 * A sibling of `store/persist.ts`'s `validate`: reject a wrong version
 * outright, check structure narrowly rather than trusting `as`, repair what is
 * repairable (a ratio out of range is clamped, as `validate` clamps it), and
 * refuse everything else with a sentence.
 */
export function parseBundle(text: string, expect?: BundleKind): ParseResult {
  if (text.length > LIMITS.bytes) return { ok: false, reason: REASONS.tooBig(text.length) };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: REASONS.notALayout };
  }

  if (!isRecord(raw) || raw.format !== FORMAT) {
    return { ok: false, reason: REASONS.notALayout };
  }
  if (typeof raw.version !== "number") return { ok: false, reason: REASONS.notALayout };
  if (raw.version > BUNDLE_VERSION) return { ok: false, reason: REASONS.newer };
  if (raw.version < BUNDLE_VERSION) return { ok: false, reason: REASONS.older };

  const kind = raw.kind;
  if (kind !== "tile" && kind !== "workspace" && kind !== "stage") {
    return { ok: false, reason: REASONS.notALayout };
  }
  if (expect && kind !== expect) {
    return { ok: false, reason: REASONS.wrongKind(kind, expect) };
  }
  if (typeof raw.name !== "string" || typeof raw.exportedAt !== "string") {
    return { ok: false, reason: REASONS.damaged };
  }

  // The credential audit runs on the WHOLE parsed value, before any of it is
  // trusted, and it is the same function `save()` uses. Both directions, one
  // net (DR-28's second one — the first is that no credential is anywhere it
  // could reach a spec).
  if (findSecrets(raw).length > 0) return { ok: false, reason: REASONS.credential };

  const payload = raw.payload;
  if (kind === "tile") {
    if (!isRecord(payload)) return { ok: false, reason: REASONS.damaged };
    if (!isPortableView(payload.view)) {
      return { ok: false, reason: REASONS.damaged };
    }
    const docs = payload.docs;
    if (!Array.isArray(docs) || !docs.every(isDoc)) {
      return { ok: false, reason: REASONS.damaged };
    }
    if (docs.length > LIMITS.docs) {
      return { ok: false, reason: REASONS.tooManyDocs(docs.length) };
    }
    if (Object.values(payload.view.documents).some((index) => index >= docs.length)) {
      return { ok: false, reason: REASONS.damaged };
    }
  } else if (kind === "workspace") {
    const bad = checkWorkspacePayload(payload, true);
    if (bad) return { ok: false, reason: bad };
  } else {
    if (!isRecord(payload)) return { ok: false, reason: REASONS.damaged };
    if (typeof payload.name !== "string") return { ok: false, reason: REASONS.damaged };
    if (payload.apps !== null && !Array.isArray(payload.apps)) {
      return { ok: false, reason: REASONS.damaged };
    }
    const chrome = payload.chrome;
    if (
      !isRecord(chrome) ||
      typeof chrome.masthead !== "boolean" ||
      typeof chrome.workspaces !== "boolean" ||
      typeof chrome.stageBar !== "boolean"
    ) {
      return { ok: false, reason: REASONS.damaged };
    }
    if (!Array.isArray(payload.docs) || !payload.docs.every(isDoc)) {
      return { ok: false, reason: REASONS.damaged };
    }
    if (!Array.isArray(payload.views) || !payload.views.every(isPortableView)) {
      return { ok: false, reason: REASONS.damaged };
    }
    if (payload.views.length > LIMITS.views) {
      return { ok: false, reason: REASONS.tooManyViews(payload.views.length) };
    }
    if (
      (payload.views as PortableView[]).some((view) =>
        Object.values(view.documents).some((index) => index >= (payload.docs as unknown[]).length),
      )
    ) {
      return { ok: false, reason: REASONS.damaged };
    }
    if (payload.docs.length > LIMITS.docs) {
      return { ok: false, reason: REASONS.tooManyDocs(payload.docs.length) };
    }
    if (!Array.isArray(payload.spaces)) return { ok: false, reason: REASONS.damaged };
    if (payload.spaces.length > LIMITS.spaces) {
      return { ok: false, reason: REASONS.tooManySpaces(payload.spaces.length) };
    }
    let total = 0;
    for (const space of payload.spaces) {
      const candidate = space as Record<string, unknown>;
      if (!Array.isArray(candidate.views)) return { ok: false, reason: REASONS.damaged };
      const bad = checkWorkspacePayload(space, false);
      if (bad) return { ok: false, reason: bad };
      if (
        portableLeaves((space as WorkspacePayload).tree).some(
          (leaf) => leaf.view >= (payload.views as unknown[]).length,
        )
      ) {
        return { ok: false, reason: REASONS.damaged };
      }
      total += countPortableLeaves((space as WorkspacePayload).tree);
    }
    if (total > LIMITS.leaves) return { ok: false, reason: REASONS.tooManyTiles(total) };
  }

  return { ok: true, bundle: raw as unknown as Bundle };
}

/* ------------------------------------------------------------ reading -- */

/** Counts for the export confirmation and the template library. */
export function measureBundle(bundle: Bundle): {
  tiles: number;
  docs: number;
  spaces: number;
  bytes: number;
} {
  const bytes = JSON.stringify(bundle).length;
  if (bundle.kind === "tile") {
    const payload = bundle.payload as TilePayload;
    return { tiles: 1, docs: payload.docs.length, spaces: 0, bytes };
  }
  if (bundle.kind === "workspace") {
    const payload = bundle.payload as WorkspacePayload;
    return {
      tiles: countPortableLeaves(payload.tree),
      docs: payload.docs.length,
      spaces: 1,
      bytes,
    };
  }
  const payload = bundle.payload as StagePayload;
  return {
    tiles: payload.spaces.reduce((n, space) => n + countPortableLeaves(space.tree), 0),
    docs: payload.docs.length,
    spaces: payload.spaces.length,
    bytes,
  };
}

/** Every source a bundle names, deduplicated, in order. */
export function sourcesOf(bundle: Bundle): SourceRef[] {
  const docs =
    bundle.kind === "tile"
      ? (bundle.payload as TilePayload).docs
      : ((bundle.payload as WorkspacePayload | StagePayload).docs ?? []);
  const seen = new Set<string>();
  const out: SourceRef[] = [];
  for (const doc of docs) {
    const graphic = { ...doc.graphic, id: "portable", name: doc.name } as GraphicDocument;
    const source = rootSource(graphic);
    if (!source) continue;
    const key = JSON.stringify(source);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

/**
 * One sentence describing a bundle, for the dialog and the library.
 *
 * Re-run on every keystroke in the import dialog, which is what lets the
 * confirm button be disabled for content that would fail. **A user should never
 * be able to press a button that then reports an error** — the same principle
 * as `CHANNEL_ACCEPTS` filtering the channel dropdown rather than the plot
 * engine rejecting the selection afterwards.
 */
export function describeBundle(bundle: Bundle): string {
  const { tiles, docs, spaces } = measureBundle(bundle);
  const sources = sourcesOf(bundle);
  const reading =
    sources.length === 0
      ? ""
      : `, reading ${sources
          .map((source) =>
            source.kind === "stream"
              ? `${source.drop} / ${source.stream ?? "events"}`
              : `${source.drop} / ${source.dataset} v${source.version ?? "latest"} / ${source.path}`,
          )
          .join(", ")}`;

  if (bundle.kind === "tile") {
    const payload = bundle.payload as TilePayload;
    const primary = payload.view.documents.primary;
    const doc = primary === undefined ? undefined : payload.docs[primary];
    return `A tile: ${payload.view.app}${doc ? ` on a document called ${doc.name}` : ""}${reading}.`;
  }
  if (bundle.kind === "workspace") {
    const payload = bundle.payload as WorkspacePayload;
    return `A workspace “${payload.name}”: ${plural(tiles, "tile")}, ${plural(docs, "document")}${reading}.`;
  }
  const payload = bundle.payload as StagePayload;
  return (
    `A stage “${payload.name}”: ${plural(spaces, "workspace")}, ` +
    `${plural(tiles, "tile")}, ${plural(docs, "document")}${reading}.`
  );
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/**
 * Application ids a bundle names that this build does not have.
 *
 * A **warning**, never a refusal. Three answers are defensible — refuse, drop
 * those tiles, or import them naming the missing application — and the third is
 * right, because `Tile` already renders exactly that case ("no application
 * called 'chartsy' — choose Replace from the title") and it preserves the shape of what was
 * shared. The reader sees a four-tile layout with one tile they cannot fill,
 * which is true, rather than a three-tile layout, which is a lie about what
 * their colleague sent. Refusing outright makes the common case — a version skew
 * of one application — unrecoverable.
 */
export function unknownApps(bundle: Bundle, known: ReadonlySet<string>): string[] {
  const apps: string[] = [];
  if (bundle.kind === "tile") apps.push((bundle.payload as TilePayload).view.app);
  else if (bundle.kind === "workspace") {
    apps.push(...(bundle.payload as WorkspacePayload).views.map((view) => view.app));
  } else {
    apps.push(...(bundle.payload as StagePayload).views.map((view) => view.app));
  }
  return [...new Set(apps.filter((app) => !known.has(app)))].sort();
}
