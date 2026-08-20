import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Colours are tokens. The only file that may spell a colour literal is the
 * demo's token sheet, which DEFINES the tones every other stylesheet reads;
 * a literal anywhere else is a value that will drift from the tone it
 * imitates (pbui playbook §4).
 */
const ROOTS = [resolve(import.meta.dirname, "../src"), resolve(import.meta.dirname, "../demo/src")];
const TOKEN_SHEETS = new Set(["styles/tokens.css"]);

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

describe("no colour literals outside the token sheet", () => {
  test("css and components read tokens only", () => {
    const violations: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const rel = relative(root, file);
        if (TOKEN_SHEETS.has(rel)) continue;
        const lines = readFileSync(file, "utf8").split("\n");
        lines.forEach((line, i) => {
          const text = line.replace(/\/\/.*$/, "");
          if (/\.css$/.test(file) ? HEX.test(text) || FUNCTIONAL.test(text) : /["'`]#[0-9a-fA-F]{3,8}["'`]/.test(text)) {
            violations.push(`${rel}:${i + 1}: ${line.trim()}`);
          }
        });
      }
    }
    expect(violations).toEqual([]);
  });
});
