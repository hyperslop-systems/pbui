import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Colours are tokens. This package defines no tones of its own — an app's
 * tone is a token reference the product supplies — so NO file here may
 * spell a colour literal (playbook §4).
 */
const ROOT = resolve(import.meta.dirname, "../src");
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FUNCTIONAL = /\b(rgb|rgba|hsl|hsla|oklch|lab)\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(css|tsx?)$/.test(path)) out.push(path);
  }
  return out;
}

describe("no colour literals", () => {
  test("css and components read tokens only", () => {
    const violations: string[] = [];
    for (const file of walk(ROOT)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const text = line.replace(/\/\/.*$/, "");
        if (/\.css$/.test(file) ? HEX.test(text) || FUNCTIONAL.test(text) : /["'`]#[0-9a-fA-F]{3,8}["'`]/.test(text)) {
          violations.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });
});
