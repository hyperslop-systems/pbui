import type { ProgramEngine } from "../engine";
import { PLOT_AUTHOR_SHIM } from "./authorShim";
import { checkScriptResult, type ScriptResult, type ScriptResultLimits, type ScriptResultProblem } from "./scriptResult";

/**
 * The program a plot script is evaluated INSIDE.
 *
 * `ProgramEngine.evaluate` is the REPL's door: a direct `eval` in a loaded
 * instance's scope (`bootstrap.ts`, `__pluginHost.evaluate`). It needs an
 * instance, so a consumer loads this one — a plugin with one widget that
 * renders nothing — and evaluates every script against it. Loading it once
 * per tile is enough; the script's own declarations are scoped to each
 * evaluation and never leak between runs.
 */
export const PLOT_HOST_PROGRAM = `
definePlugin(() => ({
  id: "plot-script-host",
  title: "plot script host",
  widgets: { main: { render: () => ({ kind: "text", text: "" }), handlers: {} } },
}));
`;

/**
 * Assemble the code `evaluate` runs for a plot script.
 *
 * The shape is dictated by two facts about the engines. First, `evaluate` is
 * a direct eval, so `code` must be an EXPRESSION — a bare `return` at the top
 * level is a SyntaxError — hence the immediately-invoked arrow that scopes
 * the shim's `const`s and gives the body a function to `return` from.
 * Second, the value comes back through `__describe`, which truncates arrays
 * at 200 items and objects at depth 8 to keep REPL output readable; a plot's
 * rows would be silently cut. A string passes `__describe` untouched, so the
 * result crosses the boundary as `JSON.stringify` output and is parsed on
 * this side. That is also exactly the JSON-only rule `contracts.ts` states.
 *
 * The body is synchronous. `await` needs the host to drive the engine's
 * promise jobs, which neither engine's `evaluate` does today; when a `sql`
 * binding arrives it brings that with it.
 */
export function buildPlotScriptCode(source: string): string {
  // `console` is a local that shadows whatever the engine provides, so a
  // script's console.log lands in the tile rather than the browser console
  // and travels back inside the same JSON string as the result. Logs from a
  // run that THROWS are lost with it — the string is never produced.
  return (
    `JSON.stringify((() => {${PLOT_AUTHOR_SHIM}\n` +
    `const __logs = [];\n` +
    `const __log = (level) => (...args) => { __logs.push({ level, text: args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ") }); };\n` +
    `const console = { log: __log("log"), info: __log("info"), warn: __log("warn"), error: __log("error"), debug: __log("log") };\n` +
    `const __value = (() => {\n${source}\n})();\n` +
    `return { value: __value === undefined ? null : __value, logs: __logs };\n` +
    `})())`
  );
}

export interface ScriptLog {
  level: "log" | "info" | "warn" | "error";
  text: string;
}

export interface RunPlotScriptInput {
  instanceId: string;
  source: string;
  limits?: ScriptResultLimits;
}

export type PlotScriptRun =
  | { status: "ok"; result: ScriptResult; logs: ScriptLog[]; ms: number }
  | { status: "invalid"; problem: ScriptResultProblem; logs: ScriptLog[]; ms: number }
  | { status: "error"; error: unknown; logs: ScriptLog[]; ms: number };

/**
 * Evaluate a plot script in a loaded `PLOT_HOST_PROGRAM` instance and check
 * the result. The instance must already be loaded by the caller:
 *
 *     await engine.load({ instanceId, programId: "plot-script-host", source: PLOT_HOST_PROGRAM });
 *     const run = await runPlotScript(engine, { instanceId, source });
 *
 * A thrown error (syntax, reference, timeout) is returned as `status: "error"`
 * with the engine's own error, which `toProgramError` knows how to describe.
 */
export async function runPlotScript(engine: ProgramEngine, input: RunPlotScriptInput): Promise<PlotScriptRun> {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const elapsed = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) - started;
  let raw: unknown;
  try {
    ({ value: raw } = await engine.evaluate({ instanceId: input.instanceId, code: buildPlotScriptCode(input.source), pluginState: null, globalState: null }));
  } catch (error) {
    return { status: "error", error, logs: [], ms: elapsed() };
  }
  if (typeof raw !== "string") {
    return { status: "invalid", problem: { kind: "not-an-object", got: typeof raw }, logs: [], ms: elapsed() };
  }
  let parsed: { value?: unknown; logs?: unknown };
  try {
    parsed = JSON.parse(raw) as { value?: unknown; logs?: unknown };
  } catch (error) {
    return { status: "error", error, logs: [], ms: elapsed() };
  }
  const logs = Array.isArray(parsed.logs) ? (parsed.logs as ScriptLog[]) : [];
  const checked = checkScriptResult(parsed.value, input.limits);
  return checked.ok ? { status: "ok", result: checked.result, logs, ms: elapsed() } : { status: "invalid", problem: checked.problem, logs, ms: elapsed() };
}
