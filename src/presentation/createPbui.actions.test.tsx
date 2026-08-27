import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  available,
  createActionRegistry,
  createPresentationTypeGraph,
  defineActions,
  unavailable,
} from "./actions";
import type { SelectionSnapshot } from "./actions";
import { createPbui } from "./createPbui";
import { createPresentationRegistry } from "./registry";

/**
 * PBUI-ACTIONS-2 P2 — the NEW capabilities, tested through the real
 * components. The pre-existing createPbui/instanceChrome suites are the
 * unchanged-behavior fence; this file covers what did not exist before:
 * a product-supplied kernel, the non-executable ambiguity row, and fresh
 * revalidation refusing a stale menu row.
 */

type Values = { file: { id: string } };
type Facts = { canOpen: boolean; version: number };
type Verb = { kind: string; version?: number };

const descriptors = createPresentationRegistry<Values, { name: string }>({
  file: { label: (value) => value.id },
});

const graph = createPresentationTypeGraph([{ id: "file" }]);
const define = defineActions<Values, Facts, Verb>();

function snapshotFrom(facts: () => Facts) {
  return (): SelectionSnapshot<Facts> => ({
    revision: facts().version,
    scopes: ["global"],
    modes: new Set(),
    capabilities: new Set(),
    product: facts(),
  });
}

function mount(
  registry: ReturnType<typeof createActionRegistry<Values, Facts, Verb>>,
  facts: () => Facts,
  onPerform = vi.fn(),
) {
  const pbui = createPbui<Values, { name: string }, Verb, Facts>({
    registry: descriptors,
    defaultEnvironment: { name: "α" },
    actions: registry,
    snapshotFor: snapshotFrom(facts),
  });
  render(
    <pbui.Provider onPerform={onPerform}>
      <pbui.Presentation reference={{ type: "file", value: { id: "f1" } }}>
        f1
      </pbui.Presentation>
      <pbui.ObjectMenu />
    </pbui.Provider>,
  );
  return { onPerform };
}

afterEach(cleanup);

describe("a product-supplied kernel drives the menu", () => {
  const open = define.exact("file", {
    id: "files.open",
    action: "presentation.open",
    scopes: ["global"],
    test: ({ snapshot }) =>
      snapshot.product.canOpen ? available() : unavailable("locked now"),
    metadata: { label: "Open" },
    bind: ({ snapshot }) => ({ kind: "open", version: snapshot.product.version }),
  });
  const registry = () =>
    createActionRegistry<Values, Facts, Verb>({
      graph,
      scopes: ["global"],
      contributions: [open],
    });

  test("clicking a resolved row delegates the FRESH verb", () => {
    const facts = { canOpen: true, version: 1 };
    const { onPerform } = mount(registry(), () => ({ ...facts }));
    fireEvent.contextMenu(screen.getByText("f1"));
    // State moves between menu render and click; the fresh verb carries it.
    facts.version = 2;
    fireEvent.click(screen.getByRole("menuitem", { name: /Open/ }));
    expect(onPerform).toHaveBeenCalledWith({ kind: "open", version: 2 });
  });

  test("a row that became unavailable after render is refused — onPerform never runs", () => {
    const facts = { canOpen: true, version: 1 };
    const { onPerform } = mount(registry(), () => ({ ...facts }));
    fireEvent.contextMenu(screen.getByText("f1"));
    facts.canOpen = false;
    fireEvent.click(screen.getByRole("menuitem", { name: /Open/ }));
    expect(onPerform).not.toHaveBeenCalled();
  });

  test("an unavailable row is visible, disabled, and explains itself", () => {
    const { onPerform } = mount(registry(), () => ({ canOpen: false, version: 1 }));
    fireEvent.contextMenu(screen.getByText("f1"));
    const row = screen.getByRole("menuitem", { name: /Open/ });
    expect((row as HTMLButtonElement).disabled).toBe(true);
    expect(row.textContent).toContain("locked now");
    expect(onPerform).not.toHaveBeenCalled();
  });
});

