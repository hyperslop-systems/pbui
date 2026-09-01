import { describe, expect, it } from "vitest";
import { checkScriptResult, describeScriptResultProblem } from "./scriptResult";

const VALID = {
  document: { format: "hyperslop.plot", version: 1, id: "p", variables: {}, composition: { dimensions: {} }, layers: [] },
  schema: { fields: [] },
  data: { rows: [{ x: 1 }], coverage: { kind: "complete", rowCount: 1 } },
};

const BOUNDED = { ...VALID, data: { rows: [], coverage: { kind: "bounded", rowCount: 0, hasMore: true, strategy: "latest" } } };

describe("checkScriptResult", () => {
  it("accepts a complete result, and a bounded one", () => {
    expect(checkScriptResult(VALID)).toEqual({ ok: true, result: VALID });
    expect(checkScriptResult(BOUNDED).ok).toBe(true);
  });

  it.each<[string, unknown, string]>([
    ["undefined", undefined, "not-an-object"],
    ["null", null, "not-an-object"],
    ["a string", "nope", "not-an-object"],
    ["an array", [VALID], "not-an-object"],
    ["missing document", { schema: VALID.schema, data: VALID.data }, "missing"],
    ["missing schema", { document: VALID.document, data: VALID.data }, "missing"],
    ["missing data", { document: VALID.document, schema: VALID.schema }, "missing"],
    ["document not an object", { ...VALID, document: "x" }, "not-an-object-field"],
    ["wrong format", { ...VALID, document: { ...VALID.document, format: "vega" } }, "bad-format"],
    ["wrong version", { ...VALID, document: { ...VALID.document, version: 2 } }, "bad-version"],
    ["layers not an array", { ...VALID, document: { ...VALID.document, layers: {} } }, "not-an-array"],
    ["fields not an array", { ...VALID, schema: { fields: "x" } }, "not-an-array"],
    ["rows not an array", { ...VALID, data: { ...VALID.data, rows: {} } }, "not-an-array"],
    ["no coverage", { ...VALID, data: { rows: [] } }, "not-an-object-field"],
    ["coverage kind unknown", { ...VALID, data: { rows: [], coverage: { kind: "sampled", rowCount: 0 } } }, "bad-coverage"],
    ["coverage rowCount missing", { ...VALID, data: { rows: [], coverage: { kind: "complete" } } }, "bad-coverage"],
    ["bounded without hasMore", { ...VALID, data: { rows: [], coverage: { kind: "bounded", rowCount: 0, strategy: "head" } } }, "bad-coverage"],
    ["bounded with a bad strategy", { ...VALID, data: { rows: [], coverage: { kind: "bounded", rowCount: 0, hasMore: false, strategy: "random" } } }, "bad-coverage"],
  ])("names the problem for %s", (_label, value, kind) => {
    const checked = checkScriptResult(value);
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.problem.kind).toBe(kind);
      expect(describeScriptResultProblem(checked.problem)).toBeTypeOf("string");
    }
  });

  it("enforces the row limit and says what it was", () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ i }));
    const checked = checkScriptResult({ ...VALID, data: { rows, coverage: { kind: "complete", rowCount: 11 } } }, { rows: 10 });
    expect(checked).toEqual({ ok: false, problem: { kind: "too-many-rows", got: 11, limit: 10 } });
  });
});
