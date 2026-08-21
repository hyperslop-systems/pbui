import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DispatchIntent, LoadedProgram, ProgramErrorPayload, ProgramGlobalState, UIEventRef, UINode, UIReference, VerbLike } from "../contracts";
import { toProgramError, type ProgramEngine } from "../engine";
import { EMPTY_TIMINGS, type InstanceHandle, type InstanceRegistry, type InstanceTimings } from "../instances";
import type { ProgramRecord } from "../library";
import { useProgramState, type ProgramStateStore } from "../state";
import { countNodes } from "../validate/uiSchema";

export interface UseProgramInstanceOptions {
  engine: ProgramEngine;
  program: ProgramRecord | null;
  viewId: string;
  placementId: string;
  states: ProgramStateStore;
  /** Where this instance publishes what it is doing (guide §4.1). */
  instances: InstanceRegistry;
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
  onEvent(widgetId: string, ref: UIEventRef, payload?: unknown): void;
  /** Back to `initialState`. */
  reset(): void;
  /** Render again without a state change. */
  rerender(): void;
}

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

const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

let mountCounter = 0;

/**
 * The host loop for one tile: load → render → event → reduce → re-render
 * (guide §5.5). One instance per (view, program version, mount); an update
 * to the program is a fresh load, never a re-evaluation in a dirty context.
 *
 * Everything the loop learns goes to the registry — status, meta, trees,
 * timings, a handle — and everything that happens is a timeline entry, so a
 * devtool elsewhere in the layout can see and drive this instance.
 */
