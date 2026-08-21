import { useSyncExternalStore } from "react";
import type { DispatchIntent, LoadedProgram, ProgramErrorCode, ProgramErrorPayload, ProgramPhase, UIEventRef, UINode } from "./contracts";

/**
 * The instance registry: what is running, what happened to it, and which
 * one we are talking about (guide §4.1, D1).
 *
 * Every `useProgramInstance` publishes into it — status, meta, trees, error,
 * timings, a control handle — and records structured entries into ONE global
 * timeline ring. Devtools (inspector, REPL, timeline, playground) read from
 * it; nothing else in the sandbox does. Keyed by VIEW id, like program state,
 * so two linked placements of one view are one instance.
 *
 * The selection ("the selected sandbox") lives here rather than in any tile
 * or React context, so a singleton tile anywhere in the layout can follow it.
 */

export interface InstanceTimings {
  loadMs?: number;
  lastRenderMs?: number;
  lastEventMs?: number;
  renders: number;
  events: number;
  errors: number;
  timeouts: number;
}

/** What a devtool may do to a mounted instance. Registered by the hook; null once unmounted. */
export interface InstanceHandle {
  fire(widgetId: string, ref: UIEventRef, payload?: unknown): void;
  /** Back to `initialState`. */
  reset(): void;
  /** Re-run render without a state change — after an injection through the REPL. */
  rerender(): void;
}

export interface InstanceSnapshot {
  viewId: string;
  /** Every placement that mounted this view; the snapshot is dropped when the last one unmounts. */
  placementIds: string[];
  programId: string | null;
  version: number;
  /** Null while loading, after a failed load, or when there is no program. */
  instanceId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  meta: LoadedProgram | null;
  trees: Record<string, UINode>;
  error: ProgramErrorPayload | null;
  timings: InstanceTimings;
  handle: InstanceHandle | null;
  /** A node path (`root.0.2`) a devtool wants the tile to highlight; null for none. */
  highlight: string | null;
}

export type TimelineEntryBody =
  | { kind: "load"; durationMs: number }
  | { kind: "render"; widgetId: string; durationMs: number; nodeCount: number }
  | { kind: "event"; widgetId: string; handler: string; args: unknown; durationMs: number; intents: DispatchIntent[] }
  | { kind: "intent"; intent: DispatchIntent; outcome: "applied" | "ignored" | "performed" | "rejected"; detail?: string }
  | { kind: "error"; phase: ProgramPhase; code: ProgramErrorCode; message: string }
  | { kind: "evaluate"; code: string; durationMs: number; ok: boolean; summary: string }
  | { kind: "note"; text: string };

export type TimelineEntry = {
  seq: number;
  at: string;
  viewId: string;
  programId: string;
  version: number;
  instanceId: string | null;
} & TimelineEntryBody;

/** `Omit` would collapse the union; spell the input as the shared head plus the body. */
export type TimelineEntryInput = { viewId: string; programId: string; version: number; instanceId: string | null } & TimelineEntryBody;

export interface InstanceRegistry {
  get(viewId: string): InstanceSnapshot | null;
  /** Every known snapshot; the same array until something changes. */
  all(): InstanceSnapshot[];
  selectedViewId(): string | null;
  select(viewId: string | null): void;
  /** Oldest first; the same array until an entry is recorded or the ring is cleared. */
  timeline(): readonly TimelineEntry[];
  clearTimeline(): void;
  subscribe(listener: () => void): () => void;

  /* ---- written by the host loop ---------------------------------------- */

  /** A placement mounted this view. Creates the snapshot when it is the first. */
  mount(viewId: string, placementId: string): void;
  /** A placement unmounted; the last one drops the snapshot (and its handle). */
  unmount(viewId: string, placementId: string): void;
  /** Merge fields into a snapshot. A patch that changes nothing (by identity) does not notify. */
  publish(viewId: string, patch: Partial<Omit<InstanceSnapshot, "viewId" | "placementIds">>): void;
  record(entry: TimelineEntryInput): TimelineEntry;
}

export interface CreateInstanceRegistryOptions {
  /** Timeline ring size; default 500. */
  keep?: number;
  now?(): string;
}

export const EMPTY_TIMINGS: InstanceTimings = Object.freeze({ renders: 0, events: 0, errors: 0, timeouts: 0 }) as InstanceTimings;

