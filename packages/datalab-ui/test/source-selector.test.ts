import { describe, expect, test } from "vitest";
import { DATASET_ROW_LIMIT, selectDocSourceTable } from "../src/apps/useTable";
import { api } from "../src/api/client";
import { makeStore } from "../src/store";
import { createGraphicDocument } from "../src/model/graphicAuthoring";
import type { Doc } from "../src/store/world";
import type { SourceRef, Table } from "../src/model/table";

function table(source: SourceRef, marker: string): Table {
  return {
    source,
    fields: [{ name: "marker", type: "n", inferred_from: "values" }],
    rows: [{ marker }],
    row_count: 1,
    truncated: false,
    strategy: source.kind === "stream" ? "latest" : "head",
  };
}

function doc(source: SourceRef, limit: number): Doc {
  return createGraphicDocument("doc", "test", source, limit);
}

describe("exact document table selectors", () => {
  test("dataset identity includes numeric version and uses the fixed product limit", async () => {
    const store = makeStore({ seed: false });
    const base = { drop: "lab", dataset: "birds", path: "rows.ndjson" };
    await store.dispatch(
      api.util.upsertQueryData(
        "datasetTable",
        { ...base, version: 1, limit: DATASET_ROW_LIMIT },
        table({ kind: "dataset", ...base, version: 1 }, "v1"),
      ),
    );
    await store.dispatch(
      api.util.upsertQueryData(
        "datasetTable",
        { ...base, version: 2, limit: DATASET_ROW_LIMIT },
        table({ kind: "dataset", ...base, version: 2 }, "v2"),
      ),
    );

    expect(
      selectDocSourceTable(store.getState(), doc({ kind: "dataset", ...base, version: 2 }, 500))
        ?.rows[0]?.marker,
    ).toBe("v2");
    expect(
      selectDocSourceTable(store.getState(), doc({ kind: "dataset", ...base, version: 2 }, 2_000))
        ?.rows[0]?.marker,
    ).toBe("v2");
  });

  test("stream identity includes order and row limit", async () => {
    const store = makeStore({ seed: false });
    const args = { drop: "lab", stream: "events", limit: 500 };
    const source = { kind: "stream", drop: "lab", stream: "events" } as const;
    await store.dispatch(
      api.util.upsertQueryData("streamTable", { ...args, order: "asc" }, table(source, "asc")),
    );
    await store.dispatch(
      api.util.upsertQueryData("streamTable", { ...args, order: "desc" }, table(source, "desc")),
    );

    expect(selectDocSourceTable(store.getState(), doc(source, 500))?.rows[0]?.marker).toBe("desc");
  });

  test("an unrequested exact key does not fall back to a similar cache entry", async () => {
    const store = makeStore({ seed: false });
    const source = {
      kind: "dataset",
      drop: "lab",
      dataset: "birds",
      version: 1,
      path: "rows.ndjson",
    } as const;
    await store.dispatch(
      api.util.upsertQueryData(
        "datasetTable",
        {
          drop: "lab",
          dataset: "birds",
          version: 1,
          path: "rows.ndjson",
          limit: DATASET_ROW_LIMIT - 1,
        },
        table(source, "cached"),
      ),
    );

    expect(selectDocSourceTable(store.getState(), doc(source, 501))).toBeUndefined();
  });
});
