import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

export const DEPENDENCY_KINDS = [
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
  "devDependencies",
] as const;

export type DependencyKind = (typeof DEPENDENCY_KINDS)[number];
export type ImportUse = "production" | "test" | "story" | "script" | "config";

export interface PackageManifest {
  readonly name?: string;
  readonly private?: boolean;
  readonly exports?: unknown;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

export interface WorkspacePackage {
  readonly name: string;
  readonly root: string;
  readonly manifestPath: string;
  readonly manifest: PackageManifest;
}

export interface DeclaredEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: DependencyKind;
}

export interface ImportEdge {
  readonly from: string;
  readonly to: string;
  readonly specifier: string;
  readonly file: string;
  readonly use: ImportUse;
}

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const EXCLUDED_DIRECTORIES = new Set([
  ".artifacts",
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "public",
  "storybook-static",
  "ttmp",
]);

function isInside(path: string, directory: string): boolean {
  const rel = relative(directory, path);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

function readManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

/** Discover the root manifest and every nested package manifest under packages/. */
export function discoverWorkspacePackages(workspaceRoot: string): WorkspacePackage[] {
  const manifests = [join(workspaceRoot, "package.json")];
  const packagesDirectory = join(workspaceRoot, "packages");

  function visit(directory: string): void {
    for (const entry of readdirSync(directory)) {
      if (EXCLUDED_DIRECTORIES.has(entry)) continue;
      const path = join(directory, entry);
      if (!statSync(path).isDirectory()) continue;
      const manifestPath = join(path, "package.json");
      try {
        if (statSync(manifestPath).isFile()) manifests.push(manifestPath);
      } catch {
        // Most source directories are not package roots.
      }
      visit(path);
    }
  }

  visit(packagesDirectory);

  const packages = manifests.map((manifestPath): WorkspacePackage => {
    const manifest = readManifest(manifestPath);
    if (!manifest.name) throw new Error(`workspace manifest has no name: ${manifestPath}`);
    return { name: manifest.name, root: dirname(manifestPath), manifestPath, manifest };
  });

  const duplicateNames = packages
    .map((pkg) => pkg.name)
    .filter((name, index, names) => names.indexOf(name) !== index);
  if (duplicateNames.length > 0) {
    throw new Error(`duplicate workspace package names: ${[...new Set(duplicateNames)].join(", ")}`);
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

/** The deepest package root containing a file owns it (important for nested demos). */
export function ownerOf(path: string, packages: readonly WorkspacePackage[]): WorkspacePackage | null {
  return (
    packages
      .filter((pkg) => isInside(path, pkg.root))
      .sort((a, b) => b.root.length - a.root.length)[0] ?? null
  );
}

/**
 * Extract module specifiers from the import forms used by this ESM workspace.
 *
 * TypeScript 7's native package intentionally exposes no compiler AST API, so
 * this is a small tested lexical scanner rather than an accidental dependency
 * on compiler internals. It covers static imports, re-exports, side-effect
 * imports, dynamic import(), and literal require(). Computed imports remain a
 * build concern because they cannot identify a package declaration statically.
 */
export function extractModuleSpecifiers(source: string, _fileName = "source.ts"): string[] {
  const matches: Array<{ index: number; specifier: string }> = [];
  const patterns = [
    /(?:^|[;\n])\s*(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/gm,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      matches.push({ index: match.index, specifier: match[1] as string });
    }
  }

  return matches.sort((a, b) => a.index - b.index).map((match) => match.specifier);
}

export function classifyImportUse(path: string, packageRoot: string): ImportUse {
  const rel = relative(packageRoot, path).split(sep).join("/");
  if (rel.includes("/.storybook/") || rel.startsWith(".storybook/") || /\.stories\.[cm]?[jt]sx?$/.test(rel)) {
    return "story";
  }
  if (rel.startsWith("test/") || rel.includes("/test/") || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(rel)) {
    return "test";
  }
  if (rel.startsWith("scripts/")) return "script";
  if (!rel.startsWith("src/")) return "config";
  return "production";
}

/** Map a package subpath to the longest matching workspace package name. */
export function normalizeInternalSpecifier(
  specifier: string,
  packageNames: readonly string[],
): string | null {
  return (
    [...packageNames]
      .sort((a, b) => b.length - a.length)
      .find((name) => specifier === name || specifier.startsWith(`${name}/`)) ?? null
  );
}

function walkSourceFiles(
  packageRoot: string,
  nestedPackageRoots: ReadonlySet<string>,
  directory = packageRoot,
  output: string[] = [],
): string[] {
  for (const entry of readdirSync(directory)) {
    if (EXCLUDED_DIRECTORIES.has(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      if (path !== packageRoot && nestedPackageRoots.has(path)) continue;
      walkSourceFiles(packageRoot, nestedPackageRoots, path, output);
    } else if (SOURCE_EXTENSIONS.has(extname(path))) {
      output.push(path);
    }
  }
  return output;
}

export function collectInternalImports(
  packages: readonly WorkspacePackage[],
  workspaceRoot: string,
): ImportEdge[] {
  const packageNames = packages.map((pkg) => pkg.name);
  const packageRoots = new Set(packages.map((pkg) => pkg.root));
  const edges: ImportEdge[] = [];

  for (const pkg of packages) {
    for (const file of walkSourceFiles(pkg.root, packageRoots)) {
      for (const specifier of extractModuleSpecifiers(readFileSync(file, "utf8"), file)) {
        const target = normalizeInternalSpecifier(specifier, packageNames);
        if (!target || target === pkg.name) continue;
        edges.push({
          from: pkg.name,
          to: target,
          specifier,
          file: relative(workspaceRoot, file).split(sep).join("/"),
          use: classifyImportUse(file, pkg.root),
        });
      }
    }
  }

  return edges.sort((a, b) =>
    `${a.from}\0${a.to}\0${a.file}\0${a.specifier}`.localeCompare(
      `${b.from}\0${b.to}\0${b.file}\0${b.specifier}`,
    ),
  );
}

export function collectDeclaredEdges(
  packages: readonly WorkspacePackage[],
  internalNames: ReadonlySet<string>,
): DeclaredEdge[] {
  const edges: DeclaredEdge[] = [];
  for (const pkg of packages) {
    for (const kind of DEPENDENCY_KINDS) {
      for (const dependency of Object.keys(pkg.manifest[kind] ?? {})) {
        if (internalNames.has(dependency)) edges.push({ from: pkg.name, to: dependency, kind });
      }
    }
  }
  return edges.sort((a, b) =>
    `${a.from}\0${a.to}\0${a.kind}`.localeCompare(`${b.from}\0${b.to}\0${b.kind}`),
  );
}

export function declarationAllowsImport(kinds: readonly DependencyKind[], use: ImportUse): boolean {
  if (use === "production") {
    return kinds.some((kind) => kind !== "devDependencies");
  }
  return kinds.length > 0;
}

/** Return one complete directed cycle, including its repeated starting node. */
export function findCycle(graph: ReadonlyMap<string, readonly string[]>): string[] | null {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];

  function visit(node: string): string[] | null {
    const stackIndex = stack.indexOf(node);
    if (visiting.has(node)) return [...stack.slice(stackIndex), node];
    if (visited.has(node)) return null;

    visiting.add(node);
    stack.push(node);
    for (const target of graph.get(node) ?? []) {
      const cycle = visit(target);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const node of [...graph.keys()].sort()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

function exportKeys(exportsField: unknown): string[] {
  if (!exportsField || typeof exportsField === "string" || Array.isArray(exportsField)) return ["."];
  if (typeof exportsField !== "object") return [];
  const keys = Object.keys(exportsField);
  return keys.some((key) => key.startsWith(".")) ? keys : ["."];
}

function matchesExportKey(subpath: string, key: string): boolean {
  if (!key.includes("*")) return subpath === key;
  const [prefix, suffix] = key.split("*") as [string, string];
  return subpath.startsWith(prefix) && subpath.endsWith(suffix);
}

export function packageExportsSpecifier(pkg: WorkspacePackage, specifier: string): boolean {
  if (specifier === pkg.name) return exportKeys(pkg.manifest.exports).includes(".");
  if (!specifier.startsWith(`${pkg.name}/`)) return false;
  const subpath = `.${specifier.slice(pkg.name.length)}`;
  return exportKeys(pkg.manifest.exports).some((key) => matchesExportKey(subpath, key));
}

export function workspaceRootFrom(importMetaDirectory: string): string {
  return resolve(importMetaDirectory, "../..");
}
