import { toProgramError } from "../engine";
import { DEFAULT_LIMITS, type SandboxLimits } from "../limits";
import type { WorkerRequest, WorkerResponse, WorkerResult } from "./protocol";
import { QuickJSRuntimeService } from "./runtimeService";

/**
 * The worker half. A consumer's worker entry is one line:
 *
 *     import { installQuickJsWorker } from "@hyperslop-systems/pbui-sandbox/quickjs";
 *     installQuickJsWorker();
 *
 * It lives in the CONSUMER's source (the demo has `sandbox.worker.ts`) so
 * that the consumer's bundler — which is the only one that knows the final
 * asset layout — emits the worker; a `new Worker(new URL(...))` inside a
 * published library does not survive a second bundling.
 */
/** The part of a worker global scope this needs; structural, so the package compiles without the WebWorker lib. */
export interface WorkerScopeLike {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown): void;
}

export function installQuickJsWorker(scope: WorkerScopeLike = self as unknown as WorkerScopeLike): void {
  let service = new QuickJSRuntimeService(DEFAULT_LIMITS);

  async function handle(request: WorkerRequest): Promise<WorkerResult> {
    switch (request.type) {
      case "configure": {
        const limits: SandboxLimits = { ...DEFAULT_LIMITS, ...request.limits };
        for (const instanceId of service.instances()) service.dispose(instanceId);
        service = new QuickJSRuntimeService(limits);
        return { configured: true };
      }
      case "load":
        return { program: await service.load(request.programId, request.instanceId, request.source) };
      case "render":
        return { tree: service.render(request.instanceId, request.widgetId, request.pluginState, request.globalState) };
      case "event":
        return { intents: service.event(request.instanceId, request.widgetId, request.handler, request.args, request.pluginState, request.globalState) };
      case "evaluate":
        return { value: service.evaluate(request.instanceId, request.code, request.pluginState, request.globalState) };
      case "dispose":
        return { disposed: service.dispose(request.instanceId) };
      case "health":
        return { ready: true, instances: service.instances() };
      default:
        throw new Error(`Unknown request type: ${(request as { type?: string }).type ?? "unknown"}`);
    }
  }

  scope.onmessage = async (event: MessageEvent) => {
    const request = event.data as WorkerRequest;
    let response: WorkerResponse;
    try {
      response = { id: request.id, ok: true, result: await handle(request) };
    } catch (error) {
      response = { id: request.id, ok: false, error: toProgramError(error) };
    }
    scope.postMessage(response);
  };
}
