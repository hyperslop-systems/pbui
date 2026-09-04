import { describe, expect, test } from "vitest";
import {
  classifyImportUse,
  declarationAllowsImport,
  extractModuleSpecifiers,
  findCycle,
  normalizeInternalSpecifier,
  ownerOf,
  packageExportsSpecifier,
  type WorkspacePackage,
} from "./workspacePackages";

function pkg(name: string, root: string, exportsField?: unknown): WorkspacePackage {
  return {
    name,
    root,
    manifestPath: `${root}/package.json`,
    manifest: { name, exports: exportsField },
  };
}

describe("workspace package architecture helpers", () => {
  test("extracts static, re-exported, dynamic, and require specifiers", () => {
    expect(
      extractModuleSpecifiers(`
        import value from "static-package";
        import type { Type } from "type-package";
        export { other } from "reexport-package";
        export * from "star-package";
        const lazy = import("dynamic-package");
        const legacy = require("require-package");
        const ignored = import(variable);
      `),
    ).toEqual([
      "static-package",
      "type-package",
      "reexport-package",
      "star-package",
      "dynamic-package",
      "require-package",
    ]);
  });

  test("normalizes internal subpaths using the longest package name", () => {
    const names = ["@scope/pkg", "@scope/pkg-long"];
    expect(normalizeInternalSpecifier("@scope/pkg/client", names)).toBe("@scope/pkg");
    expect(normalizeInternalSpecifier("@scope/pkg-long/tools", names)).toBe("@scope/pkg-long");
    expect(normalizeInternalSpecifier("@scope/pkg-other", names)).toBeNull();
  });

  test("assigns nested-demo files to the deepest package root", () => {
    const packages = [pkg("library", "/repo/packages/library"), pkg("demo", "/repo/packages/library/demo")];
    expect(ownerOf("/repo/packages/library/demo/src/main.ts", packages)?.name).toBe("demo");
    expect(ownerOf("/repo/packages/library/src/index.ts", packages)?.name).toBe("library");
    expect(ownerOf("/elsewhere/file.ts", packages)).toBeNull();
  });

  test.each([
    ["/repo/src/index.ts", "production"],
    ["/repo/src/index.test.ts", "test"],
    ["/repo/test/public.test.ts", "test"],
    ["/repo/src/Button.stories.tsx", "story"],
    ["/repo/.storybook/preview.ts", "story"],
    ["/repo/scripts/check.mjs", "script"],
    ["/repo/vite.config.ts", "config"],
  ] as const)("classifies %s as %s", (path, expected) => {
    expect(classifyImportUse(path, "/repo")).toBe(expected);
  });

  test("requires a production-visible declaration for production imports", () => {
    expect(declarationAllowsImport(["dependencies"], "production")).toBe(true);
    expect(declarationAllowsImport(["peerDependencies"], "production")).toBe(true);
    expect(declarationAllowsImport(["optionalDependencies"], "production")).toBe(true);
    expect(declarationAllowsImport(["devDependencies"], "production")).toBe(false);
    expect(declarationAllowsImport(["devDependencies"], "test")).toBe(true);
    expect(declarationAllowsImport([], "script")).toBe(false);
  });

  test("returns the complete directed cycle", () => {
    const graph = new Map<string, readonly string[]>([
      ["A", ["B"]],
      ["B", ["C"]],
      ["C", ["A"]],
    ]);
    expect(findCycle(graph)).toEqual(["A", "B", "C", "A"]);
  });

  test("returns null for a DAG", () => {
    const graph = new Map<string, readonly string[]>([
      ["A", ["B", "C"]],
      ["B", ["C"]],
      ["C", []],
    ]);
    expect(findCycle(graph)).toBeNull();
  });

  test("checks exact and wildcard package exports", () => {
    const target = pkg("@scope/pkg", "/repo/pkg", {
      ".": "./dist/index.js",
      "./client": "./dist/client.js",
      "./features/*": "./dist/features/*.js",
    });

    expect(packageExportsSpecifier(target, "@scope/pkg")).toBe(true);
    expect(packageExportsSpecifier(target, "@scope/pkg/client")).toBe(true);
    expect(packageExportsSpecifier(target, "@scope/pkg/features/one")).toBe(true);
    expect(packageExportsSpecifier(target, "@scope/pkg/private/file")).toBe(false);
  });
});
