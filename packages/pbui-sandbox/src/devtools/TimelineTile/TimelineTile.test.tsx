import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createEvalEngine } from "../../engines/evalEngine";
import { BROKEN_RENDER_PROGRAM, COUNTER_PROGRAM } from "../../fixtures/programs";
import type { SandboxHost } from "../../host/hostOptions";
import { createInstanceRegistry, type TimelineEntry } from "../../instances";
import { createProgramLibrary, memoryStorage } from "../../library";
import { ScriptTile } from "../../ScriptTile";
import { createProgramStateStore } from "../../state";
import { TimelineTile, eventsForReplay, overLimit } from "./TimelineTile";

const NONE = {};

function makeHost(): SandboxHost {
  const library = createProgramLibrary({ key: "t", storage: memoryStorage() });
  library.putProgram({ title: "Counter", source: COUNTER_PROGRAM, bindings: [], meta: { widgets: ["main"] }, by: "human" });
  library.putProgram({ title: "Broken", source: BROKEN_RENDER_PROGRAM, bindings: [], meta: { widgets: ["main"] }, by: "agent" });
  return {
    library,
    engine: createEvalEngine(),
    states: createProgramStateStore(),
    instances: createInstanceRegistry({ now: () => "2026-08-21T15:42:07.311Z" }),
    resolve: () => null,
    useEnv: () => NONE,
    perform: vi.fn(async () => "performed"),
    renderReference: (reference, label) => <span>{label || reference.id}</span>,
    askAgent: vi.fn(),
  };
}

const view = (id: string, documents: Record<string, string> = {}) => ({ id, appId: "x", documents, title: "" }) as unknown as Parameters<typeof TimelineTile>[0]["view"];

afterEach(cleanup);

const kindsOf = (container: HTMLElement) => [...container.querySelectorAll('[data-part="timeline-row"]')].map((li) => li.getAttribute("data-kind"));

describe("TimelineTile", () => {
  test("lists entries newest first, filters by kind, pauses, fires again and clears", async () => {
    const host = makeHost();
    const { container } = render(
      <>
        <ScriptTile placementId="n-1" view={view("v-1", { program: "prg-1" })} host={host} />
        <TimelineTile placementId="n-2" view={view("v-2")} host={host} />
      </>,
    );
    await waitFor(() => expect(host.instances.get("v-1")?.status).toBe("ready"));
    fireEvent.click(within(container.querySelector('[data-part="script-app"]')!).getByRole("button", { name: "+" }));
    await waitFor(() => expect(host.states.get("v-1")).toEqual({ value: 1 }));
    await waitFor(() => expect(kindsOf(container).slice(0, 3)).toEqual(["render", "intent", "event"]));
    expect(kindsOf(container).at(-1)).toBe("load");
    const event = container.querySelector('[data-part="timeline-row"][data-kind="event"]')!;
    expect(event.textContent).toContain("event increment");
    expect(event.textContent).toContain("→ state/merge");

    // kind filter: only intents
    for (const kind of ["load", "render", "event", "error", "evaluate", "note"]) fireEvent.click(within(container.querySelector('[aria-label="kinds"]')!).getByRole("button", { name: kind }));
    expect(kindsOf(container)).toEqual(["intent"]);
    fireEvent.click(within(container.querySelector('[aria-label="kinds"]')!).getByRole("button", { name: "event" }));

    // pause freezes the list while the ring grows
    fireEvent.click(screen.getByRole("button", { name: "pause" }));
    const before = kindsOf(container).length;
    fireEvent.click(within(container.querySelector('[data-part="script-app"]')!).getByRole("button", { name: "+" }));
    await waitFor(() => expect(host.states.get("v-1")).toEqual({ value: 2 }));
    expect(kindsOf(container).length).toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await waitFor(() => expect(kindsOf(container).length).toBeGreaterThan(before));

    // fire again re-sends the recorded event through the live handle
    fireEvent.click(within(container.querySelector('[data-part="timeline-row"][data-kind="event"]')!).getByRole("button", { name: "fire again" }));
    await waitFor(() => expect(host.states.get("v-1")).toEqual({ value: 3 }));

    fireEvent.click(screen.getByRole("button", { name: "clear" }));
    expect(host.instances.timeline()).toEqual([]);
    expect(screen.getByText("nothing has happened yet")).toBeTruthy();
  });

  test("copy as events produces the sandbox_test shape, falling back to a text area without a clipboard", async () => {
    const host = makeHost();
    const writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { container } = render(
      <>
        <ScriptTile placementId="n-1" view={view("v-1", { program: "prg-1" })} host={host} />
        <TimelineTile placementId="n-2" view={view("v-2")} host={host} />
      </>,
    );
    await waitFor(() => expect(host.instances.get("v-1")?.status).toBe("ready"));
    host.instances.get("v-1")!.handle!.fire("main", { handler: "increment" });
    host.instances.get("v-1")!.handle!.fire("main", { handler: "decrement" }, { why: "test" });
    await waitFor(() => expect(host.instances.timeline().filter((e) => e.kind === "event")).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "copy as events" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(JSON.parse(writeText.mock.calls[0]![0])).toEqual([{ handler: "increment" }, { handler: "decrement", args: { why: "test" } }]);
    expect(container.querySelector('[data-part="timeline-row"][data-kind="note"]')?.textContent).toContain("copied");

    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => { throw new Error("denied"); }) }, configurable: true });
    fireEvent.click(screen.getByRole("button", { name: "copy as events" }));
    await waitFor(() => expect(screen.getByLabelText(/events as JSON/)).toBeTruthy());
    expect((screen.getByLabelText(/events as JSON/) as HTMLTextAreaElement).value).toContain('"handler": "increment"');
  });

  test("an error row offers ask-the-agent", async () => {
    const host = makeHost();
    const { container } = render(
      <>
        <ScriptTile placementId="n-1" view={view("v-1", { program: "prg-2" })} host={host} />
        <TimelineTile placementId="n-2" view={view("v-2")} host={host} />
      </>,
    );
    await waitFor(() => expect(container.querySelector('[data-part="timeline-row"][data-kind="error"]')).toBeTruthy());
    const row = container.querySelector('[data-part="timeline-row"][data-kind="error"]')!;
    expect(row.getAttribute("data-danger")).toBe("true");
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "ask the agent" }));
    expect(host.askAgent).toHaveBeenCalledWith(expect.stringContaining("failed (render)"), [{ type: "program", id: "prg-2", value: { title: "Broken" } }]);
  });

  test("helpers", () => {
    const base = { seq: 1, at: "t", viewId: "v", programId: "p", version: 1, instanceId: "i" };
    const entries: TimelineEntry[] = [
      { ...base, kind: "event", widgetId: "main", handler: "a", args: undefined, durationMs: 1, intents: [] },
      { ...base, viewId: "other", kind: "event", widgetId: "main", handler: "x", args: 1, durationMs: 1, intents: [] },
      { ...base, kind: "event", widgetId: "main", handler: "b", args: { v: 1 }, durationMs: 1, intents: [] },
    ];
    expect(eventsForReplay(entries, "v")).toEqual([{ handler: "a" }, { handler: "b", args: { v: 1 } }]);
    expect(overLimit({ ...base, kind: "render", widgetId: "main", durationMs: 101, nodeCount: 1 })).toBe(true);
    expect(overLimit({ ...base, kind: "render", widgetId: "main", durationMs: 99, nodeCount: 1 })).toBe(false);
    expect(overLimit({ ...base, kind: "note", text: "" })).toBe(false);
  });
});
