import type { DispatchIntent, LoadedProgram, ProgramErrorPayload, UINode } from "../contracts";
import type { SandboxLimits } from "../limits";

/**
 * The request/response protocol between `workerEngine.ts` (main thread) and
 * `worker.ts` (the Web Worker). Ported from vm-system's `contracts.ts`.
 */

export type WorkerRequest =
  | { id: number; type: "configure"; limits: Partial<SandboxLimits> }
  | { id: number; type: "load"; programId: string; instanceId: string; source: string }
  | { id: number; type: "render"; instanceId: string; widgetId: string; pluginState: unknown; globalState: unknown }
  | { id: number; type: "event"; instanceId: string; widgetId: string; handler: string; args: unknown; pluginState: unknown; globalState: unknown }
  | { id: number; type: "dispose"; instanceId: string }
  | { id: number; type: "health" };

/** `Omit` distributed over the union — a plain `Omit<WorkerRequest, "id">` keeps only the keys every member shares. */
export type WorkerRequestBody = WorkerRequest extends infer R ? (R extends { id: number } ? Omit<R, "id"> : never) : never;

export type WorkerResult =
  | { program: LoadedProgram }
  | { tree: UINode }
  | { intents: DispatchIntent[] }
  | { disposed: boolean }
  | { ready: true; instances: string[] }
  | { configured: true };

export type WorkerResponse = { id: number; ok: true; result: WorkerResult } | { id: number; ok: false; error: ProgramErrorPayload };