function emptySnapshot(viewId: string): InstanceSnapshot {
  return {
    viewId,
    placementIds: [],
    programId: null,
    version: 0,
    instanceId: null,
    status: "idle",
    meta: null,
    trees: {},
    error: null,
    timings: EMPTY_TIMINGS,
    handle: null,
    highlight: null,
  };
}

export function createInstanceRegistry(options: CreateInstanceRegistryOptions = {}): InstanceRegistry {
  const keep = options.keep ?? 500;
  const now = options.now ?? (() => new Date().toISOString());
  const snapshots = new Map<string, InstanceSnapshot>();
  let allCache: InstanceSnapshot[] | null = null;
  let timeline: TimelineEntry[] = [];
  let seq = 0;
  let selected: string | null = null;
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) listener();
  }

  function set(viewId: string, next: InstanceSnapshot | null) {
    if (next) snapshots.set(viewId, next);
    else snapshots.delete(viewId);
    allCache = null;
    emit();
  }

  return {
    get: (viewId) => snapshots.get(viewId) ?? null,
    all() {
      if (!allCache) allCache = [...snapshots.values()];
      return allCache;
    },
    selectedViewId: () => selected,
    select(viewId) {
      if (viewId === selected) return;
      selected = viewId;
      emit();
    },
    timeline: () => timeline,
    clearTimeline() {
      if (timeline.length === 0) return;
      timeline = [];
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    mount(viewId, placementId) {
      const current = snapshots.get(viewId) ?? emptySnapshot(viewId);
      if (current.placementIds.includes(placementId)) return;
      set(viewId, { ...current, placementIds: [...current.placementIds, placementId] });
    },

    unmount(viewId, placementId) {
      const current = snapshots.get(viewId);
      if (!current) return;
      const placementIds = current.placementIds.filter((id) => id !== placementId);
      if (placementIds.length === 0) {
        // A selection pointing at a gone instance is cleared, so a singleton
        // that follows it shows its empty state rather than a stale target.
        if (selected === viewId) selected = null;
        set(viewId, null);
        return;
      }
      set(viewId, { ...current, placementIds });
    },

    publish(viewId, patch) {
      const current = snapshots.get(viewId) ?? emptySnapshot(viewId);
      let changed = false;
      for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
        if (!Object.is(current[key], patch[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      set(viewId, { ...current, ...patch });
    },

    record(entry) {
      seq += 1;
      const full = { seq, at: now(), ...entry } as TimelineEntry;
      timeline = timeline.length >= keep ? [...timeline.slice(timeline.length - keep + 1), full] : [...timeline, full];
      emit();
      return full;
    },
  };
}

/** Subscribe a component to a slice of the registry; the selector must return a stable reference for an unchanged slice. */
export function useInstances<T>(registry: InstanceRegistry, selector: (registry: InstanceRegistry) => T): T {
  return useSyncExternalStore(
    registry.subscribe,
    () => selector(registry),
    () => selector(registry),
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function short(value: unknown, max = 80): string {
  let text: string | undefined;
  try {
    text = value === undefined ? "undefined" : JSON.stringify(value);
  } catch {
    text = undefined;
  }
  return truncate(text ?? String(value), max);
}

/** One line per entry — the script tile's details log and the timeline tile's rows use the same words. */
export function formatEntry(entry: TimelineEntry): string {
  switch (entry.kind) {
    case "load":
      return `loaded in ${entry.durationMs.toFixed(1)} ms`;
    case "render":
      return `render ${entry.widgetId} · ${entry.nodeCount} nodes · ${entry.durationMs.toFixed(1)} ms`;
    case "event":
      return `event ${entry.handler}${entry.args === undefined ? "" : ` ${short(entry.args)}`} · ${entry.durationMs.toFixed(1)} ms → ${entry.intents.length} intent${entry.intents.length === 1 ? "" : "s"}`;
    case "intent":
      if (entry.intent.scope === "verb") {
        return `verb ${entry.intent.verb.kind} → ${entry.outcome}${entry.detail ? `: ${entry.detail}` : ""}`;
      }
      return `${entry.intent.actionType}${entry.intent.payload === undefined ? "" : ` ${short(entry.intent.payload)}`} · ${entry.outcome}${entry.detail ? `: ${entry.detail}` : ""}`;
    case "error":
      return `${entry.phase} · ${entry.code} · ${entry.message}`;
    case "evaluate":
      return `${truncate(entry.code.replace(/\s+/g, " ").trim(), 60)} → ${entry.summary} · ${entry.durationMs.toFixed(1)} ms`;
    case "note":
      return entry.text;
  }
}
