import { useSyncExternalStore } from "react";
import {
  PLOT_HOST_PROGRAM,
  runPlotScript,
  toProgramError,
  type ProgramEngine,
  type ProgramErrorPayload,
  type ScriptLog,
  type ScriptResult,
  type ScriptResultLimits,
  type ScriptResultProblem,
} from "@hyperslop-systems/pbui-sandbox";

/** What the tiles read for one script. */
export interface ScriptRunState {
  /** `idle` before the first run; `running` while one is in flight. */
  status: "idle" | "running" | "ok" | "invalid" | "error";
  /** The last result that passed the guard. Survives a failing run (design §8.1). */
  lastGood: ScriptResult | null;
  /** The source `lastGood` came from, so a tile can say the plot is stale. */
  lastGoodSource: string | null;
  problem: ScriptResultProblem | null;
  error: ProgramErrorPayload | null;
  logs: ScriptLog[];
  /** Duration of the last completed run. */
  ms: number | null;
  /** Monotonic per script; the plot tile keys its stale chip on it. */
  runCount: number;
}

export const IDLE_RUN: ScriptRunState = { status: "idle", lastGood: null, lastGoodSource: null, problem: null, error: null, logs: [], ms: null, runCount: 0 };

export interface PlotScriptRunner {
  getState(id: string): ScriptRunState;
  subscribe(listener: () => void): () => void;
  /** Run now. Resolves when this run has been published or discarded as stale. */
  run(id: string, source: string): Promise<void>;
  /** Run after a pause; a newer schedule or run cancels the pending one. */
  schedule(id: string, source: string): void;
  /** Forget a script: its instance, its pending run, its state. */
  dispose(id: string): Promise<void>;
  /** Every instance gone; the engine is the caller's to terminate. */
  disposeAll(): Promise<void>;
}

export interface CreatePlotScriptRunnerOptions {
  engine: ProgramEngine;
  /** Milliseconds after the last `schedule` before the run starts; default 400. */
  debounceMs?: number;
  limits?: ScriptResultLimits;
  /** Called after every run that publishes, with the source that ran. The document write hangs here. */
  onRan?(id: string, source: string, state: ScriptRunState): void;
}

const instanceIdOf = (id: string) => `plot-script:${id}`;

/**
 * One runner per workbench: it owns a sandbox instance per script (loaded
 * lazily with `PLOT_HOST_PROGRAM`), the debounce timers, and the per-script
 * run state.
 *
 * Two rules from the design (§8.1), both tested:
 *   - a run that started earlier can resolve later; each run carries a
 *     ticket and only the newest ticket may publish;
 *   - a failing run never clears `lastGood` — a syntax error appears on every
 *     keystroke while the author is mid-word.
 */
export function createPlotScriptRunner(options: CreatePlotScriptRunnerOptions): PlotScriptRunner {
  const { engine, debounceMs = 400 } = options;
  const states = new Map<string, ScriptRunState>();
  const loaded = new Map<string, Promise<void>>();
  const tickets = new Map<string, number>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };
  const publish = (id: string, patch: Partial<ScriptRunState>) => {
    states.set(id, { ...(states.get(id) ?? IDLE_RUN), ...patch });
    emit();
  };

  const ensureLoaded = (id: string): Promise<void> => {
    let pending = loaded.get(id);
    if (!pending) {
      pending = engine.load({ instanceId: instanceIdOf(id), programId: "plot-script-host", source: PLOT_HOST_PROGRAM }).then(() => undefined);
      loaded.set(id, pending);
      // A failed load must not poison every later run.
      pending.catch(() => loaded.delete(id));
    }
    return pending;
  };

  const run = async (id: string, source: string): Promise<void> => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    const ticket = (tickets.get(id) ?? 0) + 1;
    tickets.set(id, ticket);
    publish(id, { status: "running" });

    let outcome: Awaited<ReturnType<typeof runPlotScript>>;
    try {
      await ensureLoaded(id);
      outcome = await runPlotScript(engine, { instanceId: instanceIdOf(id), source, ...(options.limits ? { limits: options.limits } : {}) });
    } catch (error) {
      outcome = { status: "error", error, logs: [], ms: 0 };
    }
    // A newer run has started since; this result is stale and says nothing.
    if (tickets.get(id) !== ticket) return;

    const previous = states.get(id) ?? IDLE_RUN;
    const runCount = previous.runCount + 1;
    let next: ScriptRunState;
    if (outcome.status === "ok") {
      next = { status: "ok", lastGood: outcome.result, lastGoodSource: source, problem: null, error: null, logs: outcome.logs, ms: outcome.ms, runCount };
    } else if (outcome.status === "invalid") {
      next = { ...previous, status: "invalid", problem: outcome.problem, error: null, logs: outcome.logs, ms: outcome.ms, runCount };
    } else {
      next = { ...previous, status: "error", problem: null, error: toProgramError(outcome.error, "event"), logs: outcome.logs, ms: outcome.ms, runCount };
    }
    states.set(id, next);
    emit();
    options.onRan?.(id, source, next);
  };

  return {
    getState: (id) => states.get(id) ?? IDLE_RUN,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    run,
    schedule(id, source) {
      const timer = timers.get(id);
      if (timer) clearTimeout(timer);
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          void run(id, source);
        }, debounceMs),
      );
    },
    async dispose(id) {
      const timer = timers.get(id);
      if (timer) clearTimeout(timer);
      timers.delete(id);
      tickets.set(id, (tickets.get(id) ?? 0) + 1);
      states.delete(id);
      if (loaded.delete(id)) await engine.dispose(instanceIdOf(id)).catch(() => false);
      emit();
    },
    async disposeAll() {
      for (const id of [...loaded.keys()]) await this.dispose(id);
      for (const id of [...states.keys()]) await this.dispose(id);
    },
  };
}

export function useScriptRun(runner: PlotScriptRunner, id: string): ScriptRunState {
  return useSyncExternalStore(
    runner.subscribe,
    () => runner.getState(id),
    () => runner.getState(id),
  );
}
