import { createEvalEngine, type ProgramEngine, type ScriptResultLimits } from "@hyperslop-systems/pbui-sandbox";
import { createDraftStore, type DraftStore } from "./draftStore";
import { createPlotScriptRunner, type PlotScriptRunner } from "./runner";

/**
 * What the two tiles share: the engine, the runner over it, and the draft
 * store. One per workbench, created by the product and handed to
 * `createPlotScriptApps`.
 */
export interface PlotScriptHost {
  engine: ProgramEngine;
  runner: PlotScriptRunner;
  drafts: DraftStore;
}

export interface CreatePlotScriptHostOptions {
  /**
   * Defaults to `createEvalEngine()` (design D5): a user evaluating their own
   * code in their own tab is not a privilege escalation. The moment scripts
   * become SHAREABLE — a template, a bundle, an agent-authored script — pass
   * `createQuickJsEngine({ worker })` here; nothing else changes.
   */
  engine?: ProgramEngine;
  debounceMs?: number;
  limits?: ScriptResultLimits;
}

export function createPlotScriptHost(options: CreatePlotScriptHostOptions = {}): PlotScriptHost {
  const engine = options.engine ?? createEvalEngine();
  return {
    engine,
    runner: createPlotScriptRunner({ engine, ...(options.debounceMs !== undefined ? { debounceMs: options.debounceMs } : {}), ...(options.limits ? { limits: options.limits } : {}) }),
    drafts: createDraftStore(),
  };
}

/** The binding key both applications read: `view.documents.plot` names the script. */
export const PLOT_BINDING = "plot";
