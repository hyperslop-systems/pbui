import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  builtinHelpItems,
  createHelpRendererRegistry,
  textHelp,
} from "../components/ContextHelp";
import {
  available,
  createActionRegistry,
  createPresentationTypeGraph,
  defineActions,
} from "./actions";
import type { SelectionSnapshot } from "./actions";
import { createPbui } from "./createPbui";
import { createHelpRegistry, defineHelp } from "./help";
import { createPresentationRegistry } from "./registry";

/**
 * PBUI-HELP-001 Phase 5 (design doc §18 "runtime tests"): the optional
 * hover/focus help surface, and — just as load-bearing — that a pbui with no
 * help configured behaves exactly as before.
 */

interface Values {
  person: { id: string; name: string };
}

type Verb = { type: "select"; id: string };
type Facts = { prefix: string };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ignorePerform = () => {};
const reference = { type: "person", value: { id: "1", name: "Ada" } } as const;

/**
 * Focus opens help only for KEYBOARD focus (the :focus-visible idea, tracked
 * via window-level keydown/pointerdown). Tests that open help through focus
 * establish keyboard modality first, the way a Tab press would.
 */
const byKeyboard = () => fireEvent.keyDown(window, { key: "Tab" });
const byPointer = (target: Element) => fireEvent.pointerDown(target);

function snapshotOf(environment: Facts): SelectionSnapshot<Facts> {
  return {
    revision: 0,
    scopes: ["global"],
    modes: new Set(),
    capabilities: new Set(),
    product: environment,
  };
}

function makePbui(options: { withHelp: boolean; helpText?: string } = { withHelp: true }) {
  const registry = createPresentationRegistry<Values, Facts>({
    person: { label: (person) => person.name },
  });
  const define = defineActions<Values, Facts, Verb>();
  const graph = createPresentationTypeGraph([{ id: "person" }]);
  const actions = createActionRegistry<Values, Facts, Verb>({
    graph,
    scopes: ["global"],
    contributions: [
      define.exact("person", {
        id: "test.person.select",
        action: "person.select",
        scopes: ["global"],
        test: () => available(),
        metadata: { label: "Select" },
        bind: ({ subject }) => ({ type: "select", id: subject.value.id }),
      }),
    ],
  });

  const defineH = defineHelp<Values, Facts>();
  const helpRegistry = createHelpRegistry<Values, Facts>({
    graph,
    scopes: ["global"],
    contributions: [
      defineH.exact("person", {
        id: "test.person.help",
        scopes: ["global"],
        help: ({ subject }) => [
          textHelp.create({
            id: "person.meaning",
            title: "Person",
            payload: { text: options.helpText ?? `${subject.value.name} is a person` },
          }),
        ],
      }),
    ],
  });
  const resolveSpy = vi.spyOn(helpRegistry, "resolve");

  const pbui = createPbui({
    registry,
    defaultEnvironment: { prefix: "" },
    actions,
    snapshotFor: (_query, environment) => snapshotOf(environment),
    ...(options.withHelp
      ? { help: helpRegistry, helpRenderers: createHelpRendererRegistry(builtinHelpItems) }
      : {}),
  });
  return { pbui, resolveSpy };
}

function renderWithHelp(pbui: ReturnType<typeof makePbui>["pbui"]) {
  return render(
    <pbui.Provider onPerform={ignorePerform}>
      <pbui.Presentation reference={reference}>Ada</pbui.Presentation>
      <pbui.ObjectMenu />
      <pbui.ContextHelp />
    </pbui.Provider>,
  );
}

describe("no configured help", () => {
  test("preserves today's DOM and event behavior exactly", () => {
    const { pbui } = makePbui({ withHelp: false });
    vi.useFakeTimers();
    const { container } = renderWithHelp(pbui);
    const presentation = screen.getByRole("button", { name: "Ada" });
    fireEvent.mouseEnter(presentation);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.focus(presentation);
    expect(container.querySelector('[data-part="context-help"]')).toBeNull();
    expect(presentation.getAttribute("aria-describedby")).toBeNull();
  });
});

