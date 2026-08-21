import { getQuickJS } from "quickjs-emscripten";
import type { QuickJSContext, QuickJSHandle, QuickJSRuntime } from "quickjs-emscripten";
import { BOOTSTRAP_SOURCE } from "../bootstrap";
import type { DispatchIntent, LoadedProgram, UINode } from "../contracts";
import { ProgramValidationError, validateLoadedProgramMeta } from "../engine";
import { DEFAULT_LIMITS, byteLength, type SandboxLimits } from "../limits";
import { validateDispatchIntents } from "../validate/intents";
import { validateUINode } from "../validate/uiSchema";

/**
 * Programs inside QuickJS: one runtime + context per instance, with memory,
 * stack and wall-clock limits the engine enforces from outside. Ported from
 * vm-system `frontend/packages/plugin-runtime/src/runtimeService.ts`
 * (37bd440) onto the shared bootstrap and pbui's contracts.
 *
 * This is the main-thread service. The browser wraps it in a Web Worker
 * (`worker.ts` + `workerEngine.ts`); tests and non-browser hosts use it
 * directly through `createQuickJsDirectEngine`. Either way the program sees
 * exactly what it sees under the eval engine, minus the host.
 */

interface ProgramVm {
  programId: string;
  instanceId: string;
  runtime: QuickJSRuntime;
  context: QuickJSContext;
  deadlineMs: number;
}

function toJsLiteral(value: unknown): string {
  const encoded = JSON.stringify(value);
  return encoded === undefined ? "undefined" : encoded;
}

/**
 * A QuickJS error dump as a host Error with the SAME name the program threw
 * (TypeError, SyntaxError, InternalError for an interrupt), so the message a
 * model reads is `TypeError: …` once — not `Error: TypeError: …` — and the
 * eval and QuickJS engines report the same shape.
 */
function toHostError(context: QuickJSContext, handle: QuickJSHandle): Error {
  // `name` lives on Error.prototype, so a plain dump never carries it; read it
  // off the handle explicitly before dumping the rest.
  let name: unknown;
  try {
    const nameHandle = context.getProp(handle, "name");
    name = context.dump(nameHandle);
    nameHandle.dispose();
  } catch {
    name = undefined;
  }
  const dumped = context.dump(handle);
  if (typeof dumped === "string") return new Error(dumped);
  if (dumped && typeof dumped === "object") {
    const details = dumped as { message?: string };
    const error = new Error(details.message ?? "Unknown QuickJS runtime error");
    if (typeof name === "string" && name) error.name = name;
    return error;
  }
  return new Error("Unknown QuickJS runtime error");
}

function withDeadline<T>(vm: ProgramVm, timeoutMs: number, fn: () => T): T {
  vm.deadlineMs = Date.now() + timeoutMs;
  try {
    return fn();
  } finally {
    vm.deadlineMs = Number.POSITIVE_INFINITY;
  }
}

function evalToNative<T>(vm: ProgramVm, code: string, filename: string, timeoutMs: number): T {
  const context = vm.context;
  const result = withDeadline(vm, timeoutMs, () => context.evalCode(code, filename));
  if (result.error) {
    const error = toHostError(context, result.error);
    result.error.dispose();
    throw error;
  }
  try {
    return context.dump(result.value) as T;
  } finally {
    result.value.dispose();
  }
}

function evalCodeOrThrow(vm: ProgramVm, code: string, filename: string, timeoutMs: number): void {
  const context = vm.context;
  const result = withDeadline(vm, timeoutMs, () => context.evalCode(code, filename));
  if (result.error) {
    const error = toHostError(context, result.error);
    result.error.dispose();
    throw error;
  }
  result.value.dispose();
}

export class QuickJSRuntimeService {
  private readonly limits: SandboxLimits;
  private readonly vms = new Map<string, ProgramVm>();

  constructor(limits: SandboxLimits = DEFAULT_LIMITS) {
    this.limits = limits;
  }

