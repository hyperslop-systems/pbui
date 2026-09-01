import { afterEach, describe, expect, test, vi } from "vitest";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { createWorkbench } from "./createWorkbench";
import { layout, singleTile, split, tile, workspaces } from "./document";
import { createLocalPersistence, readWorkbenchSnapshot, type StorageLike } from "./persistence";
import { demoApps } from "./stories/demoApps";

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

describe("local persistence (5.F)", () => {
  test("a layout survives the round trip, workspace pointer and all", () => {
    const storage = fakeStorage();
    const wb = createWorkbench({
      apps: demoApps,
      initial: workspaces([
        { name: "one", spec: tile("counter") },
        { name: "two", spec: split("row", 0.5, tile("counter"), tile("notes")) },
      ]),
    });
    const persistence = createLocalPersistence(wb, { key: "k", storage, debounceMs: 0 });
    const second = wb.store.getState().document.workspaces[1]!.id;
    wb.verbs.selectWorkspace(second);
    persistence.dispose();

    const restored = readWorkbenchSnapshot("k", { storage })!;
    expect(restored).not.toBeNull();
    expect(restored.workspaceId).toBe(second);
    // Constructed from the snapshot, the product is where it left off — no
    // default layout rendered first, which is the point of reading before
    // constructing rather than restoring after.
    const next = createWorkbench({ apps: demoApps, initial: restored.document });
    next.verbs.selectWorkspace(restored.workspaceId!);
    expect(next.store.getState().workspaceId).toBe(second);
    expect(leaves(next.store.getState().document.workspaces[1]?.tree)).toHaveLength(2);
  });

  test("a mutation, a replaceDocument and a workspace switch all write; an activation does not", () => {
    const storage = fakeStorage();
    const wb = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) });
    createLocalPersistence(wb, { key: "k", storage, debounceMs: 0 });
    expect(storage.writes).toBe(1); // the attach write

    const [first] = leaves(wb.store.getState().document.workspaces[0]?.tree).map((leaf) => leaf.id);
    wb.verbs.split(first!, "row");
    expect(storage.writes).toBe(2);

    // `onMutate` never sees either of these two, which is why this subscribes
    // to the store instead.
    wb.reset();
    expect(storage.writes).toBe(3);
    const created = wb.verbs.createWorkspace("two");
    expect(created).not.toBeNull();
    const writesAfterCreate = storage.writes;

    wb.verbs.activate(leaves(wb.store.getState().document.workspaces[0]?.tree)[0]!.id);
    wb.verbs.openLauncher();
    wb.verbs.closeLauncher();
    expect(storage.writes).toBe(writesAfterCreate);
  });

  test("a burst of changes costs ONE write, and dispose never drops a pending one", () => {
    vi.useFakeTimers();
    const storage = fakeStorage();
    const wb = createWorkbench({ apps: demoApps, initial: singleTile("counter") });
    const persistence = createLocalPersistence(wb, { key: "k", storage, debounceMs: 250 });
    expect(storage.writes).toBe(1);

    const ids = () => leaves(wb.store.getState().document.workspaces[0]?.tree).map((leaf) => leaf.id);
    for (let i = 0; i < 5; i += 1) wb.verbs.split(ids()[0]!, "row");
    // Still one: the window is trailing and is NOT pushed out by each change,
    // so a drag cannot defer its own write until the pointer stops.
    expect(storage.writes).toBe(1);
    vi.advanceTimersByTime(250);
    expect(storage.writes).toBe(2);

    wb.verbs.split(ids()[0]!, "col");
    persistence.dispose();
    expect(storage.writes).toBe(3);
    expect(readWorkbenchSnapshot("k", { storage })!.document.workspaces[0]!.tree).toEqual(
      wb.store.getState().document.workspaces[0]!.tree,
    );
  });

  test("an unusable entry reads as null rather than taking the product down", () => {
    const storage = fakeStorage();
    expect(readWorkbenchSnapshot("missing", { storage })).toBeNull();
    storage.setItem("k", "{not json");
    expect(readWorkbenchSnapshot("k", { storage })).toBeNull();
    storage.setItem("k", JSON.stringify({ version: 1, document: { format: "something.else" } }));
    expect(readWorkbenchSnapshot("k", { storage })).toBeNull();
    // A document whose tree names a view that is not there: the strict read
    // refuses it instead of rendering a workspace of empty states.
    const wb = createWorkbench({ apps: demoApps, initial: singleTile("counter") });
    const broken = JSON.parse(wb.serialize());
    broken.views = {};
    storage.setItem("k", JSON.stringify({ version: 1, document: broken }));
    expect(readWorkbenchSnapshot("k", { storage })).toBeNull();
  });

  test("an older envelope is discarded unless a migrate brings it forward", () => {
    const storage = fakeStorage();
    const wb = createWorkbench({ apps: demoApps, initial: singleTile("counter") });
    // Version 1 on disk, version 2 expected.
    storage.setItem("k", JSON.stringify({ version: 1, layout: JSON.parse(wb.serialize()) }));
    expect(readWorkbenchSnapshot("k", { storage, version: 2 })).toBeNull();
    const migrated = readWorkbenchSnapshot("k", {
      storage,
      version: 2,
      migrate: (payload, from) => {
        expect(from).toBe(1);
        return { version: 2, document: (payload as { layout: unknown }).layout };
      },
    });
    expect(migrated?.document.workspaces).toHaveLength(1);
    // A migrate that gives up discards the entry rather than guessing.
    expect(readWorkbenchSnapshot("k", { storage, version: 2, migrate: () => null })).toBeNull();
  });

  test("a bare pre-envelope document arrives at migrate as version 0", () => {
    const storage = fakeStorage();
    const wb = createWorkbench({ apps: demoApps, initial: singleTile("counter") });
    // What every product that hand-wrote this loop stored: the serialised
    // document under the key, with no envelope around it.
    storage.setItem("k", wb.serialize());
    // No migrate: discarded, and the product falls back to its default.
    expect(readWorkbenchSnapshot("k", { storage })).toBeNull();
    const versions: number[] = [];
    const migrated = readWorkbenchSnapshot("k", {
      storage,
      migrate: (payload, from) => {
        versions.push(from);
        return { version: 1, document: payload };
      },
    });
    expect(versions).toEqual([0]);
    expect(migrated?.document.workspaces).toHaveLength(1);
  });

  test("a storage that throws is reported, never rethrown into the gesture", () => {
    const errors: unknown[] = [];
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    const wb = createWorkbench({ apps: demoApps, initial: singleTile("counter") });
    createLocalPersistence(wb, { key: "k", storage, debounceMs: 0, onError: (error) => errors.push(error) });
    expect(errors).toHaveLength(1);
    // The layout still works; only saving it failed.
    expect(wb.verbs.split(leaves(wb.store.getState().document.workspaces[0]?.tree)[0]!.id, "row")).not.toBeNull();
    expect(errors).toHaveLength(2);
  });
});
