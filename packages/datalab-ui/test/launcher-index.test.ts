import { describe, expect, test } from "vitest";
import type { AppDescriptor } from "../src/appkit/registry";
import {
  blockedReason,
  buildLauncherIndex,
  type LauncherRow,
  type LauncherIndexInput,
  type LauncherSearchContext,
  parseLauncherQuery,
  preferredPlacement,
  searchLauncherIndex,
} from "../src/components/organisms/ViewSwitcher";
import type { AppView, Node, Stage, Workspace } from "../src/store/layout";

/**
 * The launcher's search semantics, tested with no React and no store.
 *
 * That is the point of the Phase 1 boundary (design-doc/02 §15): every rule in
 * §6 to §8 — the grammar, the scoring, workspace grouping, linked and unplaced
 * views, and the per-workspace scope rule of §8.4 — is decidable from data, so
 * none of it needs a rendered modal to be pinned down.
 */

const descriptor = (
  id: string,
  options: Partial<Pick<AppDescriptor, "singleton" | "docBound" | "title">> = {},
): AppDescriptor => ({
  id,
  title: options.title ?? id,
  tone: "var(--pbui-tone-neutral)",
  docBound: options.docBound ?? false,
  duplicable: true,
  singleton: options.singleton ?? false,
  Component: () => null,
});

const view = (id: string, appId: string, title?: string, docId?: string): AppView => ({
  id,
  appId,
  documents: docId ? { primary: docId } : {},
  ...(title ? { title } : {}),
});

let nodeCounter = 0;
const leaf = (viewId: string, id?: string): Node => ({
  id: id ?? `node-${++nodeCounter}`,
  type: "leaf",
  viewId,
});
const split = (a: Node, b: Node): Node => ({
  id: `split-${++nodeCounter}`,
  type: "split",
  dir: "row",
  a,
  b,
  ratio: 0.5,
});

const stage = (id: string, apps: string[] | null = null): Stage => ({
  id,
  name: id,
  apps,
  chrome: { masthead: true, workspaces: true, stageBar: true },
  currentSpaceId: "",
});

const workspace = (
  id: string,
  name: string,
  tree: Node,
  options: { stageId?: string; apps?: string[] | null } = {},
): Workspace => ({
  id,
  name,
  tree,
  stageId: options.stageId ?? "work",
  ...(options.apps !== undefined ? { apps: options.apps } : {}),
});

const PLACE: LauncherSearchContext = {
  mode: "place",
  targetWorkspaceId: "ws-a",
  allowNewViews: true,
};
const NAVIGATE: LauncherSearchContext = {
  mode: "navigate",
  targetWorkspaceId: null,
  allowNewViews: false,
};

/** Two workspaces in one stage, a linked view across both, one unplaced view. */
function fixture(overrides: Partial<LauncherIndexInput> = {}): LauncherIndexInput {
  const views = [
    view("v-temp", "chart", "Temperature by station", "d-climate"),
    view("v-table", "table", undefined, "d-climate"),
    view("v-yield", "chart", "Yield by line", "d-batches"),
    view("v-scratch", "chart", "Scratch comparison"),
  ];
  return {
    apps: [descriptor("chart"), descriptor("table"), descriptor("encoding")],
    views: Object.fromEntries(views.map((item) => [item.id, item])),
    viewOrder: views.map((item) => item.id),
    workspaces: [
      workspace("ws-a", "build", split(leaf("v-temp", "n-temp-a"), leaf("v-table", "n-table"))),
      workspace("ws-b", "explore", split(leaf("v-temp", "n-temp-b"), leaf("v-yield", "n-yield"))),
    ],
    stages: [stage("work")],
    currentStageId: "work",
    currentWorkspaceId: "ws-a",
    visibleStageIds: ["work", "account", "lab", "elsewhere"],
    docNames: { "d-climate": "climate", "d-batches": "batches" },
    ...overrides,
  };
}

