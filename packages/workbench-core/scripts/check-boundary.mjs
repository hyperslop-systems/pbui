#!/usr/bin/env node
/**
 * The built-artifact fence (design doc 04 §8.4): pack pbui, workbench-protocol
 * and workbench-core, install workbench-core alone into an empty project with
 * scripts disabled, assert React is absent from the installed graph, import
 * the core and plan a command, and scan the built output for React or the
 * PBUI root entry. Source regexes prove what the source says; this proves
 * what a consumer gets.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const core = resolve(import.meta.dirname, "..");
const root = resolve(core, "../..");
const protocol = resolve(root, "packages/workbench-protocol");
const work = mkdtempSync(join(tmpdir(), "workbench-core-boundary-"));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "pipe", encoding: "utf8", env: { ...process.env, npm_config_cache: join(work, ".npm-cache") } });

try {
  // 1. Built output: the core's runtime imports name only the pure PBUI subpath and the protocol.
  const dist = join(core, "dist");
  if (!existsSync(dist)) throw new Error("build workbench-core first (pnpm build)");
  const built = readdirSync(dist).filter((name) => name.endsWith(".js"));
  const offenders = [];
  for (const name of built) {
    const text = readFileSync(join(dist, name), "utf8");
    for (const match of text.matchAll(/from\s*"([^"]+)"/g)) {
      const spec = match[1];
      if (/^react(-dom)?(\/|$)/.test(spec) || spec === "@hyperslop-systems/pbui" || spec.startsWith("@hyperslop-systems/pbui/") && spec !== "@hyperslop-systems/pbui/link-kernel") offenders.push(`${name}: ${spec}`);
    }
  }
  if (offenders.length > 0) throw new Error(`built imports outside the boundary:\n${offenders.join("\n")}`);
  console.log(`built imports: ${built.length} files, only link-kernel/protocol externals`);

  // 2. Packed install without React.
  const tarballs = [root, protocol, core].map((dir) => {
    const out = run("pnpm", ["pack", "--pack-destination", work], dir).trim().split("\n").pop();
    return resolve(dir, out);
  });
  writeFileSync(join(work, "package.json"), JSON.stringify({ name: "boundary-consumer", private: true, type: "module" }));
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs], work);
  const installed = readdirSync(join(work, "node_modules"));
  const react = installed.filter((name) => /^react(-dom)?$/.test(name));
  if (react.length > 0) throw new Error(`React installed into a core-only consumer: ${react.join(", ")}`);
  console.log(`installed without React: ${installed.filter((n) => !n.startsWith(".")).length} packages`);

  // 3. Import and plan.
  writeFileSync(
    join(work, "import.mjs"),
    `import { createWorkbenchCore, defineAppManifest, layout, split, tile, commands } from "@hyperslop-systems/workbench-core";
const core = createWorkbenchCore({ initial: layout(split("row", 0.5, tile("a"), tile("b"))), apps: [defineAppManifest({ id: "a" }), defineAppManifest({ id: "b" })] });
const first = [...core.getState().index.viewByPlacementId.keys()][0];
const previewed = core.preview(commands.duplicate(first, "row"));
if (!previewed.ok) throw new Error(previewed.because);
if (typeof globalThis.React !== "undefined") throw new Error("React global present");
console.log("imported and planned:", previewed.explanation);
`,
  );
  console.log(run("node", ["import.mjs"], work).trim());
  console.log("boundary: OK");
} finally {
  rmSync(work, { recursive: true, force: true });
}
