import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../store";
import { useCurrentStageId, useCurrentWorkspaceId } from "./DatalabWorkbenchContext";
import { allApps, type AppDescriptor } from "./registry";

/**
 * Which applications this workbench offers.
 *
 * **The registry stays global; the visible set is per instance** (DATADROP-7
 * DR-53). Applications are stateless components, so a second registry would buy
 * nothing and cost the class of bug where an application is registered in one
 * and missing from another — which surfaces as a tile rendering "unknown app"
 * with no way to find out why.
 *
 * What a tour section actually needs is narrower than a registry: the grammar
 * track should not offer the token manager in its view switcher, because that
 * list is a menu of *what this panel is for*. So the allow-list is a
 * rendering concern, applied by the shared Replace/Launcher switcher,
 * and it deliberately does not stop an app from being *mounted* — a tile whose
 * layout names an excluded application still renders it, because the alternative
 * is a seeded layout that silently loses a tile.
 *
 * With no provider the scope is every registered application, which is what the
 * product wants and means no call site has to opt in.
 *
 * ## Three levels, intersected (DATADROP-8 DR-61)
 *
 * | Level | Set by | Why |
 * |---|---|---|
 * | Instance | `InstanceConfig.apps` | a tour section should not offer the token manager |
 * | Stage | `Stage.apps` | "a login stage that only has help and sign in" |
 * | Workspace | `Workspace.apps` | "limit which tiles can be shown in a workspace" |
 *
 * Intersection rather than override, because override has no defensible
 * direction. If the stage wins, an instance embedded in a tutorial page can be
 * handed a stage that re-offers everything and DR-53 is undone silently. If the
 * instance wins, a stage cannot narrow anything and the request is
 * unimplementable. Intersection is the only composition in which adding a
 * constraint can never remove one.
 *
 * ## All three levels FILTER (DATADROP-14 DR-95)
 *
 * They did not always. Instance scope filtered while stage and workspace scope
 * greyed out with a reason, on the argument that *a stage is somewhere you are
 * and can leave; an instance is what this page is, and you cannot* — so a tour
 * section teaching four applications should show four, but a stage hiding an
 * application would teach the user it does not exist.
 *
 * That distinction is gone, and what killed it was the ratio rather than the
 * principle. Twenty-five applications with twenty-two greyed is not a list with
 * a lesson in it, it is a list nobody reads; `ViewSwitcher/model.ts` has the full
 * argument. The principle survives where it still applies — `pbui/verbs.ts`
 * greys unavailable verbs and should keep doing so, because a verb menu is
 * short.
 *
 * The consequence for this file is that `reasonFor` had no consumer left, and
 * a function returning strings nothing renders is worse than no function. It is
 * replaced by `useAvailableApps()`, which returns one already-narrowed list.
 */
const AppScopeContext = createContext<readonly string[] | null>(null);

export function AppScope({ apps, children }: { apps?: readonly string[]; children: ReactNode }) {
  // Frozen into a memo so the context value does not change identity on every
  // render of whatever holds the config object.
  const value = useMemo(() => (apps ? [...apps] : null), [apps]);
  return <AppScopeContext.Provider value={value}>{children}</AppScopeContext.Provider>;
}

/** `null` means "no constraint at this level". */
export type Scope = readonly string[] | null;

/**
 * Most restrictive wins; `null` contributes nothing.
 *
 * An empty result is possible — a stage offering `["signin"]` inside an instance
 * offering `["chart"]` — and it must not produce an unusable switcher. Replace
 * keeps the current application legal and Launcher shows its empty state.
 */
export function intersectScopes(...scopes: Scope[]): Scope {
  const present = scopes.filter((s): s is readonly string[] => s !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => {
    const keep = new Set(b);
    return a.filter((id) => keep.has(id));
  });
}

/**
 * The registry narrowed by the INSTANCE's allow-list only.
 *
 * Registration order rather than the allow-list's order: Launcher and Replace
 * read as the same list everywhere, and a tour section should not
 * be able to reorder the vocabulary it is teaching.
 *
 * Almost every caller wants `useAvailableApps` instead. This one exists for the
 * case that genuinely means "what this page is about" without regard to where
 * in it you are standing, and it is exported chiefly so that the difference has
 * a name.
 */
export function useScopedApps(): AppDescriptor[] {
  const scope = useContext(AppScopeContext);
  const all = allApps();
  if (!scope) return all;
  const allowed = new Set(scope);
  return all.filter((app) => allowed.has(app.id));
}

/**
 * What a picker should offer: instance ∩ stage ∩ workspace, in registration
 * order.
 *
 * The successor to `useAppScope()`, which returned `{ apps, reasonFor }` back
 * when stage and workspace scope were rendered greyed. Nothing greys any more
 * (DR-95), so there is nothing for a reason string to be rendered into, and the
 * honest shape is a single already-narrowed list.
 *
 * Selectors return the stored arrays by reference rather than deriving new ones,
 * so this adds no re-renders: `stage.apps` and `space.apps` are the same objects
 * across every render in which the layout did not change.
 *
 * An empty result is possible — a stage offering `["signin"]` inside an instance
 * offering `["chart"]` — and must not produce an unusable switcher. Replace
 * keeps the current application legal and Launcher shows its empty state.
 */
export function useAvailableApps(): AppDescriptor[] {
  const apps = useScopedApps();
  const stageId = useCurrentStageId();
  const workspaceId = useCurrentWorkspaceId();
  const stageApps = useSelector(
    (state: RootState) => state.navigation.stages.find((s) => s.id === stageId)?.apps ?? null,
  );
  const spaceApps = useSelector(
    (state: RootState) => state.navigation.workspace[workspaceId]?.apps ?? null,
  );

  return useMemo(() => {
    const inStage = stageApps === null ? null : new Set(stageApps);
    const inSpace = spaceApps === null ? null : new Set(spaceApps);
    return apps.filter(
      (app) => (!inStage || inStage.has(app.id)) && (!inSpace || inSpace.has(app.id)),
    );
  }, [apps, stageApps, spaceApps]);
}
