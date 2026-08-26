import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createEvalEngine } from "../../engines/evalEngine";
import { COUNTER_PROGRAM, DAYS_OF_COVER_PROGRAM, PRODUCT_2049 } from "../../fixtures/programs";
import type { SandboxHost } from "../../host/hostOptions";
import { createInstanceRegistry } from "../../instances";
import { createProgramLibrary, memoryStorage } from "../../library";
import { createProgramStateStore } from "../../state";
import { createPlaygroundStore, PLAYGROUND_TEMPLATE } from "../playgroundStore";
import { DRAFT_PROGRAM_ID, PLAYGROUND_VIEW_ID, PlaygroundTile } from "./PlaygroundTile";

const NONE = {};

function makeHost(): SandboxHost {
  const library = createProgramLibrary({ key: "t", storage: memoryStorage() });
  library.putProgram({ title: "Days", source: DAYS_OF_COVER_PROGRAM, bindings: ["product"], meta: { widgets: ["main"] }, by: "agent" });
  return {
    library,
    engine: createEvalEngine(),
    states: createProgramStateStore(),
    instances: createInstanceRegistry(),
    resolve: (key, id) => (key === "product" && id === "2049" ? PRODUCT_2049 : null),
    useEnv: () => NONE,
    perform: vi.fn(async () => "performed"),
    renderReference: (reference, label) => <span data-testid="ref">{label || reference.id}</span>,
    askAgent: vi.fn(),
    bindingChoices: (key) => (key === "product" ? [{ id: "2049", label: "Gold Maple" }, { id: "1", label: "Other" }] : []),
  };
}

const view = { id: "v-p", appId: "x", documents: {}, title: "" } as unknown as Parameters<typeof PlaygroundTile>[0]["view"];

afterEach(cleanup);

function mount(host = makeHost(), storage = memoryStorage()) {
  const store = createPlaygroundStore({ key: "pg", storage, debounceMs: 0 });
  const utils = render(<PlaygroundTile placementId="n-p" view={view} host={host} store={store} reloadMs={10} />);
  return { host, store, storage, ...utils };
}

const editor = () => screen.getByLabelText("draft source") as HTMLTextAreaElement;
const status = (container: HTMLElement) => container.querySelector('[data-part="playground-status"]')!.textContent ?? "";

describe("playgroundStore", () => {
  test("persists, restores, and resets to the template", async () => {
    const storage = memoryStorage();
    const store = createPlaygroundStore({ key: "pg", storage, debounceMs: 0, now: () => "t" });
    expect(store.get().source).toBe(PLAYGROUND_TEMPLATE);
    store.set({ source: "x", bindings: { product: "2049" }, fromProgramId: "prg-1" });
    store.flush();
    const again = createPlaygroundStore({ key: "pg", storage });
    expect(again.get()).toEqual({ source: "x", bindings: { product: "2049" }, fromProgramId: "prg-1", updatedAt: "t" });
    again.reset();
    expect(again.get().source).toBe(PLAYGROUND_TEMPLATE);
    storage.setItem("pg", "{corrupt");
    expect(createPlaygroundStore({ key: "pg", storage }).get().source).toBe(PLAYGROUND_TEMPLATE);
  });
});

