import { describe, expect, it } from "vitest";
import {
  createAppRegistry,
  createWorkbench,
  defineApp,
  layout,
  performWorkbenchVerb,
  split,
  tile,
  type WorkbenchVerb,
} from "@hyperslop-systems/pbui-workbench";
import type { FrontendTool } from "@go-go-golems/chat-provider";
import { createWorkbenchTools, type WorkbenchToolsOptions } from "./workbenchTools";
import type { Outcome, VerbLike } from "../types";

const Blank = () => null;

const apps = createAppRegistry([
  defineApp({ id: "chat", title: "chat", tone: "var(--pbui-pane-alt)", singleton: false, Component: Blank }),
  defineApp({ id: "trace", title: "trace", tone: "var(--pbui-pane-alt)", singleton: true, Component: Blank }),
  defineApp({
    id: "sku",
    title: "SKU",
    tone: "var(--pbui-pane-alt)",
    singleton: false,
    docBound: true,
    bindings: ["product"],
    Component: Blank,
  }),
]);

/**
 * A workbench plus the router seam the tools go through. `performed` records
 * exactly what reached the router, which is what the trace would have stored.
 */
function harness(overrides: Partial<WorkbenchToolsOptions> = {}) {
  const wb = createWorkbench({ apps, initial: layout(split("row", 0.6, tile("chat"), tile("trace"))) });
  const performed: VerbLike[] = [];
  const tools = createWorkbenchTools({
    getWorkbench: () => wb,
    perform: async (verb) => {
      performed.push(verb);
      performWorkbenchVerb(wb.verbs, verb as unknown as WorkbenchVerb);
      return "performed" as Outcome;
    },
    ...overrides,
  });
  const byName = (name: string) => tools.tools.find((tool) => tool.name === name) as FrontendTool<any, any>;
  const call = (name: string, input: unknown) =>
    Promise.resolve(byName(name).execute(input as never, { signal: new AbortController().signal, toolCallId: "t1" }));
  return { wb, tools, performed, byName, call };
}

describe("createWorkbenchTools · surface", () => {
  it("registers six provider-safe tools, with the raw one unavailable by default", () => {
    const { tools, byName } = harness();
    expect(tools.tools.map((t) => t.name)).toEqual([
      "workbench_describe",
      "workbench_create_workspace",
      "workbench_open_tile",
      "workbench_switch_workspace",
      "workbench_perform",
      "workbench_apply",
    ]);
    for (const tool of tools.tools) expect(tool.name).toMatch(/^[a-zA-Z0-9_-]+$/);
    // `RegisterManifestTools` skips an unavailable descriptor, so the model is
    // never even told workbench_apply exists.
    expect((byName("workbench_apply").available as () => boolean)()).toBe(false);
    expect((byName("workbench_describe").available as () => boolean)()).toBe(true);
  });

  it("is unavailable, not broken, with no workbench attached", async () => {
    const tools = createWorkbenchTools({ getWorkbench: () => null, perform: async () => "performed" as Outcome });
    const describe_ = tools.tools[0] as FrontendTool<any, any>;
    expect((describe_.available as () => boolean)()).toBe(false);
    const result = await describe_.execute({} as never, { signal: new AbortController().signal, toolCallId: "t" });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("no workbench") });
  });

  it("advertises a flat layout schema, with no $ref for a provider to choke on", () => {
    const { byName } = harness();
    const schema = JSON.stringify(byName("workbench_create_workspace").parameters);
    expect(schema).not.toContain("$ref");
  });
});

describe("workbench_describe", () => {
  it("names the tiles and the tree", async () => {
    const { call } = harness();
    const result = (await call("workbench_describe", {})) as any;
    expect(result.ok).toBe(true);
    expect(result.apps.map((a: any) => a.id)).toEqual(["chat", "trace", "sku"]);
    expect(result.workspaces[0].tiles.map((t: any) => t.appId)).toEqual(["chat", "trace"]);
    expect(result.workspaces[0].tree).toMatchObject({ kind: "split", direction: "row", ratio: 0.6 });
  });

  it("reports an unknown workspace rather than describing none silently", async () => {
    const { call } = harness();
    expect(await call("workbench_describe", { workspaceId: "ws-nope" })).toMatchObject({
      ok: false,
      error: 'unknown workspace "ws-nope"',
    });
  });
});