const search = (
  raw: string,
  context: LauncherSearchContext = PLACE,
  overrides: Partial<LauncherIndexInput> = {},
) => searchLauncherIndex(buildLauncherIndex(fixture(overrides)), parseLauncherQuery(raw), context);

describe("the launcher query grammar", () => {
  test("plain text searches everything", () => {
    expect(parseLauncherQuery("temp")).toEqual({ kind: "all", text: "temp" });
  });

  test("a bare + shows every creatable application", () => {
    expect(parseLauncherQuery("+")).toEqual({ kind: "new", text: "" });
  });

  test("+ narrows to new applications", () => {
    expect(parseLauncherQuery("+chart")).toEqual({ kind: "new", text: "chart" });
  });

  test("wsN scopes to one workspace", () => {
    expect(parseLauncherQuery("ws8")).toEqual({ kind: "workspace", workspaceOrdinal: 8, text: "" });
    expect(parseLauncherQuery("ws8 temp")).toEqual({
      kind: "workspace",
      workspaceOrdinal: 8,
      text: "temp",
    });
  });

  test("tokens are case-insensitive and tolerate surrounding whitespace", () => {
    expect(parseLauncherQuery("  WS8   TEMP  ")).toEqual({
      kind: "workspace",
      workspaceOrdinal: 8,
      text: "TEMP",
    });
  });

  test("a workspace token is only recognised at the start", () => {
    // A view may legitimately be called "ws8 report"; typing its title must
    // search for it rather than scope to a workspace.
    expect(parseLauncherQuery("report ws8")).toEqual({ kind: "all", text: "report ws8" });
  });

  test("ws8x is text, not workspace 8", () => {
    expect(parseLauncherQuery("ws8x")).toEqual({ kind: "all", text: "ws8x" });
  });

  test("ws0 is text: ordinals are one-based", () => {
    expect(parseLauncherQuery("ws0")).toEqual({ kind: "all", text: "ws0" });
  });

  test("combining a workspace with + reports rather than guesses", () => {
    expect(parseLauncherQuery("ws8 +chart")).toEqual({
      kind: "workspace",
      workspaceOrdinal: 8,
      text: "chart",
      error: "workspace-and-new-are-incompatible",
    });
  });
});

