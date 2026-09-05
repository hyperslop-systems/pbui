import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Hand-written form controls are forbidden: `Button`, `IconButton`,
 * `TextInput` and friends come from pbui (playbook §6a). The resize divider
 * is a `role="separator"` element rather than a button for the same reason.
 */
const ROOT = resolve(import.meta.dirname, "../src");

const RULES = [
  { pattern: /<button\b/, use: "Button or IconButton from @hyperslop-systems/pbui" },
  { pattern: /<select\b/, use: "SelectInput from @hyperslop-systems/pbui" },
  { pattern: /<input\b/, use: "TextInput or CheckboxRow from @hyperslop-systems/pbui" },
  { pattern: /<textarea\b/, use: "TextArea from @hyperslop-systems/pbui" },
  { pattern: /const \w+: (React\.)?CSSProperties\s*=\s*\{/, use: "a CSS module beside the component" },
];

function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(path) && !/\.(stories|test)\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

describe("form controls come from the design system", () => {
  test("no hand-written controls", () => {
    const violations: string[] = [];
    for (const file of walk(ROOT)) {
      const lines = code(readFileSync(file, "utf8")).split("\n");
      for (const rule of RULES) {
        const line = lines.findIndex((text) => rule.pattern.test(text));
        if (line === -1) continue;
        violations.push(`${relative(ROOT, file)}:${line + 1} — use ${rule.use}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
