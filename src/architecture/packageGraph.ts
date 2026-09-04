import { relative, sep } from "node:path";
import type { InternalPackageName, PackagePolicy } from "./packagePolicy";
import {
  declarationAllowsImport,
  findCycle,
  packageExportsSpecifier,
  type DeclaredEdge,
  type DependencyKind,
  type ImportEdge,
  type WorkspacePackage,
} from "./workspacePackages";

export type ArchitectureViolationCode =
  | "missing-policy"
  | "stale-policy"
  | "wrong-package-path"
  | "undeclared-import"
  | "forbidden-edge"
  | "unused-runtime-dependency"
  | "private-subpath"
  | "dependency-cycle";

export interface ArchitectureViolation {
  readonly code: ArchitectureViolationCode;
  readonly message: string;
}

const RUNTIME_KINDS = new Set<DependencyKind>([
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
]);

function edgeKey(from: string, to: string): string {
  return `${from}\0${to}`;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

/**
 * Compare measured manifests/imports with the intended package architecture.
 * The return value is deterministic so a failed CI job is directly actionable.
 */
export function analyzeWorkspaceGraph(
  workspaceRoot: string,
  packages: readonly WorkspacePackage[],
  declarations: readonly DeclaredEdge[],
  imports: readonly ImportEdge[],
  policy: Readonly<Record<InternalPackageName, PackagePolicy>>,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  const packagesByName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const discoveredNames = new Set(packagesByName.keys());
  const policyNames = new Set(Object.keys(policy));

  for (const name of [...discoveredNames].sort()) {
    const rule = policy[name as InternalPackageName];
    if (!rule) {
      violations.push({
        code: "missing-policy",
        message: `${name} is a discovered workspace package but has no package policy entry`,
      });
      continue;
    }
    const pkg = packagesByName.get(name) as WorkspacePackage;
    const actualPath = relative(workspaceRoot, pkg.root).split(sep).join("/") || ".";
    if (actualPath !== rule.path) {
      violations.push({
        code: "wrong-package-path",
        message: `${name} is at ${actualPath}, but package policy records ${rule.path}`,
      });
    }
  }

  for (const name of [...policyNames].sort()) {
    if (!discoveredNames.has(name)) {
      violations.push({
        code: "stale-policy",
        message: `${name} is in package policy but no workspace package was discovered`,
      });
    }
  }

  const declarationKinds = new Map<string, DependencyKind[]>();
  for (const edge of declarations) {
    const key = edgeKey(edge.from, edge.to);
    declarationKinds.set(key, [...(declarationKinds.get(key) ?? []), edge.kind]);
  }

  for (const edge of imports) {
    const kinds = declarationKinds.get(edgeKey(edge.from, edge.to)) ?? [];
    if (!declarationAllowsImport(kinds, edge.use)) {
      const expected = edge.use === "production"
        ? "dependencies, peerDependencies, or optionalDependencies"
        : "dependencies, peerDependencies, optionalDependencies, or devDependencies";
      violations.push({
        code: "undeclared-import",
        message:
          `${edge.file} imports ${edge.specifier}, but ${edge.from} does not declare ` +
          `${edge.to} in ${expected} (${edge.use} import)`,
      });
    }

    const target = packagesByName.get(edge.to);
    if (target && !packageExportsSpecifier(target, edge.specifier)) {
      violations.push({
        code: "private-subpath",
        message: `${edge.file} imports private package subpath ${edge.specifier}; add a public export or use an exported entry`,
      });
    }
  }

  const runtimeDeclarations = declarations.filter((edge) => RUNTIME_KINDS.has(edge.kind));
  const productionUses = new Set(
    imports.filter((edge) => edge.use === "production").map((edge) => edgeKey(edge.from, edge.to)),
  );

  for (const edge of runtimeDeclarations) {
    const rule = policy[edge.from as InternalPackageName];
    if (rule && !rule.allow.includes(edge.to as InternalPackageName)) {
      violations.push({
        code: "forbidden-edge",
        message:
          `${edge.from} declares forbidden ${edge.kind} edge to ${edge.to}; allowed production edges: ` +
          `${rule.allow.join(", ") || "none"}`,
      });
    }
    if (
      !productionUses.has(edgeKey(edge.from, edge.to)) &&
      !rule?.allowUnusedRuntime?.[edge.to as InternalPackageName]
    ) {
      violations.push({
        code: "unused-runtime-dependency",
        message: `${edge.from} declares ${edge.to} in ${edge.kind}, but production source does not import it`,
      });
    }
  }

  // A production import with only a dev declaration has already failed above,
  // but checking it against policy as well gives the intended architecture.
  for (const edgeKeyValue of uniqueSorted(
    imports
      .filter((edge) => edge.use === "production")
      .map((edge) => edgeKey(edge.from, edge.to)),
  )) {
    const [from, to] = edgeKeyValue.split("\0") as [string, string];
    const rule = policy[from as InternalPackageName];
    if (rule && !rule.allow.includes(to as InternalPackageName)) {
      violations.push({
        code: "forbidden-edge",
        message:
          `${from} production source imports forbidden package ${to}; allowed production edges: ` +
          `${rule.allow.join(", ") || "none"}`,
      });
    }
  }

  const graph = new Map<string, string[]>();
  for (const name of discoveredNames) graph.set(name, []);
  for (const edge of runtimeDeclarations) {
    graph.get(edge.from)?.push(edge.to);
  }
  for (const [name, targets] of graph) graph.set(name, uniqueSorted(targets));
  const cycle = findCycle(graph);
  if (cycle) {
    violations.push({
      code: "dependency-cycle",
      message: `internal runtime dependency cycle: ${cycle.join(" -> ")}`,
    });
  }

  const deduplicated = new Map<string, ArchitectureViolation>();
  for (const violation of violations) {
    deduplicated.set(`${violation.code}\0${violation.message}`, violation);
  }
  return [...deduplicated.values()].sort((a, b) =>
    `${a.code}\0${a.message}`.localeCompare(`${b.code}\0${b.message}`),
  );
}
