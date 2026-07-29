import type { FieldSymbol } from "../model/graphic";
import { compileDuckDBRelation } from "./compile";
import { createEmptyRelationSQL, serializeTableNDJSON, type SerializedTable } from "./ingest";
import { normalizeArrowResult } from "./normalize";
import type {
  ArrowResultPort,
  DuckDBConnectionPort,
  DuckDBFactory,
  DuckDBPort,
  MemoryObserver,
} from "./ports";
import { quoteIdentifier, quoteStringLiteral } from "./quote";
import {
  DUCKDB_TARGET_VERSION,
  type AnalysisError,
  type AnalysisExecution,
  type AnalysisMetrics,
  type AnalysisPhase,
  type AnalysisRequest,
  type ByteObservation,
  type MemoryObservation,
} from "./types";

interface RegisteredTable {
  key: string;
  relationName: string;
  fileName: string | null;
  bytes: ByteObservation;
}

const now = (): number => performance.now();

export class BrowserMemoryObserver implements MemoryObserver {
  async sample(): Promise<MemoryObservation> {
    const memory = (
      performance as Performance & {
        memory?: { usedJSHeapSize?: number };
      }
    ).memory;
    return {
      ...(memory?.usedJSHeapSize === undefined ? {} : { jsHeapBytes: memory.usedJSHeapSize }),
      source: memory?.usedJSHeapSize === undefined ? "estimate" : "browser-api",
      limitations: [
        "Worker and WebAssembly resident memory are not exposed consistently by browser APIs",
      ],
    };
  }
}

