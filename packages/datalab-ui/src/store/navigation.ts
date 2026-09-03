import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ImportTarget } from "../pbui/verbs";
import { WORK_STAGE_ID } from "./stageIds";

/**
 * Datalab's navigation metadata: what sits ABOVE the workbench document
 * (design §3.2, §5.3, §15.2).
 *
 * Workbench core owns every workspace, view, placement and split tree. What
 * it does not know is which STAGE a workspace belongs to, whether it was
 * defined in code, which applications it may offer, and which workspace each
 * stage was last on — that is product navigation, and it lives here, keyed
 * by workspace id. The transient UI state the old layout slice carried
 * (the import dialog, the export notice, an inline rename, the launcher
 * invocation, the first-sign-in marker) stays here too, for the reasons each
 * field states.
 *
 * ## No current workspace pointer
 *
 * The old slice stored `currentSpaceId` twice and needed a test walking every
 * reducer to keep the two in step (DR-60). The canonical current workspace is
 * now the core's `session.workspaceId`, and the current STAGE is derived from
 * it through `workspace[id].stageId` — `currentStageId(state, workspaceId)`
 * below. This slice remembers where each stage was last, and nothing else.
 */

export type StageId = string;
export type WorkspaceId = string;
export type AppId = string;

/** Which parts of the shell chrome a stage shows (DATADROP-8 DR-59). */
export interface StageChrome {
  /** The DATALAB wordmark. */
  masthead: boolean;
  /** The workspace strip. False for a stage that has exactly one workspace. */
  workspaces: boolean;
  /** The stage switcher in the top right. Almost always true. */
  stageBar: boolean;
}

/**
 * A stage: a named set of workspaces, an application allow-list, and chrome.
 *
 * A DEFINITION, not a memory: code-defined stages are taken wholesale from
 * source on every load (`pinned`), and `audience` is never read from storage
 * (DR-94). The one memory a stage has — its last workspace — is in
 * `rememberedWorkspaceByStage`, apart from the definition, so the two cannot
 * be treated alike by accident.
 */
export interface StageDefinition {
  id: StageId;
  name: string;
  /** Which applications this stage offers, or null for every registered one. A rendering constraint, never a mounting one (DR-61). */
  apps: AppId[] | null;
  chrome: StageChrome;
  /** Defined in code: re-created on every load, cannot be deleted or renamed. */
  pinned?: boolean;
  /** Who may see this stage in the switcher (DR-94). Absent means `any`. A rendering constraint, not a security boundary. */
  audience?: "any" | "anonymous" | "authenticated";
}

/** What Datalab knows about one workbench workspace beyond what the core holds. */
export interface WorkspaceMeta {
  stageId: StageId;
  /** Defined in code: replaced from source on every load, cannot be renamed or deleted. */
  pinned: boolean;
  /** Narrows the stage's allow-list further, or null to inherit it. */
  apps: AppId[] | null;
}

/** The import dialog, while it is open (DATADROP-8 DR-69). Never persisted. */
export interface PendingImport {
  target: ImportTarget;
  /** Text read from the clipboard, or "" when the read failed or was junk. */
  prefill: string;
  /** Where the prefill came from, for the line above the text area. */
  from: "clipboard" | "template" | null;
}

/** Why the launcher modal is open (DATALAB-VIEW-001 design-doc/02 §9). Never persisted. */
export type LauncherInvocation =
  | { kind: "fill-launcher"; placementId: string; prefill?: string }
  | { kind: "replace"; placementId: string }
  | { kind: "navigate"; activePlacementId: string | null };

export interface ExportNotice {
  ok: boolean;
  title: string;
  body: string;
}

export interface NavigationState {
  stages: StageDefinition[];
  /** Every workspace the document holds, by id. Repaired against the document by `reconcileNavigation`. */
  workspace: Record<WorkspaceId, WorkspaceMeta>;
  /** The workspace each stage was last on, so switching away and back returns you where you were (DR-60). */
  rememberedWorkspaceByStage: Record<StageId, WorkspaceId>;
  /** Non-null while an import dialog is open. Never persisted. */
  pendingImport?: PendingImport | null;
  /** Why the launcher modal is open, or null. Never persisted. */
  launcher?: LauncherInvocation | null;
  /** The result of the last export, until it is dismissed. Never persisted. */
  notice?: ExportNotice | null;
  /** The tile placement or workspace whose name is being edited, or null. Never persisted. */
  renamingId?: string | null;
  /** This browser has just completed a first sign-in (DR-96). Never persisted. */
  justSignedUp?: boolean;
}

