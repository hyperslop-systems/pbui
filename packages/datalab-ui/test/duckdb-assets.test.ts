import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extensionRepositoryFor } from "../src/analysis/browser";
import packageJSON from "../package.json";

const EXTENSIONS = {
  "public/duckdb-extensions/v1.4.3/wasm_eh/json.duckdb_extension.wasm":
    "b997276c8e15cc3ebdeda340d73d15dc1c4f4755ad281280451cb0a2f79302e9",
  "public/duckdb-extensions/v1.4.3/wasm_mvp/json.duckdb_extension.wasm":
    "5771b6d57335eca8e2ba4fdaacb491a53b49577bd7f1b0c39e2cd7a39b4e9313",
} as const;

describe("self-hosted pinned DuckDB assets", () => {
  test("the npm runtime is an exact production pin", () => {
    expect(packageJSON.dependencies["@duckdb/duckdb-wasm"]).toBe("1.32.0");
  });

  for (const [path, expected] of Object.entries(EXTENSIONS)) {
    test(`${path} is the reviewed signed extension`, async () => {
      const digest = createHash("sha256")
        .update(await readFile(path))
        .digest("hex");
      expect(digest).toBe(expected);
    });
  }

  test("the browser adapter points autoload at the same-origin Vite asset tree", async () => {
    const source = await readFile("src/analysis/browser.ts", "utf8");
    expect(source).toContain("SET custom_extension_repository");
    expect(source).not.toContain("extensions.duckdb.org");
  });

  // The repository must be derived from the resolved wasm URL, never from
  // `import.meta.env.BASE_URL` alone: Vite substitutes that constant when THIS
  // PACKAGE is built (base "/"), not when an embedding shell is built with its
  // own base, so a BASE_URL-only repository 404s in every consumer that mounts
  // the bundles anywhere but the root. The wasm `?url` import stays external
  // in the library build and is resolved by the consumer, which is what makes
  // it the one trustworthy anchor. Each case below is a real topology.
  describe("the extension repository follows the consumer's asset tree", () => {
    test("a production shell with a non-root base (datalab, /static/)", () => {
      expect(
        extensionRepositoryFor(
          "/static/assets/duckdb-eh-9ubY-jlA.wasm",
          "/",
          "http://data.example.com/ui/",
        ),
      ).toBe("http://data.example.com/static/duckdb-extensions");
    });

    test("a production build served at the root", () => {
      expect(
        extensionRepositoryFor("/assets/duckdb-eh-9ubY-jlA.wasm", "/", "http://localhost:4173/"),
      ).toBe("http://localhost:4173/duckdb-extensions");
    });

    test("this package's own dev server, from source (/@fs/, live BASE_URL)", () => {
      // The workspace node_modules sits above the Vite root, so the wasm URL
      // carries a filesystem path that says nothing about the base. From
      // source BASE_URL is live — substituted by the serving dev server — so
      // it is the one topology where the constant is trustworthy, including
      // for a non-root dev base.
      expect(
        extensionRepositoryFor(
          "/@fs/home/me/pbui/node_modules/.pnpm/@duckdb+duckdb-wasm@1.32.0/node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?import&url",
          "/",
          "http://localhost:5173/",
        ),
      ).toBe("http://localhost:5173/duckdb-extensions");
      expect(
        extensionRepositoryFor(
          "/@fs/home/me/pbui/node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm",
          "/static/",
          "http://localhost:5173/static/",
        ),
      ).toBe("http://localhost:5173/static/duckdb-extensions");
    });

    test("a consumer dev server importing the prebuilt dist", () => {
      expect(
        extensionRepositoryFor(
          "/node_modules/@hyperslop-systems/datalab-ui/node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm",
          "/",
          "http://localhost:5173/ui/",
        ),
      ).toBe("http://localhost:5173/duckdb-extensions");
    });

    test("a consumer dev server with a non-root base", () => {
      // Everything a dev server serves lives beneath its configured base, so
      // the path before /node_modules/ IS the base — while the baked BASE_URL
      // is "/" whatever the consumer configured. The URL must win.
      expect(
        extensionRepositoryFor(
          "/static/node_modules/@hyperslop-systems/datalab-ui/node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm",
          "/",
          "http://localhost:5173/static/ui/",
        ),
      ).toBe("http://localhost:5173/static/duckdb-extensions");
    });
  });
});
