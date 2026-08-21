import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createEvalEngine } from "../../engines/evalEngine";
import { COUNTER_PROGRAM, DAYS_OF_COVER_PROGRAM, PRODUCT_2049 } from "../../fixtures/programs";
import type { SandboxHost } from "../../host/hostOptions";
import { createInstanceRegistry } from "../../instances";
import { createProgramLibrary, memoryStorage } from "../../library";
import { ScriptTile } from "../../ScriptTile";
import { createProgramStateStore } from "../../state";
import { InspectorTile, chooseInstance } from "./InspectorTile";

const NONE = {};

function makeHost(): SandboxHost {
  const library = createProgramLibrary({ key: "t", storage: memoryStorage() });
  library.putProgram({ title: "Counter", source: COUNTER_PROGRAM, bindings: [], meta: { widgets: ["main"] }, by: "human" });
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
  };
}

function view(id: string, documents: Record<string, string>) {
  return { id, appId: "x", documents, title: "" } as unknown as Parameters<typeof InspectorTile>[0]["view"];
}

// vitest without `globals` does not auto-cleanup, so the first test's tiles would still be mounted in the second.
afterEach(cleanup);

describe("InspectorTile", () => {
  test("shows the running instance: state, outline with paths, fire, hover highlight, apply state", async () => {
    const host = makeHost();
    const { container } = render(
      <>
        <ScriptTile placementId="n-1" view={view("v-1", { program: "prg-1" })} host={host} />
        <InspectorTile placementId="n-2" view={view("v-2", { program: "prg-1", view: "v-1" })} host={host} />
      </>,
    );
    await waitFor(() => expect(host.instances.get("v-1")?.status).toBe("ready"));
    await waitFor(() => expect(screen.getByLabelText("program state editor")).toBeTruthy());
    expect((screen.getByLabelText("program state editor") as HTMLTextAreaElement).value).toContain('"value": 0');

    // tree pane: every node as a row, the button row can fire
    fireEvent.click(screen.getByRole("button", { name: "tree" }));
    await waitFor(() => expect(container.querySelector('[data-part="inspector-tree"]')).toBeTruthy());
    const rows = [...container.querySelectorAll('[data-part="inspector-tree"] li')].map((li) => li.getAttribute("data-path"));
    expect(rows).toEqual(["root", "root.0", "root.1", "root.1.0", "root.1.1"]);
    const fire = screen.getByRole("button", { name: /fire increment/ });
    fireEvent.click(fire);
    await waitFor(() => expect(host.states.get("v-1")).toEqual({ value: 1 }));

    // hovering a row publishes the highlight, and the program tile marks the node
    fireEvent.mouseEnter(container.querySelector('[data-path="root.1.0"]')!);
    await waitFor(() => expect(host.instances.get("v-1")?.highlight).toBe("root.1.0"));
    await waitFor(() => expect(container.querySelector('[data-part="script-app"] [data-highlighted="true"]')?.getAttribute("data-node-path")).toBe("root.1.0"));
    fireEvent.mouseLeave(container.querySelector('[aria-label="render tree"]')!);
    await waitFor(() => expect(host.instances.get("v-1")?.highlight).toBeNull());

    // state pane: apply a new state re-renders the program tile
    fireEvent.click(screen.getByRole("button", { name: "state" }));
    const editor = screen.getByLabelText("program state editor") as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: '{ "value": 41 }' } });
    fireEvent.click(screen.getByRole("button", { name: "apply" }));
    await waitFor(() => expect(host.states.get("v-1")).toEqual({ value: 41 }));
    await waitFor(() => expect(within(container.querySelector('[data-part="script-app"]')!).getByText("Count: 41")).toBeTruthy());
    expect(host.instances.timeline().some((e) => e.kind === "note" && e.text.includes("inspector"))).toBe(true);

    // invalid JSON is reported, not applied
    fireEvent.change(editor, { target: { value: "{ nope" } });
    fireEvent.click(screen.getByRole("button", { name: "apply" }));
    await waitFor(() => expect(editor.getAttribute("aria-invalid")).toBe("true"));
    expect(host.states.get("v-1")).toEqual({ value: 41 });

    // reset goes back to initialState
    fireEvent.click(screen.getByRole("button", { name: "reset to initialState" }));
    await waitFor(() => expect(host.states.get("v-1")).toEqual({ value: 0 }));
  });

  test("bindings pane shows resolved references and meta pane shows timings", async () => {
    const host = makeHost();
    const { container } = render(
      <>
        <ScriptTile placementId="n-1" view={view("v-1", { program: "prg-2", product: "2049" })} host={host} />
        <InspectorTile placementId="n-2" view={view("v-2", { program: "prg-2" })} host={host} />
      </>,
    );
    await waitFor(() => expect(host.instances.get("v-1")?.globalState).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "bindings" }));
    await waitFor(() => expect(container.querySelector('[data-part="inspector-binding"][data-key="product"]')).toBeTruthy());
    expect(within(container.querySelector('[data-part="program-inspector"]')!).getByTestId("ref").textContent).toBe("product:2049");
    fireEvent.click(screen.getByRole("button", { name: "meta" }));
    await waitFor(() => expect(container.querySelector('[data-part="inspector-facts"]')?.textContent).toContain("v-1:prg-2:v1#"));
    expect(container.querySelector('[data-part="inspector-facts"]')?.textContent).toContain("renders");
  });

  test("without a running instance it says so", () => {
    const host = makeHost();
    render(<InspectorTile placementId="n-2" view={view("v-2", { program: "prg-1" })} host={host} />);
    expect(screen.getByText("Counter is not running")).toBeTruthy();
  });

  test("chooseInstance prefers chosen, then wanted, then selected, then the latest", () => {
    const snap = (viewId: string) => ({ viewId }) as Parameters<typeof chooseInstance>[0][number];
    const candidates = [snap("a"), snap("b"), snap("c")];
    expect(chooseInstance(candidates, "b", "c", "a")?.viewId).toBe("a");
    expect(chooseInstance(candidates, "b", "c", null)?.viewId).toBe("b");
    expect(chooseInstance(candidates, undefined, "c", null)?.viewId).toBe("c");
    expect(chooseInstance(candidates, "zz", "zz", "zz")?.viewId).toBe("c");
    expect(chooseInstance([], undefined, null, null)).toBeNull();
  });
});
