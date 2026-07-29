import { describe, expect, test } from "vitest";
import { createDefaultGraphic, rootView } from "../src/model/graphicAuthoring";
import type { Field, Table } from "../src/model/table";

const field = (
  name: string,
  type: Field["type"],
  inferred_from: Field["inferred_from"] = "values",
): Field => ({ name, type, inferred_from });
const tableOf = (fields: Field[], rows: Record<string, unknown>[]): Table => ({
  source: { kind: "dataset", drop: "lab" },
  fields,
  rows,
  row_count: rows.length,
  truncated: false,
  strategy: "head",
});

describe("default chart authoring", () => {
  test("prefers temporal x, payload quantitative y, a real dimension, and line", () => {
    const table = tableOf(
      [
        { ...field("time", "t", "envelope"), distinct: 4 },
        { ...field("seq", "q", "envelope"), distinct: 4 },
        { ...field("data.temp", "q"), distinct: 4 },
        { ...field("data.ok", "n"), distinct: 2 },
        { ...field("data.station", "n"), distinct: 4 },
      ],
      [
        {
          time: "2026-07-24T00:00:00Z",
          seq: 1,
          "data.temp": 21,
          "data.ok": true,
          "data.station": "n",
        },
      ],
    );
    const view = rootView(createDefaultGraphic("test", "test", table));
    expect(view.encodings.x?.name).toBe("time");
    expect(view.encodings.y?.name).toBe("data.temp");
    expect(view.encodings.color?.name).toBe("data.station");
    expect(view.mark).toBe("line");
  });

  test("never colors by envelope metadata", () => {
    const table = tableOf(
      [
        { ...field("stream", "n", "envelope"), distinct: 2 },
        { ...field("time", "t", "envelope"), distinct: 4 },
        { ...field("data.temp", "q"), distinct: 4 },
        { ...field("data.station", "n"), distinct: 4 },
      ],
      [{ stream: "temps", time: "2026-07-24T00:00:00Z", "data.temp": 21, "data.station": "n" }],
    );
    expect(rootView(createDefaultGraphic("test", "test", table)).encodings.color?.name).toBe(
      "data.station",
    );
  });

  test("skips dimensions too large for the categorical palette", () => {
    const table = tableOf(
      [field("data.x", "q"), field("data.y", "q"), { ...field("data.uid", "n"), distinct: 400 }],
      [{ "data.x": 1, "data.y": 2, "data.uid": "x" }],
    );
    expect(rootView(createDefaultGraphic("test", "test", table)).encodings.color).toBeUndefined();
  });

  test("falls back to two quantitative fields and a scatter", () => {
    const table = tableOf([field("a", "q"), field("b", "q")], [{ a: 1, b: 2 }]);
    const view = rootView(createDefaultGraphic("test", "test", table));
    expect(view.encodings.x?.name).toBe("a");
    expect(view.encodings.y?.name).toBe("b");
    expect(view.mark).toBe("point");
  });
});
