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
          <pbui.Presentation reference={reference} />
        </pbui.Provider>
        <pbui.Provider environment={{ prefix: "B: " }}>
          <pbui.Presentation reference={reference} />
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
        <pbui.Presentation reference={reference} />
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
        <pbui.Presentation reference={reference} />
      </pbui.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.click(screen.getByRole("button", { name: "Ada" }));

    await act(async () => {
      expect(await result).toEqual(reference);
    });
  });
});
