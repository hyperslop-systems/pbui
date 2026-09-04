import { toJson } from "@bufbuild/protobuf";
import {
  WorkbenchDocumentSchema,
  type WorkbenchDocument,
} from "@hyperslop-systems/workbench-protocol";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import {
  documentSourceMutations,
  parseWorkbenchDocument,
  type ManifestCatalog,
} from "@hyperslop-systems/workbench-core";
import type { GraphicDocument } from "../model/graphic";
import { graphicDocumentSource } from "./graphicSource";
import { mergePinned } from "./merge";
import { isV5Layout, migrateV5Layout } from "./migrateV5";
import {
  durableNavigation,
  type NavigationState,
  type PersistedNavigation,
  type StageDefinition,
  type WorkspaceMeta,
} from "./navigation";
import { defaultSeed, type DatalabSeed } from "./seed";
import type { WorldState } from "./world";

/**
 * localStorage persistence, defensively.
 *
 * A layout written by a previous version, hand-edited, or truncated by a full
 * quota must produce the defaults and a console warning — never a blank
 * screen. Ours changes shape repeatedly, so every load validates.
 *
 * The token is NEVER written here. It lives in sessionStorage and nothing
 * else belongs there (guide §5.6). What is persisted is tile arrangements
 * and chart specifications, and that payload is audited for anything
 * token-shaped, because a shared snapshot carrying a bearer token is a
 * credential-exfiltration feature.
 *
 * **The key is a parameter, not a constant** (DATADROP-7 DR-47): five
 * embedded instances running one debounced `save()` against one key would
 * overwrite the reader's real layout with whichever tutorial section they
 * last scrolled past. `usePersistence(null)` never calls either function.
 *
 * ## Version 6 (PBUI-DATALAB-WORKBENCH-1, design §13)
 *
 * The spatial half of the envelope is the workbench document itself, as
 * canonical protobuf JSON — the same bytes a Go server would accept — plus
 * the navigation metadata Datalab keeps above it and the workspace on
 * screen. A version-5 payload is MIGRATED rather than discarded (DR-73):
 * `migrateV5.ts` transcribes the local tree into the protocol's.
 *
 * Load order (§13.2): parse the envelope → validate the world → parse the
 * workbench structurally → hydrate stubs for the world's documents → merge
 * this build's pinned stages → validate against the catalog → reconcile
 * navigation. The product constructs its workbench from the FINAL accepted
 * state; nothing renders a default and then replaces it.
 */

/** The application's key. Embedded instances pass null and persist nothing. */
export const WORKBENCH_KEY = "datadrop-workbench";
/** Bumped when a shape change makes older payloads unreadable. 6: the workbench document replaces the local layout. */
export const PERSISTENCE_VERSION = 6;

export type PersistedWorld = Pick<
  WorldState,
  "docs" | "docOrder" | "activeDocId" | "snapshots" | "snapshotOrder" | "pins" | "watch"
>;

export interface PersistedDatalab {
  version: typeof PERSISTENCE_VERSION;
  world: PersistedWorld;
  /** The workbench document, canonical protobuf JSON. */
  workbench: unknown;
  navigation: PersistedNavigation;
  /** The workspace on screen when this was written. */
  workspaceId: string;
}

/** What `load` hands the product: the world to preload and the seed to build the workbench from. */
export interface RestoredDatalab {
  world: PersistedWorld;
  seed: DatalabSeed;
}

/**
 * The credential guard, re-exported from where it now lives (`model/secrets`),
 * so this file still reads as the one that guards durable storage.
 */
export { findSecrets } from "../model/secrets";
import { findSecrets } from "../model/secrets";

/* -------------------------------------------------------------- shapes -- */

function isGraphicDocument(value: unknown): value is GraphicDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<GraphicDocument>;
  return (
    document.format === "datadrop.gog.document" &&
    document.version === 2 &&
    typeof document.id === "string" &&
    typeof document.name === "string" &&
    !!document.sources &&
    !!document.transforms &&
    !!document.views &&
    typeof document.rootView === "string" &&
    !!document.parameters
  );
}

function isWorld(value: unknown): value is PersistedWorld {
  const world = value as Partial<PersistedWorld>;
  if (!world || typeof world !== "object") return false;
  if (typeof world.docs !== "object" || !world.docs || !Array.isArray(world.docOrder)) return false;
  if (!Object.values(world.docs).every(isGraphicDocument)) return false;
  return (
    typeof world.snapshots === "object" &&
    !!world.snapshots &&
    Object.values(world.snapshots).every(
      (snapshot) =>
        !!snapshot &&
        typeof snapshot === "object" &&
        isGraphicDocument((snapshot as { document?: unknown }).document),
    )
  );
}

function isChrome(value: unknown): value is StageDefinition["chrome"] {
  const chrome = value as Partial<StageDefinition["chrome"]>;
  return (
    !!chrome &&
    typeof chrome.masthead === "boolean" &&
    typeof chrome.workspaces === "boolean" &&
    typeof chrome.stageBar === "boolean"
  );
}

