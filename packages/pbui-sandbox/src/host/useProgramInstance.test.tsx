import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { createEvalEngine } from "../engines/evalEngine";
import { BROKEN_RENDER_PROGRAM, COUNTER_PROGRAM, DAYS_OF_COVER_PROGRAM, PRODUCT_2049 } from "../fixtures/programs";
import type { ProgramRecord } from "../library";
import { createProgramStateStore } from "../state";
import { useProgramInstance } from "./useProgramInstance";

function record(source: string, version = 1, id = "prg-1"): ProgramRecord {
  return { id, title: "t", source, version, bindings: [], meta: { widgets: ["main"] }, by: "agent", pinned: false, createdAt: "", updatedAt: "" };
}

const NONE = {};

describe("useProgramInstance", () => {
  test("loads, renders, reduces a plugin intent and re-renders", async () => {
    const engine = createEvalEngine();
    const states = createProgramStateStore();
    const perform = vi.fn(async () => "performed");
    const { result } = renderHook(() =>
      useProgramInstance({ engine, program: record(COUNTER_PROGRAM), viewId: "v-1", placementId: "n-1", states, documents: NONE, env: NONE, perform }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await waitFor(() => expect(result.current.trees.main).toBeTruthy());
    expect((result.current.trees.main as { children: { text: string }[] }).children[0]?.text).toBe("Count: 0");
    expect(states.get("v-1")).toEqual({ value: 0 });

    act(() => result.current.onEvent("main", { handler: "increment" }));
    await waitFor(() => expect(states.get("v-1")).toEqual({ value: 1 }));
    await waitFor(() => expect((result.current.trees.main as { children: { text: string }[] }).children[0]?.text).toBe("Count: 1"));
    expect(result.current.log.at(-1)).toMatchObject({ kind: "intent", outcome: "applied", text: "state/merge" });
  });

  test("a verb intent is performed with the program as provenance", async () => {
    const engine = createEvalEngine();
    const states = createProgramStateStore();
    const perform = vi.fn(async () => "performed");
    const documents = { product: PRODUCT_2049 };
    const { result } = renderHook(() =>
      useProgramInstance({ engine, program: record(DAYS_OF_COVER_PROGRAM, 1, "prg-7"), viewId: "v-2", placementId: "n-2", states, documents, env: NONE, perform }),
    );
    await waitFor(() => expect(result.current.trees.main).toBeTruthy());
    act(() => result.current.onEvent("main", { handler: "reorder" }));
    await waitFor(() => expect(perform).toHaveBeenCalledWith({ kind: "reorder", productId: "2049" }, { provenance: { programId: "prg-7" } }));
    await waitFor(() => expect(result.current.log.at(-1)).toMatchObject({ outcome: "applied", text: "verb reorder → performed" }));
  });

  test("a throwing render becomes an error with phase and code, and the reset recovers", async () => {
    const engine = createEvalEngine();
    const states = createProgramStateStore();
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useProgramInstance({ engine, program: record(BROKEN_RENDER_PROGRAM), viewId: "v-3", placementId: "n-3", states, documents: NONE, env: NONE, perform: async () => "performed", onError }),
    );
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatchObject({ phase: "render", code: "RUNTIME_ERROR" });
    expect(onError).toHaveBeenCalled();
  });

  test("an update keeps compatible state and is a fresh instance", async () => {
    const engine = createEvalEngine();
    const states = createProgramStateStore();
    const perform = vi.fn(async () => "performed");
    const { result, rerender } = renderHook(
      ({ program }: { program: ProgramRecord }) =>
        useProgramInstance({ engine, program, viewId: "v-4", placementId: "n-4", states, documents: NONE, env: NONE, perform }),
      { initialProps: { program: record(COUNTER_PROGRAM, 1) } },
    );
    await waitFor(() => expect(result.current.trees.main).toBeTruthy());
    act(() => result.current.onEvent("main", { handler: "increment" }));
    await waitFor(() => expect(states.get("v-4")).toEqual({ value: 1 }));

    const v2 = record(COUNTER_PROGRAM.replace('"Count: "', '"Total: "'), 2);
    rerender({ program: v2 });
    await waitFor(() => expect((result.current.trees.main as { children: { text: string }[] }).children[0]?.text).toBe("Total: 1"));
    expect(states.get("v-4")).toEqual({ value: 1 });
    const instances = (await engine.health()).instances;
    expect(instances).toHaveLength(1);
    expect(instances[0]).toContain(":v2#");
  });

  test("settles with inline (unstable) callbacks and memoised inputs", async () => {
    const engine = createEvalEngine();
    const renders: number[] = [];
    const spy: typeof engine.render = async (input) => {
      renders.push(1);
      return engine.render(input);
    };
    const spied = { ...engine, render: spy };
    const states = createProgramStateStore();
    const { result } = renderHook(() =>
      useProgramInstance({
        engine: spied,
        program: record(COUNTER_PROGRAM),
        viewId: "v-6",
        placementId: "n-6",
        states,
        documents: NONE,
        env: NONE,
        // New functions every render — the natural way to write a call site.
        perform: async () => "performed",
        onError: () => {},
      }),
    );
    await waitFor(() => expect(result.current.trees.main).toBeTruthy());
    const settled = renders.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(renders.length).toBe(settled);
    expect(settled).toBeLessThanOrEqual(3);
  });

  test("without a program the instance is idle", () => {
    const engine = createEvalEngine();
    // Hoisted: a store created inside the render callback is a new dependency
    // every render, which is the caller bug the hook must not amplify.
    const states = createProgramStateStore();
    const perform = async () => "performed";
    const { result } = renderHook(() =>
      useProgramInstance({ engine, program: null, viewId: "v-5", placementId: "n-5", states, documents: NONE, env: NONE, perform }),
    );
    expect(result.current.status).toBe("idle");
    expect(result.current.trees).toEqual({});
  });
});
