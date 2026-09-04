import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { extractModuleSpecifiers } from "./workspacePackages";

export const GOVERNED_COMPONENT_DIRECTORIES = [
  "foundation",
  "layout",
  "atoms",
  "molecules",
  "organisms",
] as const;

export const CROSS_CUTTING_COMPONENT_DIRECTORIES = [
  "ContextHelp",
  "Dialog",
  "InspectorPanel",
  "JsonBlock",
] as const;

/** Which root source layers each stable component/chrome layer may import. */
export const ROOT_LAYER_POLICY: Readonly<Record<string, readonly string[]>> = {
  "components/foundation": [],
  "components/layout": ["components/foundation"],
  "components/atoms": ["components/foundation", "components/layout"],
  "components/molecules": [
    "components/foundation",
    "components/layout",
    "components/atoms",
    "components/format",
  ],
  chrome: [
    "components/foundation",
    "components/atoms",
    "components/Dialog",
    "focus",
    "surfaces",
  ],
  visualization: ["components/format"],
  "components/organisms": [
    "components/foundation",
    "components/layout",
    "components/atoms",
    "components/molecules",
    "components/format",
    "chrome",
    "visualization",
  ],
};

function slash(path: string): string {
  return path.split(sep).join("/");
}

function isInside(path: string, directory: string): boolean {
  const rel = relative(directory, path);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

/** Map a root source path onto the deliberately small governed vocabulary. */
export function rootLayerOf(path: string, sourceRoot: string): string | null {
  if (!isInside(path, sourceRoot)) return null;
  const [first, second] = slash(relative(sourceRoot, path)).split("/");
  if (!first) return null;
  if (first !== "components") return first.replace(/\.[^.]+$/, "");
  if (!second) return "components";
  return `components/${second.replace(/\.[^.]+$/, "")}`;
}

function walkProductionTypeScript(directory: string, output: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      walkProductionTypeScript(path, output);
    } else if (
      /\.[cm]?[jt]sx?$/.test(path) &&
      !/\.(?:test|spec|stories)\.[cm]?[jt]sx?$/.test(path)
    ) {
      output.push(path);
    }
  }
  return output;
}

export interface RootLayerViolation {
  readonly file: string;
  readonly from: string;
  readonly specifier: string;
  readonly to: string;
  readonly message: string;
}

export function analyzeRootLayers(
  sourceRoot: string,
  policy: Readonly<Record<string, readonly string[]>> = ROOT_LAYER_POLICY,
): RootLayerViolation[] {
  const violations: RootLayerViolation[] = [];

  for (const file of walkProductionTypeScript(sourceRoot)) {
    const from = rootLayerOf(file, sourceRoot);
    if (!from || !(from in policy)) continue;

    for (const specifier of extractModuleSpecifiers(readFileSync(file, "utf8"), file)) {
      if (!specifier.startsWith(".")) continue;
      const target = resolve(dirname(file), specifier);
      const to = rootLayerOf(target, sourceRoot);
      if (!to || to === from) continue;
      if (policy[from]?.includes(to)) continue;

      violations.push({
        file: slash(relative(sourceRoot, file)),
        from,
        specifier,
        to,
        message:
          `${slash(relative(sourceRoot, file))} (${from}) imports ${specifier} (${to}); ` +
          `${from} may import: ${policy[from]?.join(", ") || "nothing"}`,
      });
    }
  }

  return violations.sort((a, b) => a.message.localeCompare(b.message));
}
