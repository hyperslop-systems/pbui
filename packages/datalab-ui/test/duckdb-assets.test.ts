import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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
    expect(source).toContain("import.meta.env.BASE_URL}duckdb-extensions");
    expect(source).toContain("SET custom_extension_repository");
    expect(source).not.toContain("extensions.duckdb.org");
  });
});
