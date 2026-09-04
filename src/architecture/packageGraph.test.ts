import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { analyzeWorkspaceGraph } from "./packageGraph";
import { INTERNAL_PACKAGE_NAMES, PACKAGE_POLICY, type InternalPackageName, type PackagePolicy } from "./packagePolicy";
import {
  collectDeclaredEdges,
  collectInternalImports,
  discoverWorkspacePackages,
  type DeclaredEdge,
  type ImportEdge,
  type WorkspacePackage,
} from "./workspacePackages";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../..");
const PACKAGES = discoverWorkspacePackages(WORKSPACE_ROOT);
const INTERNAL_NAMES = new Set(PACKAGES.map((pkg) => pkg.name));
const DECLARATIONS = collectDeclaredEdges(PACKAGES, INTERNAL_NAMES);
const IMPORTS = collectInternalImports(PACKAGES, WORKSPACE_ROOT);

describe("the PBUI workspace package graph", () => {
  test("discovers every current workspace package", () => {
    expect(PACKAGES.map((pkg) => pkg.name)).toEqual([...INTERNAL_PACKAGE_NAMES].sort());
    expect(PACKAGES).toHaveLength(13);
  });

  test("matches manifests and imports to the intended acyclic architecture", () => {
    expect(
      analyzeWorkspaceGraph(WORKSPACE_ROOT, PACKAGES, DECLARATIONS, IMPORTS, PACKAGE_POLICY),
    ).toEqual([]);
  });
});

const PBUI = "@hyperslop-systems/pbui";
const PROTOCOL = "@hyperslop-systems/workbench-protocol";

function fixturePackage(name: string, path: string, exportsField: unknown = { ".": "./index.js" }): WorkspacePackage {
  const root = resolve("/repo", path === "." ? "" : path);
  return {
    name,
    root,
    manifestPath: resolve(root, "package.json"),
    manifest: { name, exports: exportsField },
  };
}

function fixturePolicy(entries: Record<string, PackagePolicy>): Readonly<Record<InternalPackageName, PackagePolicy>> {
  return entries as Readonly<Record<InternalPackageName, PackagePolicy>>;
}

function importEdge(from: string, to: string, use: ImportEdge["use"] = "production", specifier = to): ImportEdge {
  return { from, to, use, specifier, file: "src/example.ts" };
}

function declaration(from: string, to: string, kind: DeclaredEdge["kind"] = "dependencies"): DeclaredEdge {
  return { from, to, kind };
}

describe("package graph failure diagnostics", () => {
  const packages = [fixturePackage(PBUI, "."), fixturePackage(PROTOCOL, "packages/protocol")];

  test("reports an undeclared direct production import", () => {
    const violations = analyzeWorkspaceGraph(
      "/repo",
      packages,
      [],
      [importEdge(PBUI, PROTOCOL)],
      fixturePolicy({
        [PBUI]: { path: ".", allow: [PROTOCOL] },
        [PROTOCOL]: { path: "packages/protocol", allow: [] },
      }),
    );
    expect(violations.map((violation) => violation.code)).toContain("undeclared-import");
    expect(violations.find((violation) => violation.code === "undeclared-import")?.message).toContain(
      "src/example.ts imports @hyperslop-systems/workbench-protocol",
    );
  });

  test("reports an unused internal runtime declaration", () => {
    const violations = analyzeWorkspaceGraph(
      "/repo",
      packages,
      [declaration(PBUI, PROTOCOL)],
      [],
      fixturePolicy({
        [PBUI]: { path: ".", allow: [PROTOCOL] },
        [PROTOCOL]: { path: "packages/protocol", allow: [] },
      }),
    );
    expect(violations.map((violation) => violation.code)).toContain("unused-runtime-dependency");
  });

  test("accepts a reasoned non-code runtime contract", () => {
    const violations = analyzeWorkspaceGraph(
      "/repo",
      packages,
      [declaration(PBUI, PROTOCOL)],
      [],
      fixturePolicy({
        [PBUI]: {
          path: ".",
          allow: [PROTOCOL],
          allowUnusedRuntime: { [PROTOCOL]: "Runtime CSS contract exercised by packed consumer smoke." },
        },
        [PROTOCOL]: { path: "packages/protocol", allow: [] },
      }),
    );
    expect(violations).toEqual([]);
  });

  test("reports a forbidden production edge", () => {
    const violations = analyzeWorkspaceGraph(
      "/repo",
      packages,
      [declaration(PBUI, PROTOCOL)],
      [importEdge(PBUI, PROTOCOL)],
      fixturePolicy({
        [PBUI]: { path: ".", allow: [] },
        [PROTOCOL]: { path: "packages/protocol", allow: [] },
      }),
    );
    expect(violations.map((violation) => violation.code)).toContain("forbidden-edge");
  });

  test("reports a complete internal dependency cycle", () => {
    const violations = analyzeWorkspaceGraph(
      "/repo",
      packages,
      [declaration(PBUI, PROTOCOL), declaration(PROTOCOL, PBUI)],
      [importEdge(PBUI, PROTOCOL), importEdge(PROTOCOL, PBUI)],
      fixturePolicy({
        [PBUI]: { path: ".", allow: [PROTOCOL] },
        [PROTOCOL]: { path: "packages/protocol", allow: [PBUI] },
      }),
    );
    expect(violations.find((violation) => violation.code === "dependency-cycle")?.message).toBe(
      `internal runtime dependency cycle: ${PBUI} -> ${PROTOCOL} -> ${PBUI}`,
    );
  });

  test("reports an import through a private package subpath", () => {
    const violations = analyzeWorkspaceGraph(
      "/repo",
      packages,
      [declaration(PBUI, PROTOCOL)],
      [importEdge(PBUI, PROTOCOL, "production", `${PROTOCOL}/private`) ],
      fixturePolicy({
        [PBUI]: { path: ".", allow: [PROTOCOL] },
        [PROTOCOL]: { path: "packages/protocol", allow: [] },
      }),
    );
    expect(violations.map((violation) => violation.code)).toContain("private-subpath");
  });

  test("reports discovered packages missing from policy", () => {
    const violations = analyzeWorkspaceGraph(
      "/repo",
      packages,
      [],
      [],
      fixturePolicy({ [PBUI]: { path: ".", allow: [] } }),
    );
    expect(violations.map((violation) => violation.code)).toContain("missing-policy");
  });
});
