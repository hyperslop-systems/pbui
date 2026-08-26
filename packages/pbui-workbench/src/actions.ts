import {
  available,
  defineActions,
  inapplicable,
  unavailable,
} from "@hyperslop-systems/pbui";
import type {
  ActionContribution,
  PresentationTypeDefinition,
  ScopeId,
} from "@hyperslop-systems/pbui";
import type { TileRef } from "./tileDescriptor";
import { workbenchVerbs, type WorkbenchVerb } from "./verbs";

/**
 * The shared workbench action contributions (PBUI-ACTIONS-2 Amendment C).
 *
 * This is how a SHARED package contributes to a PRODUCT-OWNED action
 * registry: exported fragments the product spreads into its own
 * `createActionRegistry`, instead of the `TileDescriptorOptions.extra`
 * callback (now deprecated). A product adding tile actions registers its own
 * rules for subject `"tile"` under its own rule ids — no merge owner, and
 * the kernel's override and ambiguity machinery arbitrates.
 *
 *     const registry = createActionRegistry({
 *       graph: createPresentationTypeGraph([...workbenchTypeDefinitions, ...productTypes]),
 *       scopes: [...productScopes, ...workbenchScopes, "global"],
 *       contributions: [...workbenchTileContributions(), ...productContributions],
 *     });
 *
 * The rules reproduce `createTileDescriptor`'s rows exactly — same labels,
 * same `disabledBecause` wording, same verbs, same order — with two
 * kernel-native upgrades: the "Shown in N tiles" informational row is
 * `inapplicable` on a single placement (absent, permits nothing because no
 * other rule implements it) and `unavailable` on a linked view (visible,
 * disabled, explains itself); and every row now participates in override,
 * trace, and fresh revalidation.
 *
 * Menu order note: the rows deliberately share one (undefined) group with
 * sequential `order` values so the kernel's presentation sort reproduces the
 * descriptor's exact row sequence. The old `group: "layout" | "view"`
 * labels were metadata with no renderer; reintroduce visual groups
 * deliberately, not as a side effect of migration.
 */

export const workbenchTypeDefinitions: readonly PresentationTypeDefinition[] = [
  { id: "tile" },
  { id: "workspace" },
];

export const workbenchScopes: readonly ScopeId[] = ["workbench"];

export interface WorkbenchTileContributionOptions<TileValue = TileRef> {
  /** Offer "Show something else here…" through the per-pane launcher. Default true. */
  launcher?: boolean;
  /**
   * Project the product's tile value onto the canonical `TileRef`. Products
   * whose `<tile>` presentation carries a different shape (the chat layer's
   * wire reference, for one) supply the mapping here and consume the shared
   * rules unchanged. Default: the value already IS a TileRef.
   */
  project?(value: TileValue): TileRef;
}

export function workbenchTileContributions<
  Values extends { tile: unknown },
  ProductFacts,
>(
  options: WorkbenchTileContributionOptions<Values["tile"]> = {},
): readonly ActionContribution<Values, ProductFacts, WorkbenchVerb>[] {
  /*
   * Built against a canonical `{tile}` shape and widened on return: the
   * compiler cannot prove `"tile"` is a key of an unresolved `Values`, but
   * the constraint guarantees it, and every rule reads the payload only
   * through `project`, which pins the shape.
   */
  type TileValues = { tile: TileRef };
  const define = defineActions<TileValues, ProductFacts, WorkbenchVerb>();
  const useLauncher = options.launcher ?? true;
  const project = (options.project ?? ((value: unknown) => value as TileRef)) as (
    value: unknown,
  ) => TileRef;

  const contributions: ActionContribution<TileValues, ProductFacts, WorkbenchVerb>[] = [
    define.exact("tile", {
      id: "workbench.tile.split-row",
      action: "tile.split.row",
      scopes: [...workbenchScopes],
      metadata: { label: "Split beside", order: 10 },
      bind: ({ subject }) => workbenchVerbs.split(project(subject.value).placementId, "row"),
    }),
    define.exact("tile", {
      id: "workbench.tile.split-col",
      action: "tile.split.col",
      scopes: [...workbenchScopes],
      metadata: { label: "Split below", order: 11 },
      bind: ({ subject }) => workbenchVerbs.split(project(subject.value).placementId, "col"),
    }),
  ];

  if (useLauncher) {
    contributions.push(
      define.exact("tile", {
        id: "workbench.tile.replace",
        action: "tile.replace",
        scopes: [...workbenchScopes],
        metadata: {
          label: "Show something else here…",
          description: "opens the launcher aimed at this tile",
          order: 12,
        },
        bind: ({ subject }) => workbenchVerbs.openLauncher(project(subject.value).placementId),
      }),
    );
  }

  contributions.push(
    define.exact("tile", {
      id: "workbench.tile.duplicate",
      action: "view.duplicate",
      scopes: [...workbenchScopes],
      test: ({ subject }) =>
        project(subject.value).duplicable
          ? available()
          : unavailable("this application shows one view; splitting links a second tile to it"),
      metadata: {
        label: "Duplicate",
        description: "a second tile with its own state",
        order: 20,
      },
      bind: ({ subject }) => workbenchVerbs.split(project(subject.value).placementId, "row"),
    }),
    define.exact("tile", {
      id: "workbench.tile.rename",
      action: "view.rename",
      scopes: [...workbenchScopes],
      metadata: {
        label: ({ subject }) =>
          project(subject.value).customTitle ? "Rename…" : "Name this tile…",
        order: 21,
      },
      bind: ({ subject }) => {
        const tile = project(subject.value);
        return workbenchVerbs.setTitle(tile.viewId, tile.customTitle ?? "");
      },
    }),
    define.exact("tile", {
      id: "workbench.tile.linked-info",
      action: "view.linked-info",
      scopes: [...workbenchScopes],
      // Informational on a linked view; simply not relevant on a lone one.
      test: ({ subject }) =>
        project(subject.value).placementCount > 1
          ? unavailable("this is a description, not an action")
          : inapplicable(),
      metadata: {
        label: ({ subject }) =>
          `Shown in ${project(subject.value).placementCount} tiles`,
        description: "the same view; changes appear in both",
        order: 22,
      },
      bind: ({ subject }) => workbenchVerbs.goTo(project(subject.value).viewId),
    }),
    define.exact("tile", {
      id: "workbench.tile.close",
      action: "tile.close",
      scopes: [...workbenchScopes],
      test: ({ subject }) =>
        project(subject.value).canClose
          ? available()
          : unavailable("a workspace keeps at least one tile"),
      metadata: { label: "Close tile", danger: true, order: 30 },
      bind: ({ subject }) => workbenchVerbs.close(project(subject.value).placementId),
    }),
  );

  return contributions as unknown as readonly ActionContribution<
    Values,
    ProductFacts,
    WorkbenchVerb
  >[];
}
