import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DispatchIntent, LoadedProgram, ProgramErrorPayload, ProgramGlobalState, UIEventRef, UINode, UIReference, VerbLike } from "../contracts";
import { toProgramError, type ProgramEngine } from "../engine";
import type { ProgramRecord } from "../library";
import { useProgramState, type ProgramStateStore } from "../state";

/** One line of the per-instance log: vm-system's dispatch timeline, scaled to one program. */
export interface InstanceLogEntry {
  at: string;
  kind: "intent" | "error" | "note";
  text: string;
  outcome?: "applied" | "denied" | "ignored";
}

export interface UseProgramInstanceOptions {
  engine: ProgramEngine;
  program: ProgramRecord | null;
  viewId: string;
  placementId: string;
  states: ProgramStateStore;
  /** The view's bindings, resolved; memoise it — it is an effect dependency. */
  documents: Record<string, UIReference | null>;
  /** The product's descriptor environment; memoise it likewise. */
  env: Record<string, unknown>;
  /**
   * Perform a verb a handler emitted. The product routes it through its
   * router with `actor: "human"` (a human clicked) and the program as
   * provenance (guide D10); the returned string is the router's outcome.
   */
  perform(verb: VerbLike, options: { provenance: { programId: string } }): Promise<string>;
  onError?(error: ProgramErrorPayload): void;
}

export interface ProgramInstance {
  status: "idle" | "loading" | "ready" | "error";
  meta: LoadedProgram | null;
  trees: Record<string, UINode>;
  error: ProgramErrorPayload | null;
  log: readonly InstanceLogEntry[];
  onEvent(widgetId: string, ref: UIEventRef, payload?: unknown): void;
  /** Back to `initialState`. */
  reset(): void;
}

const LOG_KEEP = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The generic reducer — vm-system's `reduceGenericPlugin`, the only one a program needs. */
export function reducePluginIntent(current: unknown, intent: Extract<DispatchIntent, { scope: "plugin" }>): { next: unknown; applied: boolean } {
  if (intent.actionType === "state/replace") return { next: intent.payload ?? {}, applied: true };
  if (intent.actionType === "state/merge" && isRecord(intent.payload)) {
    return { next: { ...(isRecord(current) ? current : {}), ...intent.payload }, applied: true };
  }
  return { next: current, applied: false };
}

let mountCounter = 0;

/**
 * The host loop for one tile: load → render → event → reduce → re-render
 * (guide §5.5). One instance per (view, program version, mount); an update
 * to the program is a fresh load, never a re-evaluation in a dirty context.
 */
