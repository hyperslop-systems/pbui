import type { PlotData, PlotDocument, PlotSchema, PlotViewState } from "@hyperslop-systems/plot";

/**
 * What a plot script must return. Everything in it is JSON: the document is
 * `renderPlot`'s input, the schema names the fields, the data carries the rows
 * and an honest coverage statement.
 *
 * The type import from `@hyperslop-systems/plot` is type-only and erased at
 * build, so this module adds no runtime dependency to the sandbox; `plot` is
 * a devDependency here, used by the parity test.
 */
export interface ScriptResult {
  document: PlotDocument;
  schema: PlotSchema;
  data: PlotData;
  /** Optional initial interaction state; passed through untouched. */
  view?: PlotViewState;
}

export type ScriptResultProblem =
  | { kind: "not-an-object"; got: string }
  | { kind: "missing"; field: "document" | "schema" | "data" }
  | { kind: "not-an-object-field"; field: "document" | "schema" | "data" | "data.coverage" }
  | { kind: "bad-format"; got: unknown }
  | { kind: "bad-version"; got: unknown }
  | { kind: "not-an-array"; field: "document.layers" | "schema.fields" | "data.rows" }
  | { kind: "bad-coverage"; got: unknown }
  | { kind: "too-many-rows"; got: number; limit: number }
  | { kind: "too-many-plots"; got: number; limit: number }
  | { kind: "empty-list" }
  | { kind: "in-list"; index: number; problem: ScriptResultProblem };

export interface ScriptResultLimits {
  rows: number;
  /** How many results one script may return as a list. */
  plots: number;
}

export const DEFAULT_SCRIPT_RESULT_LIMITS: ScriptResultLimits = { rows: 200_000, plots: 12 };

export type ScriptResultCheck = { ok: true; result: ScriptResult } | { ok: false; problem: ScriptResultProblem };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A structural guard over an untrusted value: is this SHAPED like a plot
 * request? It returns a problem rather than throwing, and never a bare
 * boolean, because the tile has to tell the author what is wrong.
 *
 * Everything past this guard is `renderPlot`'s job, and `renderPlot` is
 * already total — an authoring mistake returns diagnostics rather than
 * throwing (`plot/src/render.ts`). So this checks only the envelope: the
 * three fields exist and are objects, the document carries the format and
 * version literals, the arrays are arrays, coverage is one of its two kinds,
 * and the row count is under the limit.
 */
export type ScriptResultsCheck = { ok: true; results: ScriptResult[] } | { ok: false; problem: ScriptResultProblem };

/**
 * A script may return ONE result or a LIST of them — several plots in one
 * tile, each an independent request. A list is checked element by element
 * and a problem names its index; an empty list is a problem of its own,
 * because "return []" is almost always a filter that removed everything.
 */
export function checkScriptResults(value: unknown, limits: ScriptResultLimits = DEFAULT_SCRIPT_RESULT_LIMITS): ScriptResultsCheck {
  if (!Array.isArray(value)) {
    const one = checkScriptResult(value, limits);
    return one.ok ? { ok: true, results: [one.result] } : one;
  }
  if (value.length === 0) return { ok: false, problem: { kind: "empty-list" } };
  if (value.length > limits.plots) return { ok: false, problem: { kind: "too-many-plots", got: value.length, limit: limits.plots } };
  const results: ScriptResult[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const one = checkScriptResult(value[index], limits);
    if (!one.ok) return { ok: false, problem: { kind: "in-list", index, problem: one.problem } };
    results.push(one.result);
  }
  return { ok: true, results };
}

export function checkScriptResult(value: unknown, limits: ScriptResultLimits = DEFAULT_SCRIPT_RESULT_LIMITS): ScriptResultCheck {
  if (!isRecord(value)) return { ok: false, problem: { kind: "not-an-object", got: value === null ? "null" : Array.isArray(value) ? "array" : typeof value } };
  for (const field of ["document", "schema", "data"] as const) {
    if (!(field in value)) return { ok: false, problem: { kind: "missing", field } };
    if (!isRecord(value[field])) return { ok: false, problem: { kind: "not-an-object-field", field } };
  }
  const document = value.document as Record<string, unknown>;
  const schema = value.schema as Record<string, unknown>;
  const data = value.data as Record<string, unknown>;

  if (document.format !== "hyperslop.plot") return { ok: false, problem: { kind: "bad-format", got: document.format } };
  if (document.version !== 1) return { ok: false, problem: { kind: "bad-version", got: document.version } };
  if (!Array.isArray(document.layers)) return { ok: false, problem: { kind: "not-an-array", field: "document.layers" } };
  if (!Array.isArray(schema.fields)) return { ok: false, problem: { kind: "not-an-array", field: "schema.fields" } };
  if (!Array.isArray(data.rows)) return { ok: false, problem: { kind: "not-an-array", field: "data.rows" } };
  if (!isRecord(data.coverage)) return { ok: false, problem: { kind: "not-an-object-field", field: "data.coverage" } };
  const coverage = data.coverage;
  const kind = coverage.kind;
  if (kind !== "complete" && kind !== "bounded") return { ok: false, problem: { kind: "bad-coverage", got: kind } };
  if (typeof coverage.rowCount !== "number") return { ok: false, problem: { kind: "bad-coverage", got: coverage } };
  if (kind === "bounded" && (typeof coverage.hasMore !== "boolean" || (coverage.strategy !== "head" && coverage.strategy !== "latest"))) {
    return { ok: false, problem: { kind: "bad-coverage", got: coverage } };
  }
  if (data.rows.length > limits.rows) return { ok: false, problem: { kind: "too-many-rows", got: data.rows.length, limit: limits.rows } };

  return { ok: true, result: value as unknown as ScriptResult };
}

/** One line a tile can show for a problem. */
export function describeScriptResultProblem(problem: ScriptResultProblem): string {
  switch (problem.kind) {
    case "not-an-object":
      return `the script returned ${problem.got}; return { document, schema, data }, or a list of them`;
    case "missing":
      return `the result has no "${problem.field}"`;
    case "not-an-object-field":
      return `"${problem.field}" must be an object`;
    case "bad-format":
      return `document.format must be "hyperslop.plot" (got ${JSON.stringify(problem.got)}); build it with plot({ … })`;
    case "bad-version":
      return `document.version must be 1 (got ${JSON.stringify(problem.got)})`;
    case "not-an-array":
      return `"${problem.field}" must be an array`;
    case "bad-coverage":
      return `data.coverage must be { kind: "complete", rowCount } or { kind: "bounded", rowCount, hasMore, strategy }`;
    case "too-many-rows":
      return `${problem.got} rows exceeds the limit of ${problem.limit}`;
    case "too-many-plots":
      return `${problem.got} plots exceeds the limit of ${problem.limit} in one tile`;
    case "empty-list":
      return "the script returned an empty list; return one result, or a list of them";
    case "in-list":
      return `plot ${problem.index + 1}: ${describeScriptResultProblem(problem.problem)}`;
  }
}
