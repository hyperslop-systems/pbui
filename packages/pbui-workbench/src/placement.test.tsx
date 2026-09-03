import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { layout, split, tile } from "@hyperslop-systems/workbench-core";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { createWorkbench } from "./createWorkbenchShell";
import { demoApps } from "./stories/demoApps";
import type { PlacementOutcome } from "./placement";

afterEach(cleanup);

/**
 * Placement mode's tests drive the real carry through real pointer events,
 * because the thing worth guarding is the SEAM: a capture-phase pointerdown
 * over a tile with real geometry, classified into a zone, arriving as an aim.
 * A fake hit test would test the promise and nothing else.
 */
function twoTiles() {
  const wb = createWorkbench({
    apps: demoApps,
    initial: layout(split("row", 0.5, tile("counter"), tile("notes"))),
  });
  const view = render(<wb.Surface />);
  // Tile A spans 0..600, tile B spans 700..1300: a click at 710 is B's left edge.
  [...view.baseElement.querySelectorAll<HTMLElement>('[data-part="tile"]')].forEach((element, index) => {
    element.getBoundingClientRect = () =>
      ({
        left: index * 700,
        top: 0,
        right: index * 700 + 600,
        bottom: 600,
        width: 600,
        height: 600,
        x: index * 700,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  });
  const ids = leaves(wb.core.getState().document.workspaces[0]?.tree).map((leaf) => leaf.id);
  return { wb, view, a: ids[0]!, b: ids[1]! };
}

describe("placement mode (5.E)", () => {
  test("begin() resolves with the tile and zone the user aimed at", async () => {
    const { wb, b } = twoTiles();
    let outcome: PlacementOutcome | null = null;
    act(() => {
      void wb.placement.begin({ prompt: "placing Basic.lean" }).then((result) => {
        outcome = result;
      });
    });
    expect(wb.placement.current()?.prompt).toBe("placing Basic.lean");
    await act(async () => {
      fireEvent(window, new MouseEvent("pointerdown", { clientX: 710, clientY: 300, bubbles: true }));
    });
    expect(outcome).toEqual({ kind: "aimed", placementId: b, zone: "left" });
    // The controller PERFORMS nothing: the caller decides what an aim means.
    expect(leaves(wb.core.getState().document.workspaces[0]?.tree)).toHaveLength(2);
    expect(wb.placement.current()).toBeNull();
  });

  test("Alt aims at replace; Escape and an empty-space click both cancel", async () => {
    const { wb, a } = twoTiles();
    let outcome: PlacementOutcome | null = null;
    const begin = () => {
      outcome = null;
      act(() => {
        void wb.placement.begin({ prompt: "placing" }).then((result) => {
          outcome = result;
        });
      });
    };

    begin();
    await act(async () => {
      fireEvent(window, new MouseEvent("pointerdown", { clientX: 300, clientY: 300, altKey: true, bubbles: true }));
    });
    expect(outcome).toEqual({ kind: "aimed", placementId: a, zone: "replace" });

    begin();
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(outcome).toEqual({ kind: "cancelled" });

    begin();
    await act(async () => {
      // Nowhere near a tile: aiming at nothing is a cancel, not a place.
      fireEvent(window, new MouseEvent("pointerdown", { clientX: 5000, clientY: 5000, bubbles: true }));
    });
    expect(outcome).toEqual({ kind: "cancelled" });
  });

  test("Enter resolves as default only when a defaultLabel names what it would do", async () => {
    const { wb } = twoTiles();
    let outcome: PlacementOutcome | null = null;
    act(() => {
      void wb.placement.begin({ prompt: "placing", defaultLabel: "beside the active tile" }).then((result) => {
        outcome = result;
      });
    });
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(outcome).toEqual({ kind: "default" });

    // Without one, Enter is inert: the mode is still live afterwards.
    outcome = null;
    act(() => {
      void wb.placement.begin({ prompt: "placing" }).then((result) => {
        outcome = result;
      });
    });
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(outcome).toBeNull();
    expect(wb.placement.current()).not.toBeNull();
    wb.placement.cancel();
  });

  test("a refused aim re-arms rather than ending the mode", async () => {
    const { wb, a, b } = twoTiles();
    const refused: string[] = [];
    let outcome: PlacementOutcome | null = null;
    act(() => {
      void wb.placement
        .begin({
          prompt: "placing",
          accept: (aim) => {
            if (aim.placementId === b) {
              refused.push(aim.placementId);
              return false;
            }
            return true;
          },
        })
        .then((result) => {
          outcome = result;
        });
    });
    await act(async () => {
      fireEvent(window, new MouseEvent("pointerdown", { clientX: 710, clientY: 300, bubbles: true }));
    });
    expect(refused).toEqual([b]);
    expect(outcome).toBeNull();
    expect(wb.placement.current()).not.toBeNull();
    // Still aiming: the next click, on a tile it accepts, settles it.
    await act(async () => {
      fireEvent(window, new MouseEvent("pointerdown", { clientX: 300, clientY: 300, bubbles: true }));
    });
    expect(outcome).toEqual({ kind: "aimed", placementId: a, zone: "center" });
  });

  test("a second begin cancels the first, and cancel() settles a live one", async () => {
    const { wb } = twoTiles();
    const outcomes: PlacementOutcome[] = [];
    act(() => {
      void wb.placement.begin({ prompt: "first" }).then((result) => outcomes.push(result));
    });
    await act(async () => {
      void wb.placement.begin({ prompt: "second" }).then((result) => outcomes.push(result));
    });
    expect(outcomes).toEqual([{ kind: "cancelled" }]);
    expect(wb.placement.current()?.prompt).toBe("second");
    await act(async () => {
      wb.placement.cancel();
    });
    expect(outcomes).toEqual([{ kind: "cancelled" }, { kind: "cancelled" }]);
    expect(wb.placement.current()).toBeNull();
  });

  test("the banner shows the prompt, and labelFor words the hovered tile's overlay", async () => {
    const { wb, view, b } = twoTiles();
    act(() => {
      void wb.placement.begin({
        prompt: "placing Basic.lean",
        defaultLabel: "beside “goals”",
        labelFor: (placementId, zone) =>
          placementId === b ? `open Basic.lean at this tile's ${zone}` : undefined,
      });
    });
    const banner = view.baseElement.querySelector('[data-part="workbench-placing"]');
    expect(banner?.textContent).toContain("placing Basic.lean");
    expect(banner?.textContent).toContain("Enter: beside “goals”");

    // Hover B's left edge: only the hovered tile paints an overlay, and its
    // label is the product's, not the shell's generic wording.
    await act(async () => {
      fireEvent(window, new MouseEvent("pointermove", { clientX: 710, clientY: 300, bubbles: true }));
    });
    const labels = [...view.baseElement.querySelectorAll('[data-part="drop-zone-label"]')].map(
      (node) => node.textContent,
    );
    expect(labels).toEqual(["open Basic.lean at this tile's left"]);

    // A tile the product does not word keeps the shell's generic label.
    await act(async () => {
      fireEvent(window, new MouseEvent("pointermove", { clientX: 300, clientY: 300, bubbles: true }));
    });
    expect(view.baseElement.querySelector('[data-part="drop-zone-label"]')?.textContent).toContain("place beside");
    await act(async () => {
      wb.placement.cancel();
    });
  });
});
