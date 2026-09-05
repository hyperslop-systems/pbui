export const INTERNAL_PACKAGE_NAMES = [
  "@hyperslop-systems/pbui",
  "@hyperslop-systems/datalab-ui",
  "@hyperslop-systems/pbui-chat-demo",
  "@hyperslop-systems/pbui-chat",
  "@hyperslop-systems/pbui-ecommerce-demo",
  "@hyperslop-systems/pbui-ecommerce",
  "@hyperslop-systems/pbui-editor",
  "@hyperslop-systems/pbui-plotscript-demo",
  "@hyperslop-systems/pbui-plotscript",
  "@hyperslop-systems/pbui-sandbox",
  "@hyperslop-systems/pbui-workbench",
  "@hyperslop-systems/workbench-core",
  "@hyperslop-systems/workbench-protocol",
] as const;

export type InternalPackageName = (typeof INTERNAL_PACKAGE_NAMES)[number];

export interface PackagePolicy {
  /** Repository-relative directory containing package.json. */
  readonly path: string;
  /** Internal packages this package's production code may import. */
  readonly allow: readonly InternalPackageName[];
  /** Rare non-code runtime contracts, keyed by package with a reviewable reason. */
  readonly allowUnusedRuntime?: Readonly<Partial<Record<InternalPackageName, string>>>;
}

/**
 * The intended production package DAG.
 *
 * This is deliberately explicit rather than inferred from the current
 * manifests. Adding a package or production edge is an architecture decision
 * and must update this reviewable table in the same change.
 */
export const PACKAGE_POLICY: Record<InternalPackageName, PackagePolicy> = {
  "@hyperslop-systems/pbui": {
    path: ".",
    allow: [],
  },
  "@hyperslop-systems/workbench-protocol": {
    path: "packages/workbench-protocol",
    allow: [],
  },
  "@hyperslop-systems/workbench-core": {
    path: "packages/workbench-core",
    allow: ["@hyperslop-systems/pbui", "@hyperslop-systems/workbench-protocol"],
  },
  "@hyperslop-systems/pbui-workbench": {
    path: "packages/pbui-workbench",
    allow: [
      "@hyperslop-systems/pbui",
      "@hyperslop-systems/workbench-core",
      "@hyperslop-systems/workbench-protocol",
    ],
  },
  "@hyperslop-systems/pbui-editor": {
    path: "packages/pbui-editor",
    allow: ["@hyperslop-systems/pbui"],
    allowUnusedRuntime: {
      "@hyperslop-systems/pbui":
        "Editor theme reads PBUI CSS tokens at runtime; consumer smoke imports PBUI styles even though editor JavaScript has no PBUI import.",
    },
  },
  "@hyperslop-systems/pbui-ecommerce": {
    path: "packages/pbui-ecommerce",
    allow: [
      "@hyperslop-systems/pbui",
      "@hyperslop-systems/pbui-workbench",
      "@hyperslop-systems/workbench-core",
      "@hyperslop-systems/workbench-protocol",
    ],
  },
  "@hyperslop-systems/datalab-ui": {
    path: "packages/datalab-ui",
    allow: [
      "@hyperslop-systems/pbui",
      "@hyperslop-systems/pbui-workbench",
      "@hyperslop-systems/workbench-core",
      "@hyperslop-systems/workbench-protocol",
    ],
  },
  "@hyperslop-systems/pbui-sandbox": {
    path: "packages/pbui-sandbox",
    allow: [
      "@hyperslop-systems/pbui",
      "@hyperslop-systems/pbui-editor",
      "@hyperslop-systems/pbui-workbench",
      "@hyperslop-systems/workbench-core",
      "@hyperslop-systems/workbench-protocol",
    ],
  },
  "@hyperslop-systems/pbui-plotscript": {
    path: "packages/pbui-plotscript",
    allow: [
      "@hyperslop-systems/pbui",
      "@hyperslop-systems/pbui-editor",
      "@hyperslop-systems/pbui-sandbox",
      "@hyperslop-systems/pbui-workbench",
      "@hyperslop-systems/workbench-core",
      "@hyperslop-systems/workbench-protocol",
    ],
  },
  "@hyperslop-systems/pbui-chat": {
    path: "packages/pbui-chat",
    allow: [
      "@hyperslop-systems/pbui",
      "@hyperslop-systems/pbui-sandbox",
      "@hyperslop-systems/pbui-workbench",
      "@hyperslop-systems/workbench-core",
      "@hyperslop-systems/workbench-protocol",
    ],
  },
  "@hyperslop-systems/pbui-ecommerce-demo": {
    path: "packages/pbui-ecommerce/demo",
    allow: [
      "@hyperslop-systems/pbui",
      "@hyperslop-systems/pbui-ecommerce",
      "@hyperslop-systems/pbui-workbench",
      "@hyperslop-systems/workbench-core",
    ],
  },
  "@hyperslop-systems/pbui-plotscript-demo": {
    path: "packages/pbui-plotscript/demo",
    allow: [
      "@hyperslop-systems/pbui",
      "@hyperslop-systems/pbui-editor",
      "@hyperslop-systems/pbui-plotscript",
      "@hyperslop-systems/pbui-sandbox",
      "@hyperslop-systems/pbui-workbench",
      "@hyperslop-systems/workbench-core",
      "@hyperslop-systems/workbench-protocol",
    ],
  },
  "@hyperslop-systems/pbui-chat-demo": {
    path: "packages/pbui-chat/demo",
    allow: [
      "@hyperslop-systems/pbui",
      "@hyperslop-systems/pbui-chat",
      "@hyperslop-systems/pbui-sandbox",
      "@hyperslop-systems/pbui-workbench",
      "@hyperslop-systems/workbench-core",
      "@hyperslop-systems/workbench-protocol",
    ],
  },
};
