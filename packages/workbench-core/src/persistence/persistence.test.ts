import { afterEach, describe, expect, test, vi } from "vitest";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { defineAppManifest } from "../apps";
import { commands } from "../commands";
import { createWorkbenchCore } from "../createWorkbenchCore";
import { layout, singleTile, split, tile, workspaces } from "../document";
import { createLocalPersistence, readWorkbenchSnapshot, type StorageLike } from "./index";

const apps = [defineAppManifest({ id: "counter" }), defineAppManifest({ id: "notes", viewCardinality: "one" })];
const core = (initial: ReturnType<typeof layout>) => createWorkbenchCore({ initial, apps });

/** localStorage's three methods over a Map, plus a count of writes. */
function fakeStorage(): StorageLike & { writes: number; map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    writes: 0,
    getItem: (key) => map.get(key) ?? null,
    setItem(key, value) {
      this.writes += 1;
      map.set(key, value);
    },
    removeItem: (key) => void map.delete(key),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("local persistence (guide §15.1)", () => {
  test("a layout survives the round trip, workspace pointer and all", () => {
    const storage = fakeStorage();
    const c = core(workspaces([{ name: "one", spec: tile("counter") }, { name: "two", spec: split("row", 0.5, tile("counter"), tile("notes")) }]));
    const persistence = createLocalPersistence(c, { key: "k", storage, debounceMs: 0, onHide: () => () => undefined });
    const second = c.getState().document.workspaces[1]!.id;
    c.execute(commands.selectWorkspace(second));
    persistence.dispose();

    const restored = readWorkbenchSnapshot("k", { storage, apps: c.apps })!;
    expect(restored).not.toBeNull();
    expect(restored.workspaceId).toBe(second);
    const next = createWorkbenchCore({ initial: restored.document, apps, initialSession: { workspaceId: restored.workspaceId } });
    expect(next.getState().session.workspaceId).toBe(second);
    expect(leaves(next.getState().document.workspaces[1]?.tree)).toHaveLength(2);
  });

  test("a command, a replacement and a workspace switch all write; an activation does not", () => {
    const storage = fakeStorage();
    const c = core(layout(split("row", 0.5, tile("counter"), tile("notes"))));
    createLocalPersistence(c, { key: "k", storage, debounceMs: 0, onHide: () => () => undefined });
    expect(storage.writes).toBe(1); // the attach write
    const [first] = leaves(c.getState().document.workspaces[0]?.tree).map((leaf) => leaf.id);
    c.execute(commands.duplicate(first!, "row"));
    expect(storage.writes).toBe(2);
    // `onCommit` never sees either of these two, which is why this subscribes to the state.
    c.reset();
    expect(storage.writes).toBe(3);
    expect(c.execute(commands.createWorkspace("two")).ok).toBe(true);
    const writesAfterCreate = storage.writes;
    c.execute(commands.activate(leaves(c.getState().document.workspaces[0]?.tree)[0]!.id));
    expect(storage.writes).toBe(writesAfterCreate);
  });

  test("a burst of changes costs ONE write, and dispose never drops a pending one", () => {
    vi.useFakeTimers();
    const storage = fakeStorage();
    const c = core(singleTile("counter"));
    const persistence = createLocalPersistence(c, { key: "k", storage, debounceMs: 250, onHide: () => () => undefined });
    expect(storage.writes).toBe(1);
    const ids = () => leaves(c.getState().document.workspaces[0]?.tree).map((leaf) => leaf.id);
    for (let i = 0; i < 5; i += 1) c.execute(commands.duplicate(ids()[0]!, "row"));
    expect(storage.writes).toBe(1);
    vi.advanceTimersByTime(250);
    expect(storage.writes).toBe(2);
    c.execute(commands.duplicate(ids()[0]!, "col"));
    persistence.dispose();
    expect(storage.writes).toBe(3);
    expect(readWorkbenchSnapshot("k", { storage })!.document.workspaces[0]!.tree).toEqual(c.getState().document.workspaces[0]!.tree);
  });

  test("an unusable entry reads as null, with the reason available", () => {
    const storage = fakeStorage();
    const reasons: string[] = [];
    const onDiscard = (reason: string) => reasons.push(reason);
    expect(readWorkbenchSnapshot("missing", { storage, onDiscard })).toBeNull();
    storage.setItem("k", "{not json");
    expect(readWorkbenchSnapshot("k", { storage, onDiscard })).toBeNull();
    storage.setItem("k", JSON.stringify({ version: 1, document: { format: "something.else" } }));
    expect(readWorkbenchSnapshot("k", { storage, onDiscard })).toBeNull();
    const c = core(singleTile("counter"));
    const broken = JSON.parse(c.serialize());
    broken.views = {};
    storage.setItem("k", JSON.stringify({ version: 1, document: broken }));
    expect(readWorkbenchSnapshot("k", { storage, onDiscard })).toBeNull();
    // With a catalog, a layout naming a retired application is discarded too (Phase 2's construction check would otherwise throw).
    const retired = JSON.parse(c.serialize());
    retired.views[Object.keys(retired.views)[0]!].appId = "retired";
    storage.setItem("k", JSON.stringify({ version: 1, document: retired }));
    expect(readWorkbenchSnapshot("k", { storage })).not.toBeNull();
    expect(readWorkbenchSnapshot("k", { storage, apps: c.apps, onDiscard })).toBeNull();
    expect(reasons.map((r) => r.split(":")[0])).toEqual(["the stored entry is not JSON", "unsupported_format at format", "unknown_view at workspaces[0].tree.leaf.viewId", "unknown_application at views[\"" + Object.keys(retired.views)[0] + "\"].appId"]);
  });

  test("an older envelope is discarded unless a migrate brings it forward; a bare document arrives as version 0", () => {
    const storage = fakeStorage();
    const c = core(singleTile("counter"));
    storage.setItem("k", JSON.stringify({ version: 1, layout: JSON.parse(c.serialize()) }));
    expect(readWorkbenchSnapshot("k", { storage, version: 2 })).toBeNull();
    const migrated = readWorkbenchSnapshot("k", { storage, version: 2, migrate: (payload, from) => ({ version: 2, document: (payload as { layout: unknown }).layout, from }) });
    expect(migrated?.document.workspaces).toHaveLength(1);
    expect(readWorkbenchSnapshot("k", { storage, version: 2, migrate: () => null })).toBeNull();
    storage.setItem("k", c.serialize());
    expect(readWorkbenchSnapshot("k", { storage })).toBeNull();
    const versions: number[] = [];
    const bare = readWorkbenchSnapshot("k", { storage, migrate: (payload, from) => (versions.push(from), { version: 1, document: payload }) });
    expect(versions).toEqual([0]);
    expect(bare?.document.workspaces).toHaveLength(1);
  });

  test("a storage that throws is reported, never rethrown into the gesture", () => {
    const errors: unknown[] = [];
    const storage: StorageLike = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); }, removeItem: () => {} };
    const c = core(singleTile("counter"));
    createLocalPersistence(c, { key: "k", storage, debounceMs: 0, onError: (error) => errors.push(error), onHide: () => () => undefined });
    expect(errors).toHaveLength(1);
    expect(c.execute(commands.duplicate(leaves(c.getState().document.workspaces[0]?.tree)[0]!.id, "row")).ok).toBe(true);
    expect(errors).toHaveLength(2);
  });
});
