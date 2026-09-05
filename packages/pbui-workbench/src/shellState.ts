import { useSyncExternalStore } from "react";
import type { Choice, WorkbenchCommand } from "@hyperslop-systems/workbench-core";

/**
 * The shell's transient state (guide §16.7, S5): one browser-local store for
 * the dialogs and modes that are this tab's business and never the layout's.
 * Nothing here is a command, nothing is persisted, and the engine never
 * reads it. Placement mode stays its own controller because its aiming
 * lifecycle is asynchronous.
 */
export interface WorkbenchShellState {
  /** The launcher, and the tile it was invoked FROM when per-pane ("show something else in THIS tile"). */
  readonly launcher: { readonly from: string | null } | null;
  readonly rebalanceOpen: boolean;
  /** Connect-management mode (PBUI-LINK-1 Phase 3). */
  readonly linkModeOpen: boolean;
  /** A `show` that resolved to several targets awaits the user's choice; the command is re-executed with the chosen candidate. */
  readonly showChooser: { readonly command: Extract<WorkbenchCommand, { kind: "show" }>; readonly choices: readonly Choice[] } | null;
  /** The relation palette is open for a destination port (PBUI-LINK-1 Phase 6). */
  readonly relationPalette: { readonly destination: string; readonly source?: string } | null;
}

export type WorkbenchShellAction =
  | { kind: "launcher.open"; from?: string }
  | { kind: "launcher.close" }
  | { kind: "rebalance.open" }
  | { kind: "rebalance.close" }
  | { kind: "link.mode.open" }
  | { kind: "link.mode.close" }
  | { kind: "show.chooser.open"; command: Extract<WorkbenchCommand, { kind: "show" }>; choices: readonly Choice[] }
  | { kind: "show.chooser.close" }
  | { kind: "relation.palette.open"; destination: string; source?: string }
  | { kind: "relation.palette.close" };

export interface WorkbenchShellStore {
  getState(): WorkbenchShellState;
  subscribe(listener: () => void): () => void;
  dispatch(action: WorkbenchShellAction): void;
}

const INITIAL: WorkbenchShellState = { launcher: null, rebalanceOpen: false, linkModeOpen: false, showChooser: null, relationPalette: null };

function reduce(state: WorkbenchShellState, action: WorkbenchShellAction): WorkbenchShellState {
  switch (action.kind) {
    case "launcher.open":
      return { ...state, launcher: { from: action.from ?? null } };
    case "launcher.close":
      return state.launcher ? { ...state, launcher: null } : state;
    case "rebalance.open":
      return state.rebalanceOpen ? state : { ...state, rebalanceOpen: true };
    case "rebalance.close":
      return state.rebalanceOpen ? { ...state, rebalanceOpen: false } : state;
    case "link.mode.open":
      return state.linkModeOpen ? state : { ...state, linkModeOpen: true };
    case "link.mode.close":
      return state.linkModeOpen ? { ...state, linkModeOpen: false } : state;
    case "show.chooser.open":
      return { ...state, showChooser: { command: action.command, choices: action.choices } };
    case "show.chooser.close":
      return state.showChooser ? { ...state, showChooser: null } : state;
    case "relation.palette.open":
      return { ...state, relationPalette: { destination: action.destination, ...(action.source ? { source: action.source } : {}) } };
    case "relation.palette.close":
      return state.relationPalette ? { ...state, relationPalette: null } : state;
  }
}

export function createShellStore(): WorkbenchShellStore {
  let state = INITIAL;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(action) {
      const next = reduce(state, action);
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener();
    },
  };
}

export function useShellState<T>(store: WorkbenchShellStore, selector: (state: WorkbenchShellState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

/** Is this a shell action rather than a semantic command? The routing question a product's verb router asks. */
export function isWorkbenchShellAction(value: unknown): value is WorkbenchShellAction {
  if (!value || typeof value !== "object") return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === "string" && SHELL_ACTION_KINDS.has(kind);
}

const SHELL_ACTION_KINDS = new Set<string>(["launcher.open", "launcher.close", "rebalance.open", "rebalance.close", "link.mode.open", "link.mode.close", "show.chooser.open", "show.chooser.close", "relation.palette.open", "relation.palette.close"]);
