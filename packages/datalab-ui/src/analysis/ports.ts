export interface ArrowRowPort {
  toJSON?(): Record<string, unknown>;
  [key: string]: unknown;
}

export interface ArrowResultPort {
  numRows: number;
  toArray(): ArrowRowPort[];
}

export interface PreparedStatementPort {
  query(...params: unknown[]): Promise<ArrowResultPort>;
  close(): Promise<void>;
}

export interface DuckDBConnectionPort {
  query(sql: string): Promise<ArrowResultPort>;
  prepare(sql: string): Promise<PreparedStatementPort>;
  close(): Promise<void>;
}

export interface DuckDBPort {
  connect(): Promise<DuckDBConnectionPort>;
  registerFileText(name: string, text: string): Promise<void>;
  dropFile(name: string): Promise<unknown>;
  getVersion(): Promise<string>;
  terminate(): Promise<void>;
}

export interface DuckDBFactory {
  create(): Promise<DuckDBPort>;
}

export interface MemoryObserver {
  sample(): Promise<{
    jsHeapBytes?: number;
    wasmBytes?: number;
    workerBytes?: number;
    source: "browser-api" | "runtime-api" | "estimate";
    limitations: string[];
  } | null>;
}
