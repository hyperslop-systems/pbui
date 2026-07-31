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
 * topology. Three cases:
 *
 *  - **A production build** emits the wasm into the assets directory one
 *    level below the base, and Vite copies `public/duckdb-extensions` (via
 *    the `datalabPublicDir` helper) to the base itself — so the repository is
 *    the asset's sibling directory one level up. One level is Vite's default
 *    `build.assetsDir`; a build that moves it must say so with
 *    `setDuckDBExtensionRepository` below.
 *  - **A consumer dev server importing the prebuilt dist** serves everything
 *    beneath its configured base, so the path before `/node_modules/` IS that
 *    base. The baked `BASE_URL` must not be used here: it is `/` whatever the
 *    consumer's dev base actually is.
 *  - **This package's own dev server, from source.** The workspace
 *    `node_modules` sits above the Vite root, so the wasm arrives as
 *    `/@fs/<absolute path>` — a URL that carries the filesystem, not the
 *    base. But from source `import.meta.env.BASE_URL` is live, substituted by
 *    the dev server that is actually serving, so it is trustworthy here and
 *    only here.
 */
export function extensionRepositoryFor(
  mainModule: string,
  baseUrl: string,
  locationHref: string,
): string {
  const resolved = new URL(mainModule, locationHref);
  const marker = resolved.pathname.indexOf("/node_modules/");
  const repository =
    marker < 0
      ? new URL("../duckdb-extensions", resolved)
      : resolved.pathname.slice(0, marker).includes("/@fs")
        ? new URL(`${baseUrl}duckdb-extensions`, locationHref)
        : new URL(`${resolved.pathname.slice(0, marker)}/duckdb-extensions`, resolved);
  return repository.href.replace(/\/$/, "");
}

let configuredExtensionRepository: string | null = null;

/**
 * State where DuckDB extensions live instead of letting the factory infer it.
 *
 * The zero-config derivation above covers every stock Vite topology, but it
 * infers: a build that customizes `build.assetsDir` (so the wasm is not one
 * level below the base), or a dev server whose `node_modules` resolves outside
 * its root while serving the prebuilt dist, moves the wasm somewhere the
 * inference cannot follow. Such a shell states the location once, at startup:
 *
 *     setDuckDBExtensionRepository(`${import.meta.env.BASE_URL}duckdb-extensions`)
 *
 * `BASE_URL` is substituted with the SHELL's base there, because the shell is
 * compiled by the consumer's own Vite — the same reason this library cannot
 * use the constant itself (see `extensionRepositoryFor`). Pass null to return
 * to the derived default. Takes effect for engines created afterwards.
 */
export function setDuckDBExtensionRepository(url: string | null): void {
  configuredExtensionRepository = url;
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
    // A configured value may be base-relative ("/static/duckdb-extensions");
    // DuckDB wants an absolute URL, so both paths resolve against the page.
    const repository = configuredExtensionRepository
      ? new URL(configuredExtensionRepository, globalThis.location.href).href.replace(/\/$/, "")
      : extensionRepositoryFor(
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
