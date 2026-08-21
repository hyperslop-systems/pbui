/**
 * The QuickJS half of the package, as its own entry so an eval-only consumer
 * never pulls the wasm: `import { … } from "@hyperslop-systems/pbui-sandbox/quickjs"`.
 */
export { QuickJSRuntimeService } from "./quickjs/runtimeService";
export { createQuickJsDirectEngine } from "./quickjs/directEngine";
export { createQuickJsEngine } from "./quickjs/workerEngine";
export type { QuickJsEngineOptions } from "./quickjs/workerEngine";
export { installQuickJsWorker } from "./quickjs/worker";
export type { WorkerScopeLike } from "./quickjs/worker";
export type { WorkerRequest, WorkerRequestBody, WorkerResponse, WorkerResult } from "./quickjs/protocol";
