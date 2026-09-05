import type { AppView } from "@hyperslop-systems/workbench-protocol";
import type { AppDescriptor } from "../../../appkit/registry";

type ViewId = string;

export interface ExistingViewOption {
  view: AppView;
  app: AppDescriptor | null;
  placementCount: number;
  shownInCurrentWorkspace: boolean;
}

export interface ViewSwitcherModel {
  existing: ExistingViewOption[];
  creatable: AppDescriptor[];
}

export interface ViewSwitcherModelInput {
  apps: readonly AppDescriptor[];
  views: Readonly<Record<ViewId, AppView>>;
  viewOrder: readonly ViewId[];
  currentViewId: ViewId | null;
  appFor(id: string): AppDescriptor | null;
  placementCount(viewId: ViewId): number;
  shownInCurrentWorkspace(viewId: ViewId): boolean;
}

/**
 * Pure selection policy shared by launcher and Replace.
 *
 * Scope decides which application definitions and existing views are legal.
 * A singleton limits logical views, not placements: its existing view remains
 * selectable, while creating a second logical view is unavailable.
 */
export function buildViewSwitcherModel({
  apps,
  views,
  viewOrder,
  currentViewId,
  appFor,
  placementCount,
  shownInCurrentWorkspace,
}: ViewSwitcherModelInput): ViewSwitcherModel {
  const current = currentViewId ? views[currentViewId] : undefined;
  const ownApp = current ? appFor(current.appId) : null;
  const listedApps = apps.some((app) => app.id === current?.appId)
    ? [...apps]
    : [...(ownApp ? [ownApp] : []), ...apps];
  const allowedExistingApps = new Set(apps.map((app) => app.id));
  const existingAppIds = new Set(viewOrder.flatMap((id) => (views[id] ? [views[id].appId] : [])));
  const existing = viewOrder.flatMap((id) => {
    const view = views[id];
    if (
      !view ||
      view.id === currentViewId ||
      view.appId === "launcher" ||
      !allowedExistingApps.has(view.appId)
    ) {
      return [];
    }
    return [
      {
        view,
        app: appFor(view.appId),
        placementCount: placementCount(view.id),
        shownInCurrentWorkspace: shownInCurrentWorkspace(view.id),
      },
    ];
  });
  const rank = (option: ExistingViewOption) =>
    option.shownInCurrentWorkspace ? 0 : option.placementCount === 0 ? 1 : 2;
  existing.sort((a, b) => rank(a) - rank(b));

  return {
    existing,
    creatable: listedApps.filter(
      (app) => app.id !== "launcher" && !(app.singleton && existingAppIds.has(app.id)),
    ),
  };
}
