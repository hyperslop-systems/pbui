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
    fireEvent.focus(presentation);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.querySelector("button, a, input, [tabindex]")).toBeNull();
    // Opening help never moved focus.
    expect(document.activeElement).not.toBe(tooltip);
  });

  test("Escape closes open help", () => {
    const { pbui } = makePbui();
    renderWithHelp(pbui);
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
    fireEvent.focus(presentation);
    expect(screen.getByRole("tooltip")).toBeTruthy();

    fireEvent.contextMenu(presentation, { clientX: 10, clientY: 10 });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("menu")).toBeTruthy();
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
    fireEvent.focus(screen.getByRole("button", { name: "Ada" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