describe("workspace grouping", () => {
  test("a linked view appears once under each workspace that places it", () => {
    const index = buildLauncherIndex(fixture());
    const rows = index.currentStageGroups.flatMap((group) =>
      group.rows.filter((row) => row.viewId === "v-temp"),
    );
    expect(rows.map((row) => row.workspaceId)).toEqual(["ws-a", "ws-b"]);
    expect(rows.map((row) => row.totalPlacementCount)).toEqual([2, 2]);
    expect(rows.map((row) => row.id)).toEqual(["placed:ws-a:v-temp", "placed:ws-b:v-temp"]);
  });

  test("several placements of one view in one workspace collapse to one row", () => {
    const index = buildLauncherIndex(
      fixture({
        workspaces: [
          workspace("ws-a", "build", split(leaf("v-temp", "n-1"), leaf("v-temp", "n-2"))),
        ],
      }),
    );
    const rows = index.currentStageGroups[0]?.rows ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.placementIds).toEqual(["n-1", "n-2"]);
    expect(rows[0]?.totalPlacementCount).toBe(2);
  });

  test("a view with no placement is unplaced, not grouped", () => {
    const index = buildLauncherIndex(fixture());
    expect(index.unplaced.map((row) => row.viewId)).toEqual(["v-scratch"]);
    expect(index.currentStageGroups.flatMap((g) => g.rows).map((r) => r.viewId)).not.toContain(
      "v-scratch",
    );
  });

  test("ordinals follow the current stage's strip order and are one-based", () => {
    const index = buildLauncherIndex(fixture());
    expect([...index.workspaceByOrdinal]).toEqual([
      [1, "ws-a"],
      [2, "ws-b"],
    ]);
    expect(index.currentStageGroups.map((group) => group.alias)).toEqual(["ws1", "ws2"]);
  });

  test("another stage's workspaces get no ordinal", () => {
    const index = buildLauncherIndex(
      fixture({
        stages: [stage("work"), stage("account")],
        workspaces: [
          workspace("ws-a", "build", leaf("v-temp")),
          workspace("ws-z", "profile", leaf("v-yield"), { stageId: "account" }),
        ],
      }),
    );
    expect([...index.workspaceByOrdinal]).toEqual([[1, "ws-a"]]);
    expect(index.otherStageGroups.map((group) => group.alias)).toEqual([""]);
  });

  test("the derived title matches what the tile renders", () => {
    const index = buildLauncherIndex(fixture());
    const rows = index.currentStageGroups.flatMap((group) => group.rows);
    // v-table has no custom title, so it derives "table · climate".
    expect(rows.find((row) => row.viewId === "v-table")?.title).toBe("table · climate");
    expect(rows.find((row) => row.viewId === "v-temp")?.title).toBe("Temperature by station");
  });

  test("every row carries its application's tone", () => {
    // The launcher colours rows by application, the same way the tile title bar
    // and `Chip` do. A view whose application this build does not register gets
    // the neutral tone rather than an empty border.
    const index = buildLauncherIndex(
      fixture({
        apps: [
          { ...descriptor("chart"), tone: "var(--pbui-tone-chart)" },
          { ...descriptor("table"), tone: "var(--pbui-tone-cat)" },
        ],
        views: {
          "v-c": view("v-c", "chart", "a chart"),
          "v-t": view("v-t", "table", "a table"),
        },
        viewOrder: ["v-c", "v-t"],
        workspaces: [workspace("ws-a", "build", split(leaf("v-c"), leaf("v-t")))],
      }),
    );
    const byId = Object.fromEntries(
      (index.currentStageGroups[0]?.rows ?? []).map((row) => [row.viewId, row.tone]),
    );
    expect(byId).toEqual({
      "v-c": "var(--pbui-tone-chart)",
      "v-t": "var(--pbui-tone-cat)",
    });
    expect(index.newApplications.map((row) => row.tone)).toEqual([
      "var(--pbui-tone-chart)",
      "var(--pbui-tone-cat)",
    ]);
  });

  test("launcher tiles are never destinations", () => {
    const index = buildLauncherIndex(
      fixture({
        apps: [descriptor("chart"), descriptor("launcher")],
        views: { "v-empty": view("v-empty", "launcher") },
        viewOrder: ["v-empty"],
        workspaces: [workspace("ws-a", "build", leaf("v-empty"))],
      }),
    );
    expect(index.currentStageGroups.flatMap((group) => group.rows)).toEqual([]);
    expect(index.newApplications.map((row) => row.appId)).not.toContain("launcher");
  });
});