export class AnalysisRuntime {
  private db: DuckDBPort | null = null;
  private connection: DuckDBConnectionPort | null = null;
  private engineVersion = "unknown";
  private workerGeneration = 0;
  private registered: RegisteredTable | null = null;
  private sequence = 0;
  private disposed = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly factory: DuckDBFactory,
    private readonly memory: MemoryObserver = new BrowserMemoryObserver(),
  ) {}

  execute(request: AnalysisRequest): Promise<AnalysisExecution> {
    if (this.disposed) {
      return Promise.reject(
        this.analysisError("execute", "runtime.disposed", "Analysis runtime is disposed", false),
      );
    }
    const operation = this.queue.then(() => this.executeNow(request));
    this.queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async ensureReady(): Promise<number> {
    if (this.db && this.connection) return 0;
    const started = now();
    this.db = await this.factory.create();
    this.connection = await this.db.connect();
    this.engineVersion = await this.db.getVersion();
    this.workerGeneration += 1;
    return now() - started;
  }

  private sourceFields(request: AnalysisRequest): FieldSymbol[] {
    const scan = request.logical.operations.find(
      (operation) => operation.kind === "core:scan" && operation.sourceId === request.sourceId,
    );
    if (!scan) throw new Error(`logical graph has no scan for source ${request.sourceId}`);
    return scan.relation.fields;
  }

  private async clearRegistered(): Promise<void> {
    if (!this.registered || !this.connection || !this.db) return;
    await this.connection.query(
      `DROP TABLE IF EXISTS ${quoteIdentifier(this.registered.relationName)}`,
    );
    if (this.registered.fileName) await this.db.dropFile(this.registered.fileName);
    this.registered = null;
  }

  private async registerSource(
    request: AnalysisRequest,
  ): Promise<{ serializeMs: number; registerMs: number; bytes: ByteObservation }> {
    if (this.registered?.key === request.sourceKey) {
      return { serializeMs: 0, registerMs: 0, bytes: this.registered.bytes };
    }
    await this.clearRegistered();
    if (!this.connection || !this.db) throw new Error("runtime is not ready");

    const relationName = `source_${++this.sequence}`;
    const fields = this.sourceFields(request);
    if (request.table.rows.length === 0) {
      const registeredAt = now();
      await this.connection.query(createEmptyRelationSQL(relationName, fields));
      const bytes = { bytes: 0, kind: "measured-utf8" } as const;
      this.registered = { key: request.sourceKey, relationName, fileName: null, bytes };
      return { serializeMs: 0, registerMs: now() - registeredAt, bytes };
    }

    const serializeAt = now();
    let serialized: SerializedTable;
    try {
      serialized = serializeTableNDJSON(request.table);
    } catch (cause) {
      throw this.analysisError(
        "serialize",
        "serialize.unsupported-value",
        cause instanceof Error ? cause.message : String(cause),
        false,
        cause,
      );
    }
    const serializeMs = now() - serializeAt;
    const fileName = `${relationName}.ndjson`;
    const registerAt = now();
    await this.db.registerFileText(fileName, serialized.text);
    try {
      await this.connection.query(createEmptyRelationSQL(relationName, fields));
      await this.connection.query(
        `COPY ${quoteIdentifier(relationName)} FROM ${quoteStringLiteral(fileName)} (FORMAT JSON)`,
      );
    } catch (cause) {
      await this.connection.query(`DROP TABLE IF EXISTS ${quoteIdentifier(relationName)}`);
      await this.db.dropFile(fileName);
      throw cause;
    }
    const bytes = { bytes: serialized.bytes, kind: "measured-utf8" } as const;
    this.registered = { key: request.sourceKey, relationName, fileName, bytes };
    return { serializeMs, registerMs: now() - registerAt, bytes };
  }

  private async executeNow(request: AnalysisRequest): Promise<AnalysisExecution> {
    if (!Number.isInteger(request.maxResultRows) || request.maxResultRows < 0) {
      throw this.analysisError(
        "compile",
        "result.limit",
        "Maximum result rows must be a non-negative integer",
        false,
      );
    }
    const totalAt = now();
    let phase: AnalysisPhase = "instantiate";
    const memoryBefore = await this.memory.sample();
    const partial: Partial<AnalysisMetrics> = {};
    try {
      partial.startupMs = await this.ensureReady();
      phase = "register-source";
      const registration = await this.registerSource(request);
      partial.serializeMs = registration.serializeMs;
      partial.registerMs = registration.registerMs;
      partial.sourceBytes = registration.bytes;
      const memoryAfterRegistration = await this.memory.sample();

      phase = "compile";
      const compileAt = now();
      const compiled = compileDuckDBRelation(request.logical, request.relation, [
        { sourceId: request.sourceId, relationName: this.registered!.relationName },
      ]);
      partial.compileMs = now() - compileAt;
      if (!compiled.compiled) {
        throw this.analysisError(
          "compile",
          "compile.failed",
          compiled.diagnostics.map((item) => item.message).join("; "),
          false,
        );
      }

      phase = "execute";
      const executeAt = now();
      const cappedSQL = `SELECT * FROM (${compiled.compiled.sql}) AS ${quoteIdentifier("bounded_result")} LIMIT ?`;
      const statement = await this.connection!.prepare(cappedSQL);
      let arrow: ArrowResultPort;
      try {
        arrow = await statement.query(...compiled.compiled.params, request.maxResultRows + 1);
      } finally {
        await statement.close();
      }
      partial.executeMs = now() - executeAt;
      const memoryPeakObserved = await this.memory.sample();

      phase = "normalize";
      const normalizeAt = now();
      const normalized = normalizeArrowResult(
        arrow,
        compiled.compiled.output,
        request.maxResultRows,
      );
      partial.normalizeMs = now() - normalizeAt;
      const memoryAfterQuery = await this.memory.sample();
      const relation = request.logical.relations[request.relation];
      if (!relation) throw new Error(`logical relation ${request.relation} disappeared`);

      const metrics: AnalysisMetrics = {
        engineVersion: this.engineVersion,
        targetVersion: DUCKDB_TARGET_VERSION,
        workerGeneration: this.workerGeneration,
        startupMs: partial.startupMs ?? 0,
        serializeMs: partial.serializeMs ?? 0,
        registerMs: partial.registerMs ?? 0,
        compileMs: partial.compileMs ?? 0,
        executeMs: partial.executeMs ?? 0,
        normalizeMs: partial.normalizeMs ?? 0,
        totalMs: now() - totalAt,
        sourceRows: request.table.rows.length,
        sourceBytes: partial.sourceBytes ?? { bytes: 0, kind: "estimated-json" },
        resultRows: normalized.rows.length,
        resultBytes: { bytes: normalized.bytes, kind: "serialized-size" },
        resultTruncated: normalized.truncated,
        parameterCount: compiled.compiled.params.length + 1,
        ...(memoryBefore ? { memoryBefore } : {}),
        ...(memoryAfterRegistration ? { memoryAfterRegistration } : {}),
        ...(memoryPeakObserved ? { memoryPeakObserved } : {}),
        ...(memoryAfterQuery ? { memoryAfterQuery } : {}),
      };
      return {
        requestId: request.requestId,
        generation: request.generation,
        result: {
          rows: normalized.rows,
          fields: normalized.fields,
          err: null,
          dropped: {},
          coverage: relation.coverage,
          resultTruncated: normalized.truncated,
          resultLimit: request.maxResultRows,
          diagnostics: [...compiled.diagnostics, ...normalized.diagnostics],
        },
        metrics,
      };
    } catch (cause) {
      if (this.isAnalysisError(cause)) throw cause;
      throw this.analysisError(
        phase,
        `${phase}.failed`,
        cause instanceof Error ? cause.message : String(cause),
        phase !== "compile" && phase !== "normalize",
        cause,
      );
    }
  }

  async purge(): Promise<void> {
    await this.queue;
    await this.shutdown(false);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.queue;
    await this.shutdown(true);
  }

  private async shutdown(permanent: boolean): Promise<void> {
    try {
      await this.clearRegistered();
      await this.connection?.close();
      await this.db?.terminate();
    } catch (cause) {
      throw this.analysisError(
        "dispose",
        "dispose.failed",
        cause instanceof Error ? cause.message : String(cause),
        true,
        cause,
      );
    } finally {
      this.connection = null;
      this.db = null;
      this.registered = null;
      if (!permanent) this.disposed = false;
    }
  }

  private analysisError(
    phase: AnalysisPhase,
    code: string,
    message: string,
    retryable: boolean,
    cause?: unknown,
  ): AnalysisError {
    return { phase, code, message, retryable, ...(cause === undefined ? {} : { cause }) };
  }

  private isAnalysisError(value: unknown): value is AnalysisError {
    return Boolean(
      value &&
        typeof value === "object" &&
        "phase" in value &&
        "code" in value &&
        "retryable" in value,
    );
  }
}
