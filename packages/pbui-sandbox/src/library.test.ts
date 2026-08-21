import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createProgramLibrary, memoryStorage, type LibraryStorage } from "./library";

const META = { widgets: ["main"] };
const program = (title: string, source = "definePlugin(() => ({}))") => ({ title, source, bindings: [], meta: META, by: "agent" as const });

describe("createProgramLibrary", () => {
  let storage: LibraryStorage;
  beforeEach(() => {
    vi.useFakeTimers();
    storage = memoryStorage();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("mints short stable ids, bumps the version on update, and keeps createdAt", () => {
    const now = vi.fn(() => "2026-08-21T12:00:00.000Z");
    const library = createProgramLibrary({ key: "k", storage, now });
    const first = library.putProgram(program("Counter"));
    expect(first).toMatchObject({ id: "prg-1", version: 1, pinned: false, createdAt: "2026-08-21T12:00:00.000Z" });
    now.mockReturnValue("2026-08-21T12:05:00.000Z");
    const second = library.putProgram({ ...program("Counter 2", "definePlugin(() => ({ v: 2 }))"), id: "prg-1" });
    expect(second).toMatchObject({ id: "prg-1", version: 2, title: "Counter 2", createdAt: "2026-08-21T12:00:00.000Z", updatedAt: "2026-08-21T12:05:00.000Z" });
    expect(library.putProgram(program("Other")).id).toBe("prg-2");
    expect(() => library.putProgram({ ...program("x"), id: "prg-9" })).toThrow("no program prg-9");
  });

  test("persists after the debounce and restores from storage", () => {
    const library = createProgramLibrary({ key: "k", storage, debounceMs: 300 });
    library.putProgram(program("Counter"));
    expect(storage.getItem("k")).toBeNull();
    vi.advanceTimersByTime(300);
    expect(storage.getItem("k")).toContain('"prg-1"');

    const again = createProgramLibrary({ key: "k", storage });
    expect(Object.keys(again.getState().programs)).toEqual(["prg-1"]);
    expect(again.getState().nextId).toBe(2);
  });

  test("flush writes immediately", () => {
    const library = createProgramLibrary({ key: "k", storage });
    library.putProgram(program("Counter"));
    library.flush();
    expect(storage.getItem("k")).toContain("Counter");
  });

  test("keeps a corrupt entry under a sibling key and starts empty, reporting it", () => {
    storage.setItem("k", "{not json");
    const onRejected = vi.fn();
    const library = createProgramLibrary({ key: "k", storage, onRejected });
    expect(library.getState().programs).toEqual({});
    expect(onRejected).toHaveBeenCalledWith("restore", expect.any(Error));
    expect(storage.getItem("k")).toBe("{not json");
    const keys = ["k.corrupt-"].map((prefix) => prefix);
    expect(keys.length).toBe(1);
  });

  test("enforces the source, count and library byte limits without writing", () => {
    const library = createProgramLibrary({ key: "k", storage, limits: { sourceBytes: 30, programs: 1, libraryBytes: 100_000 } });
    expect(() => library.putProgram(program("big", "x".repeat(31)))).toThrow("source is 31 bytes, the limit is 30");
    library.putProgram(program("one"));
    expect(() => library.putProgram(program("two"))).toThrow("already holds 1 programs");
    const tight = createProgramLibrary({ key: "t", storage, limits: { libraryBytes: 120 } });
    expect(() => tight.putProgram(program("one"))).toThrow(/the library would be \d+ bytes, the limit is 120/);
    expect(tight.getState().programs).toEqual({});
  });

  test("actions: put, update, pin, remove; types required", () => {
    const library = createProgramLibrary({ key: "k", storage });
    const action = library.putAction({ label: "Days of cover", types: ["product"], behaviour: { kind: "openProgram", programId: "prg-1" }, by: "agent" });
    expect(action).toMatchObject({ id: "act-1", pinned: false });
    expect(library.setPinned("action", "act-1", true)).toBe(true);
    expect(library.getState().actions["act-1"]?.pinned).toBe(true);
    expect(() => library.putAction({ label: "x", types: [], behaviour: { kind: "askAgent", template: "{0}" }, by: "agent" })).toThrow("at least one presentation type");
    expect(library.removeAction("act-1")).toBe(true);
    expect(library.removeAction("act-1")).toBe(false);
  });

  test("recordError marks the program without bumping its version", () => {
    const library = createProgramLibrary({ key: "k", storage });
    const record = library.putProgram(program("Counter"));
    library.recordError(record.id, { phase: "render", message: "boom", at: "now" });
    expect(library.getState().programs[record.id]).toMatchObject({ version: 1, lastError: { message: "boom" } });
    library.recordError(record.id, undefined);
    expect(library.getState().programs[record.id]?.lastError).toBeUndefined();
  });

  test("import merges and replaces; seeded is sticky", () => {
    const library = createProgramLibrary({ key: "k", storage });
    library.putProgram(program("mine"));
    const snapshot = { ...library.export(), programs: { "prg-7": { ...library.getState().programs["prg-1"]!, id: "prg-7", title: "seed" } }, nextId: 8, seeded: true };
    library.import(snapshot, "merge");
    expect(Object.keys(library.getState().programs).sort()).toEqual(["prg-1", "prg-7"]);
    expect(library.getState().nextId).toBe(8);
    expect(library.getState().seeded).toBe(true);
    library.import({ ...snapshot, programs: {} }, "replace");
    expect(library.getState().programs).toEqual({});
  });

  test("notifies subscribers once per change", () => {
    const library = createProgramLibrary({ key: "k", storage });
    const listener = vi.fn();
    const unsubscribe = library.subscribe(listener);
    library.putProgram(program("a"));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    library.putProgram(program("b"));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