describe("lazy resolution", () => {
  test("rendering resolves nothing; the hover gesture resolves once, after the delay", () => {
    const { pbui, resolveSpy } = makePbui();
    vi.useFakeTimers();
    renderWithHelp(pbui);
    expect(resolveSpy).not.toHaveBeenCalled();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Ada" }));
    expect(resolveSpy).not.toHaveBeenCalled(); // armed, not resolved
    act(() => {
      vi.advanceTimersByTime(349);
    });
    expect(resolveSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tooltip").textContent).toContain("Ada is a person");
  });

  test("leaving before the delay cancels the pending open", () => {
    const { pbui, resolveSpy } = makePbui();
    vi.useFakeTimers();
    renderWithHelp(pbui);
    const presentation = screen.getByRole("button", { name: "Ada" });
    fireEvent.mouseEnter(presentation);
    fireEvent.mouseLeave(presentation);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("hover and focus parity", () => {
  test("focus opens the SAME content immediately; blur closes it", () => {
    const { pbui } = makePbui();
    vi.useFakeTimers();
    renderWithHelp(pbui);
    const presentation = screen.getByRole("button", { name: "Ada" });

    fireEvent.mouseEnter(presentation);
    act(() => {
      vi.advanceTimersByTime(350);
    });
    const hoverContent = screen.getByRole("tooltip").textContent;
    fireEvent.mouseLeave(presentation);
    expect(screen.queryByRole("tooltip")).toBeNull();

    byKeyboard();
    fireEvent.focus(presentation);
    expect(screen.getByRole("tooltip").textContent).toBe(hoverContent);
    fireEvent.blur(presentation);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("accessibility contract", () => {
  test("aria-describedby points at the tooltip only while open", () => {
    const { pbui } = makePbui();
    renderWithHelp(pbui);
    const presentation = screen.getByRole("button", { name: "Ada" });
    expect(presentation.getAttribute("aria-describedby")).toBeNull();

    byKeyboard();
    fireEvent.focus(presentation);
    const tooltip = screen.getByRole("tooltip");
    expect(presentation.getAttribute("aria-describedby")).toBe(tooltip.id);
    expect(tooltip.id.length).toBeGreaterThan(0);

    fireEvent.blur(presentation);
    expect(presentation.getAttribute("aria-describedby")).toBeNull();
  });

  test("the surface is non-interactive: role tooltip, no focusable content", () => {
    const { pbui } = makePbui();
    renderWithHelp(pbui);
    const presentation = screen.getByRole("button", { name: "Ada" });
    byKeyboard();
    fireEvent.focus(presentation);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.querySelector("button, a, input, [tabindex]")).toBeNull();
    // Opening help never moved focus.
    expect(document.activeElement).not.toBe(tooltip);
  });

  test("Escape closes open help", () => {
    const { pbui } = makePbui();
    renderWithHelp(pbui);
    byKeyboard();
    fireEvent.focus(screen.getByRole("button", { name: "Ada" }));
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("surface interplay", () => {
  test("opening the object menu closes help", () => {
    const { pbui } = makePbui();
    renderWithHelp(pbui);
    const presentation = screen.getByRole("button", { name: "Ada" });
    byKeyboard();
    fireEvent.focus(presentation);
    expect(screen.getByRole("tooltip")).toBeTruthy();

    fireEvent.contextMenu(presentation, { clientX: 10, clientY: 10 });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  test("performing a menu action does not reopen help through focus return", async () => {
    const { pbui } = makePbui();
    renderWithHelp(pbui);
    const presentation = screen.getByRole("button", { name: "Ada" });

    fireEvent.contextMenu(presentation, { clientX: 10, clientY: 10 });
    const item = screen.getByRole("menuitem", { name: "Select" });
    // A real click is preceded by pointerdown — that is what marks the
    // interaction as pointer-modal, so the menu's focus RETURN to the
    // presentation must not open the card the gesture never asked for.
    byPointer(item);
    fireEvent.click(item);
    await act(async () => Promise.resolve());
    expect(document.activeElement).toBe(presentation);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  test("KEYBOARD menu dismissal does not reopen help through focus return", async () => {
    const { pbui } = makePbui();
    renderWithHelp(pbui);
    const presentation = screen.getByRole("button", { name: "Ada" });

    // Keyboard user: focus opens help, Shift+F10 opens the menu (closing
    // help), Escape closes the menu. Modality stays keyboard throughout, so
    // only the focus-restore mark can tell the returned focus apart.
    byKeyboard();
    fireEvent.focus(presentation);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(presentation, { key: "F10", shiftKey: true });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    await act(async () => Promise.resolve());
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(presentation);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  test("moving the pointer into the card keeps it open; leaving the card closes it", () => {
    const { pbui } = makePbui();
    vi.useFakeTimers();
    renderWithHelp(pbui);
    const presentation = screen.getByRole("button", { name: "Ada" });
    fireEvent.mouseEnter(presentation);
    act(() => {
      vi.advanceTimersByTime(350);
    });
    const tooltip = screen.getByRole("tooltip");

    // Overflowing help is scrollable only if the pointer can reach the card.
    fireEvent.mouseLeave(presentation, { relatedTarget: tooltip });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.mouseLeave(tooltip, { relatedTarget: document.body });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  test("PageDown pages keyboard-opened help; hover-opened help keeps the keys", () => {
    const { pbui } = makePbui();
    vi.useFakeTimers();
    renderWithHelp(pbui);
    const presentation = screen.getByRole("button", { name: "Ada" });

    byKeyboard();
    fireEvent.focus(presentation);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    // fireEvent returns false when a handler called preventDefault.
    expect(fireEvent.keyDown(window, { key: "PageDown" })).toBe(false);
    fireEvent.blur(presentation);

    fireEvent.mouseEnter(presentation);
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    expect(fireEvent.keyDown(window, { key: "PageDown" })).toBe(true);
  });

  test("an armed hover timer never fires over an open menu (PR #20 r4)", () => {
    const { pbui, resolveSpy } = makePbui();
    vi.useFakeTimers();
    renderWithHelp(pbui);
    const presentation = screen.getByRole("button", { name: "Ada" });

    // Enter, then open the menu INSIDE the 350ms window: the arm must die
    // with the menu opening, not fire help on top of it.
    fireEvent.mouseEnter(presentation);
    fireEvent.contextMenu(presentation, { clientX: 10, clientY: 10 });
    expect(screen.getByRole("menu")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(resolveSpy).not.toHaveBeenCalled();
  });

  test("the card carries its placement side from the pure geometry", () => {
    const { pbui } = makePbui();
    renderWithHelp(pbui);
    byKeyboard();
    fireEvent.focus(screen.getByRole("button", { name: "Ada" }));
    const tooltip = screen.getByRole("tooltip");
    // jsdom has no layout, so rects are zero — but the placement pipeline
    // must still have run and stamped a side.
    expect(tooltip.getAttribute("data-side")).toMatch(/^(below|above)$/);
    expect(tooltip.style.maxHeight).not.toBe("");
  });

  test("unmounting the presentation closes its open card", () => {
    const { pbui } = makePbui();
    vi.useFakeTimers();
    const view = (show: boolean) => (
      <pbui.Provider onPerform={ignorePerform}>
        {show && <pbui.Presentation reference={reference}>Ada</pbui.Presentation>}
        <pbui.ContextHelp />
      </pbui.Provider>
    );
    const { rerender } = render(view(true));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Ada" }));
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();

    // A virtualized collection drops the row: no mouseleave, no blur — the
    // card must not linger anchored to a detached element.
    rerender(view(false));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  test("clicking the presentation itself opens no card either", () => {
    const { pbui } = makePbui();
    vi.useFakeTimers();
    renderWithHelp(pbui);
    const presentation = screen.getByRole("button", { name: "Ada" });
    // Focus-follows-click: pointerdown, then the element receives focus.
    byPointer(presentation);
    fireEvent.focus(presentation);
    expect(screen.queryByRole("tooltip")).toBeNull();
    // The pointer path still works afterwards, on its own delay.
    fireEvent.mouseEnter(presentation);
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  test("an empty resolution opens no card at all", () => {
    const registry = createPresentationRegistry<Values, Facts>({
      person: { label: (person) => person.name },
    });
    const graph = createPresentationTypeGraph([{ id: "person" }]);
    const define = defineActions<Values, Facts, Verb>();
    const defineH = defineHelp<Values, Facts>();
    const pbui = createPbui({
      registry,
      defaultEnvironment: { prefix: "" },
      actions: createActionRegistry<Values, Facts, Verb>({
        graph,
        scopes: ["global"],
        contributions: [
          define.exact("person", {
            id: "test.person.select",
            action: "person.select",
            scopes: ["global"],
            metadata: { label: "Select" },
            bind: ({ subject }) => ({ type: "select", id: subject.value.id }),
          }),
        ],
      }),
      snapshotFor: (_query, environment) => snapshotOf(environment),
      help: createHelpRegistry<Values, Facts>({
        graph,
        scopes: ["global"],
        contributions: [
          defineH.exact("person", {
            id: "test.person.help",
            scopes: ["global"],
            // Never available ⇒ every resolution is empty.
            test: () => ({ kind: "unavailable", because: "no help here" }),
            help: () => [textHelp.create({ id: "never", payload: { text: "never" } })],
          }),
        ],
      }),
      helpRenderers: createHelpRendererRegistry(builtinHelpItems),
    });
    renderWithHelp(pbui);
    byKeyboard();
    fireEvent.focus(screen.getByRole("button", { name: "Ada" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
