import { EditorView } from "@hyperslop-systems/pbui-editor";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createEvalEngine } from "../../engines/evalEngine";
import { COUNTER_PROGRAM } from "../../fixtures/programs";
import type { SandboxHost } from "../../host/hostOptions";
import { createInstanceRegistry } from "../../instances";
import { createProgramLibrary, memoryStorage } from "../../library";
import { createProgramStateStore } from "../../state";
import { createPlaygroundStore } from "../playgroundStore";
import { SourceTile, seedPlaygroundFrom, versionsOf } from "./SourceTile";

const NONE = {};

function makeHost(): SandboxHost {
  const library = createProgramLibrary({ key: "t", storage: memoryStorage(), now: () => "2026-08-21T15:42:07.000Z" });
  library.putProgram({ title: "Counter", source: COUNTER_PROGRAM, bindings: [], meta: { widgets: ["main"] }, by: "human" });
  library.putProgram({ id: "prg-1", title: "Counter", source: COUNTER_PROGRAM.replace('"Count: "', '"Total: "'), bindings: [], meta: { widgets: ["main"] }, by: "agent" });
  library.putProgram({ id: "prg-1", title: "Counter 3", source: COUNTER_PROGRAM.replace('"Count: "', '"Sum: "'), bindings: [], meta: { widgets: ["main"] }, by: "agent" });
  return {
    library,
    engine: createEvalEngine(),
    states: createProgramStateStore(),
    instances: createInstanceRegistry(),
    resolve: () => null,
    useEnv: () => NONE,
    perform: vi.fn(async () => "performed"),
    renderReference: (reference, label) => <span>{label || reference.id}</span>,
    askAgent: vi.fn(),
  };
}

const view = (documents: Record<string, string>) => ({ id: "v-s", appId: "x", documents, title: "" }) as unknown as Parameters<typeof SourceTile>[0]["view"];

afterEach(cleanup);

describe("SourceTile", () => {
  test("shows the source with line numbers, lists versions, diffs and rolls back", () => {
    const host = makeHost();
    const { container } = render(<SourceTile placementId="n-s" view={view({ program: "prg-1" })} host={host} />);
    expect(screen.getByText("Counter 3 · v3 · agent")).toBeTruthy();
    const listing = container.querySelector('[data-part="source-listing"]')!;
    // A read-only CodeEditor since PBUI-PLOTKIT-1: assert on the document it
    // holds rather than on rendered lines, which CodeMirror virtualises.
    const editorView = EditorView.findFromDOM(listing.querySelector(".cm-editor") as HTMLElement)!;
    // v3 is the current record, whose source is COUNTER_PROGRAM with "Total: " → "Sum: ".
    expect(editorView.state.doc.lines).toBe(COUNTER_PROGRAM.split("\n").length);
    expect(editorView.state.doc.toString()).toContain("Sum: ");
    expect(editorView.state.readOnly).toBe(true);
    expect(editorView.contentDOM.getAttribute("aria-label")).toBe("program source");

    fireEvent.click(screen.getByRole("button", { name: "versions" }));
    const versions = [...container.querySelectorAll('[data-part="program-version"]')].map((li) => li.getAttribute("data-version"));
    expect(versions).toEqual(["3", "2", "1"]);
    expect(container.querySelector('[data-version="3"]')?.textContent).toContain("current");

    fireEvent.click(screen.getByRole("button", { name: "diff" }));
    expect(container.querySelector('[data-part="diff-summary"]')?.textContent).toBe("+1 −1");
    expect(container.textContent).toContain('"Total: "');
    expect(container.textContent).toContain('"Sum: "');
    fireEvent.change(screen.getByLabelText("diff base version"), { target: { value: "3" } });
    expect(screen.getByText("no differences")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "versions" }));
    fireEvent.click(screen.getByRole("button", { name: "roll back to v1" }));
    const record = host.library.getState().programs["prg-1"]!;
    expect(record).toMatchObject({ version: 4, source: COUNTER_PROGRAM, title: "Counter", by: "human" });
    expect(record.history.map((v) => v.version)).toEqual([3, 2, 1]);
    expect(screen.getByText("Counter · v4 · human")).toBeTruthy();
  });

  test("a pinned program asks before rolling back", () => {
    const host = makeHost();
    host.library.setPinned("program", "prg-1", true);
    render(<SourceTile placementId="n-s" view={view({ program: "prg-1" })} host={host} />);
    fireEvent.click(screen.getByRole("button", { name: "versions" }));
    fireEvent.click(screen.getByRole("button", { name: "roll back to v2" }));
    expect(screen.getByText("Roll back Counter 3 to v2?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "keep v3" }));
    expect(host.library.getState().programs["prg-1"]!.version).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "roll back to v2" }));
    fireEvent.click(screen.getByRole("button", { name: "roll back" }));
    expect(host.library.getState().programs["prg-1"]).toMatchObject({ version: 4, title: "Counter", pinned: true });
  });

  test("missing program, versionsOf and seedPlaygroundFrom", () => {
    const host = makeHost();
    render(<SourceTile placementId="n-s" view={view({ program: "prg-9" })} host={host} />);
    expect(screen.getByText("program prg-9 is not in the library")).toBeTruthy();

    const record = host.library.getState().programs["prg-1"]!;
    expect(versionsOf(record).map((v) => v.version)).toEqual([3, 2, 1]);

    const store = createPlaygroundStore({ key: "pg", storage: memoryStorage() });
    store.set({ bindings: { product: "2049" } });
    seedPlaygroundFrom(store, { ...record, bindings: ["product", "order"] });
    expect(store.get()).toMatchObject({ source: record.source, bindings: { product: "2049", order: "" }, fromProgramId: "prg-1" });
    seedPlaygroundFrom(store, record, record.history[1]);
    expect(store.get().source).toBe(COUNTER_PROGRAM);
  });
});
