import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { available } from "./actions";
import { createPbui } from "./createPbui";
import { definePresentation } from "./model";
import type { PresentationReference } from "./types";

/**
 * PBUI-KERNEL-4 P6 — the §19.8 runtime tests through the real components:
 * the accept machine's invariants as a user meets them, pointer/keyboard
 * parity on an acceptable object, and introspection through the context.
 */

type Values = { person: { id: string; name: string }; note: { id: string; author: string } };
type Facts = Record<string, never>;
type Verb = { kind: string };

const p = definePresentation<Values, { prefix: string }, Facts, Verb>();

const presentation = p.create({
  id: "test.interaction",
  types: [{ id: "person" }, { id: "note" }],
  knownScopes: ["global"],
  defaultActiveScopes: ["global"],
  revision: () => "static",
  descriptors: {
    person: { label: (value) => value.name },
    note: { label: (value) => `note ${value.id}` },
  },
  actions: [
    p.actions.exact("person", { id: "people.open", action: "presentation.open", scopes: ["global"], test: () => available(), metadata: { label: "Open" }, bind: () => ({ kind: "open" }) }),
  ],
  // Two relations from a note to a person at the same scope: a genuine tie the chooser must offer.
  relations: [
    { id: "note.author", from: "note", to: "person", match: "exact", exposure: { acceptance: true }, apply: (r) => (r.type === "note" ? { type: "person", value: { id: r.value.author, name: "author" } } : undefined) },
    { id: "note.mentioned", from: "note", to: "person", match: "exact", exposure: { acceptance: true }, apply: (r) => (r.type === "note" ? { type: "person", value: { id: `${r.value.author}-m`, name: "mentioned" } } : undefined) },
  ],
});

const ADA: PresentationReference<Values> = { type: "person", value: { id: "1", name: "Ada" } };
const NOTE: PresentationReference<Values> = { type: "note", value: { id: "n1", author: "1" } };

function makePbui() {
  return createPbui<Values, { prefix: string }, Verb, Facts>({ presentation, defaultEnvironment: { prefix: "" }, contextFor: () => ({ facts: {}, revision: "static" }) });
}

afterEach(cleanup);

describe("accept through the runtime (§19.8)", () => {
  function Harness({ pbui, onResult }: { pbui: ReturnType<typeof makePbui>; onResult: (label: string, result: unknown) => void }) {
    const context = pbui.usePbui();
    return (
      <>
        <button type="button" onClick={() => void context.accept({ types: "person", prompt: "first" }).then((r) => onResult("first", r))}>
          start first
        </button>
        <button type="button" onClick={() => void context.accept({ types: "person", prompt: "second" }).then((r) => onResult("second", r))}>
          start second
        </button>
        <pbui.Presentation reference={ADA}>Ada</pbui.Presentation>
        <pbui.Presentation reference={NOTE}>note</pbui.Presentation>
        <pbui.AcceptBanner />
        <pbui.AcceptChooser />
      </>
    );
  }

  function mount() {
    const pbui = makePbui();
    const results: Array<[string, unknown]> = [];
    const onAccept = vi.fn();
    render(
      <pbui.Provider onPerform={() => undefined} onAccept={onAccept}>
        <Harness pbui={pbui} onResult={(label, r) => results.push([label, r])} />
      </pbui.Provider>,
    );
    return { results, onAccept };
  }

  test("an acceptable direct reference settles the request", async () => {
    const { results, onAccept } = mount();
    fireEvent.click(screen.getByText("start first"));
    expect(screen.getByRole("status").textContent).toContain("first");
    fireEvent.click(screen.getByRole("button", { name: "Ada" }));
    await act(async () => undefined);
    expect(results).toEqual([["first", ADA]]);
    expect(onAccept).toHaveBeenCalledWith(ADA);
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("a second request resolves null at once, without replacing the first, and onAccept is not told", async () => {
    const { results, onAccept } = mount();
    fireEvent.click(screen.getByText("start first"));
    fireEvent.click(screen.getByText("start second"));
    await act(async () => undefined);
    expect(results).toEqual([["second", null]]);
    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("first");
    fireEvent.click(screen.getByRole("button", { name: "Ada" }));
    await act(async () => undefined);
    expect(results).toEqual([["second", null], ["first", ADA]]);
  });

  test("an ambiguous acceptance opens the chooser; chooser Escape keeps the request; request Escape aborts it", async () => {
    const { results, onAccept } = mount();
    fireEvent.click(screen.getByText("start first"));
    fireEvent.click(screen.getByRole("button", { name: "note n1" }));
    expect(screen.getByRole("dialog", { name: /choose how to accept/ })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("first");
    expect(results).toEqual([]);
    fireEvent.keyDown(window, { key: "Escape" });
    await act(async () => undefined);
    expect(screen.queryByRole("status")).toBeNull();
    expect(results).toEqual([["first", null]]);
    expect(onAccept).toHaveBeenCalledWith(null);
  });

  test("choosing an option settles with that option's result", async () => {
    const { results } = mount();
    fireEvent.click(screen.getByText("start first"));
    fireEvent.click(screen.getByRole("button", { name: "note n1" }));
    const options = screen.getAllByRole("button", { name: /author|mentioned/ });
    fireEvent.click(options[1]!);
    await act(async () => undefined);
    expect(results).toEqual([["first", { type: "person", value: { id: "1-m", name: "mentioned" } }]]);
  });

  test("pointer and keyboard parity: Enter on an acceptable presentation settles like a click", async () => {
    const { results } = mount();
    fireEvent.click(screen.getByText("start first"));
    const ada = screen.getByRole("button", { name: "Ada" });
    expect(ada.getAttribute("data-state")).toBe("acceptable");
    fireEvent.keyDown(ada, { key: "Enter" });
    await act(async () => undefined);
    expect(results).toEqual([["first", ADA]]);
  });
});

describe("introspection through the context (§19.8)", () => {
  test("explain uses the menu query and, in public mode, lists exactly the menu's rows", () => {
    const pbui = makePbui();
    let captured: { rows: string[]; invocation: string; resolved: string[] } | null = null;
    function Probe() {
      const context = pbui.usePbui();
      const query = { subject: ADA, invocation: "menu" as const };
      const explanation = context.explain(query);
      captured = { rows: explanation.rows.map((r) => r.action), invocation: explanation.query.invocation, resolved: context.resolve(query).actions.map((a) => a.action) };
      return null;
    }
    render(
      <pbui.Provider onPerform={() => undefined}>
        <Probe />
      </pbui.Provider>,
    );
    expect(captured).toEqual({ rows: ["presentation.open"], invocation: "menu", resolved: ["presentation.open"] });
  });
});
