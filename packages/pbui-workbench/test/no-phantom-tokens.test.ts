import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Every `--pbui-*` custom property this package READS must be one pbui
 * DEFINES (PBUI-WORKBENCH-2, found by turboproof's `make ui-token-check`).
 *
 * An undefined custom property is invalid at computed-value time: the whole
 * declaration is dropped and the element renders with no colour at all, with
 * no error anywhere. pbui's own `tokens.css` documents the exact three names
 * this package had shipped — `--pbui-ink-faint` (a typo for `--pbui-faint`),
 * and `--pbui-blue`/`--pbui-mustard`, invented from a design sketch — as
 * names that do not exist. The package repeated a mistake its dependency had
 * already written down, so the guard moves here, where the CSS is.
 *
 * A read WITH an inline fallback — `var(--pbui-x, #fff)` — is safe by design
 * and not flagged.
 */
const TOKENS = resolve(import.meta.dirname, "../../../src/tokens.css");
const SRC = resolve(import.meta.dirname, "../src");

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return path.endsWith(".css") ? [path] : [];
  });
}

describe("pbui token reads", () => {
  test("every token this package reads without a fallback is defined by pbui", () => {
    const defined = new Set(
      [...readFileSync(TOKENS, "utf8").matchAll(/^\s*(--pbui-[a-z0-9-]+)\s*:/gm)].map(
        (match) => match[1]!,
      ),
    );
    expect(defined.size).toBeGreaterThan(30);

    const missing = new Map<string, string[]>();
    for (const file of cssFiles(SRC)) {
      const css = readFileSync(file, "utf8");
      // `var(--pbui-x)` with no comma: no fallback, so it must be defined.
      for (const match of css.matchAll(/var\(\s*(--pbui-[a-z0-9-]+)\s*\)/g)) {
        const token = match[1]!;
        if (defined.has(token)) continue;
        missing.set(token, [...(missing.get(token) ?? []), file.slice(SRC.length + 1)]);
      }
    }
    expect(Object.fromEntries(missing)).toEqual({});
  });
});
