/**
 * MouseDocLine and AcceptBanner (PBUI-UNIFY-001 Phase 1, DR-U2): the two
 * instance-bound chrome strips previously transcribed per product, now
 * returned from createPbui like ObjectMenu.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { createPbui } from "./createPbui";
import { createPresentationRegistry } from "./registry";

interface Values {
  person: { id: string; name: string };
}

type Verb = { type: "select"; id: string };

afterEach(cleanup);

function makePbui() {
  const registry = createPresentationRegistry<Values, Record<string, never>, Verb>({
    person: {
      label: (person) => person.name,
      actions: () => [],
    },
  });
  return createPbui({ registry, defaultEnvironment: {} });
}

describe("MouseDocLine", () => {
  test("shows READY, the idle doc, and the ambient", () => {
    const pbui = makePbui();
    render(
      <pbui.Provider>
        <pbui.MouseDocLine ambient="3 workspaces" />
      </pbui.Provider>,
    );
    expect(screen.getByText("READY")).toBeTruthy();
    expect(screen.getAllByText(/hover anything · L is the default verb/).length).toBeGreaterThan(0);
    expect(screen.getByText("3 workspaces")).toBeTruthy();
  });

  test("shows the hovered presentation's doc and ACCEPT MODE while accepting", async () => {
    const pbui = makePbui();
    const reference = { type: "person", value: { id: "1", name: "Ada" } } as const;

    function Arm() {
      const context = pbui.usePbui();
      return (
        <button type="button" onClick={() => void context.accept({ types: "person", prompt: "pick a person" })}>
          arm
        </button>
      );
    }

    render(
      <pbui.Provider>
        <pbui.Presentation reference={reference} doc="<person> Ada">
          Ada
        </pbui.Presentation>
        <Arm />
        <pbui.MouseDocLine />
      </pbui.Provider>,
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: "<person> Ada" }));
    expect(screen.getAllByText(/<person> Ada/).length).toBeGreaterThan(0);
    fireEvent.mouseLeave(screen.getByRole("button", { name: "<person> Ada" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "arm" }));
    });
    expect(screen.getByText("ACCEPT MODE")).toBeTruthy();
    expect(screen.getAllByText(/pick a person/).length).toBeGreaterThan(0);
  });
});

describe("AcceptBanner", () => {
  test("is absent when idle, present while accepting, and Escape aborts", async () => {
    const pbui = makePbui();
    let settled: unknown = "unsettled";

    function Arm() {
      const context = pbui.usePbui();
      return (
        <button
          type="button"
          onClick={() =>
            void context.accept({ types: "person", prompt: "pick" }).then((result) => {
              settled = result;
            })
          }
        >
          arm
        </button>
      );
    }

    render(
      <pbui.Provider>
        <Arm />
        <pbui.AcceptBanner />
      </pbui.Provider>,
    );

    expect(screen.queryByRole("status")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "arm" }));
    });
    expect(screen.getByRole("status").textContent).toContain("ACCEPTING <person>");

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(settled).toBeNull();
  });
});

describe("presentation-parts.css", () => {
  // The incident regression (PBUI-UNIFY-001 §1): an unpositioned menu renders
  // invisibly at the end of the document. The shipped default MUST position it.
  test("positions the object menu fixed and above content", () => {
    // cwd-relative: vitest runs from the package root (import.meta.url is not
    // file-scheme under this vitest setup — the same constraint the
    // workbench-protocol tests hit).
    const css = readFileSync("public/presentation-parts.css", "utf8");
    const menuRule = css.split('[data-part="menu"]')[1] ?? "";
    expect(menuRule).toContain("position: fixed");
    expect(menuRule).toContain("z-index: 100");
    // And the affordance layer exists at all.
    expect(css).toContain('[data-part="presentation"]:hover');
    expect(css).toContain('[data-state="acceptable"]');
  });
});
