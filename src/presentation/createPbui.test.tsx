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
   * The object menu explains unavailability ONLY when the action is unavailable.
   *
   * The menu used to guard both the reason text and the `title` on
   * `disabledReason` being SET rather than on the action being disabled, so an
   * action that worked fine displayed an explanation of why it could not be
   * used — "Focus this term — the cursor is already here", on a row where
   * focusing worked. Fifteen live sites across three products, plus pbui's own
   * `Pbui.stories.tsx:30`.
   *
   * The descriptor below is written the way descriptor authors write them, and
   * the way all fifteen sites are written: a conditional `disabled` beside an
   * unconditional reason. That pairing reads as one unit and is evaluated as
   * two, which is the entire defect.
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
              // The shape every real descriptor uses: predicate, then prose.
              disabled: environment.focused === person.id,
              disabledReason: "the cursor is already here",
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