describe("workbench_create_workspace · validation", () => {
  const good = { kind: "tile" as const, appId: "chat" };

  it("refuses an unknown app and lists the real ones", async () => {
    const { call, performed } = harness();
    expect(await call("workbench_create_workspace", { name: "x", layout: { kind: "tile", appId: "invnetory" } })).toMatchObject({
      ok: false,
      error: 'unknown app "invnetory"; available: chat, trace, sku',
    });
    // Nothing reached the router: a refused layout is refused before it can
    // half-apply.
    expect(performed).toHaveLength(0);
  });

  it("refuses a ratio outside the usable range", async () => {
    const { call } = harness();
    const result = (await call("workbench_create_workspace", {
      name: "x",
      layout: { kind: "split", direction: "row", ratio: 0.05, a: good, b: good },
    })) as any;
    expect(result.error).toBe("ratio 0.05 is outside [0.1, 0.9]");
  });

  it("refuses a doc-bound app with nothing bound", async () => {
    const { call } = harness();
    const result = (await call("workbench_create_workspace", { name: "x", layout: { kind: "tile", appId: "sku" } })) as any;
    expect(result.error).toBe('app "sku" needs a "product" binding; got {}');
  });

  it("accepts a doc-bound app that is bound", async () => {
    const { call } = harness();
    const result = (await call("workbench_create_workspace", {
      name: "x",
      layout: { kind: "tile", appId: "sku", documents: { product: "2049" } },
    })) as any;
    expect(result.ok).toBe(true);
  });

  it("refuses more tiles than the limit", async () => {
    const { call } = harness({ limits: { tilesPerWorkspace: 2 } });
    const result = (await call("workbench_create_workspace", {
      name: "x",
      layout: { kind: "split", direction: "row", ratio: 0.5, a: good, b: { kind: "split", direction: "col", ratio: 0.5, a: good, b: good } },
    })) as any;
    expect(result.error).toBe("layout has 3 tiles, the limit is 2");
  });

  it("refuses past the workspace limit", async () => {
    const { call } = harness({ limits: { workspaces: 1 } });
    const result = (await call("workbench_create_workspace", { name: "x", layout: good })) as any;
    expect(result.error).toContain("the limit");
  });
});

describe("workbench_create_workspace · success", () => {
  it("performs a workspace.create through the router and reports the new id and tiles", async () => {
    const { call, performed, wb } = harness();
    const result = (await call("workbench_create_workspace", {
      name: "Gold desk",
      layout: { kind: "split", direction: "row", ratio: 0.55, a: { kind: "tile", appId: "chat" }, b: { kind: "tile", appId: "trace" } },
    })) as any;

    // The verb went through the ROUTER, not straight to wb.verbs — that is
    // the indirection that puts it in the trace.
    expect(performed).toHaveLength(1);
    expect(performed[0]).toMatchObject({ kind: "workspace.create", name: "Gold desk" });

    expect(result.ok).toBe(true);
    expect(result.workspaceId).toBeTruthy();
    expect(result.active).toBe(true);
    expect(result.tiles.map((t: any) => t.appId)).toEqual(["chat", "trace"]);
    expect(result.undoToken).toMatch(/^undo-\d+$/);
    expect(wb.store.getState().document.workspaces).toHaveLength(2);
  });
});

describe("workbench_open_tile", () => {
  it("opens a bound tile and reports its placement", async () => {
    const { call } = harness();
    const result = (await call("workbench_open_tile", { appId: "sku", documents: { product: "2049" } })) as any;
    expect(result.ok).toBe(true);
    expect(result.placementId).toBeTruthy();
    expect(result.wentToExisting).toBe(false);
  });

  it("reports wentToExisting rather than opening a second identical tile", async () => {
    const { call, wb } = harness();
    await call("workbench_open_tile", { appId: "sku", documents: { product: "2049" } });
    const before = wb.store.getState().document;
    const second = (await call("workbench_open_tile", { appId: "sku", documents: { product: "2049" } })) as any;
    expect(second.wentToExisting).toBe(true);
    expect(wb.store.getState().document).toBe(before);
  });

  it("validates the app the same way create does", async () => {
    const { call } = harness();
    expect(await call("workbench_open_tile", { appId: "sku" })).toMatchObject({
      error: 'app "sku" needs a "product" binding; got {}',
    });
  });
});

