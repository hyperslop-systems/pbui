import type { GraphicDocument } from "../model/graphic";
import type { AppView, LayoutState, Node, Stage, StageChrome, Workspace } from "./layout";
import { mergeStages } from "./stages";
import type { WorldState } from "./world";

/**
 * localStorage persistence, defensively.
 *
 * A layout written by a previous version, hand-edited, or truncated by a full
 * quota must produce the defaults and a console warning — never a blank screen.
 * The prototype restores without validating (pbui-gog.jsx:227-240) and gets away
 * with it because the shape never changed; ours will change, repeatedly.
 *
 * The token is NEVER written here. It lives in sessionStorage and nothing else
 * belongs there (guide §5.6). What is persisted is tile arrangements and chart
 * specifications, and that payload is audited by a test for anything
 * token-shaped, because "a snapshot is designed to be shared" and a shared
 * snapshot carrying a bearer token is a credential-exfiltration feature.
 *
 * **The key is a parameter, not a constant** (DATADROP-7 DR-47). It used to be
 * the module-level `KEY` below, which is correct while there is one workbench
 * per page and destructive the moment there is not: five embedded instances
 * would each run the 500 ms debounced `save()` against one key, so the reader's
 * real layout would be overwritten by whichever tutorial section they last
 * scrolled past, silently. `usePersistence(null)` — the default for an embedded
 * instance — never calls either function.
 */

/** The application's key. Embedded instances pass null and persist nothing. */
export const WORKBENCH_KEY = "datadrop-workbench";
/**
 * Bumped when a shape change makes older payloads unreadable.
 *
 * 2 since DATADROP-8, which put stages above workspaces. Version 1 payloads
 * are MIGRATED rather than discarded (DR-73) — see `migrate` below.
 */
const VERSION = 4;

interface Persisted {
  version: number;
  world: Pick<
    WorldState,
    "docs" | "docOrder" | "activeDocId" | "snapshots" | "snapshotOrder" | "pins" | "watch"
  >;
  layout: LayoutState;
}

/**
 * The credential guard, re-exported from where it now lives.
 *
 * It moved to `model/secrets.ts` in DATADROP-8, because a *bundle* has to be
 * audited in both directions and `model` may not import `store`. Re-exported
 * here so this file still reads as the one that guards durable storage — the
 * import site is the documentation.
 */
export { findSecrets } from "../model/secrets";
import { findSecrets } from "../model/secrets";