describe("application scope is per row, not per query", () => {
  // §8.4. The bug this prevents is an absence: a view placed in ws2 vanishing
  // from a `ws2` query because the *current* workspace does not offer its app.
  const scoped = () =>
    fixture({
      workspaces: [
        workspace("ws-a", "build", leaf("v-temp"), { apps: ["chart"] }),
        workspace("ws-b", "explore", split(leaf("v-yield"), leaf("v-enc")), {
          apps: ["chart", "encoding"],
        }),
      ],
      views: {
        "v-temp": view("v-temp", "chart", "Temperature by station"),
        "v-yield": view("v-yield", "chart", "Yield by line"),
        "v-enc": view("v-enc", "encoding", "Yield encoding"),
      },
      viewOrder: ["v-temp", "v-yield", "v-enc"],
    });

  test("a view is listed under a workspace that offers its application", () => {
    const index = buildLauncherIndex(scoped());
    const groupB = index.currentStageGroups.find((group) => group.workspaceId === "ws-b");
    expect(groupB?.rows.map((row) => row.viewId)).toEqual(["v-yield", "v-enc"]);
    expect(groupB?.rows.find((row) => row.viewId === "v-enc")?.inScope).toBe(true);
  });

  test("the current workspace's allow-list does not filter another workspace's rows", () => {
    // ws-a offers only `chart`. Without §8.4 the encoding view in ws-b would be
    // hidden from `ws2 yield` entirely.
    const results = searchLauncherIndex(
      buildLauncherIndex(scoped()),
      parseLauncherQuery("ws2 yield"),
      PLACE,
    );
    expect(results.groups.flatMap((group) => group.rows).map((row) => row.viewId)).toEqual([
      "v-yield",
      "v-enc",
    ]);
  });

  test("a stage allow-list narrows its own workspaces only", () => {
    // Two stages, one forbidding `encoding`. The same view is placed in each,
    // so a scope leak in either direction shows up as both rows agreeing.
    const index = buildLauncherIndex({
      ...scoped(),
      stages: [stage("work", ["chart"]), stage("lab")],
      currentStageId: "work",
      workspaces: [
        workspace("ws-a", "build", leaf("v-enc", "n-a")),
        workspace("ws-lab", "lab bench", leaf("v-enc", "n-lab"), { stageId: "lab" }),
      ],
    });
    const inWork = index.currentStageGroups[0]?.rows[0];
    const inLab = index.otherStageGroups[0]?.rows[0];
    expect(inWork?.workspaceId).toBe("ws-a");
    expect(inLab?.workspaceId).toBe("ws-lab");
    // Out of scope where the stage forbids it, in scope where it does not —
    // one logical view, two answers, decided by the workspace it sits in.
    expect(inWork?.inScope).toBe(false);
    expect(inLab?.inScope).toBe(true);
  });

  test("instance scope removes a row entirely rather than marking it", () => {
    // Instance scope is "what this page is about" and cannot be left, unlike a
    // stage. A tour panel teaching two applications must not offer a third.
    const index = buildLauncherIndex({
      ...scoped(),
      apps: [descriptor("chart")],
    });
    const rows = index.currentStageGroups.flatMap((group) => group.rows);
    expect(rows.map((row) => row.viewId)).not.toContain("v-enc");
  });
});

describe("search behaviour", () => {
  test("scoring puts an exact title above a prefix above a substring", () => {
    const results = search("yield", PLACE, {
      views: {
        a: view("a", "chart", "yield"),
        b: view("b", "chart", "yield by line"),
        c: view("c", "chart", "annual yield report"),
      },
      viewOrder: ["a", "b", "c"],
      workspaces: [workspace("ws-a", "build", split(split(leaf("a"), leaf("b")), leaf("c")))],
    });
    expect(results.groups[0]?.rows.map((row) => row.viewId)).toEqual(["a", "b", "c"]);
  });

  test("a word-prefix match beats a bare substring", () => {
    const results = search("station", PLACE, {
      views: {
        a: view("a", "chart", "workstation load"),
        b: view("b", "chart", "temperature station"),
      },
      viewOrder: ["a", "b"],
      workspaces: [workspace("ws-a", "build", split(leaf("a"), leaf("b")))],
    });
    expect(results.groups[0]?.rows.map((row) => row.viewId)).toEqual(["b", "a"]);
  });

  test("a document name matches", () => {
    const results = search("batches");
    expect(results.groups.flatMap((g) => g.rows).map((r) => r.viewId)).toContain("v-yield");
  });

  test("no match omits the row rather than ranking it last", () => {
    const results = search("zzzz");
    expect(results.rows).toEqual([]);
  });

  test("the current workspace is ordered first", () => {
    const results = search("temp");
    expect(results.groups.map((group) => group.workspaceId)).toEqual(["ws-a", "ws-b"]);
  });

  test("wsN restricts results to the resolved workspace", () => {
    const results = search("ws2 temp");
    expect(results.groups.map((group) => group.workspaceId)).toEqual(["ws-b"]);
    expect(results.missingWorkspace).toBeNull();
  });

  test("a missing workspace explains itself and lists what exists", () => {
    const results = search("ws9 temp");
    expect(results.missingWorkspace).toEqual({ ordinal: 9, available: ["ws1", "ws2"] });
    expect(results.groups).toEqual([]);
  });

  test("+chart returns only new applications", () => {
    const results = search("+chart");
    expect(results.groups).toEqual([]);
    expect(results.unplaced).toEqual([]);
    expect(results.newApplications.map((row) => row.appId)).toEqual(["chart"]);
  });

  test("a singleton with an existing view is not creatable again", () => {
    const index = buildLauncherIndex(
      fixture({
        apps: [descriptor("chart"), descriptor("trace", { singleton: true })],
        views: { t: view("t", "trace") },
        viewOrder: ["t"],
        workspaces: [workspace("ws-a", "build", leaf("t"))],
      }),
    );
    expect(index.newApplications.map((row) => row.appId)).toEqual(["chart"]);
    // …but its existing view remains a destination: singleton limits logical
    // views, not placements.
    expect(index.currentStageGroups[0]?.rows.map((row) => row.viewId)).toEqual(["t"]);
  });
});