describe("PlaygroundTile", () => {
  test("runs the template live, reloads after typing, and reports errors", async () => {
    const { host, container } = mount();
    await waitFor(() => expect(host.instances.get(PLAYGROUND_VIEW_ID)?.status).toBe("ready"));
    expect(host.instances.get(PLAYGROUND_VIEW_ID)?.programId).toBe(DRAFT_PROGRAM_ID);
    const preview = container.querySelector('[data-part="playground-preview"]') as HTMLElement;
    expect(within(preview).getByText("n = 0")).toBeTruthy();
    fireEvent.click(within(preview).getByRole("button", { name: "+1" }));
    await waitFor(() => expect(within(preview).getByText("n = 1")).toBeTruthy());
    expect(status(container)).toMatch(/^ok · main · \d+ nodes/);

    fireEvent.change(editor(), { target: { value: PLAYGROUND_TEMPLATE.replace('"n = "', '"count = "') } });
    await waitFor(() => expect(within(preview).getByText("count = 1")).toBeTruthy());
    expect(host.instances.get(PLAYGROUND_VIEW_ID)?.version).toBe(2);

    fireEvent.change(editor(), { target: { value: "definePlugin(() => ({ widgets: { main: { render() { throw new Error('boom'); } } } }))" } });
    await waitFor(() => expect(status(container)).toContain("render · RUNTIME_ERROR · Error: boom"));
    expect(screen.getByRole("button", { name: "save as new" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "ask the agent" }));
    expect(host.askAgent).toHaveBeenCalledWith(expect.stringContaining("fails at render with RUNTIME_ERROR"), []);
  });

  test("save as new stores a human program and opens it; update bumps the version", async () => {
    const { host, store } = mount();
    await waitFor(() => expect(host.instances.get(PLAYGROUND_VIEW_ID)?.status).toBe("ready"));
    await waitFor(() => expect(screen.getByRole("button", { name: "save as new" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "save as new" }));
    await waitFor(() => expect(Object.keys(host.library.getState().programs)).toHaveLength(2));
    const saved = host.library.getState().programs["prg-2"]!;
    expect(saved).toMatchObject({ title: "My draft", by: "human", version: 1, bindings: [], meta: { declaredId: "my-draft", widgets: ["main"] } });
    expect(host.perform).toHaveBeenCalledWith({ kind: "program.open", programId: "prg-2", documents: {} }, { provenance: { programId: "prg-2" } });
    expect(store.get().fromProgramId).toBe("prg-2");
    await waitFor(() => expect(screen.getByRole("button", { name: "update prg-2" })).toBeTruthy());

    fireEvent.change(editor(), { target: { value: PLAYGROUND_TEMPLATE.replace('"My draft"', '"My draft 2"') } });
    await waitFor(() => expect(host.instances.get(PLAYGROUND_VIEW_ID)?.meta?.title).toBe("My draft 2"));
    await waitFor(() => expect(screen.getByRole("button", { name: "update prg-2" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "update prg-2" }));
    expect(host.library.getState().programs["prg-2"]).toMatchObject({ version: 2, title: "My draft 2" });
  });

  test("load from seeds the draft and its declared bindings; the picker resolves a product", async () => {
    const { host, store, container } = mount();
    await waitFor(() => expect(host.instances.get(PLAYGROUND_VIEW_ID)?.status).toBe("ready"));
    fireEvent.change(screen.getByLabelText("load a library program into the draft"), { target: { value: "prg-1" } });
    await waitFor(() => expect(store.get().source).toBe(DAYS_OF_COVER_PROGRAM));
    expect(store.get()).toMatchObject({ fromProgramId: "prg-1", bindings: { product: "" } });
    await waitFor(() => expect(host.instances.get(PLAYGROUND_VIEW_ID)?.meta?.bindings).toEqual(["product"]));
    const preview = container.querySelector('[data-part="playground-preview"]') as HTMLElement;
    await waitFor(() => expect(within(preview).getByText("bind this tile to a product")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("binding product"), { target: { value: "2049" } });
    await waitFor(() => expect(within(container.querySelector('[data-part="playground-bindings"]') as HTMLElement).getByTestId("ref").textContent).toBe("product:2049"));
    await waitFor(() => expect(within(preview).getByText("Draft a reorder")).toBeTruthy());

    // loading again over an edited draft asks first
    fireEvent.change(editor(), { target: { value: COUNTER_PROGRAM } });
    fireEvent.change(screen.getByLabelText("load a library program into the draft"), { target: { value: "prg-1" } });
    expect(screen.getByText("Replace the draft?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "keep my draft" }));
    expect(store.get().source).toBe(COUNTER_PROGRAM);
  });

  test("a source over the limit disables saving and says why", async () => {
    const { host, container } = mount();
    await waitFor(() => expect(host.instances.get(PLAYGROUND_VIEW_ID)?.status).toBe("ready"));
    fireEvent.change(editor(), { target: { value: `${PLAYGROUND_TEMPLATE}\n// ${"x".repeat(70 * 1024)}` } });
    await waitFor(() => expect(status(container)).toContain("the limit is 65536"));
    expect(screen.getByRole("button", { name: "save as new" }).hasAttribute("disabled")).toBe(true);
  });
});
