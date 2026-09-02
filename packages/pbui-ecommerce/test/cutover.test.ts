import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * The cutover rules of PBUI-LINK-1 design D10, enforced where the first
 * consumer is written: no `bindings`/`docBound` on an app descriptor (ports
 * only), no module-level mutable globals outside the host and the link
 * runtime, and no dependency on the frozen datalab-ui package.
 */
const SRC = resolve(import.meta.dirname, "../src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const SOURCES = walk(SRC).filter((f) => /\.tsx?$/.test(f) && !/\.(test|stories)\.tsx?$/.test(f));

describe("cutover rules (D10)", () => {
  test("app descriptors declare ports, never bindings/docBound", () => {
    const hits = SOURCES.filter((file) => /\b(docBound|bindings)\s*:/.test(readFileSync(file, "utf8"))).map((f) => relative(SRC, f));
    expect(hits).toEqual([]);
  });

  test("nothing imports datalab-ui", () => {
    const hits = SOURCES.filter((file) => readFileSync(file, "utf8").includes("datalab-ui")).map((f) => relative(SRC, f));
    expect(hits).toEqual([]);
  });

  test("no product globals: module-level `let` outside the host", () => {
    const hits = SOURCES.filter((file) => {
      const rel = relative(SRC, file);
      if (rel === "host.ts" || rel.startsWith("fixtures/")) return false;
      return /^let\s/m.test(readFileSync(file, "utf8"));
    }).map((f) => relative(SRC, f));
    expect(hits).toEqual([]);
  });
});