describe("ambiguity is data in the menu", () => {
  test("a tie renders a non-executable diagnostic row, and nothing else for that action", () => {
    const contested = (id: string) =>
      define.exact("file", {
        id,
        action: "presentation.open",
        scopes: ["global"],
        test: () => available(),
        metadata: { label: "Open" },
        bind: () => ({ kind: "open", version: 0 }),
      });
    const registry = createActionRegistry<Values, Facts, Verb>({
      graph,
      scopes: ["global"],
      contributions: [contested("plugin-a.open"), contested("plugin-b.open")],
    });
    const { onPerform } = mount(registry, () => ({ canOpen: true, version: 1 }));
    fireEvent.contextMenu(screen.getByText("f1"));

    expect(screen.queryByRole("menuitem", { name: /Open/ })).toBeNull();
    const note = document.querySelector('[data-part="menu-ambiguity"]');
    expect(note?.textContent).toContain("2 rules tie for presentation.open");
    expect(note?.tagName).not.toBe("BUTTON");
    fireEvent.click(note as Element);
    expect(onPerform).not.toHaveBeenCalled();
  });
});

describe("the primary invocation (PBUI-ACTIONS-3 A4)", () => {
  const primaryOpen = define.exact("file", {
    id: "files.primary-open",
    action: "presentation.open",
    scopes: ["global"],
    test: ({ snapshot }) =>
      snapshot.product.canOpen ? available() : unavailable("locked now"),
    metadata: { label: "Open", primary: true },
    bind: ({ snapshot }) => ({ kind: "open", version: snapshot.product.version }),
  });

  test("a left click performs the unique available primary action with the fresh verb", () => {
    const registry = createActionRegistry<Values, Facts, Verb>({
      graph,
      scopes: ["global"],
      contributions: [primaryOpen],
    });
    const facts = { canOpen: true, version: 1 };
    const { onPerform } = mount(registry, () => ({ ...facts }));
    facts.version = 2;
    fireEvent.click(screen.getByText("f1"));
    expect(onPerform).toHaveBeenCalledWith({ kind: "open", version: 2 });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("an unavailable primary falls back to opening the menu", () => {
    const registry = createActionRegistry<Values, Facts, Verb>({
      graph,
      scopes: ["global"],
      contributions: [primaryOpen],
    });
    const { onPerform } = mount(registry, () => ({ canOpen: false, version: 1 }));
    fireEvent.click(screen.getByText("f1"));
    expect(onPerform).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeNull();
  });

  test("two available primaries open the menu — nothing guesses", () => {
    const second = define.exact("file", {
      id: "files.primary-preview",
      action: "presentation.preview",
      scopes: ["global"],
      test: () => available(),
      metadata: { label: "Preview", primary: true },
      bind: () => ({ kind: "preview" }),
    });
    const registry = createActionRegistry<Values, Facts, Verb>({
      graph,
      scopes: ["global"],
      contributions: [primaryOpen, second],
    });
    const { onPerform } = mount(registry, () => ({ canOpen: true, version: 1 }));
    fireEvent.click(screen.getByText("f1"));
    expect(onPerform).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeNull();
  });
});

describe("typed accept and the chooser (PBUI-ACTIONS-2 P6)", () => {
  type AValues = {
    doc: { id: string };
    "image-doc": { id: string };
    tag: { name: string; docId: string };
  };
  type AFacts = Record<string, never>;
  type AVerb = { kind: string };

  const aDescriptors = createPresentationRegistry<AValues, Record<string, never>>({
    doc: { label: (value) => value.id },
    "image-doc": { label: (value) => value.id },
    tag: { label: (value) => value.name },
  });
  const aGraph = createPresentationTypeGraph([
    { id: "doc" },
    { id: "image-doc", parents: ["doc"] },
    { id: "tag" },
  ]);
  const aRegistry = createActionRegistry<AValues, AFacts, AVerb>({
    graph: aGraph,
    scopes: ["global"],
    contributions: [],
  });
  const aSnapshot = () => ({
    revision: 0,
    scopes: ["global"] as const,
    modes: new Set<string>(),
    capabilities: new Set<string>(),
    product: {},
  });

  function mountAccept(
    translators: readonly {
      id: string;
      from: string;
      to: string;
      match: "exact" | "subtypes";
      translate: (r: unknown) => unknown;
    }[],
  ) {
    const pbui = createPbui<AValues, Record<string, never>, AVerb, AFacts>({
      registry: aDescriptors,
      defaultEnvironment: {},
      actions: aRegistry,
      snapshotFor: aSnapshot,
      translators: translators as never,
    });
    const onAccept = vi.fn();
    let acceptResult: unknown = "unset";
    function Trigger() {
      const context = pbui.usePbui();
      return (
        <button
          type="button"
          onClick={() => void context.accept({ types: "doc", prompt: "pick" }).then((r) => (acceptResult = r))}
        >
          want-doc
        </button>
      );
    }
    render(
      <pbui.Provider onPerform={vi.fn()} onAccept={onAccept}>
        <Trigger />
        <pbui.Presentation reference={{ type: "image-doc", value: { id: "img-1" } }}>
          img-1
        </pbui.Presentation>
        <pbui.Presentation reference={{ type: "tag", value: { name: "urgent", docId: "d9" } }}>
          urgent
        </pbui.Presentation>
        <pbui.AcceptChooser />
      </pbui.Provider>,
    );
    return { onAccept, result: () => acceptResult };
  }

  test("a subtype satisfies the request with the ORIGINAL reference", () => {
    const { onAccept } = mountAccept([]);
    fireEvent.click(screen.getByText("want-doc"));
    fireEvent.click(screen.getByText("img-1"));
    expect(onAccept).toHaveBeenCalledWith({ type: "image-doc", value: { id: "img-1" } });
  });

  test("one translator edge settles; highlighting and clicking agree", () => {
    const { onAccept } = mountAccept([
      {
        id: "tag-to-doc",
        from: "tag",
        to: "doc",
        match: "exact",
        translate: (r) => {
          const reference = r as { type: string; value: { docId: string } };
          return { type: "doc", value: { id: reference.value.docId } };
        },
      },
    ]);
    fireEvent.click(screen.getByText("want-doc"));
    const tag = screen.getByText("urgent").closest('[data-pbui="presentation"]');
    expect(tag?.getAttribute("data-state")).toBe("acceptable");
    fireEvent.click(screen.getByText("urgent"));
    expect(onAccept).toHaveBeenCalledWith({ type: "doc", value: { id: "d9" } });
  });

  test("two tied edges open the chooser; Escape keeps the accept pending; a pick settles", () => {
    const edge = (id: string, suffix: string) => ({
      id,
      from: "tag",
      to: "doc",
      match: "exact" as const,
      translate: (r: unknown) => {
        const reference = r as { type: string; value: { docId: string } };
        return { type: "doc", value: { id: reference.value.docId + suffix } };
      },
    });
    const { onAccept } = mountAccept([edge("a.edge", "-a"), edge("b.edge", "-b")]);
    fireEvent.click(screen.getByText("want-doc"));
    fireEvent.click(screen.getByText("urgent"));

    // Nothing settled by itself; the chooser is on screen with both options.
    expect(onAccept).not.toHaveBeenCalled();
    const chooser = document.querySelector('[data-part="accept-chooser"]');
    expect(chooser).not.toBeNull();

    // Escape dismisses the chooser only — the accept request stays pending.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector('[data-part="accept-chooser"]')).toBeNull();
    expect(onAccept).not.toHaveBeenCalled();
    expect(
      screen.getByText("urgent").closest('[data-pbui="presentation"]')?.getAttribute("data-state"),
    ).toBe("acceptable");

    // Click again and pick the second option deliberately.
    fireEvent.click(screen.getByText("urgent"));
    const options = document.querySelectorAll('[data-part="accept-chooser-option"]');
    expect(options).toHaveLength(2);
    fireEvent.click(options[1] as Element);
    expect(onAccept).toHaveBeenCalledWith({ type: "doc", value: { id: "d9-b" } });
  });
});