  private async createVm(programId: string, instanceId: string): Promise<ProgramVm> {
    const QuickJS = await getQuickJS();
    const runtime = QuickJS.newRuntime();
    const context = runtime.newContext();
    const vm: ProgramVm = { programId, instanceId, runtime, context, deadlineMs: Number.POSITIVE_INFINITY };
    runtime.setMemoryLimit(this.limits.memoryBytes);
    runtime.setMaxStackSize(this.limits.stackBytes);
    // The whole timeout story: QuickJS polls this between instructions, so a
    // `while (true) {}` in render is interrupted after renderMs — which is
    // the thing the eval engine cannot do.
    runtime.setInterruptHandler(() => Date.now() > vm.deadlineMs);
    // The bootstrap declares `__pluginHost` as a const; the epilogue publishes
    // it for the host's later `evalCode` calls to reach.
    evalCodeOrThrow(vm, `${BOOTSTRAP_SOURCE}\nglobalThis.__pluginHost = __pluginHost;`, "program-bootstrap.js", this.limits.loadMs);
    return vm;
  }

  private getVmOrThrow(instanceId: string): ProgramVm {
    const vm = this.vms.get(instanceId);
    if (!vm) throw new Error(`Program instance not found: ${instanceId}`);
    return vm;
  }

  async load(programId: string, instanceId: string, source: string): Promise<LoadedProgram> {
    if (this.vms.has(instanceId)) throw new Error(`Program instance already exists: ${instanceId}`);
    const size = byteLength(source);
    if (size > this.limits.sourceBytes) throw new ProgramValidationError(`source is ${size} bytes, the limit is ${this.limits.sourceBytes}`);
    const vm = await this.createVm(programId, instanceId);
    try {
      evalCodeOrThrow(vm, source, `${instanceId}.program.js`, this.limits.loadMs);
      const meta = evalToNative<unknown>(vm, "globalThis.__pluginHost.getMeta()", "program-meta.js", this.limits.loadMs);
      const program = validateLoadedProgramMeta(programId, instanceId, meta);
      this.vms.set(instanceId, vm);
      return program;
    } catch (error) {
      vm.context.dispose();
      vm.runtime.dispose();
      throw error;
    }
  }

  render(instanceId: string, widgetId: string, pluginState: unknown, globalState: unknown): UINode {
    const vm = this.getVmOrThrow(instanceId);
    const tree = evalToNative<unknown>(
      vm,
      `globalThis.__pluginHost.render(${toJsLiteral(widgetId)}, ${toJsLiteral(pluginState)}, ${toJsLiteral(globalState)})`,
      `${instanceId}.render.js`,
      this.limits.renderMs,
    );
    try {
      return validateUINode(tree, this.limits);
    } catch (error) {
      throw new ProgramValidationError(error instanceof Error ? error.message : String(error));
    }
  }

  event(instanceId: string, widgetId: string, handler: string, args: unknown, pluginState: unknown, globalState: unknown): DispatchIntent[] {
    const vm = this.getVmOrThrow(instanceId);
    const intents = evalToNative<unknown>(
      vm,
      `globalThis.__pluginHost.event(${toJsLiteral(widgetId)}, ${toJsLiteral(handler)}, ${toJsLiteral(args)}, ${toJsLiteral(pluginState)}, ${toJsLiteral(globalState)})`,
      `${instanceId}.event.js`,
      this.limits.eventMs,
    );
    try {
      return validateDispatchIntents(intents, instanceId, this.limits);
    } catch (error) {
      throw new ProgramValidationError(error instanceof Error ? error.message : String(error));
    }
  }

  dispose(instanceId: string): boolean {
    const vm = this.vms.get(instanceId);
    if (!vm) return false;
    this.vms.delete(instanceId);
    vm.context.dispose();
    vm.runtime.dispose();
    return true;
  }

  instances(): string[] {
    return [...this.vms.keys()];
  }
}