export function useProgramInstance(options: UseProgramInstanceOptions): ProgramInstance {
  const { engine, program, viewId, placementId, states, instances, documents, env, perform, onError } = options;
  void perform;
  void onError;
  const programId = program?.id ?? null;
  const version = program?.version ?? 0;
  const source = program?.source ?? null;

  const [meta, setMeta] = useState<LoadedProgram | null>(null);
  const [status, setStatus] = useState<ProgramInstance["status"]>("idle");
  const [trees, setTrees] = useState<Record<string, UINode>>({});
  const [error, setError] = useState<ProgramErrorPayload | null>(null);
  const [tick, setTick] = useState(0);
  const instanceRef = useRef<string | null>(null);
  const timingsRef = useRef<InstanceTimings>(EMPTY_TIMINGS);
  const treesRef = useRef<Record<string, UINode>>({});
  const pluginState = useProgramState(states, viewId);
  // Read through a ref so an inline `onError` arrow — the natural way to
  // write it at a call site — does not make `fail`, and through it the render
  // effect, a new dependency every render. That was a busy loop in the demo:
  // render → setTrees → re-render → new onError → new fail → render …
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const performRef = useRef(perform);
  performRef.current = perform;

  const bumpTimings = useCallback(
    (patch: Partial<InstanceTimings>) => {
      timingsRef.current = { ...timingsRef.current, ...patch };
      instances.publish(viewId, { timings: timingsRef.current });
    },
    [instances, viewId],
  );

  const fail = useCallback(
    (raw: unknown, phase: ProgramErrorPayload["phase"]) => {
      const payload = toProgramError(raw, phase);
      setError(payload);
      setStatus("error");
      if (programId) {
        instances.record({ kind: "error", viewId, programId, version, instanceId: instanceRef.current, phase: phase ?? "render", code: payload.code, message: payload.message });
      }
      bumpTimings({
        errors: timingsRef.current.errors + 1,
        timeouts: timingsRef.current.timeouts + (payload.code === "RUNTIME_TIMEOUT" ? 1 : 0),
      });
      instances.publish(viewId, { status: "error", error: payload });
      onErrorRef.current?.(payload);
    },
    [instances, viewId, programId, version, bumpTimings],
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

  /* ---- mount: this placement shows this view ---------------------------- */
  useEffect(() => {
    instances.mount(viewId, placementId);
    return () => instances.unmount(viewId, placementId);
  }, [instances, viewId, placementId]);

  /* ---- load ------------------------------------------------------------- */
  useEffect(() => {
    if (!programId || source === null) {
      setMeta(null);
      setStatus("idle");
      // Functional, so an already-empty map stays the same object: a fresh
      // `{}` here would re-render, and a caller whose dependencies are not
      // stable would loop.
      setTrees((current) => (Object.keys(current).length === 0 ? current : {}));
      treesRef.current = {};
      setError(null);
      instances.publish(viewId, { status: "idle", programId: null, version: 0, instanceId: null, meta: null, error: null });
      return undefined;
    }
    let cancelled = false;
    mountCounter += 1;
    const instanceId = `${viewId}:${programId}:v${version}#${mountCounter}`;
    instanceRef.current = instanceId;
    timingsRef.current = EMPTY_TIMINGS;
    setStatus("loading");
    setError(null);
    instances.publish(viewId, { status: "loading", programId, version, instanceId: null, error: null, timings: EMPTY_TIMINGS });

    void (async () => {
      const started = clock();
      try {
        const loaded = await engine.load({ instanceId, programId, source });
        if (cancelled) {
          await engine.dispose(instanceId);
          return;
        }
        const loadMs = clock() - started;
        instances.record({ kind: "load", viewId, programId, version, instanceId, durationMs: loadMs });
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
            instances.record({ kind: "note", viewId, programId, version, instanceId, text: `state was reset: version ${version} does not render the previous state` });
          }
        }
        setMeta(loaded);
        setStatus("ready");
        timingsRef.current = { ...EMPTY_TIMINGS, loadMs };
        instances.publish(viewId, { status: "ready", instanceId, meta: loaded, timings: timingsRef.current });
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
  }, [engine, programId, source, version, viewId, placementId, states, instances]);

  /* ---- render ----------------------------------------------------------- */
  useEffect(() => {
    if (!meta || !globalState || status === "loading" || status === "idle") return undefined;
    const instanceId = instanceRef.current;
    if (!instanceId || !programId) return undefined;
    let cancelled = false;
    void (async () => {
      const next: Record<string, UINode> = {};
      const started = clock();
      try {
        for (const widgetId of meta.widgets) {
          const widgetStarted = clock();
          next[widgetId] = await engine.render({ instanceId, widgetId, pluginState: pluginState ?? {}, globalState });
          instances.record({ kind: "render", viewId, programId, version, instanceId, widgetId, durationMs: clock() - widgetStarted, nodeCount: countNodes(next[widgetId]!) });
        }
        if (cancelled) return;
        // Same tree, same object: a render that changed nothing must not
        // re-render the tile (or any unstable dependency upstream loops), and
        // must not notify the registry's subscribers either.
        const published = JSON.stringify(treesRef.current) === JSON.stringify(next) ? treesRef.current : next;
        treesRef.current = published;
        setTrees(published);
        setError(null);
        setStatus("ready");
        bumpTimings({ renders: timingsRef.current.renders + 1, lastRenderMs: clock() - started });
        instances.publish(viewId, { status: "ready", error: null, trees: published, globalState });
      } catch (raw) {
        if (!cancelled) fail(raw, "render");
      }
    })();
    return () => {
      cancelled = true;
    };
    // `status` is deliberately not a dependency: a render error must not retrigger itself.
    // `tick` is: `rerender()` bumps it to run this effect with nothing else changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, meta, globalState, pluginState, fail, tick]);

  /* ---- event ------------------------------------------------------------ */
  const onEvent = useCallback(
    (widgetId: string, ref: UIEventRef, payload?: unknown) => {
      const instanceId = instanceRef.current;
      if (!instanceId || !meta || !globalState || !programId) return;
      void (async () => {
        let intents: DispatchIntent[];
        const started = clock();
        const args = payload ?? ref.args;
        try {
          intents = await engine.event({ instanceId, widgetId, handler: ref.handler, args, pluginState: states.get(viewId) ?? {}, globalState });
        } catch (raw) {
          fail(raw, "event");
          return;
        }
        const durationMs = clock() - started;
        instances.record({ kind: "event", viewId, programId, version, instanceId, widgetId, handler: ref.handler, args, durationMs, intents });
        bumpTimings({ events: timingsRef.current.events + 1, lastEventMs: durationMs });
        for (const intent of intents) {
          if (intent.scope === "plugin") {
            const { next, applied } = reducePluginIntent(states.get(viewId), intent);
            if (applied) states.set(viewId, next);
            instances.record({ kind: "intent", viewId, programId, version, instanceId, intent, outcome: applied ? "applied" : "ignored" });
          } else if (intent.scope === "verb") {
            const outcome = await performRef.current(intent.verb, { provenance: { programId } });
            const performed = outcome === "performed";
            instances.record({ kind: "intent", viewId, programId, version, instanceId, intent, outcome: performed ? "performed" : "rejected", ...(performed ? {} : { detail: outcome }) });
          }
        }
      })();
    },
    [engine, meta, globalState, programId, version, states, viewId, instances, fail, bumpTimings],
  );

  const reset = useCallback(() => {
    if (!meta || !programId) return;
    states.set(viewId, meta.initialState ?? {});
    setError(null);
    instances.record({ kind: "note", viewId, programId, version, instanceId: instanceRef.current, text: "state reset to initialState" });
  }, [meta, programId, version, states, viewId, instances]);

  const rerender = useCallback(() => setTick((t) => t + 1), []);

  /* ---- the handle devtools drive the instance through ------------------- */
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const resetRef = useRef(reset);
  resetRef.current = reset;
  useEffect(() => {
    // One stable object per mount whose methods read the latest callbacks
    // through refs, so the registry is written once, not on every render.
    const handle: InstanceHandle = {
      fire: (widgetId, ref, payload) => onEventRef.current(widgetId, ref, payload),
      reset: () => resetRef.current(),
      rerender,
    };
    instances.publish(viewId, { handle });
    return () => {
      // Only clear our own handle: a second placement of the same view may
      // have registered since, and its handle is as good as ours.
      if (instances.get(viewId)?.handle === handle) instances.publish(viewId, { handle: null });
    };
  }, [instances, viewId, rerender]);

  return { status, meta, trees, error, onEvent, reset, rerender };
}
