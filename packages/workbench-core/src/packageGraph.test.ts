import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The dependency DAG, by kind (design doc 04 §8.4): runtime, peer and dev
 * dependencies are different claims, and the headless claim is about the
 * first two. The packed-consumer script (`pnpm boundary`) proves the
 * installed graph; this proves the declarations that produce it.
 */
const read = (path: string) => JSON.parse(readFileSync(resolve(import.meta.dirname, path), "utf8")) as { dependencies?: Record<string, string>; peerDependencies?: Record<string, string>; peerDependenciesMeta?: Record<string, { optional?: boolean }>; devDependencies?: Record<string, string>; exports?: Record<string, unknown> };

describe("package graph", () => {
  const core = read("../package.json");
  const pbui = read("../../../package.json");
  const protocol = read("../../workbench-protocol/package.json");

  it("workbench-core has no React in runtime, peer or dev dependencies", () => {
    for (const kind of ["dependencies", "peerDependencies", "devDependencies"] as const) {
      expect(Object.keys(core[kind] ?? {}).filter((name) => /^react/.test(name))).toEqual([]);
    }
    expect(Object.keys(core.dependencies ?? {}).sort()).toEqual(["@bufbuild/protobuf", "@hyperslop-systems/pbui", "@hyperslop-systems/workbench-protocol"]);
  });

  it("pbui's React is an OPTIONAL peer, so a link-kernel consumer does not inherit it", () => {
    expect(Object.keys(pbui.peerDependencies ?? {}).sort()).toEqual(["react", "react-dom"]);
    expect(pbui.peerDependenciesMeta?.react?.optional).toBe(true);
    expect(pbui.peerDependenciesMeta?.["react-dom"]?.optional).toBe(true);
    expect(Object.keys(pbui.dependencies ?? {}).filter((name) => /^react/.test(name))).toEqual([]);
    expect(pbui.exports?.["./link-kernel"]).toBeDefined();
  });

  it("workbench-protocol has no React at all", () => {
    for (const kind of ["dependencies", "peerDependencies"] as const) {
      expect(Object.keys(protocol[kind] ?? {}).filter((name) => /^react/.test(name))).toEqual([]);
    }
  });
});