describe("empty-query presentation limits", () => {
  const many = () =>
    fixture({
      views: Object.fromEntries(
        Array.from({ length: 6 }, (_, i) => [`v${i}`, view(`v${i}`, "chart", `view ${i}`)]),
      ),
      viewOrder: Array.from({ length: 6 }, (_, i) => `v${i}`),
      workspaces: [
        workspace("ws-a", "build", leaf("v0")),
        workspace(
          "ws-b",
          "explore",
          split(split(leaf("v1"), leaf("v2")), split(leaf("v3"), leaf("v4"))),
        ),
      ],
    });

  test("an empty query caps other workspaces but not the current one", () => {
    const results = searchLauncherIndex(buildLauncherIndex(many()), parseLauncherQuery(""), PLACE);
    const other = results.groups.find((group) => group.workspaceId === "ws-b");
    expect(other?.rows).toHaveLength(3);
    expect(results.limited).toBe(true);
  });

  test("typing text removes the limits", () => {
    const results = searchLauncherIndex(
      buildLauncherIndex(many()),
      parseLauncherQuery("view"),
      PLACE,
    );
    const other = results.groups.find((group) => group.workspaceId === "ws-b");
    expect(other?.rows).toHaveLength(4);
    expect(results.limited).toBe(false);
  });

  test("an empty query omits other stages; text includes them", () => {
    const input = fixture({
      stages: [stage("work"), stage("account")],
      workspaces: [
        workspace("ws-a", "build", leaf("v-temp")),
        workspace("ws-z", "elsewhere", leaf("v-yield"), { stageId: "account" }),
      ],
    });
    const index = buildLauncherIndex(input);
    expect(
      searchLauncherIndex(index, parseLauncherQuery(""), PLACE).groups.map((g) => g.workspaceId),
    ).toEqual(["ws-a"]);
    expect(
      searchLauncherIndex(index, parseLauncherQuery("yield"), PLACE).groups.map(
        (g) => g.workspaceId,
      ),
    ).toEqual(["ws-z"]);
  });
});

