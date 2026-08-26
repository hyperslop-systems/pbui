import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createEvalEngine } from "../../engines/evalEngine";
import { COUNTER_PROGRAM } from "../../fixtures/programs";
import type { SandboxHost } from "../../host/hostOptions";
import { createInstanceRegistry } from "../../instances";
import { createProgramLibrary, memoryStorage } from "../../library";
import { ScriptTile } from "../../ScriptTile";
import { createProgramStateStore } from "../../state";
import { ReplTile, isIntentList, isUINode, summariseValue } from "./ReplTile";

const NONE = {};

function makeHost(): SandboxHost {
  const library = createProgramLibrary({ key: "t", storage: memoryStorage() });
  library.putProgram({ title: "Counter", source: COUNTER_PROGRAM, bindings: [], meta: { widgets: ["main"] }, by: "human" });
  return {
    library,
    engine: createEvalEngine(),
    states: createProgramStateStore(),
    instances: createInstanceRegistry(),
    resolve: () => null,
    useEnv: () => NONE,
    perform: vi.fn(async () => "performed"),
    renderReference: (reference, label) => <span data-testid="ref">{label || reference.id}</span>,
  };
}

const view = (id: string, documents: Record<string, string> = {}) => ({ id, appId: "x", documents, title: "" }) as unknown as Parameters<typeof ReplTile>[0]["view"];

afterEach(cleanup);

async function mountWithCounter() {
  const host = makeHost();
  const utils = render(
    <>
      <ScriptTile placementId="n-1" view={view("v-1", { program: "prg-1" })} host={host} />
      <ReplTile placementId="n-2" view={view("v-2")} host={host} />
    </>,
  );
  await waitFor(() => expect(host.instances.get("v-1")?.status).toBe("ready"));
  host.instances.select("v-1");
  await waitFor(() => expect((screen.getByLabelText("REPL input") as HTMLTextAreaElement).disabled).toBe(false));
  return { host, ...utils };
}

function type(code: string) {
  const input = screen.getByLabelText("REPL input") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: code } });
  fireEvent.keyDown(input, { key: "Enter" });
  return input;
}

describe("ReplTile", () => {
  test("evaluates in the selected instance, shows values, errors and a rendered tree", async () => {
    const { host, container } = await mountWithCounter();
    type("$state");
    await waitFor(() => expect(container.querySelector('[data-part="repl-line"]')).toBeTruthy());
    expect(container.querySelector('[data-part="repl-line"]')?.textContent).toContain('"value": 0');

    type("nope.x");
    await waitFor(() => expect(container.querySelectorAll('[data-part="repl-line"]')).toHaveLength(2));
    expect(container.querySelector('[data-part="repl-line"][data-ok="false"]')?.textContent).toContain("ReferenceError");

    type("$render({ value: 7 })");
    await waitFor(() => expect(container.querySelectorAll('[data-part="repl-line"]')).toHaveLength(3));
    fireEvent.click(screen.getByRole("button", { name: "render here" }));
    const lines = container.querySelectorAll('[data-part="repl-line"]');
    expect(within(lines[2] as HTMLElement).getByText("Count: 7")).toBeTruthy();

    const evaluated = host.instances.timeline().filter((e) => e.kind === "evaluate");
    expect(evaluated.map((e) => (e as { ok: boolean }).ok)).toEqual([true, false, true]);
    expect((evaluated[2] as { summary: string }).summary).toBe("UINode column (5 nodes)");
  });

  test("set as state and apply intents reach the live instance; an injection changes the program", async () => {
    const { host, container } = await mountWithCounter();
    type("({ value: 9 })");
    await waitFor(() => expect(screen.getByRole("button", { name: "set as state" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "set as state" }));
    await waitFor(() => expect(host.states.get("v-1")).toEqual({ value: 9 }));
    await waitFor(() => expect(within(container.querySelector('[data-part="script-app"]')!).getByText("Count: 9")).toBeTruthy());

    type('$event("increment")');
    await waitFor(() => expect(screen.getByRole("button", { name: "apply intents" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "apply intents" }));
    await waitFor(() => expect(host.states.get("v-1")).toEqual({ value: 10 }));
    expect(host.instances.timeline().some((e) => e.kind === "intent" && e.detail === "from the REPL")).toBe(true);

    type('$plugin.widgets.main.handlers.increment = (c) => c.dispatchPluginAction("state/merge", { value: 100 })');
    await waitFor(() => expect(container.querySelectorAll('[data-part="repl-line"]')).toHaveLength(3));
    fireEvent.click(within(container.querySelector('[data-part="script-app"]')!).getByRole("button", { name: "+" }));
    await waitFor(() => expect(host.states.get("v-1")).toEqual({ value: 100 }));
  });

  test("history recalls with the arrow keys; without a running program it says so", async () => {
    const { host } = await mountWithCounter();
    const input = type("1 + 1");
    await waitFor(() => expect(screen.getByText("2")).toBeTruthy());
    type("2 + 2");
    await waitFor(() => expect(screen.getByText("4")).toBeTruthy());
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value).toBe("2 + 2");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value).toBe("1 + 1");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.value).toBe("2 + 2");
    expect(host.instances.timeline().filter((e) => e.kind === "evaluate")).toHaveLength(2);

    cleanup();
    const empty = makeHost();
    render(<ReplTile placementId="n-2" view={view("v-2")} host={empty} />);
    expect(screen.getByText("no program is running")).toBeTruthy();
    expect((screen.getByLabelText("REPL input") as HTMLTextAreaElement).disabled).toBe(true);
  });

  test("value helpers", () => {
    expect(isUINode({ kind: "text", text: "x" })).toBe(true);
    expect(isUINode({ kind: "nope" })).toBe(false);
    expect(isIntentList([{ scope: "plugin", actionType: "state/merge" }])).toBe(true);
    expect(isIntentList([])).toBe(false);
    expect(summariseValue({ $type: "error", name: "TypeError", message: "x" })).toBe("TypeError: x");
    expect(summariseValue({ $type: "function", $text: "() => 1" })).toBe("function () => 1");
    expect(summariseValue({ a: 1 })).toBe('{"a":1}');
    expect(summariseValue("x".repeat(100)).length).toBe(80);
  });
});
