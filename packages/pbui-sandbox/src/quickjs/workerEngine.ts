import type { DispatchIntent, LoadedProgram, ProgramErrorPayload, UINode } from "../contracts";
import { ProgramValidationError, type ProgramEngine } from "../engine";
import { DEFAULT_LIMITS, type SandboxLimits } from "../limits";
import type { WorkerRequestBody, WorkerResponse, WorkerResult } from "./protocol";

/**
 * The main-thread half: a `ProgramEngine` over a Web Worker running
 * `installQuickJsWorker()`. Every call is one request with an id; responses
 * are matched by id; a worker error or `terminate()` rejects everything
 * pending. Ported from vm-system's `worker/sandboxClient.ts`.
 */
export interface QuickJsEngineOptions {
  /** The worker, created by the consumer from its own worker entry. */
  worker: Worker;
  limits?: Partial<SandboxLimits>;
}

function toError(payload: ProgramErrorPayload): Error {
  if (payload.code === "VALIDATION_ERROR") return new ProgramValidationError(payload.message);
  const error = new Error(payload.message);
  error.name = payload.code === "RUNTIME_TIMEOUT" ? "RuntimeTimeout" : "RuntimeError";
  return error;
}

export function createQuickJsEngine(options: QuickJsEngineOptions): ProgramEngine {
  const { worker } = options;
  let nextId = 1;
  const pending = new Map<number, { resolve(value: WorkerResult): void; reject(reason: unknown): void }>();

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const waiter = pending.get(response.id);
    if (!waiter) return;
    pending.delete(response.id);
    if (response.ok) waiter.resolve(response.result);
    else waiter.reject(toError(response.error));
  };
  worker.onerror = (event) => {
    const error = new Error(`QuickJS worker error: ${event.message}`);
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  };

  function post<T extends WorkerResult>(request: WorkerRequestBody): Promise<T> {
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (value: WorkerResult) => void, reject });
      worker.postMessage({ id, ...request });
    });
  }

  const configured = options.limits
    ? post<{ configured: true }>({ type: "configure", limits: { ...DEFAULT_LIMITS, ...options.limits } })
    : Promise.resolve({ configured: true as const });

  return {
    kind: "quickjs",
    async load({ instanceId, programId, source }): Promise<LoadedProgram> {
      await configured;
      const { program } = await post<{ program: LoadedProgram }>({ type: "load", programId, instanceId, source });
      return program;
    },
    async render({ instanceId, widgetId, pluginState, globalState }): Promise<UINode> {
      const { tree } = await post<{ tree: UINode }>({ type: "render", instanceId, widgetId, pluginState, globalState });
      return tree;
    },
    async event({ instanceId, widgetId, handler, args, pluginState, globalState }): Promise<DispatchIntent[]> {
      const { intents } = await post<{ intents: DispatchIntent[] }>({ type: "event", instanceId, widgetId, handler, args, pluginState, globalState });
      return intents;
    },
    async evaluate({ instanceId, code, pluginState, globalState }) {
      const { value } = await post<{ value: unknown }>({ type: "evaluate", instanceId, code, pluginState, globalState });
      return { value };
    },
    async dispose(instanceId) {
      const { disposed } = await post<{ disposed: boolean }>({ type: "dispose", instanceId });
      return disposed;
    },
    async health() {
      const { instances } = await post<{ ready: true; instances: string[] }>({ type: "health" });
      return { ready: true as const, instances };
    },
    terminate() {
      const error = new Error("QuickJS worker terminated");
      for (const waiter of pending.values()) waiter.reject(error);
      pending.clear();
      worker.terminate();
    },
  };
}
