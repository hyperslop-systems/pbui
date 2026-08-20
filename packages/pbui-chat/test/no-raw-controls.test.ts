import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Hand-written form controls are forbidden everywhere in this package and
 * its demo: `Button`, `TextInput`, `TextArea`, `SelectInput`, `CheckboxRow`
 * come from pbui, and a raw element means either the author did not know
 * the atom exists or the atom is missing a variant — both are conversations
 * worth forcing (pbui playbook §6a).
 */
const ROOTS = [resolve(import.meta.dirname, "../src"), resolve(import.meta.dirname, "../demo/src")];

const RULES = [
  { pattern: /<button\b/, use: "Button or IconButton from @hyperslop-systems/pbui" },
  { pattern: /<select\b/, use: "SelectInput from @hyperslop-systems/pbui" },
  { pattern: /<input\b/, use: "TextInput or CheckboxRow from @hyperslop-systems/pbui" },
  { pattern: /<textarea\b/, use: "TextArea from @hyperslop-systems/pbui" },
  { pattern: /const \w+: (React\.)?CSSProperties\s*=\s*\{/, use: "a CSS module beside the component" },
];

const ALLOWED: Array<{ prefix: string; because: string }> = [];

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
    if (entry === "generated") continue;
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(path) && !path.endsWith(".stories.tsx")) out.push(path);
  }
  return out;
}

const FILES = ROOTS.flatMap((root) => walk(root).map((file) => ({ root, file })));

describe("form controls come from the design system", () => {
  test("there are files to check", () => {
    expect(FILES.length).toBeGreaterThan(30);
  });

  test("no hand-written controls", () => {
    const violations: string[] = [];
    for (const { root, file } of FILES) {
      const rel = relative(root, file);
      if (ALLOWED.some((entry) => rel.startsWith(entry.prefix))) continue;
      const lines = code(readFileSync(file, "utf8")).split("\n");
      for (const rule of RULES) {
        const line = lines.findIndex((text) => rule.pattern.test(text));
        if (line === -1) continue;
        violations.push(`${rel}:${line + 1} — use ${rule.use}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
