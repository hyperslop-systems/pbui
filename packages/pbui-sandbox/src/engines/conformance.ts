import { afterEach, describe, expect, test } from "vitest";
import type { DispatchIntent, ProgramGlobalState } from "../contracts";
import { toProgramError, type ProgramEngine } from "../engine";
import type { SandboxLimits } from "../limits";
import {
  BROKEN_RENDER_PROGRAM,
  COLUMN_PROGRAM,
  COUNTER_PROGRAM,
  DAYS_OF_COVER_PROGRAM,
  DOM_PROGRAM,
  PRODUCT_2049,
  UNKNOWN_KIND_PROGRAM,
} from "../fixtures/programs";
import { withLimits } from "../limits";

/**
 * The engine conformance suite. Every engine must pass it unchanged: the
 * eval engine runs it from `conformance.test.ts`, the QuickJS engine from
 * `../quickjs/conformance.test.ts` (a Node environment, for the wasm).
 */
export type EngineFactory = (limits?: SandboxLimits) => ProgramEngine;

function globalState(overrides: Partial<ProgramGlobalState["shared"]> = {}): ProgramGlobalState {
  return {
    self: { instanceId: "i", programId: "p", viewId: "v", placementId: "n" },
    shared: { documents: {}, env: {}, ...overrides },
    system: { engine: "eval", version: 1 },
  };
}

/** The generic reducer, four lines, the same the host loop runs. */
function reduce(state: unknown, intents: DispatchIntent[]): unknown {
  let next = state;
  for (const intent of intents) {
    if (intent.scope !== "plugin") continue;
    if (intent.actionType === "state/replace") next = intent.payload ?? {};
    else if (intent.actionType === "state/merge" && typeof intent.payload === "object" && intent.payload !== null) {
      next = { ...(next as Record<string, unknown>), ...(intent.payload as Record<string, unknown>) };
    }
  }
  return next;
}