describe("workbench_perform · policy", () => {
  it("applies an allowed verb and returns the new tiles", async () => {
    const { call, wb, performed } = harness();
    const placement = wb.store.getState().document.workspaces[0]!.tree!.body.case === "split" ? null : null;
    void placement;
    const tiles = (await call("workbench_describe", {})) as any;
    const first = tiles.workspaces[0].tiles[0].placementId;
    const result = (await call("workbench_perform", { verbs: [{ kind: "tile.split", placementId: first, direction: "col" }] })) as any;
    expect(result.applied).toBe(1);
    expect(result.results[0].ok).toBe(true);
    expect(performed).toHaveLength(1);
    expect(result.tiles).toHaveLength(3);
  });

  it("refuses a confirm-policy verb with no confirmation, and says how to get one", async () => {
    const { call, performed } = harness();
    const tiles = (await call("workbench_describe", {})) as any;
    const first = tiles.workspaces[0].tiles[0].placementId;
    const result = (await call("workbench_perform", { verbs: [{ kind: "tile.close", placementId: first }] })) as any;
    expect(result.applied).toBe(0);
    expect(result.results[0].error).toContain("call pbui_propose first");
    expect(performed).toHaveLength(0);
  });

  it("refuses a confirmation the product has not approved", async () => {
    const { call } = harness({ isApproved: () => false });
    const tiles = (await call("workbench_describe", {})) as any;
    const first = tiles.workspaces[0].tiles[0].placementId;
    const result = (await call("workbench_perform", { verbs: [{ kind: "tile.close", placementId: first }], confirmationId: "p-1" })) as any;
    expect(result.results[0].error).toBe('no approved proposal with id "p-1"');
  });

  it("applies a confirm-policy verb once the product says it was approved", async () => {
    const { call, performed } = harness({ isApproved: (id) => id === "p-1" });
    const tiles = (await call("workbench_describe", {})) as any;
    const first = tiles.workspaces[0].tiles[0].placementId;
    const result = (await call("workbench_perform", { verbs: [{ kind: "tile.close", placementId: first }], confirmationId: "p-1" })) as any;
    expect(result.applied).toBe(1);
    expect(performed).toHaveLength(1);
  });

  it("denies the launcher outright — it is the human's dialog", async () => {
    const { call } = harness();
    const result = (await call("workbench_perform", { verbs: [{ kind: "launcher.open" }] })) as any;
    expect(result.results[0].error).toContain("not something the assistant may do");
  });

  it("rejects a non-verb without taking the batch down", async () => {
    const { call } = harness();
    const tiles = (await call("workbench_describe", {})) as any;
    const first = tiles.workspaces[0].tiles[0].placementId;
    const result = (await call("workbench_perform", {
      verbs: [{ kind: "nonsense" }, { kind: "tile.activate", placementId: first }],
    })) as any;
    expect(result.results[0].ok).toBe(false);
    expect(result.results[1].ok).toBe(true);
    expect(result.applied).toBe(1);
  });

  it("refuses more verbs than the limit", async () => {
    const { call } = harness({ limits: { verbsPerCall: 1 } });
    const result = (await call("workbench_perform", {
      verbs: [{ kind: "tile.activate", placementId: "a" }, { kind: "tile.activate", placementId: "b" }],
    })) as any;
    expect(result.error).toBe("2 verbs in one call, the limit is 1");
  });
});

describe("workbench_switch_workspace", () => {
  it("switches and reports the tiles it landed on", async () => {
    const { call, wb } = harness();
    const created = (await call("workbench_create_workspace", { name: "second", layout: { kind: "tile", appId: "chat" } })) as any;
    const first = wb.store.getState().document.workspaces[0]!.id;
    const result = (await call("workbench_switch_workspace", { workspaceId: first })) as any;
    expect(result.activeWorkspaceId).toBe(first);
    expect(result.tiles).toHaveLength(2);
    expect(created.workspaceId).not.toBe(first);
  });

  it("refuses an unknown workspace", async () => {
    const { call } = harness();
    expect(await call("workbench_switch_workspace", { workspaceId: "nope" })).toMatchObject({ ok: false });
  });
});

describe("undo", () => {
  it("restores the document a change was made from", async () => {
    const { call, tools, wb } = harness();
    const before = wb.store.getState().document;
    const result = (await call("workbench_create_workspace", { name: "x", layout: { kind: "tile", appId: "chat" } })) as any;
    expect(wb.store.getState().document).not.toBe(before);
    expect(tools.undo(result.undoToken)).toBe(true);
    expect(wb.store.getState().document).toBe(before);
  });

  it("drops everything after the restored point, so a second undo cannot jump forward", async () => {
    const { call, tools } = harness();
    const one = (await call("workbench_create_workspace", { name: "one", layout: { kind: "tile", appId: "chat" } })) as any;
    await call("workbench_create_workspace", { name: "two", layout: { kind: "tile", appId: "chat" } });
    expect(tools.history()).toHaveLength(2);
    tools.undo(one.undoToken);
    expect(tools.history()).toHaveLength(0);
  });

  it("is false for a token that aged out", () => {
    const { tools } = harness();
    expect(tools.undo("undo-99")).toBe(false);
  });
});
