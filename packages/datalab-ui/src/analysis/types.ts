import type {
  Coverage,
  Diagnostic,
  FieldSymbol,
  LogicalGraphic,
  SourceNodeId,
  ValueId,
} from "../model/graphic";
import type { AnalyticalField, Row, Table } from "../model/table";

export const DUCKDB_TARGET_VERSION = 1;

export type DuckDBParameter = null | boolean | number | string;

export interface RegisteredSource {
  sourceId: SourceNodeId;
  relationName: string;
}

export interface CompiledRelation {
  sql: string;
  params: DuckDBParameter[];
  output: FieldSymbol[];
  relation: ValueId;
  targetVersion: number;
  operations: Array<{ operationId: string; cte: string }>;
}

export interface PhysicalCompileResult {
  compiled: CompiledRelation | null;
  diagnostics: Diagnostic[];
}

export type AnalysisPhase =
  | "asset-load"
  | "instantiate"
  | "serialize"
  | "register-source"
  | "compile"
  | "execute"
  | "normalize"
  | "dispose";

export interface AnalysisError {
  phase: AnalysisPhase;
  code: string;
  message: string;
  retryable: boolean;
  cause?: unknown;
}

export interface ByteObservation {
  bytes: number;
  kind: "measured-utf8" | "serialized-size" | "estimated-json";
}

export interface MemoryObservation {
  jsHeapBytes?: number;
  wasmBytes?: number;
  workerBytes?: number;
  source: "browser-api" | "runtime-api" | "estimate";
  limitations: string[];
}

export interface AnalysisMetrics {
  engineVersion: string;
  targetVersion: number;
  workerGeneration: number;
  startupMs: number;
  serializeMs: number;
  registerMs: number;
  compileMs: number;
  executeMs: number;
  normalizeMs: number;
  totalMs: number;
  sourceRows: number;
  sourceBytes: ByteObservation;
  resultRows: number;
  resultBytes: ByteObservation;
  resultTruncated: boolean;
  parameterCount: number;
  memoryBefore?: MemoryObservation;
  memoryAfterRegistration?: MemoryObservation;
  memoryPeakObserved?: MemoryObservation;
  memoryAfterQuery?: MemoryObservation;
}

export interface AnalysisResult {
  rows: Row[];
  fields: AnalyticalField[];
  err: null;
  dropped: Record<string, never>;
  coverage: Coverage;
  resultTruncated: boolean;
  resultLimit: number;
  diagnostics: Diagnostic[];
}

export interface AnalysisRequest {
  requestId: string;
  namespace: string;
  generation: number;
  sourceKey: string;
  sourceId: SourceNodeId;
  table: Table;
  logical: LogicalGraphic;
  relation: ValueId;
  maxResultRows: number;
}

export interface AnalysisExecution {
  requestId: string;
  generation: number;
  result: AnalysisResult;
  metrics: AnalysisMetrics;
}
