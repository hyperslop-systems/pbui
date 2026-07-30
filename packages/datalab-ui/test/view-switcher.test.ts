import { describe, expect, test } from "vitest";
import type { AppDescriptor } from "../src/appkit/registry";
import { buildViewSwitcherModel } from "../src/components/organisms/ViewSwitcher";
import type { AppView } from "../src/store/layout";

const descriptor = (
  id: string,
  options: Partial<Pick<AppDescriptor, "singleton" | "docBound">> = {},
): AppDescriptor => ({
  id,
  title: id,
  tone: "var(--pbui-tone-neutral)",
  docBound: options.docBound ?? false,
  duplicable: true,
  singleton: options.singleton ?? false,
  Component: () => null,
});

const view = (id: string, appId: string): AppView => ({
  id,
  appId,
  documents: {},
});

function model(options: { apps?: AppDescriptor[]; views?: AppView[]; current?: string | null }) {
  const apps = options.apps ?? [descriptor("chart"), descriptor("trace", { singleton: true })];
  const views = options.views ?? [view("chart-1", "chart"), view("trace-1", "trace")];
  const byId = Object.fromEntries(views.map((item) => [item.id, item]));
  const registry = new Map(apps.map((app) => [app.id, app]));
  return buildViewSwitcherModel({
    apps,
    views: byId,
    viewOrder: views.map((item) => item.id),
    currentViewId: options.current ?? null,
    appFor: (id) => registry.get(id) ?? null,
    placementCount: (id) => (id === "chart-1" ? 2 : 0),
    shownInCurrentWorkspace: (id) => id === "chart-1",
  });
}

describe("the shared launcher and Replace selection model", () => {
  test("existing views retain placement metadata and exclude the current view", () => {
    const result = model({ current: "trace-1" });
    expect(result.existing).toEqual([
      expect.objectContaining({
        view: expect.objectContaining({ id: "chart-1" }),
        placementCount: 2,
        shownInCurrentWorkspace: true,
      }),
    ]);
  });

  test("a singleton existing view is selectable but cannot be created again", () => {
    const result = model({});
    expect(result.existing.map((option) => option.view.id)).toContain("trace-1");
    expect(result.creatable.map((app) => app.id)).not.toContain("trace");
  });

  test("a non-singleton application remains creatable while views of it exist", () => {
    expect(model({}).creatable.map((app) => app.id)).toContain("chart");
  });

  test("out-of-scope existing views are hidden", () => {
    const result = model({
      apps: [descriptor("chart")],
      views: [view("chart-1", "chart"), view("tokens-1", "tokens")],
    });
    expect(result.existing.map((option) => option.view.id)).toEqual(["chart-1"]);
  });

  test("views shown here sort ahead of hidden and elsewhere views", () => {
    const apps = [descriptor("chart")];
    const views = [view("elsewhere", "chart"), view("hidden", "chart"), view("here", "chart")];
    const byId = Object.fromEntries(views.map((item) => [item.id, item]));
    const result = buildViewSwitcherModel({
      apps,
      views: byId,
      viewOrder: views.map((item) => item.id),
      currentViewId: null,
      appFor: () => apps[0]!,
      placementCount: (id) => (id === "hidden" ? 0 : 1),
      shownInCurrentWorkspace: (id) => id === "here",
    });
    expect(result.existing.map((option) => option.view.id)).toEqual([
      "here",
      "hidden",
      "elsewhere",
    ]);
  });
});