function isNode(value: unknown): value is Node {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<Node> & { type?: string };
  if (typeof node.id !== "string") return false;
  if (node.type === "leaf") return typeof (node as { viewId?: unknown }).viewId === "string";
  if (node.type === "split") {
    const s = node as { a?: unknown; b?: unknown; ratio?: unknown; dir?: unknown };
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

function isAppView(value: unknown): value is AppView {
  if (!value || typeof value !== "object") return false;
  const view = value as Partial<AppView>;
  return (
    typeof view.id === "string" &&
    typeof view.appId === "string" &&
    !!view.documents &&
    typeof view.documents === "object" &&
    Object.values(view.documents).every((id) => typeof id === "string") &&
    (view.title === undefined || typeof view.title === "string")
  );
}

function isWorkspace(value: unknown): value is Workspace {
  const space = value as Partial<Workspace>;
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

function isStage(value: unknown): value is Stage {
  const stage = value as Partial<Stage>;
  return (
    !!stage &&
    typeof stage.id === "string" &&
    typeof stage.name === "string" &&
    typeof stage.currentSpaceId === "string" &&
    (stage.apps === null || Array.isArray(stage.apps)) &&
    isChrome(stage.chrome)
  );
}

export function migrate(raw: unknown): unknown | null {
  if (!raw || typeof raw !== "object") return null;
  return (raw as { version?: number }).version === VERSION ? raw : null;
}

function isGraphicDocument(value: unknown): value is GraphicDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<GraphicDocument>;
  return (
    document.format === "datadrop.gog.document" &&
    document.version === 1 &&
    typeof document.id === "string" &&
    typeof document.name === "string" &&
    !!document.sources &&
    !!document.transforms &&
    !!document.views &&
    typeof document.rootView === "string" &&
    !!document.parameters
  );
}

export function validate(input: unknown): Persisted | null {
  const raw = migrate(input);
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<Persisted>;
  if (data.version !== VERSION) return null;
  if (!data.world || !data.layout) return null;
  if (!Array.isArray(data.layout.spaces)) return null;
  if (!data.layout.spaces.every(isWorkspace)) return null;
  if (!Array.isArray(data.layout.stages)) return null;
  if (!data.layout.stages.every(isStage)) return null;
  if (!data.layout.views || typeof data.layout.views !== "object") return null;
  if (!Object.values(data.layout.views).every(isAppView)) return null;
  if (!Array.isArray(data.layout.viewOrder)) return null;
  if (
    data.layout.viewOrder.length !== Object.keys(data.layout.views).length ||
    new Set(data.layout.viewOrder).size !== data.layout.viewOrder.length ||
    !data.layout.viewOrder.every((id) => typeof id === "string" && !!data.layout?.views[id])
  ) {
    return null;
  }
  const referencesKnownViews = (node: Node): boolean =>
    node.type === "leaf"
      ? !!data.layout?.views[node.viewId]
      : referencesKnownViews(node.a) && referencesKnownViews(node.b);
  if (!data.layout.spaces.every((space) => referencesKnownViews(space.tree))) return null;
  if (typeof data.world.docs !== "object" || !Array.isArray(data.world.docOrder)) return null;
  if (!Object.values(data.world.docs).every(isGraphicDocument)) return null;
  if (
    typeof data.world.snapshots !== "object" ||
    !Object.values(data.world.snapshots).every(
      (snapshot) =>
        !!snapshot &&
        typeof snapshot === "object" &&
        isGraphicDocument((snapshot as { document?: unknown }).document),
    )
  ) {
    return null;
  }

  // The hardwired stages and their workspaces are re-created from code on every
  // load, replacing whatever was stored under their ids (DR-29, DR-59). A user
  // who deleted the account workspace in a previous release gets it back; a
  // user who added a tile to it loses that tile, which is what "hardwired"
  // means. `mergeStages` also repairs orphans and empty stages.
  const { stages, spaces, views, viewOrder } = mergeStages(
    data.layout.stages,
    data.layout.spaces,
    data.layout.views,
    data.layout.viewOrder,
  );

  const stage = stages.find((s) => s.id === data.layout?.currentStageId) ?? (stages[0] as Stage);
  // A currentSpaceId naming a space that is gone would render nothing. The
  // stage's own pointer has already been repaired by mergeStages, so mirroring
  // it here is both the repair and the invariant (DR-60).
  const currentSpaceId = spaces.some(
    (s) => s.id === data.layout?.currentSpaceId && s.stageId === stage.id,
  )
    ? (data.layout.currentSpaceId as string)
    : stage.currentSpaceId;
  stage.currentSpaceId = currentSpaceId;

  return {
    version: VERSION,
    world: data.world,
    layout: { stages, currentStageId: stage.id, spaces, currentSpaceId, views, viewOrder },
  };
}

export function save(key: string, world: WorldState, layout: LayoutState): void {
  const payload: Persisted = {
    version: VERSION,
    world: {
      docs: world.docs,
      docOrder: world.docOrder,
      activeDocId: world.activeDocId,
      snapshots: world.snapshots,
      snapshotOrder: world.snapshotOrder,
      pins: world.pins,
      watch: world.watch,
      // Deliberately not the trace: it is a session-scoped teaching surface,
      // and restoring yesterday's transcript beside today's work is confusing
      // rather than useful.
    },
    layout: {
      stages: layout.stages,
      currentStageId: layout.currentStageId,
      spaces: layout.spaces,
      currentSpaceId: layout.currentSpaceId,
      views: layout.views,
      viewOrder: layout.viewOrder,
      // `pendingImport` is deliberately not persisted: it is a dialog, and a
      // reload that reopens a dialog over a tile that may be gone is a defect
      // that produces no error and fails no test (DR-69).
      //
      // Enumerated rather than spread for exactly that reason. The world above
      // has been enumerated since DATADROP-4 and the layout was passed whole,
      // because at the time every field in it was durable. The next transient
      // field added to this slice must now make a decision here rather than
      // relying on someone remembering.
    },
  };

  const secrets = findSecrets(payload);
  if (secrets.length > 0) {
    // Refuse rather than truncate. Losing a layout is an annoyance; writing a
    // credential to durable storage is not.
    console.error("refusing to persist: credential-shaped keys", secrets);
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    // A full quota must not take the application down with it.
    console.warn("could not persist the workbench layout", error);
  }
}

export function load(key: string): Persisted | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const valid = validate(parsed);
    if (!valid) {
      console.warn("stored workbench layout is not readable by this version — using defaults");
      return null;
    }
    return valid;
  } catch (error) {
    console.warn("could not restore the workbench layout", error);
    return null;
  }
}

export function clear(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
