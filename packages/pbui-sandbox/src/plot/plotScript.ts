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
  return `JSON.stringify((() => {${PLOT_AUTHOR_SHIM}\nreturn (() => {\n${source}\n})();\n})())`;
}

export interface RunPlotScriptInput {
  instanceId: string;
  source: string;
  limits?: ScriptResultLimits;
}

export type PlotScriptRun =
  | { status: "ok"; result: ScriptResult; ms: number }
  | { status: "invalid"; problem: ScriptResultProblem; ms: number }
  | { status: "error"; error: unknown; ms: number };

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
    return { status: "error", error, ms: elapsed() };
  }
  if (typeof raw !== "string") {
    // `JSON.stringify(undefined)` is `undefined`, described as `{ $type: "undefined" }`.
    return { status: "invalid", problem: { kind: "not-an-object", got: "undefined" }, ms: elapsed() };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { status: "error", error, ms: elapsed() };
  }
  const checked = checkScriptResult(parsed, input.limits);
  return checked.ok ? { status: "ok", result: checked.result, ms: elapsed() } : { status: "invalid", problem: checked.problem, ms: elapsed() };
}
