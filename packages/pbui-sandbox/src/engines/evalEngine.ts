import { BOOTSTRAP_SOURCE } from "../bootstrap";
import type { DispatchIntent, LoadedProgram, UINode } from "../contracts";
import type { EvaluateResult } from "../engine";
import { ProgramValidationError, validateLoadedProgramMeta, type ProgramEngine } from "../engine";
import { DEFAULT_LIMITS, byteLength, type SandboxLimits } from "../limits";
import { validateDispatchIntents } from "../validate/intents";
import { validateUINode } from "../validate/uiSchema";

/**
 * The `eval` engine: evaluates the bootstrap and the program's source with
 * `new Function` on the calling thread.
 *
 * # What it is, and is not
 *
 * It structures a program exactly as the QuickJS engine does — the same
 * bootstrap, the same JSON boundary (arguments and results are cloned), the
 * same validators — so that a program written against it runs unchanged
 * under real isolation later. It is NOT isolation: the shadowed globals below
 * stop an accidental `document.title = …` or `fetch(…)`, and nothing more.
 * `(0, eval)("this")` reaches the real global; a `while (true) {}` in render
 * freezes the tab because no one can interrupt synchronous code on its own
 * thread. The guide's §5.11 states the trust table; a product with data a
 * user cares about uses the QuickJS engine.
 */

/** Names a program cannot use — each is bound to a proxy that throws a ReferenceError. A speed bump for accidents, not a security boundary. */
export const SHADOWED_GLOBALS = [
  "window",
  "document",
  "globalThis",
  "self",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "setTimeout",
  "setInterval",
  "requestAnimationFrame",
  "queueMicrotask",
  "importScripts",
  "navigator",
  "location",
  "history",
] as const;

/**
 * What a shadowed name evaluates to: not `undefined` (which turns
 * `document.title` into "Cannot read properties of undefined (reading
 * 'title')" — a message that hides the rule it broke) but a proxy whose every
 * trap throws a ReferenceError naming the global and the rule. The reader of
 * that message is usually a model fixing its own program.
 */
function forbidden(name: string): unknown {
  const message = `${name} is not available inside a program: programs are pure functions over their state and bindings — no DOM, network, storage or timers`;
  const fail = (): never => {
    throw new ReferenceError(message);
  };
  return new Proxy(function forbiddenGlobal() {}, {
    get: fail,
    set: fail,
    has: fail,
    apply: fail,
    construct: fail,
    deleteProperty: fail,
    defineProperty: fail,
    ownKeys: fail,
    getOwnPropertyDescriptor: fail,
    getPrototypeOf: fail,
    setPrototypeOf: fail,
  });
}

interface PluginHost {
  getMeta(): unknown;
  render(widgetId: string, pluginState: unknown, globalState: unknown): unknown;
  event(widgetId: string, handler: string, args: unknown, pluginState: unknown, globalState: unknown): unknown;
  evaluate(code: string, pluginState: unknown, globalState: unknown): unknown;
}

/**
 * Values cross into and out of the program by value. On a shared heap that
 * is what keeps the purity the host loop relies on: a program cannot mutate
 * the host's `pluginState` object in place, and the host cannot be handed a
 * tree that the program later edits.
 */
function clone<T>(value: T): T {
  if (value === undefined) return value;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through: a value structuredClone refuses (a function, a symbol) is also not JSON.
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createEvalEngine(limits: SandboxLimits = DEFAULT_LIMITS): ProgramEngine {
  const hosts = new Map<string, { programId: string; host: PluginHost }>();

  function get(instanceId: string): PluginHost {
    const entry = hosts.get(instanceId);
    if (!entry) throw new Error(`Program instance not found: ${instanceId}`);
    return entry.host;
  }

  return {
    kind: "eval",

    async load({ instanceId, programId, source }): Promise<LoadedProgram> {
      if (hosts.has(instanceId)) throw new Error(`Program instance already exists: ${instanceId}`);
      const size = byteLength(source);
      if (size > limits.sourceBytes) {
        throw new ProgramValidationError(`source is ${size} bytes, the limit is ${limits.sourceBytes}`);
      }
      // One Function: the bootstrap, then the program, then the epilogue that
      // hands the host object back. A SyntaxError surfaces here, from the
      // constructor, with the engine's own line and column.
      const factory = new Function(...SHADOWED_GLOBALS, `"use strict";\n${BOOTSTRAP_SOURCE}\n${source}\n;return __pluginHost;`);
      const host = factory(...SHADOWED_GLOBALS.map((name) => forbidden(name))) as PluginHost;
      const meta = validateLoadedProgramMeta(programId, instanceId, clone(host.getMeta()));
      hosts.set(instanceId, { programId, host });
      return meta;
    },

    async render({ instanceId, widgetId, pluginState, globalState }): Promise<UINode> {
      const host = get(instanceId);
      const tree = host.render(widgetId, clone(pluginState), clone(globalState));
      try {
        return validateUINode(clone(tree), limits);
      } catch (error) {
        throw new ProgramValidationError(error instanceof Error ? error.message : String(error));
      }
    },

    async event({ instanceId, widgetId, handler, args, pluginState, globalState }): Promise<DispatchIntent[]> {
      const host = get(instanceId);
      const intents = host.event(widgetId, handler, clone(args), clone(pluginState), clone(globalState));
      try {
        return validateDispatchIntents(clone(intents), instanceId, limits);
      } catch (error) {
        throw new ProgramValidationError(error instanceof Error ? error.message : String(error));
      }
    },

    async evaluate({ instanceId, code, pluginState, globalState }): Promise<EvaluateResult> {
      const host = get(instanceId);
      // The bootstrap described the value; the clone is the JSON boundary.
      return { value: clone(host.evaluate(code, clone(pluginState), clone(globalState))) };
    },

    async dispose(instanceId) {
      return hosts.delete(instanceId);
    },

    async health() {
      return { ready: true as const, instances: [...hosts.keys()] };
    },
  };
}