describe("the target workspace's scope decides what can be placed", () => {
  // Codex review, P1. §8.4 says a row that ends in a placement is scoped by
  // where it is GOING. The index only ever applied the row's own workspace
  // scope, so the launcher offered to create a `chart` in a workspace
  // restricted to `signin` — and the disabled message claimed the target's
  // scope while the check used the source's.
  const scoped = { ...PLACE, targetAppIds: ["chart"] };

  test("a new-view row the target forbids is hidden", () => {
    expect(search("", scoped).newApplications.map((row) => row.appId)).toEqual(["chart"]);
    expect(search("", PLACE).newApplications.map((row) => row.appId)).toContain("table");
  });

  test("a placed row the target forbids is offered disabled, not hidden", () => {
    const row = search("table", scoped)
      .groups.flatMap((group) => group.rows)
      .find((candidate) => candidate.appId === "table");
    expect(row).toBeDefined();
    expect(row?.unavailable).toContain("not offered");
  });

  test("an unplaced row the target forbids is disabled too", () => {
    const results = searchLauncherIndex(buildLauncherIndex(fixture()), parseLauncherQuery(""), {
      ...PLACE,
      targetAppIds: ["table"],
    });
    // v-scratch is a chart, and the target offers only tables.
    expect(results.unplaced.map((row) => row.unavailable)).toEqual([
      expect.stringContaining("not offered"),
    ]);
  });

  test("navigate mode ignores it: nothing is being placed", () => {
    const results = search("table", { ...NAVIGATE, targetAppIds: ["chart"] });
    const row = results.groups.flatMap((group) => group.rows).find((r) => r.appId === "table");
    expect(row?.unavailable).toBeUndefined();
  });

  test("blockedReason is the one field both the pointer and Enter read", () => {
    const row = search("table", scoped)
      .groups.flatMap((group) => group.rows)
      .find((candidate) => candidate.appId === "table");
    expect(blockedReason(row as LauncherRow)).toContain("not offered");
    const allowed = search("temp", scoped)
      .groups.flatMap((group) => group.rows)
      .find((candidate) => candidate.appId === "chart");
    expect(blockedReason(allowed as LauncherRow)).toBeNull();
  });
});

describe("stages the viewer cannot reach", () => {
  // Codex review, P1. Without this a signed-out visitor could select a result
  // in the authenticated `work` stage: setCurrentSpace takes them there and the
  // gate immediately bounces them back.
  const twoStages = () =>
    fixture({
      stages: [stage("work"), stage("private")],
      currentStageId: "work",
      workspaces: [
        workspace("ws-a", "build", leaf("v-temp")),
        workspace("ws-secret", "restricted", leaf("v-yield"), { stageId: "private" }),
      ],
    });

  test("an invisible stage is not indexed", () => {
    const index = buildLauncherIndex({ ...twoStages(), visibleStageIds: ["work"] });
    expect(index.otherStageGroups).toEqual([]);
  });

  test("a visible stage still is", () => {
    const index = buildLauncherIndex({ ...twoStages(), visibleStageIds: ["work", "private"] });
    expect(index.otherStageGroups.map((group) => group.workspaceId)).toEqual(["ws-secret"]);
  });

  test("the current stage is exempt: you are already standing in it", () => {
    const index = buildLauncherIndex({ ...twoStages(), visibleStageIds: [] });
    expect(index.currentStageGroups.map((group) => group.workspaceId)).toEqual(["ws-a"]);
  });
});

describe("new-view discoverability", () => {
  // The problem this solves, measured in the running app: with existing views
  // first, a Replace on a real workspace put 25 rows and a scroll between the
  // user and every new-view option.
  test("an empty query puts new views first", () => {
    const results = search("");
    expect(results.newViewsFirst).toBe(true);
    expect(results.rows[0]?.kind).toBe("new");
  });

  test("typing text puts the specific answers first again", () => {
    // A named view matching "chart" is a better answer than "the chart
    // application", so once there is text the existing rows lead.
    const results = search("chart");
    expect(results.newViewsFirst).toBe(false);
    expect(results.rows.at(-1)?.kind).toBe("new");
  });

  test("navigate mode reorders too, once it has somewhere to create", () => {
    // Reported as "I don't see any new view with cmd-K": navigate mode showed
    // 36 existing rows before the new-view section, which is the same burial.
    expect(search("", { ...NAVIGATE, allowNewViews: true }).newViewsFirst).toBe(true);
  });

  test("with nowhere to create, there is nothing to put first", () => {
    expect(search("", NAVIGATE).newViewsFirst).toBe(false);
  });

  test("rows follow the rendered order, so arrow keys agree with the eye", () => {
    const results = search("");
    const newCount = results.newApplications.length;
    expect(newCount).toBeGreaterThan(0);
    expect(results.rows.slice(0, newCount).every((row) => row.kind === "new")).toBe(true);
    expect(results.rows.slice(newCount).some((row) => row.kind === "new")).toBe(false);
  });
});

