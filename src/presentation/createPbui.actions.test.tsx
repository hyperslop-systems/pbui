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

const descriptors = createPresentationRegistry<Values, { name: string }, Verb>({
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

describe("the automatic legacy engine", () => {
  test("without actions/snapshotFor, descriptor actions() still drives the menu — one engine", () => {
    const legacyDescriptors = createPresentationRegistry<Values, { name: string }, Verb>({
      file: {
        label: (value) => value.id,
        actions: (value, environment) => [
          {
            id: "file.open",
            label: `Open in ${environment.name}`,
            verb: { kind: "open.legacy", version: value.id.length },
          },
        ],
      },
    });
    const pbui = createPbui<Values, { name: string }, Verb>({
      registry: legacyDescriptors,
      defaultEnvironment: { name: "α" },
    });
    const onPerform = vi.fn();
    render(
      <pbui.Provider onPerform={onPerform}>
        <pbui.Presentation reference={{ type: "file", value: { id: "f1" } }}>
          f1
        </pbui.Presentation>
        <pbui.ObjectMenu />
      </pbui.Provider>,
    );
    fireEvent.contextMenu(screen.getByText("f1"));
    fireEvent.click(screen.getByRole("menuitem", { name: /Open in α/ }));
    expect(onPerform).toHaveBeenCalledWith({ kind: "open.legacy", version: 2 });
  });

  test("actions without snapshotFor is a construction error", () => {
    expect(() =>
      createPbui<Values, { name: string }, Verb, Facts>({
        registry: descriptors,
        defaultEnvironment: { name: "α" },
        actions: createActionRegistry<Values, Facts, Verb>({
          graph,
          scopes: ["global"],
          contributions: [],
        }),
      }),
    ).toThrow(/requires `snapshotFor`/);
  });
});
