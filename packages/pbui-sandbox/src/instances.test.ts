import { describe, expect, test } from "vitest";
import { createInstanceRegistry, formatEntry, type TimelineEntry } from "./instances";

const base = { viewId: "v-1", programId: "prg-1", version: 1, instanceId: "v-1:prg-1:v1#1" };

describe("createInstanceRegistry", () => {
  test("mount creates a snapshot, publish merges, the last unmount drops it", () => {
    const registry = createInstanceRegistry();
    let notified = 0;
    registry.subscribe(() => notified++);
    registry.mount("v-1", "n-1");
    registry.mount("v-1", "n-2");
    expect(registry.get("v-1")).toMatchObject({ status: "idle", placementIds: ["n-1", "n-2"], handle: null });
    registry.publish("v-1", { status: "loading", programId: "prg-1", version: 1 });
    expect(registry.get("v-1")).toMatchObject({ status: "loading", programId: "prg-1", placementIds: ["n-1", "n-2"] });
    registry.unmount("v-1", "n-1");
    expect(registry.get("v-1")?.placementIds).toEqual(["n-2"]);
    registry.unmount("v-1", "n-2");
    expect(registry.get("v-1")).toBeNull();
    expect(notified).toBe(5);
  });

  test("a patch that changes nothing does not notify, and all() is stable until something does", () => {
    const registry = createInstanceRegistry();
    registry.mount("v-1", "n-1");
    const trees = {};
    registry.publish("v-1", { trees });
    const all = registry.all();
    let notified = 0;
    registry.subscribe(() => notified++);
    registry.publish("v-1", { trees, status: "idle" });
    expect(notified).toBe(0);
    expect(registry.all()).toBe(all);
    registry.publish("v-1", { trees: {} });
    expect(notified).toBe(1);
    expect(registry.all()).not.toBe(all);
  });

  test("the timeline is a ring with monotonic seq, and clearing empties it", () => {
    const registry = createInstanceRegistry({ keep: 3, now: () => "t" });
    for (let i = 0; i < 5; i++) registry.record({ ...base, kind: "note", text: `n${i}` });
    const entries = registry.timeline();
    expect(entries.map((e) => e.seq)).toEqual([3, 4, 5]);
    expect(entries.map((e) => (e as { text: string }).text)).toEqual(["n2", "n3", "n4"]);
    expect(entries[0]?.at).toBe("t");
    const same = registry.timeline();
    expect(same).toBe(entries);
    registry.clearTimeline();
    expect(registry.timeline()).toEqual([]);
    registry.record({ ...base, kind: "note", text: "after" });
    expect(registry.timeline()[0]?.seq).toBe(6);
  });

  test("selection notifies, and unmounting the selected view clears it", () => {
    const registry = createInstanceRegistry();
    let notified = 0;
    registry.subscribe(() => notified++);
    registry.mount("v-1", "n-1");
    registry.select("v-1");
    expect(registry.selectedViewId()).toBe("v-1");
    registry.select("v-1");
    expect(notified).toBe(2);
    registry.unmount("v-1", "n-1");
    expect(registry.selectedViewId()).toBeNull();
  });
});

describe("formatEntry", () => {
  const at = { seq: 1, at: "t", ...base };
  const cases: [TimelineEntry, string][] = [
    [{ ...at, kind: "load", durationMs: 6.04 }, "loaded in 6.0 ms"],
    [{ ...at, kind: "render", widgetId: "main", durationMs: 3.5, nodeCount: 14 }, "render main · 14 nodes · 3.5 ms"],
    [{ ...at, kind: "event", widgetId: "main", handler: "setDays", args: { value: "45" }, durationMs: 1.2, intents: [] }, 'event setDays {"value":"45"} · 1.2 ms → 0 intents'],
    [{ ...at, kind: "intent", intent: { scope: "plugin", actionType: "state/merge", payload: { days: 45 } }, outcome: "applied" }, 'state/merge {"days":45} · applied'],
    [{ ...at, kind: "intent", intent: { scope: "verb", verb: { kind: "reorder" } }, outcome: "rejected", detail: "rejected:unknown verb" }, "verb reorder → rejected: rejected:unknown verb"],
    [{ ...at, kind: "error", phase: "render", code: "RUNTIME_TIMEOUT", message: "interrupted" }, "render · RUNTIME_TIMEOUT · interrupted"],
    [{ ...at, kind: "evaluate", code: "1 + 1", durationMs: 0.2, ok: true, summary: "2" }, "1 + 1 → 2 · 0.2 ms"],
    [{ ...at, kind: "note", text: "hello" }, "hello"],
  ];
  test.each(cases)("%#", (entry, expected) => {
    expect(formatEntry(entry)).toBe(expected);
  });
});