/** The durable subset: what persistence writes and a bundle of navigation carries. */
export interface PersistedNavigation {
  stages: StageDefinition[];
  workspace: Record<WorkspaceId, WorkspaceMeta>;
  rememberedWorkspaceByStage: Record<StageId, WorkspaceId>;
}

export function durableNavigation(state: NavigationState): PersistedNavigation {
  return {
    stages: state.stages,
    workspace: state.workspace,
    rememberedWorkspaceByStage: state.rememberedWorkspaceByStage,
  };
}

export const emptyNavigation = (): NavigationState => ({
  stages: [],
  workspace: {},
  rememberedWorkspaceByStage: {},
});

/* ------------------------------------------------------------- queries -- */

export function stageOf(state: PersistedNavigation, stageId: StageId): StageDefinition | undefined {
  return state.stages.find((stage) => stage.id === stageId);
}

/** The metadata of a workspace, defaulting an unknown one into the work stage (design §8.3). */
export function metaOf(state: PersistedNavigation, workspaceId: WorkspaceId): WorkspaceMeta {
  return state.workspace[workspaceId] ?? { stageId: WORK_STAGE_ID, pinned: false, apps: null };
}

/** The stage the selected workspace belongs to — the derived current stage (design §5.2). */
export function currentStageId(state: PersistedNavigation, workspaceId: WorkspaceId): StageId {
  const stageId = metaOf(state, workspaceId).stageId;
  return state.stages.some((stage) => stage.id === stageId)
    ? stageId
    : (state.stages[0]?.id ?? WORK_STAGE_ID);
}

/** The workspaces of one stage, in DOCUMENT order (the caller passes the document's workspace ids). */
export function workspacesOfStage(
  state: PersistedNavigation,
  workspaceIds: readonly WorkspaceId[],
  stageId: StageId,
): WorkspaceId[] {
  return workspaceIds.filter((id) => metaOf(state, id).stageId === stageId);
}

/**
 * The workspace a stage switch lands on: the remembered one when it still
 * exists in that stage, else the stage's first (design §5.2).
 */
export function landingWorkspaceOf(
  state: PersistedNavigation,
  workspaceIds: readonly WorkspaceId[],
  stageId: StageId,
): WorkspaceId | null {
  const own = workspacesOfStage(state, workspaceIds, stageId);
  const remembered = state.rememberedWorkspaceByStage[stageId];
  if (remembered && own.includes(remembered)) return remembered;
  return own[0] ?? null;
}

/**
 * Make the metadata true for a document (design §8.3, §11.3):
 *  - every workspace the document holds has metadata (unknown ⇒ work stage);
 *  - no metadata names a workspace the document lacks;
 *  - a workspace naming a stage that no longer exists joins work;
 *  - a stage's remembered workspace exists and belongs to it, else its first.
 *
 * Pure, and returns the SAME object when nothing needed repair, so a
 * subscriber comparing identity does not wake for a reconcile that found
 * nothing to do.
 */
export function reconcileNavigation<S extends PersistedNavigation>(
  state: S,
  workspaceIds: readonly WorkspaceId[],
): S {
  const known = new Set(state.stages.map((stage) => stage.id));
  const fallbackStage = known.has(WORK_STAGE_ID)
    ? WORK_STAGE_ID
    : (state.stages[0]?.id ?? WORK_STAGE_ID);
  let changed = false;
  const workspace: Record<WorkspaceId, WorkspaceMeta> = {};
  for (const id of workspaceIds) {
    const meta = state.workspace[id];
    if (!meta) {
      workspace[id] = { stageId: fallbackStage, pinned: false, apps: null };
      changed = true;
    } else if (!known.has(meta.stageId)) {
      workspace[id] = { ...meta, stageId: fallbackStage };
      changed = true;
    } else {
      workspace[id] = meta;
    }
  }
  if (Object.keys(state.workspace).length !== Object.keys(workspace).length) changed = true;
  const remembered: Record<StageId, WorkspaceId> = {};
  for (const stage of state.stages) {
    const own = workspaceIds.filter((id) => workspace[id]?.stageId === stage.id);
    const current = state.rememberedWorkspaceByStage[stage.id];
    const next = current && own.includes(current) ? current : own[0];
    if (next) remembered[stage.id] = next;
    if (next !== current) changed = true;
  }
  if (Object.keys(state.rememberedWorkspaceByStage).length !== Object.keys(remembered).length)
    changed = true;
  return changed ? { ...state, workspace, rememberedWorkspaceByStage: remembered } : state;
}

/* --------------------------------------------------------------- slice -- */

