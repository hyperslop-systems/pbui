import type { DispatchIntent, LoadedProgram, ProgramErrorPayload, ProgramPhase, UINode } from "./contracts";

/**
 * What evaluates programs. This is vm-system's `RuntimeHostAdapter`
 * (`frontend/packages/plugin-runtime/src/hostAdapter.ts:28-35`) with pbui's
 * names. Everything is async even when the engine is synchronous, so the host
 * loop is written once and the engine is a one-line choice.
 */
export interface LoadInput {
  instanceId: string;
  programId: string;
  source: string;
}

export interface RenderInput {
  instanceId: string;
  widgetId: string;
  pluginState: unknown;
  globalState: unknown;
}

export interface EventInput extends RenderInput {
  handler: string;
  args: unknown;
}

/** A REPL line inside a live instance (guide §4.3). */
export interface EvaluateInput {
  instanceId: string;
  code: string;
  pluginState: unknown;
  globalState: unknown;
}

export interface EvaluateResult {
  /** Already described by the bootstrap: JSON, with `{ $type }` markers for what JSON cannot carry. */
  value: unknown;
}

export interface EngineHealth {
  ready: true;
  instances: string[];
}

export interface ProgramEngine {
  readonly kind: "eval" | "quickjs";
  load(input: LoadInput): Promise<LoadedProgram>;
  render(input: RenderInput): Promise<UINode>;
  event(input: EventInput): Promise<DispatchIntent[]>;
  /** Evaluate code in the instance's scope; rejects with the error the code threw (its name preserved). */
  evaluate(input: EvaluateInput): Promise<EvaluateResult>;
  dispose(instanceId: string): Promise<boolean>;
  health(): Promise<EngineHealth>;
  terminate?(): void;
}

/** Wrap anything thrown by an engine into the payload a tool result or a tile can show. */
export function toProgramError(error: unknown, phase?: ProgramPhase): ProgramErrorPayload {
  if (error instanceof ProgramValidationError) {
    return { code: "VALIDATION_ERROR", message: error.message, ...(phase ? { phase } : {}) };
  }
  if (error instanceof Error) {
    const interrupted = error.name === "RuntimeTimeout" || error.message.includes("interrupted");
    // An error that already crossed the worker boundary carries a formatted
    // message under a marker name; prefixing it again reads as
    // "RuntimeTimeout: Error: InternalError: interrupted".
    const formatted = error.name === "RuntimeTimeout" || error.name === "RuntimeError" || error.name === "Error" && /^[A-Z][A-Za-z]*Error: /.test(error.message);
    return {
      code: interrupted ? "RUNTIME_TIMEOUT" : "RUNTIME_ERROR",
      message: formatted ? error.message : `${error.name}: ${error.message}`,
      ...(phase ? { phase } : {}),
    };
  }
  return { code: "UNKNOWN_ERROR", message: String(error), ...(phase ? { phase } : {}) };
}

/** Thrown by the validators, so a bad tree is told apart from a thrown program. */
export class ProgramValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgramValidationError";
  }
}

/** Port of vm-system `runtimeService.ts:210-240`: what `getMeta()` must have returned. */
export function validateLoadedProgramMeta(programId: string, instanceId: string, value: unknown): LoadedProgram {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProgramValidationError("Program metadata must be an object");
  }
  const meta = value as {
    declaredId?: unknown;
    title?: unknown;
    description?: unknown;
    initialState?: unknown;
    bindings?: unknown;
    widgets?: unknown;
  };
  if (!Array.isArray(meta.widgets) || meta.widgets.some((widgetId) => typeof widgetId !== "string")) {
    throw new ProgramValidationError("Program metadata widgets must be string[]");
  }
  if (meta.widgets.length === 0) {
    throw new ProgramValidationError("Program declares no widgets; add `widgets: { main: { render, handlers } }`");
  }
  const bindings = Array.isArray(meta.bindings) ? meta.bindings.filter((b): b is string => typeof b === "string") : [];
  return {
    programId,
    instanceId,
    declaredId: typeof meta.declaredId === "string" ? meta.declaredId : undefined,
    title: typeof meta.title === "string" ? meta.title : "Untitled program",
    description: typeof meta.description === "string" ? meta.description : undefined,
    initialState: meta.initialState,
    bindings,
    widgets: meta.widgets as string[],
  };
}
