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

/**
 * Where the same-origin DuckDB extension repository lives, derived from where
 * the wasm runtime itself was served from.
 *
 * ## Why not `import.meta.env.BASE_URL`
 *
 * That was the previous implementation, and it is a constant Vite substitutes
 * when THIS PACKAGE is built — with the library's own base of `/` — not when
 * an embedding shell is built with its base of `/static/`. The published
 * bundle therefore asked every deployment for `/duckdb-extensions/...` at the
 * root, and in datalab (assets mounted under `/static/`) each request 404ed:
 * extension autoloading failed, every analysis query errored, and each chart
 * tile showed "no source" with the rows already fetched.
 *
 * The wasm `?url` imports in `assets.ts` do not have this problem — they stay
 * external in the library build and are resolved by the CONSUMER's Vite — so
 * the selected bundle's own URL is the one value that is correct in every
 * topology. Two cases:
 *
 *  - **A dev server** serves the wasm straight out of `node_modules`, and the
 *    package's public directory at the configured base — which in every dev
 *    topology (this package's demo from source, a consumer dev-serving the
 *    prebuilt dist) is `/`, matching the baked `BASE_URL`.
 *  - **A production build** emits the wasm into the assets directory one
 *    level below the base, and Vite copies `public/duckdb-extensions` (via
 *    the `datalabPublicDir` helper) to the base itself — so the repository is
 *    the asset's sibling directory one level up.
 */
export function extensionRepositoryFor(
  mainModule: string,
  baseUrl: string,
  locationHref: string,
): string {
  const resolved = new URL(mainModule, locationHref);
  const repository = resolved.pathname.includes("/node_modules/")
    ? new URL(`${baseUrl}duckdb-extensions`, locationHref)
    : new URL("../duckdb-extensions", resolved);
  return repository.href.replace(/\/$/, "");
}

class BrowserDuckDB implements DuckDBPort {
  constructor(
    private readonly database: duckdb.AsyncDuckDB,
    private readonly extensionRepository: string,
  ) {}

  async connect(): Promise<DuckDBConnectionPort> {
    const connection = new BrowserConnection(await this.database.connect());
    await connection.query(
      `SET custom_extension_repository = ${quoteStringLiteral(this.extensionRepository)}`,
    );
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
    const repository = extensionRepositoryFor(
      bundle.mainModule,
      import.meta.env.BASE_URL,
      globalThis.location.href,
    );
    try {
      await database.instantiate(bundle.mainModule, bundle.pthreadWorker);
      return new BrowserDuckDB(database, repository);
    } catch (cause) {
      await database.terminate();
      throw cause;
    }
  }
}
