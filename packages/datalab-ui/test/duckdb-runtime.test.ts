import { describe, expect, test } from "vitest";
import type { LogicalGraphic } from "../src/model/graphic";
import type { Table } from "../src/model/table";
import type {
  ArrowResultPort,
  DuckDBConnectionPort,
  DuckDBFactory,
  DuckDBPort,
  MemoryObserver,
  PreparedStatementPort,
} from "../src/analysis/ports";
import { AnalysisRuntime } from "../src/analysis/runtime";
import type { AnalysisRequest } from "../src/analysis/types";

class FakePrepared implements PreparedStatementPort {
  closed = false;
  params: unknown[] = [];

  constructor(
    private readonly result: ArrowResultPort,
    private readonly delayMs = 0,
    private readonly activity?: { active: number; peak: number },
  ) {}

  async query(...params: unknown[]): Promise<ArrowResultPort> {
    this.params = params;
    if (this.activity) {
      this.activity.active += 1;
      this.activity.peak = Math.max(this.activity.peak, this.activity.active);
    }
    if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    if (this.activity) this.activity.active -= 1;
    return this.result;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

class FakeConnection implements DuckDBConnectionPort {
  queries: string[] = [];
  preparedSQL: string[] = [];
  prepared: FakePrepared[] = [];
  closed = false;
  activity = { active: 0, peak: 0 };

  constructor(
    private result: ArrowResultPort,
    private delayMs = 0,
  ) {}

  async query(sql: string): Promise<ArrowResultPort> {
    this.queries.push(sql);
    return { numRows: 0, toArray: () => [] };
  }

  async prepare(sql: string): Promise<PreparedStatementPort> {
    this.preparedSQL.push(sql);
    const statement = new FakePrepared(this.result, this.delayMs, this.activity);
    this.prepared.push(statement);
    return statement;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

class FakeDB implements DuckDBPort {
  texts: Array<{ name: string; text: string }> = [];
  dropped: string[] = [];
  terminated = false;

  constructor(readonly connection: FakeConnection) {}

  async connect(): Promise<DuckDBConnectionPort> {
    return this.connection;
  }

  async registerFileText(name: string, text: string): Promise<void> {
    this.texts.push({ name, text });
  }

  async dropFile(name: string): Promise<unknown> {
    this.dropped.push(name);
    return null;
  }

  async getVersion(): Promise<string> {
    return "v1.32.0";
  }

  async terminate(): Promise<void> {
    this.terminated = true;
  }
}

class FakeFactory implements DuckDBFactory {
  databases: FakeDB[] = [];

  constructor(
    private readonly result: ArrowResultPort,
    private readonly delayMs = 0,
  ) {}

  async create(): Promise<DuckDBPort> {
    const db = new FakeDB(new FakeConnection(this.result, this.delayMs));
    this.databases.push(db);
    return db;
  }
}

class FakeMemory implements MemoryObserver {
  samples = 0;

  async sample() {
    this.samples += 1;
    return {
      jsHeapBytes: this.samples * 1_000,
      source: "browser-api" as const,
      limitations: ["fake observation"],
    };
  }
}

const species = {
  id: "field:source:species",
  name: "species",
  valueType: { physical: { kind: "string" as const }, nullable: false },
  semanticType: "nominal" as const,
  provenance: { kind: "source" as const, sourceId: "source", path: "species" },
};
const count = {
  id: "field:source:count",
  name: "count",
  valueType: { physical: { kind: "int64" as const }, nullable: false },
  semanticType: "quantitative" as const,
  provenance: { kind: "source" as const, sourceId: "source", path: "count" },
};
const score = {
  id: "field:source:score",
  name: "score",
  valueType: { physical: { kind: "float64" as const }, nullable: true },
  semanticType: "quantitative" as const,
  provenance: { kind: "source" as const, sourceId: "source", path: "score" },
};
const relation = {
  fields: [species, count, score],
  coverage: { kind: "bounded" as const, strategy: "head" as const, rows: 2, hasMore: false },
};
const logical: LogicalGraphic = {
  documentId: "doc",
  operations: [
    {
      id: "operation:source",
      kind: "core:scan",
      sourceId: "source",
      output: "value:source",
      relation,
      origin: "source",
    },
  ],
  relations: { "value:source": relation },
  views: {
    view: {
      id: "view",
      relation: "value:source",
      mark: "point",
      encodings: { x: species.id, y: score.id },
      yScale: "linear",
      analysis: { kind: "identity" },
      facetScales: "fixed",
    },
  },
  rootView: "view",
};
const table: Table = {
  source: { kind: "dataset", drop: "lab", dataset: "birds", version: 1, path: "rows.ndjson" },
  fields: [
    { name: "species", type: "n", inferred_from: "values" },
    { name: "count", type: "q", inferred_from: "values" },
    { name: "score", type: "q", inferred_from: "values" },
  ],
  rows: [
    { species: "a", count: 1, score: 2 },
    { species: "b", count: 2, score: 3 },
  ],
  row_count: 2,
  truncated: false,
  strategy: "head",
};

function request(overrides: Partial<AnalysisRequest> = {}): AnalysisRequest {
  return {
    requestId: "request-1",
    namespace: "workbench-1",
    generation: 1,
    sourceKey: "dataset:lab:birds:1:rows.ndjson:2000",
    sourceId: "source",
    table,
    logical,
    relation: "value:source",
    maxResultRows: 2,
    ...overrides,
  };
}

function arrowRows(rows: Array<Record<string, unknown>>): ArrowResultPort {
  return {
    numRows: rows.length,
    toArray: () => rows.map((row) => ({ toJSON: () => row })),
  };
}

describe("single-worker DuckDB runtime", () => {
  test("registers NDJSON, binds the cap, normalizes scalars, and records load metrics", async () => {
    const factory = new FakeFactory(
      arrowRows([
        { species: "a", count: 2n, score: 2.5 },
        {
          species: "b",
          count: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
          score: Number.POSITIVE_INFINITY,
        },
        { species: "c", count: 3n, score: 4 },
      ]),
    );
    const memory = new FakeMemory();
    const runtime = new AnalysisRuntime(factory, memory);
    const execution = await runtime.execute(request());
    const db = factory.databases[0]!;

    expect(db.texts).toHaveLength(1);
    expect(db.texts[0]!.text.split("\n").filter(Boolean)).toHaveLength(2);
    expect(db.connection.queries[0]).toContain(
      'CREATE TABLE "source_1" ("species" VARCHAR NOT NULL, "count" BIGINT NOT NULL, "score" DOUBLE)',
    );
    expect(db.connection.queries[1]).toBe(`COPY "source_1" FROM 'source_1.ndjson' (FORMAT JSON)`);
    expect(db.connection.prepared[0]?.params).toEqual([3]);
    expect(db.connection.preparedSQL[0]).toContain("LIMIT ?");
    expect(db.connection.prepared[0]?.closed).toBe(true);
    expect(execution.result.rows).toEqual([
      { species: "a", count: 2, score: 2.5 },
      { species: "b", count: "9007199254740992", score: null },
    ]);
    expect(execution.result.resultTruncated).toBe(true);
    expect(execution.result.diagnostics.map((item) => item.code)).toContain("duckdb.non-finite");
    expect(execution.metrics).toMatchObject({
      engineVersion: "v1.32.0",
      workerGeneration: 1,
      sourceRows: 2,
      resultRows: 2,
      resultTruncated: true,
      parameterCount: 1,
    });
    expect(execution.metrics.sourceBytes.bytes).toBeGreaterThan(0);
    expect(execution.metrics.resultBytes.bytes).toBeGreaterThan(0);
    expect(execution.metrics.memoryAfterQuery?.source).toBe("browser-api");
    expect(memory.samples).toBe(4);

    const again = await runtime.execute(request({ requestId: "request-2", generation: 2 }));
    expect(db.texts).toHaveLength(1);
    expect(db.connection.queries.filter((sql) => sql.startsWith("COPY"))).toHaveLength(1);
    expect(again.metrics.serializeMs).toBe(0);
    expect(again.metrics.registerMs).toBe(0);
    expect(again.metrics.startupMs).toBe(0);
    await runtime.dispose();
    expect(db.connection.closed).toBe(true);
    expect(db.terminated).toBe(true);
    expect(db.dropped).toEqual([db.texts[0]!.name]);
  });

  test("replaces a changed source and creates an explicit empty typed relation", async () => {
    const factory = new FakeFactory(arrowRows([]));
    const runtime = new AnalysisRuntime(factory, new FakeMemory());
    await runtime.execute(request());
    const db = factory.databases[0]!;
    await runtime.execute(
      request({
        requestId: "empty",
        generation: 2,
        sourceKey: "empty-source",
        table: { ...table, rows: [], row_count: 0 },
      }),
    );

    expect(db.connection.queries.some((sql) => sql.startsWith("DROP TABLE IF EXISTS"))).toBe(true);
    expect(db.connection.queries.some((sql) => sql.startsWith("CREATE TABLE"))).toBe(true);
    expect(db.texts).toHaveLength(1);
    expect(db.dropped).toEqual([db.texts[0]!.name]);
  });

  test("serializes concurrent requests through one connection", async () => {
    const factory = new FakeFactory(arrowRows([]), 15);
    const runtime = new AnalysisRuntime(factory, new FakeMemory());
    await Promise.all([
      runtime.execute(request({ requestId: "one" })),
      runtime.execute(request({ requestId: "two", generation: 2 })),
    ]);
    expect(factory.databases[0]!.connection.activity.peak).toBe(1);
  });

  test("purge terminates authorized data and later execution creates a fresh worker", async () => {
    const factory = new FakeFactory(arrowRows([]));
    const runtime = new AnalysisRuntime(factory, new FakeMemory());
    await runtime.execute(request());
    await runtime.purge();
    expect(factory.databases[0]!.terminated).toBe(true);

    const execution = await runtime.execute(request({ requestId: "after-purge" }));
    expect(factory.databases).toHaveLength(2);
    expect(execution.metrics.workerGeneration).toBe(2);
  });

  test("rejects unsupported source values and invalid result limits with structured phases", async () => {
    const factory = new FakeFactory(arrowRows([]));
    const runtime = new AnalysisRuntime(factory, new FakeMemory());
    await expect(
      runtime.execute(
        request({ table: { ...table, rows: [{ species: { nested: true }, count: 1, score: 2 }] } }),
      ),
    ).rejects.toMatchObject({ phase: "serialize", code: "serialize.unsupported-value" });
    await expect(runtime.execute(request({ maxResultRows: -1 }))).rejects.toMatchObject({
      phase: "compile",
      code: "result.limit",
      retryable: false,
    });
  });
});
