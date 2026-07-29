import * as duckdb from "@duckdb/duckdb-wasm";
import { DUCKDB_LOCAL_BUNDLES } from "./assets";
import type {
  ArrowResultPort,
  DuckDBConnectionPort,
  DuckDBFactory,
  DuckDBPort,
  PreparedStatementPort,
} from "./ports";
import { quoteStringLiteral } from "./quote";

class BrowserPreparedStatement implements PreparedStatementPort {
  constructor(private readonly statement: duckdb.AsyncPreparedStatement) {}

  query(...params: unknown[]): Promise<ArrowResultPort> {
    return this.statement.query(...params) as Promise<ArrowResultPort>;
  }

  close(): Promise<void> {
    return this.statement.close();
  }
}

class BrowserConnection implements DuckDBConnectionPort {
  constructor(private readonly connection: duckdb.AsyncDuckDBConnection) {}

  query(sql: string): Promise<ArrowResultPort> {
    return this.connection.query(sql) as Promise<ArrowResultPort>;
  }

  async prepare(sql: string): Promise<PreparedStatementPort> {
    return new BrowserPreparedStatement(await this.connection.prepare(sql));
  }

  close(): Promise<void> {
    return this.connection.close();
  }
}

class BrowserDuckDB implements DuckDBPort {
  constructor(private readonly database: duckdb.AsyncDuckDB) {}

  async connect(): Promise<DuckDBConnectionPort> {
    const connection = new BrowserConnection(await this.database.connect());
    const repository = new URL(
      `${import.meta.env.BASE_URL}duckdb-extensions`,
      globalThis.location.href,
    ).href.replace(/\/$/, "");
    await connection.query(`SET custom_extension_repository = ${quoteStringLiteral(repository)}`);
    return connection;
  }

  registerFileText(name: string, text: string): Promise<void> {
    return this.database.registerFileText(name, text);
  }

  dropFile(name: string): Promise<unknown> {
    return this.database.dropFile(name);
  }

  getVersion(): Promise<string> {
    return this.database.getVersion();
  }

  terminate(): Promise<void> {
    return this.database.terminate();
  }
}

export class BrowserDuckDBFactory implements DuckDBFactory {
  async create(): Promise<DuckDBPort> {
    const bundle = await duckdb.selectBundle(DUCKDB_LOCAL_BUNDLES);
    if (!bundle.mainWorker) throw new Error("selected DuckDB bundle has no local worker asset");
    const worker = new Worker(bundle.mainWorker);
    const database = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
    try {
      await database.instantiate(bundle.mainModule, bundle.pthreadWorker);
      return new BrowserDuckDB(database);
    } catch (cause) {
      await database.terminate();
      throw cause;
    }
  }
}
