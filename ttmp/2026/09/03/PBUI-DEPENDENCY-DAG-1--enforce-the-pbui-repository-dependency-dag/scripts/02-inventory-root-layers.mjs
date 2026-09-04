#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const root = resolve(process.argv[2] ?? process.cwd());
const src = join(root, "src");
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(path) && !/\.(?:test|stories)\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}
function layer(path) {
  const [first, second] = relative(src, path).split("/");
  if (first === "components") return `components/${second ?? "entry"}`;
  return first ?? "entry";
}
function resolveImport(file, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(file), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return null;
}
const edges = new Map();
for (const file of walk(src)) {
  const from = layer(file);
  const text = readFileSync(file, "utf8");
  const pattern = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of text.matchAll(pattern)) {
    const target = resolveImport(file, match[1]);
    if (!target || !target.startsWith(src)) continue;
    const to = layer(target);
    if (to === from) continue;
    const key = `${from} -> ${to}`;
    const examples = edges.get(key) ?? [];
    if (examples.length < 4) examples.push(`${relative(src, file)} -> ${match[1]}`);
    edges.set(key, examples);
  }
}
console.log(JSON.stringify(Object.fromEntries([...edges].sort(([a], [b]) => a.localeCompare(b))), null, 2));
