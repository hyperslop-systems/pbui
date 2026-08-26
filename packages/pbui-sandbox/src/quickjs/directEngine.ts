import type { ProgramEngine } from "../engine";
import { DEFAULT_LIMITS, type SandboxLimits } from "../limits";
import { QuickJSRuntimeService } from "./runtimeService";

/**
 * QuickJS on the calling thread, as a `ProgramEngine`. Isolation and
 * interrupts without a worker — right for tests, Node hosts and the
 * conformance suite; a browser should prefer `createQuickJsEngine` so a
 * slow render cannot hold the UI thread for its full timeout.
 */
export function createQuickJsDirectEngine(limits: Partial<SandboxLimits> = {}): ProgramEngine {
  const service = new QuickJSRuntimeService({ ...DEFAULT_LIMITS, ...limits });
  return {
    kind: "quickjs",
    load: ({ instanceId, programId, source }) => service.load(programId, instanceId, source),
    render: async ({ instanceId, widgetId, pluginState, globalState }) => service.render(instanceId, widgetId, pluginState, globalState),
    event: async ({ instanceId, widgetId, handler, args, pluginState, globalState }) =>
      service.event(instanceId, widgetId, handler, args, pluginState, globalState),
    evaluate: async ({ instanceId, code, pluginState, globalState }) => ({ value: service.evaluate(instanceId, code, pluginState, globalState) }),
    dispose: async (instanceId) => service.dispose(instanceId),
    health: async () => ({ ready: true as const, instances: service.instances() }),
    terminate() {
      for (const instanceId of service.instances()) service.dispose(instanceId);
    },
  };
}