export function useProgramInstance(options: UseProgramInstanceOptions): ProgramInstance {
  const { engine, program, viewId, placementId, states, documents, env, perform, onError } = options;
  void perform;
  void onError;
  const programId = program?.id ?? null;
  const version = program?.version ?? 0;
  const source = program?.source ?? null;

  const [meta, setMeta] = useState<LoadedProgram | null>(null);
  const [status, setStatus] = useState<ProgramInstance["status"]>("idle");
  const [trees, setTrees] = useState<Record<string, UINode>>({});
  const [error, setError] = useState<ProgramErrorPayload | null>(null);
  const [log, setLog] = useState<InstanceLogEntry[]>([]);
  const instanceRef = useRef<string | null>(null);
  const pluginState = useProgramState(states, viewId);
  // Read through a ref so an inline `onError` arrow — the natural way to
  // write it at a call site — does not make `fail`, and through it the render
  // effect, a new dependency every render. That was a busy loop in the demo:
  // render → setTrees → re-render → new onError → new fail → render …
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const performRef = useRef(perform);
  performRef.current = perform;

  const note = useCallback((entry: Omit<InstanceLogEntry, "at">) => {
    setLog((current) => [...current, { at: new Date().toISOString(), ...entry }].slice(-LOG_KEEP));
  }, []);

  const fail = useCallback(
    (raw: unknown, phase: ProgramErrorPayload["phase"]) => {
      const payload = toProgramError(raw, phase);
      setError(payload);
      setStatus("error");
      note({ kind: "error", text: `${phase}: ${payload.message}` });
      onErrorRef.current?.(payload);
    },
    [note],
  );

  const globalState = useMemo<ProgramGlobalState | null>(
    () =>
      programId && instanceRef.current
        ? {
            self: { instanceId: instanceRef.current, programId, viewId, placementId },
            shared: { documents, env },
            system: { engine: engine.kind, version },
          }
        : null,
    // instanceRef is read at call time; `meta` changing is what marks a new instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [programId, viewId, placementId, documents, env, engine.kind, version, meta],
  );

  /* ---- load ------------------------------------------------------------- */
  useEffect(() => {
    if (!programId || source === null) {
      setMeta(null);
      setStatus("idle");
      // Functional, so an already-empty map stays the same object: a fresh
      // `{}` here would re-render, and a caller whose dependencies are not
      // stable would loop.
      setTrees((current) => (Object.keys(current).length === 0 ? current : {}));
      setError(null);
      return undefined;
    }
    let cancelled = false;
    mountCounter += 1;
    const instanceId = `${viewId}:${programId}:v${version}#${mountCounter}`;
    instanceRef.current = instanceId;
    setStatus("loading");
    setError(null);

    void (async () => {
      try {
        const loaded = await engine.load({ instanceId, programId, source });
        if (cancelled) {
          await engine.dispose(instanceId);
          return;
        }
        // State across an update (guide D11): keep the previous state when the
        // new version renders with it, else reset to initialState and say so.
        const previous = states.get(viewId);
        if (previous === undefined) {
          states.set(viewId, loaded.initialState ?? {});
        } else {
          try {
            await engine.render({
              instanceId,
              widgetId: loaded.widgets[0]!,
              pluginState: previous,
              globalState: { self: { instanceId, programId, viewId, placementId }, shared: { documents, env }, system: { engine: engine.kind, version } },
            });
          } catch {
            states.set(viewId, loaded.initialState ?? {});
            note({ kind: "note", text: `state was reset: version ${version} does not render the previous state` });
          }
        }
        setMeta(loaded);
        setStatus("ready");
      } catch (raw) {
        if (!cancelled) fail(raw, "load");
      }
    })();

    return () => {
      cancelled = true;
      instanceRef.current = null;
      void engine.dispose(instanceId);
    };
    // documents/env are read once at load for the compatibility probe; the render effect tracks them live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, programId, source, version, viewId, placementId, states]);

  /* ---- render ----------------------------------------------------------- */
  useEffect(() => {
    if (!meta || !globalState || status === "loading" || status === "idle") return undefined;
    const instanceId = instanceRef.current;
    if (!instanceId) return undefined;
    let cancelled = false;
    void (async () => {
      const next: Record<string, UINode> = {};
      try {
        for (const widgetId of meta.widgets) {
          next[widgetId] = await engine.render({ instanceId, widgetId, pluginState: pluginState ?? {}, globalState });
        }
        if (cancelled) return;
        // Same tree, same object: a render that changed nothing must not
        // re-render the tile, or any unstable dependency upstream loops.
        setTrees((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
        setError(null);
        setStatus("ready");
      } catch (raw) {
        if (!cancelled) fail(raw, "render");
      }
    })();
    return () => {
      cancelled = true;
    };
    // `status` is deliberately not a dependency: a render error must not retrigger itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, meta, globalState, pluginState, fail]);

  /* ---- event ------------------------------------------------------------ */
  const onEvent = useCallback(
    (widgetId: string, ref: UIEventRef, payload?: unknown) => {
      const instanceId = instanceRef.current;
      if (!instanceId || !meta || !globalState || !programId) return;
      void (async () => {
        let intents: DispatchIntent[];
        try {
          intents = await engine.event({
            instanceId,
            widgetId,
            handler: ref.handler,
            args: payload ?? ref.args,
            pluginState: states.get(viewId) ?? {},
            globalState,
          });
        } catch (raw) {
          fail(raw, "event");
          return;
        }
        for (const intent of intents) {
          if (intent.scope === "plugin") {
            const { next, applied } = reducePluginIntent(states.get(viewId), intent);
            if (applied) states.set(viewId, next);
            note({
              kind: "intent",
              text: `${intent.actionType}`,
              outcome: applied ? "applied" : "ignored",
            });
          } else if (intent.scope === "verb") {
            const outcome = await performRef.current(intent.verb, { provenance: { programId } });
            note({
              kind: "intent",
              text: `verb ${intent.verb.kind} → ${outcome}`,
              outcome: outcome === "performed" ? "applied" : "denied",
            });
          }
        }
      })();
    },
    [engine, meta, globalState, programId, states, viewId, fail, note],
  );

  const reset = useCallback(() => {
    if (!meta) return;
    states.set(viewId, meta.initialState ?? {});
    setError(null);
    note({ kind: "note", text: "state reset to initialState" });
  }, [meta, states, viewId, note]);

  return { status, meta, trees, error, log, onEvent, reset };
}
