// @vitest-environment node
import { describe, expect, test } from "vitest";
import { toProgramError } from "../engine";
import { describeEngineConformance } from "../engines/conformance";
import { createQuickJsDirectEngine } from "./directEngine";

describeEngineConformance("quickjs", (limits) => createQuickJsDirectEngine(limits));

describe("quickjs engine · what eval cannot do", () => {
  test("interrupts a runaway render and reports RUNTIME_TIMEOUT", async () => {
    const e = createQuickJsDirectEngine({ renderMs: 50 });
    await e.load({
      instanceId: "loop",
      programId: "loop",
      source: `definePlugin(() => ({ title: "loop", widgets: { main: { render() { while (true) {} }, handlers: {} } } }))`,
    });
    const outcome = await e
      .render({ instanceId: "loop", widgetId: "main", pluginState: {}, globalState: { self: {}, shared: { documents: {}, env: {} }, system: {} } })
      .catch((error) => toProgramError(error, "render"));
    expect(outcome).toMatchObject({ code: "RUNTIME_TIMEOUT", phase: "render" });
    await e.dispose("loop");
  });

  test("a program cannot see the host's globals at all", async () => {
    const e = createQuickJsDirectEngine();
    const load = e.load({ instanceId: "g", programId: "g", source: `const x = globalThis.localStorage.getItem("k"); definePlugin(() => ({ widgets: {} }))` });
    await expect(load).rejects.toMatchObject({ name: "TypeError" });
    // The name reaches the model once, as a prefix — not "Error: TypeError: …".
    await expect(load.catch((error) => toProgramError(error, "load"))).resolves.toMatchObject({ message: expect.stringMatching(/^TypeError: cannot read/) });
    expect((await e.health()).instances).toEqual([]);
  });
});
