export { PLOT_AUTHOR_SHIM, PLOT_AUTHOR_SHIM_NAMES, PLOT_AUTHOR_SHIM_VERSION } from "./authorShim";
export { DEFAULT_SCRIPT_RESULT_LIMITS, checkScriptResult, checkScriptResults, describeScriptResultProblem } from "./scriptResult";
export type { ScriptResult, ScriptResultCheck, ScriptResultLimits, ScriptResultProblem, ScriptResultsCheck } from "./scriptResult";
export { PLOT_HOST_PROGRAM, buildPlotScriptCode, runPlotScript } from "./plotScript";
export type { PlotScriptRun, RunPlotScriptInput, ScriptLog } from "./plotScript";