export const navigationSlice = createSlice({
  name: "navigation",
  initialState: emptyNavigation(),
  reducers: {
    /** Record (or replace) what Datalab knows about one workspace. Metadata only: the workspace itself is the core's. */
    putWorkspace(state, action: PayloadAction<{ id: WorkspaceId; meta: WorkspaceMeta }>) {
      state.workspace[action.payload.id] = action.payload.meta;
    },
    forgetWorkspace(state, action: PayloadAction<WorkspaceId>) {
      delete state.workspace[action.payload];
      for (const [stageId, workspaceId] of Object.entries(state.rememberedWorkspaceByStage)) {
        if (workspaceId === action.payload) delete state.rememberedWorkspaceByStage[stageId];
      }
    },
    /** A stage's memory of where it was; written after the core accepted the selection, never before. */
    remember(state, action: PayloadAction<{ stageId: StageId; workspaceId: WorkspaceId }>) {
      state.rememberedWorkspaceByStage[action.payload.stageId] = action.payload.workspaceId;
    },
    /** Narrow (or, with null, un-narrow) one workspace's application list. */
    setWorkspaceApps(
      state,
      action: PayloadAction<{ id: WorkspaceId; apps: readonly AppId[] | null }>,
    ) {
      const meta = state.workspace[action.payload.id];
      if (!meta) return;
      meta.apps = action.payload.apps === null ? null : [...action.payload.apps];
    },
    /** Move a workspace between stages. The controller has already checked pinning and the source stage's count. */
    moveWorkspace(state, action: PayloadAction<{ id: WorkspaceId; stageId: StageId }>) {
      const meta = state.workspace[action.payload.id];
      if (!meta || !state.stages.some((stage) => stage.id === action.payload.stageId)) return;
      const from = meta.stageId;
      meta.stageId = action.payload.stageId;
      if (state.rememberedWorkspaceByStage[from] === action.payload.id)
        delete state.rememberedWorkspaceByStage[from];
    },
    addStage(state, action: PayloadAction<StageDefinition>) {
      if (state.stages.some((stage) => stage.id === action.payload.id)) return;
      state.stages.push(action.payload);
    },
    /** Remove a stage DEFINITION and its memory. Its workspaces are the controller's to delete through the core first. */
    removeStage(state, action: PayloadAction<StageId>) {
      const stage = state.stages.find((candidate) => candidate.id === action.payload);
      if (!stage || stage.pinned || state.stages.length < 2) return;
      state.stages = state.stages.filter((candidate) => candidate.id !== action.payload);
      delete state.rememberedWorkspaceByStage[action.payload];
    },
    renameStage(state, action: PayloadAction<{ stageId: StageId; name: string }>) {
      const stage = state.stages.find((candidate) => candidate.id === action.payload.stageId);
      if (stage && !stage.pinned && action.payload.name) stage.name = action.payload.name;
    },
    /** Repair against the document's workspace ids (see `reconcileNavigation`). */
    reconcile(state, action: PayloadAction<readonly WorkspaceId[]>) {
      const next = reconcileNavigation(
        {
          stages: state.stages,
          workspace: state.workspace,
          rememberedWorkspaceByStage: state.rememberedWorkspaceByStage,
        },
        action.payload,
      );
      state.workspace = next.workspace;
      state.rememberedWorkspaceByStage = next.rememberedWorkspaceByStage;
    },
    /** Replace the durable part wholesale — a restore, a remote adoption. Transient fields are cleared: their targets may be gone. */
    replaceNavigation(state, action: PayloadAction<PersistedNavigation>) {
      state.stages = action.payload.stages;
      state.workspace = action.payload.workspace;
      state.rememberedWorkspaceByStage = action.payload.rememberedWorkspaceByStage;
      state.pendingImport = null;
      state.launcher = null;
      state.renamingId = null;
    },

    /* -------------------------------------------------- transient UI -- */

    /** Start (or, with null, stop) editing a tile's or workspace's name. */
    beginRename(state, action: PayloadAction<string | null>) {
      state.renamingId = action.payload;
    },
    openLauncher(state, action: PayloadAction<LauncherInvocation>) {
      state.launcher = action.payload;
    },
    closeLauncher(state) {
      state.launcher = null;
    },
    /** Record that this browser has just completed a first sign-in (DR-96). */
    setJustSignedUp(state, action: PayloadAction<boolean>) {
      state.justSignedUp = action.payload;
    },
    showNotice(state, action: PayloadAction<ExportNotice>) {
      state.notice = action.payload;
    },
    dismissNotice(state) {
      state.notice = null;
    },
    openImport(state, action: PayloadAction<PendingImport>) {
      state.pendingImport = action.payload;
    },
    closeImport(state) {
      state.pendingImport = null;
    },
  },
});

export const navigationActions = navigationSlice.actions;
