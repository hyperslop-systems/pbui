import type { ReactElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { createPbui } from "./createPbui";
import { createPresentationRegistry } from "./registry";

interface Values {
  person: { id: string; name: string };
}

type Verb = { type: "select"; id: string };

afterEach(cleanup);

function makePbui() {
  const registry = createPresentationRegistry<Values, { prefix: string }, Verb>({
    person: {
      label: (person, environment) => `${environment.prefix}${person.name}`,
      actions: (person) => [
        {
          id: "select",
          label: "Select",
          verb: { type: "select", id: person.id },
        },
      ],
    },
  });

  return createPbui({
    registry,
    defaultEnvironment: { prefix: "" },
  });
}

describe("createPbui", () => {
  test("keeps provider environments isolated", () => {
    const pbui = makePbui();
    const reference = { type: "person", value: { id: "1", name: "Ada" } } as const;

    render(
      <>
        <pbui.Provider environment={{ prefix: "A: " }}>
          <pbui.Presentation reference={reference}>A: Ada</pbui.Presentation>
        </pbui.Provider>
        <pbui.Provider environment={{ prefix: "B: " }}>
          <pbui.Presentation reference={reference}>B: Ada</pbui.Presentation>
        </pbui.Provider>
      </>,
    );

    expect(screen.getByRole("button", { name: "A: Ada" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "B: Ada" })).toBeTruthy();
  });

  test("opens a descriptor menu and performs its verb", () => {
    const pbui = makePbui();
    const performed: Verb[] = [];
    const reference = { type: "person", value: { id: "1", name: "Ada" } } as const;

    render(
      <pbui.Provider
        onPerform={(verb) => {
          performed.push(verb);
        }}
      >
        <pbui.Presentation reference={reference}>Ada</pbui.Presentation>
        <pbui.ObjectMenu />
      </pbui.Provider>,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "Ada" }), {
      clientX: 20,
      clientY: 30,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Select" }));

    expect(performed).toEqual([{ type: "select", id: "1" }]);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("resolves typed accept requests", async () => {
    const pbui = makePbui();
    const reference = { type: "person", value: { id: "1", name: "Ada" } } as const;
    let result: Promise<unknown> | undefined;

    function Acceptor() {
      const context = pbui.usePbui();
      return (
        <button
          type="button"
          onClick={() => {
            result = context.accept({ types: "person", prompt: "Choose a person" });
          }}
        >
          Start
        </button>
      );
    }

    render(
      <pbui.Provider>
        <Acceptor />
        <pbui.Presentation reference={reference}>Ada</pbui.Presentation>
      </pbui.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.click(screen.getByRole("button", { name: "Ada" }));

    await act(async () => {
      expect(await result).toEqual(reference);
    });
  });

  /**
   * Inside a composite widget, the container keeps the tab stop.
   *
   * A presentation defaults to `role="button" tabindex="0"`, which is right
   * standalone and wrong inside a `tree`/`grid`/`listbox` item: two competing
   * navigation models for a screen-reader user, and a Tab key that lands
   * inside rows instead of moving past the widget.
   */
  describe("composite-widget semantics", () => {
    const reference = { type: "person", value: { id: "1", name: "Ada" } } as const;

    test("is a button with a tab stop when it stands alone", () => {
      const pbui = makePbui();
      render(
        <pbui.Provider>
          <pbui.Presentation reference={reference}>Ada</pbui.Presentation>
        </pbui.Provider>,
      );
      const el = screen.getByRole("button", { name: "Ada" });
      expect(el.getAttribute("tabindex")).toBe("0");
    });

    test("yields role and tab stop to the container when inComposite", () => {
      const pbui = makePbui();
      const { container } = render(
        <pbui.Provider>
          <div role="tree">
            <div role="treeitem" tabIndex={-1}>
              <pbui.Presentation reference={reference} inComposite>
                Ada
              </pbui.Presentation>
            </div>
          </div>
        </pbui.Provider>,
      );
      expect(screen.queryByRole("button")).toBeNull();
      const el = container.querySelector('[data-pbui="presentation"]') as HTMLElement;
      expect(el.getAttribute("role")).toBe("none");
      expect(el.getAttribute("tabindex")).toBe("-1");
      // One tab stop for the whole widget, and it is the treeitem's.
      expect(container.querySelectorAll('[tabindex="0"]').length).toBe(0);
    });
  });

  /**
   * A click reaches the host, and stops at the first Presentation ancestor.
   *
   * P4.1 removed the unconditional `stopPropagation()` so that a Presentation
   * wrapping an organism's row content no longer swallows the row's own
   * gesture. That alone would have introduced a different bug: an inner
   * Presentation's click would bubble into an OUTER Presentation, which would
   * open its menu on a click meant for the child. Nothing nests presentations
   * today, but the accept flow makes it a natural shape — an acceptable object
   * containing presented children — and marking the native event is cheaper
   * than finding out later.
   */
  describe("click propagation", () => {
    const reference = { type: "person", value: { id: "1", name: "Ada" } } as const;

    test("lets the host element see a click it activated on", () => {
      const pbui = makePbui();
      const hostClicks: string[] = [];
      const activated: string[] = [];

      render(
        <pbui.Provider>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div onClick={() => hostClicks.push("host")}>
            <pbui.Presentation
              reference={reference}
              activate={{ run: () => activated.push("presentation") }}
            >
              Ada
            </pbui.Presentation>
          </div>
        </pbui.Provider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Ada" }));
      expect(activated).toEqual(["presentation"]);
      // The whole point: the host is not deprived of its own click.
      expect(hostClicks).toEqual(["host"]);
    });

    test("still swallows the click when it opens the menu", () => {
      const pbui = makePbui();
      const hostClicks: string[] = [];

      render(
        <pbui.Provider>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div onClick={() => hostClicks.push("host")}>
            <pbui.Presentation reference={reference}>Ada</pbui.Presentation>
          </div>
          <pbui.ObjectMenu />
        </pbui.Provider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Ada" }));
      // Opening a menu IS this element acting, so the host must not also fire —
      // a menu-open that selects the row underneath is wrong.
      expect(screen.queryByRole("menu")).toBeTruthy();
      expect(hostClicks).toEqual([]);
    });

    test("Enter reaches the host too, exactly as a click does", () => {
      // P4.1 made the CLICK bubble and left the keyboard path calling `run`
      // directly, so the two diverged: Enter ran the presentation's verb and
      // the host never saw it.
      const pbui = makePbui();
      const hostClicks: string[] = [];
      const activated: string[] = [];

      render(
        <pbui.Provider>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div onClick={() => hostClicks.push("host")}>
            <pbui.Presentation
              reference={reference}
              activate={{ run: () => activated.push("presentation") }}
            >
              Ada
            </pbui.Presentation>
          </div>
        </pbui.Provider>,
      );

      fireEvent.keyDown(screen.getByRole("button", { name: "Ada" }), { key: "Enter" });
      expect(activated).toEqual(["presentation"]);
      expect(hostClicks).toEqual(["host"]);
    });

    test("Enter reaches the host when activate has no run at all", () => {
      // The `renderRow` shape: the host owns the click entirely and `activate`
      // exists only to say a left click means the default verb. This was a
      // complete keyboard no-op.
      const pbui = makePbui();
      const hostClicks: string[] = [];

      render(
        <pbui.Provider>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div onClick={() => hostClicks.push("host")}>
            <pbui.Presentation reference={reference} activate={{ doc: "select" }}>
              Ada
            </pbui.Presentation>
          </div>
        </pbui.Provider>,
      );

      fireEvent.keyDown(screen.getByRole("button", { name: "Ada" }), { key: "Enter" });
      expect(hostClicks).toEqual(["host"]);
    });

    test("an inner Presentation's click does not reach an outer one", () => {
      const pbui = makePbui();
      const runs: string[] = [];

      render(
        <pbui.Provider>
          <pbui.Presentation
            reference={{ type: "person", value: { id: "outer", name: "Outer" } }}
            activate={{ run: () => runs.push("outer") }}
            block
          >
            <pbui.Presentation reference={reference} activate={{ run: () => runs.push("inner") }}>
              Ada
            </pbui.Presentation>
          </pbui.Presentation>
        </pbui.Provider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Ada" }));
      expect(runs).toEqual(["inner"]);
    });
  });

  /**
   * `activate` describes the left click in the mouse-doc strip.
   *
   * These two were `onActivate?: () => void` and `activateDoc?: string`, and
   * the doc was read only inside the branch that tested the handler — so a doc
   * without a handler type-checked, rendered nothing, and said nothing. P3.4
   * merged them into one prop, and this is the behaviour that merge has to
   * preserve. It had no test before.
   */
  describe("the mouse-doc line describes what a left click will do", () => {
    function hover(node: ReactElement, pbui: ReturnType<typeof makePbui>) {
      const { container } = render(
        <pbui.Provider>
          {node}
          <pbui.MouseDocLine />
        </pbui.Provider>,
      );
      fireEvent.mouseEnter(screen.getByRole("button", { name: /Ada/ }));
      // The visible span specifically: MouseDocLine renders the same string
      // twice, once for the eye and once in a polite live region, so a text
      // query matches both.
      return container.querySelector('[data-part="mouse-doc-text"]')?.textContent ?? "";
    }

    const reference = { type: "person", value: { id: "1", name: "Ada" } } as const;

    test("names the verb when the presentation has one", () => {
      const pbui = makePbui();
      const text = hover(
        <pbui.Presentation reference={reference} activate={{ run: () => {}, doc: "open the file" }}>
          Ada
        </pbui.Presentation>,
        pbui,
      );
      expect(text).toContain("L: open the file");
      expect(text).toContain("R: menu");
    });

    test("falls back to 'activate' when the verb is unnamed", () => {
      const pbui = makePbui();
      const text = hover(
        <pbui.Presentation reference={reference} activate={{ run: () => {} }}>
          Ada
        </pbui.Presentation>,
        pbui,
      );
      expect(text).toContain("L: activate");
    });

    test("says both buttons open the menu when there is no verb", () => {
      const pbui = makePbui();
      const text = hover(<pbui.Presentation reference={reference}>Ada</pbui.Presentation>, pbui);
      expect(text).toContain("L/R: menu");
    });
  });

  /**
   * The object menu explains unavailability ONLY when the action is unavailable.
   *
   * The menu used to guard both the reason text and the `title` on
   * `disabledReason` being SET rather than on the action being disabled, so an
   * action that worked fine displayed an explanation of why it could not be
   * used — "Focus this term — the cursor is already here", on a row where
   * focusing worked. Fifteen live sites across three products, plus pbui's own
   * `Pbui.stories.tsx:30`.
   *
   * P3.1 then merged the pair into `disabledBecause`, which is what the
   * descriptor below now uses. These assertions did not change across that
   * merge — which is the point of keeping them: they pin the BEHAVIOUR (a
   * reason appears only on an unavailable action) independently of whichever
   * shape expresses it.
   */
  describe("a disabled reason belongs to a disabled action", () => {
    type MenuVerb = { type: "focus"; id: string };

    function menuPbui() {
      const registry = createPresentationRegistry<Values, { focused: string }, MenuVerb>({
        person: {
          label: (person) => person.name,
          actions: (person, environment) => [
            {
              id: "focus",
              label: "Focus",
              verb: { type: "focus", id: person.id },
              description: "bring this person into view",
              // One field. Under the two-field API this read
              //     disabled: environment.focused === person.id,
              //     disabledReason: "the cursor is already here",
              // which is how every real descriptor wrote it: a predicate and a
              // prose explanation OF that predicate, evaluated independently.
              disabledBecause:
                environment.focused === person.id ? "the cursor is already here" : undefined,
            },
          ],
        },
      });
      return createPbui({ registry, defaultEnvironment: { focused: "" } });
    }

    function openMenuFor(focused: string) {
      const pbui = menuPbui();
      render(
        <pbui.Provider environment={{ focused }}>
          <pbui.Presentation reference={{ type: "person", value: { id: "1", name: "Ada" } }}>
            Ada
          </pbui.Presentation>
          <pbui.ObjectMenu />
        </pbui.Provider>,
      );
      fireEvent.contextMenu(screen.getByRole("button", { name: "Ada" }), {
        clientX: 1,
        clientY: 1,
      });
      return screen.getByRole("menuitem", { name: /Focus/ });
    }

    test("shows no reason on an enabled action, and keeps its description", () => {
      const item = openMenuFor("someone-else");

      expect(item.hasAttribute("disabled")).toBe(false);
      // The defect: this used to be "Focus — the cursor is already here".
      expect(item.textContent).toBe("Focus");
      expect(item.querySelector('[data-part="menu-reason"]')).toBeNull();
      // And the description used to be replaced by the inapplicable reason.
      expect(item.getAttribute("title")).toBe("bring this person into view");
    });

    test("shows the reason on a disabled action", () => {
      const item = openMenuFor("1");

      expect(item.hasAttribute("disabled")).toBe(true);
      expect(item.textContent).toBe("Focus — the cursor is already here");
      expect(item.querySelector('[data-part="menu-reason"]')?.textContent).toBe(
        " — the cursor is already here",
      );
      expect(item.getAttribute("title")).toBe("the cursor is already here");
    });
  });
});
