#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(process.argv[2] ?? process.cwd());
const ignored = new Set(["node_modules", "dist", "storybook-static", ".git", ".artifacts", "ttmp"]);

function walk(dir, accept, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, accept, out);
    else if (accept(path)) out.push(path);
  }
  return out;
}

const manifests = [join(root, "package.json"), ...walk(join(root, "packages"), (path) => path.endsWith("package.json"))]
  .map((path) => ({ path, dir: resolve(path, ".."), json: JSON.parse(readFileSync(path, "utf8")) }))
  .filter((entry) => typeof entry.json.name === "string");
const byName = new Map(manifests.map((entry) => [entry.json.name, entry]));
const internal = new Set(byName.keys());

function importedPackage(specifier) {
  if (!specifier.startsWith("@hyperslop-systems/")) return null;
  const parts = specifier.split("/");
  return `${parts[0]}/${parts[1]}`;
}

function sourceFiles(entry) {
  const starts = [join(entry.dir, "src"), join(entry.dir, "test"), join(entry.dir, "scripts")];
  if (entry.dir === root) starts.push(join(root, "vite.config.ts"));
  const out = [];
  for (const start of starts) {
    if (!existsSync(start)) continue;
    if (statSync(start).isFile()) out.push(start);
    else walk(start, (path) => /\.(?:[cm]?[jt]sx?)$/.test(path), out);
  }
  return out;
}

const rows = [];
for (const entry of manifests) {
  const declared = new Map();
  for (const kind of ["dependencies", "peerDependencies", "devDependencies"]) {
    for (const name of Object.keys(entry.json[kind] ?? {})) if (internal.has(name)) declared.set(name, kind);
  }
  const imports = new Map();
  for (const file of sourceFiles(entry)) {
    const text = readFileSync(file, "utf8");
    const pattern = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
    for (const match of text.matchAll(pattern)) {
      const target = importedPackage(match[1] ?? match[2]);
      if (!target || !internal.has(target) || target === entry.json.name) continue;
      const files = imports.get(target) ?? [];
      files.push(relative(root, file));
      imports.set(target, files);
    }
  }
  for (const target of new Set([...declared.keys(), ...imports.keys()])) {
    rows.push({ from: entry.json.name, to: target, declared: declared.get(target) ?? null, imports: [...new Set(imports.get(target) ?? [])].sort() });
  }
}

console.log(JSON.stringify({ packages: manifests.map((entry) => ({ name: entry.json.name, path: relative(root, entry.path) })), edges: rows.sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`)) }, null, 2));