describe("invocation semantics", () => {
  test("navigate mode offers new applications, because it can split", () => {
    // It used to refuse unless the active tile was an empty launcher. That made
    // Mod+K a strictly worse launcher than the tile's own, and on a freshly
    // loaded page — nothing focused, so no active tile — it offered none at all.
    const results = search("chart", { ...NAVIGATE, allowNewViews: true });
    expect(results.newApplications.map((row) => row.appId)).toEqual(["chart"]);
  });

  test("new applications are still suppressed when there is nowhere to put one", () => {
    // The only remaining case: a workspace holding no tile at all.
    const results = search("chart", NAVIGATE);
    expect(results.newApplications).toEqual([]);
  });

  test("navigate mode hides unplaced views, which have nowhere to navigate", () => {
    // Codex review, P2: once navigate mode could create, `allowNewViews` went
    // true and started admitting unplaced rows — which `choose` does not handle
    // there, so selecting one silently did nothing and left the modal open.
    expect(search("scratch", { ...NAVIGATE, allowNewViews: true }).unplaced).toEqual([]);
    expect(search("scratch", NAVIGATE).unplaced).toEqual([]);
    expect(search("scratch", PLACE).unplaced.map((row) => row.viewId)).toEqual(["v-scratch"]);
  });

  test("wsN never offers new applications: a new view has no workspace yet", () => {
    expect(search("ws1").newApplications).toEqual([]);
  });

  test("place mode drops the view already in the target, in every workspace", () => {
    // v-temp is placed in both ws-a and ws-b. Replacing the tile that already
    // shows it is a no-op whichever row is clicked, so both rows go — the
    // exclusion is by view, not by row.
    const results = searchLauncherIndex(buildLauncherIndex(fixture()), parseLauncherQuery("temp"), {
      ...PLACE,
      excludeViewId: "v-temp",
    });
    expect(results.rows.map((row) => ("viewId" in row ? row.viewId : row.id))).not.toContain(
      "v-temp",
    );
  });

  test("navigate mode keeps it: another placement of it is a real destination", () => {
    const results = searchLauncherIndex(buildLauncherIndex(fixture()), parseLauncherQuery("temp"), {
      ...NAVIGATE,
      excludeViewId: "v-temp",
    });
    expect(results.groups.flatMap((group) => group.rows).map((row) => row.viewId)).toContain(
      "v-temp",
    );
  });

  test("an unplaced view is dropped from place mode when it is the target's own", () => {
    const results = searchLauncherIndex(
      buildLauncherIndex(fixture()),
      parseLauncherQuery("scratch"),
      { ...PLACE, excludeViewId: "v-scratch" },
    );
    expect(results.unplaced).toEqual([]);
  });
});

describe("preferred placement for navigation", () => {
  const row = {
    kind: "placed" as const,
    id: "placed:ws-a:v",
    viewId: "v",
    workspaceId: "ws-a",
    placementIds: ["n-1", "n-2"],
    totalPlacementCount: 2,
    title: "v",
    appId: "chart",
    appTitle: "chart",
    tone: "var(--pbui-tone-chart)",
    docName: null,
    inScope: true,
  };

  test("the active placement wins when it is one of the occurrences", () => {
    expect(preferredPlacement(row, "n-2")).toBe("n-2");
  });

  test("otherwise the first in tree order", () => {
    expect(preferredPlacement(row, "n-elsewhere")).toBe("n-1");
    expect(preferredPlacement(row, null)).toBe("n-1");
  });
});