function isStageDefinition(value: unknown): value is StageDefinition {
  const stage = value as Partial<StageDefinition>;
  return (
    !!stage &&
    typeof stage.id === "string" &&
    typeof stage.name === "string" &&
    (stage.apps === null ||
      (Array.isArray(stage.apps) && stage.apps.every((id) => typeof id === "string"))) &&
    isChrome(stage.chrome)
  );
}

function isWorkspaceMeta(value: unknown): value is WorkspaceMeta {
  const meta = value as Partial<WorkspaceMeta>;
  return (
    !!meta &&
    typeof meta.stageId === "string" &&
    typeof meta.pinned === "boolean" &&
    (meta.apps === null ||
      (Array.isArray(meta.apps) && meta.apps.every((id) => typeof id === "string")))
  );
}

function isNavigation(value: unknown): value is PersistedNavigation {
  const nav = value as Partial<PersistedNavigation>;
  if (!nav || typeof nav !== "object") return false;
  if (!Array.isArray(nav.stages) || !nav.stages.every(isStageDefinition)) return false;
  if (
    !nav.workspace ||
    typeof nav.workspace !== "object" ||
    !Object.values(nav.workspace).every(isWorkspaceMeta)
  )
    return false;
  return (
    !!nav.rememberedWorkspaceByStage &&
    typeof nav.rememberedWorkspaceByStage === "object" &&
    Object.values(nav.rememberedWorkspaceByStage).every((id) => typeof id === "string")
  );
}

/* ------------------------------------------------------------- migrate -- */

/**
 * Bring a stored payload to the current envelope, or null when it cannot be
 * read. Version 6 passes through; version 5 is transcribed; anything else —
 * including the pre-canonical versions 1 to 4 — is refused.
 */
export function migrate(raw: unknown): unknown | null {
  if (!raw || typeof raw !== "object") return null;
  const version = (raw as { version?: unknown }).version;
  if (version === PERSISTENCE_VERSION) return raw;
  if (version !== 5) return null;
  const legacy = raw as { world?: unknown; layout?: unknown };
  if (!isV5Layout(legacy.layout)) return null;
  const migrated = migrateV5Layout(legacy.layout);
  return {
    version: PERSISTENCE_VERSION,
    // Validated by `validate`, like a version-6 world; the migrator only transcribes the layout.
    world: legacy.world as PersistedWorld,
    workbench: toJson(WorkbenchDocumentSchema, migrated.document),
    navigation: migrated.navigation,
    workspaceId: migrated.workspaceId,
  } satisfies PersistedDatalab;
}

/* ------------------------------------------------------------ validate -- */

/**
 * Everything between "some JSON" and "a seed the product can build from"
 * (§13.2). Returns null for anything unusable; the caller falls back to the
 * default layout, never to a blank screen.
 */
export function validate(input: unknown, apps: ManifestCatalog): RestoredDatalab | null {
  const raw = migrate(input);
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<PersistedDatalab>;
  if (data.version !== PERSISTENCE_VERSION) return null;
  if (!isWorld(data.world)) return null;
  if (!isNavigation(data.navigation)) return null;
  if (typeof data.workspaceId !== "string") return null;

  // Structural parse first (no catalog yet): a layout naming a retired
  // application must survive to the merge, where its pinned pages are
  // replaced from code, and only THEN be judged.
  const parsed = parseWorkbenchDocument(JSON.stringify(data.workbench));
  if (!parsed.ok) return null;
  let document: WorkbenchDocument = parsed.document;

  // Hydrate before validating (design §9.7 of the stabilization ticket): a
  // stub the world's documents would contribute is added now, so a layout
  // bound to a document whose stub was never persisted is repaired.
  const world = data.world;
  const { mutations } = documentSourceMutations(
    document,
    graphicDocumentSource(() => world),
  );
  if (mutations.length > 0) document = applyMutations(document, mutations);

  const merged = mergePinned(
    defaultSeed({ apps }),
    { document, navigation: data.navigation, workspaceId: data.workspaceId },
    { apps },
  );
  if (!merged) return null;
  return { world, seed: merged };
}

/* --------------------------------------------------------- save / load -- */

export function save(
  key: string,
  world: WorldState,
  workbench: { document: WorkbenchDocument; workspaceId: string },
  navigation: NavigationState,
): void {
  const payload: PersistedDatalab = {
    version: PERSISTENCE_VERSION,
    world: {
      docs: world.docs,
      docOrder: world.docOrder,
      activeDocId: world.activeDocId,
      snapshots: world.snapshots,
      snapshotOrder: world.snapshotOrder,
      pins: world.pins,
      watch: world.watch,
      // Deliberately not the trace: a session-scoped teaching surface.
    },
    workbench: toJson(WorkbenchDocumentSchema, workbench.document),
    // The durable subset ONLY (DR-69): the import dialog, the launcher, a
    // rename in progress and the first-sign-in marker never reach storage.
    navigation: durableNavigation(navigation),
    workspaceId: workbench.workspaceId,
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

export function load(key: string, apps: ManifestCatalog): RestoredDatalab | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const valid = validate(parsed, apps);
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