export function describeEngineConformance(name: string, make: EngineFactory): void {
  describe(`${name} engine`, () => {
  const engines: ProgramEngine[] = [];
  const engine = () => {
    const e = make();
    engines.push(e);
    return e;
  };
  afterEach(async () => {
    for (const e of engines) for (const id of (await e.health()).instances) await e.dispose(id);
    engines.length = 0;
  });

  test("loads the counter, renders it, and increments through an intent", async () => {
    const e = engine();
    const meta = await e.load({ instanceId: "c1", programId: "counter", source: COUNTER_PROGRAM });
    expect(meta).toMatchObject({ programId: "counter", instanceId: "c1", declaredId: "minimal-counter", title: "Minimal Counter", widgets: ["main"], bindings: [] });
    expect(meta.initialState).toEqual({ value: 0 });

    let state = meta.initialState;
    const tree = await e.render({ instanceId: "c1", widgetId: "main", pluginState: state, globalState: globalState() });
    expect(tree).toEqual({
      kind: "column",
      children: [
        { kind: "text", text: "Count: 0" },
        { kind: "row", children: [
          { kind: "button", props: { label: "-", onClick: { handler: "decrement" } } },
          { kind: "button", props: { label: "+", onClick: { handler: "increment" } } },
        ] },
      ],
    });

    const intents = await e.event({ instanceId: "c1", widgetId: "main", handler: "increment", args: undefined, pluginState: state, globalState: globalState() });
    expect(intents).toEqual([{ scope: "plugin", instanceId: "c1", actionType: "state/merge", payload: { value: 1 } }]);
    state = reduce(state, intents);
    const again = await e.render({ instanceId: "c1", widgetId: "main", pluginState: state, globalState: globalState() });
    expect((again as { children: unknown[] }).children[0]).toEqual({ kind: "text", text: "Count: 1" });
  });

  test("reads a bound object, renders a ref and a meter, and emits a verb intent", async () => {
    const e = engine();
    const meta = await e.load({ instanceId: "d1", programId: "days", source: DAYS_OF_COVER_PROGRAM });
    expect(meta.bindings).toEqual(["product"]);

    const unbound = await e.render({ instanceId: "d1", widgetId: "main", pluginState: meta.initialState, globalState: globalState() });
    expect(unbound).toEqual({ kind: "callout", props: { variant: "warning", text: "bind this tile to a product" } });

    const bound = globalState({ documents: { product: PRODUCT_2049 } });
    const tree = await e.render({ instanceId: "d1", widgetId: "main", pluginState: meta.initialState, globalState: bound });
    expect(tree).toMatchObject({
      kind: "column",
      children: [
        { kind: "row", children: [{ kind: "ref", props: { reference: PRODUCT_2049 } }, { kind: "badge", text: "short" }] },
        { kind: "input", props: { value: "30", type: "number" } },
        { kind: "meter", props: { value: "3 / 75", label: "stock vs need" } },
        { kind: "button", props: { label: "Draft a reorder", variant: "destructive", disabled: false } },
      ],
    });

    const typed = await e.event({ instanceId: "d1", widgetId: "main", handler: "setDays", args: { value: "1" }, pluginState: meta.initialState, globalState: bound });
    expect(reduce(meta.initialState, typed)).toEqual({ days: 1 });

    const clicked = await e.event({ instanceId: "d1", widgetId: "main", handler: "reorder", args: undefined, pluginState: meta.initialState, globalState: bound });
    expect(clicked).toEqual([{ scope: "verb", instanceId: "d1", verb: { kind: "reorder", productId: "2049" } }]);
  });

  test("renders several widgets and reports them in declaration order", async () => {
    const e = engine();
    const meta = await e.load({ instanceId: "w1", programId: "column", source: COLUMN_PROGRAM });
    expect(meta.widgets).toEqual(["top", "side"]);
    expect(meta.initialState).toBeUndefined();
    expect(await e.render({ instanceId: "w1", widgetId: "side", pluginState: {}, globalState: globalState() })).toEqual({
      kind: "panel",
      props: { title: "aside" },
      children: [{ kind: "badge", text: "side" }],
    });
  });

  test("does not let a program mutate the host's state object", async () => {
    const e = engine();
    const source = `definePlugin(({ ui }) => ({ title: "m", widgets: { main: {
      render({ pluginState }) { pluginState.touched = true; return ui.text("x"); },
      handlers: { go({ pluginState, dispatchPluginAction }) { pluginState.touched = true; dispatchPluginAction("state/merge", {}); } } } } }));`;
    await e.load({ instanceId: "m1", programId: "m", source });
    const state: Record<string, unknown> = { value: 1 };
    await e.render({ instanceId: "m1", widgetId: "main", pluginState: state, globalState: globalState() });
    await e.event({ instanceId: "m1", widgetId: "main", handler: "go", args: undefined, pluginState: state, globalState: globalState() });
    expect(state).toEqual({ value: 1 });
  });

  test("fails to load a program that reaches for the DOM", async () => {
    const e = engine();
    // eval: "document is not available inside a program …"; QuickJS: "ReferenceError: document is not defined".
    await expect(e.load({ instanceId: "x1", programId: "dom", source: DOM_PROGRAM })).rejects.toThrow(/document/);
    expect((await e.health()).instances).toEqual([]);
  });

  test("reports a syntax error at load, a missing definePlugin, and a duplicate instance", async () => {
    const e = engine();
    // Both engines throw a SyntaxError; their messages differ ("Unexpected token '<'" vs "unexpected token in expression: '<'").
    const syntax = e.load({ instanceId: "s1", programId: "s", source: "definePlugin(({ ui }) => ({ title: 'x', widgets: { main: { render() { return ui.text(<b>x</b>); } } } }))" });
    await expect(syntax).rejects.toMatchObject({ name: "SyntaxError" });
    await expect(syntax.catch((error) => toProgramError(error, "load"))).resolves.toMatchObject({ code: "RUNTIME_ERROR", message: expect.stringMatching(/^SyntaxError: /i) });
    await expect(e.load({ instanceId: "s2", programId: "s", source: "const x = 1;" })).rejects.toThrow("Plugin did not register via definePlugin");
    await e.load({ instanceId: "s3", programId: "counter", source: COUNTER_PROGRAM });
    await expect(e.load({ instanceId: "s3", programId: "counter", source: COUNTER_PROGRAM })).rejects.toThrow("already exists");
  });

  test("turns a throwing render into a RUNTIME_ERROR and an unknown kind into a VALIDATION_ERROR", async () => {
    const e = engine();
    await e.load({ instanceId: "b1", programId: "broken", source: BROKEN_RENDER_PROGRAM });
    const broken = await e.render({ instanceId: "b1", widgetId: "main", pluginState: {}, globalState: globalState() }).catch((error) => toProgramError(error, "render"));
    expect(broken).toMatchObject({ code: "RUNTIME_ERROR", phase: "render" });
    expect((broken as { message: string }).message).toMatch(/TypeError/);

    await e.load({ instanceId: "u1", programId: "unknown", source: UNKNOWN_KIND_PROGRAM });
    const unknown = await e.render({ instanceId: "u1", widgetId: "main", pluginState: {}, globalState: globalState() }).catch((error) => toProgramError(error, "render"));
    expect(unknown).toMatchObject({ code: "VALIDATION_ERROR", phase: "render" });
    expect((unknown as { message: string }).message).toContain("root.kind 'image' is not supported");
  });

  test("refuses a handler that does not exist and a source over the size limit", async () => {
    const e = engine();
    await e.load({ instanceId: "h1", programId: "counter", source: COUNTER_PROGRAM });
    await expect(e.event({ instanceId: "h1", widgetId: "main", handler: "nope", args: undefined, pluginState: {}, globalState: globalState() })).rejects.toThrow("Handler not found: nope");
    const small = make(withLimits({ sourceBytes: 10 }));
    engines.push(small);
    await expect(small.load({ instanceId: "h2", programId: "counter", source: COUNTER_PROGRAM })).rejects.toThrow(/limit is 10/);
  });

  test("disposes and forgets an instance", async () => {
    const e = engine();
    await e.load({ instanceId: "z1", programId: "counter", source: COUNTER_PROGRAM });
    expect(await e.dispose("z1")).toBe(true);
    expect(await e.dispose("z1")).toBe(false);
    await expect(e.render({ instanceId: "z1", widgetId: "main", pluginState: {}, globalState: globalState() })).rejects.toThrow("Program instance not found: z1");
  });
  });
}
