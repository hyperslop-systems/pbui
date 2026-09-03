import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The link kernel is pure (design D1, D9): no React, no stores, no DOM. The
 * same fence the action kernel keeps.
 */
describe("the link kernel imports no React", () => {
  it("has no react, react-dom, or DOM imports in any non-test module", () => {
    const dir = import.meta.dirname;
    const offenders: string[] = [];
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts") || file.endsWith(".test-helpers.ts")) continue;
      const source = readFileSync(join(dir, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("//"))
        .join("\n");
      if (/from ["']react/.test(source) || /\b(globalThis\.)?(document|window)\.[a-zA-Z]/.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
