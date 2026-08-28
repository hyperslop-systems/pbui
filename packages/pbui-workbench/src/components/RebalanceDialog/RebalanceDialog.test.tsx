import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Node } from "@hyperslop-systems/workbench-protocol";
import { workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";

afterEach(cleanup);

/** A hog-and-sliver layout: the notes tile gets 5% of a 1024px fallback width. */
function brokenWorkbench() {
  return createWorkbench({
    apps: demoApps,
    initial: layout(split("row", 0.95, tile("counter"), tile("notes"))),
  });
}

function rootRatio(node: Node | undefined): number {
  if (!node || node.body.case !== "split") throw new Error("expected a split root");
  return node.body.value.ratio;
}

describe("measureDividerPx", () => {
  test("reads the track's THICKNESS, not a column divider's full span", async () => {
    const { measureDividerPx } = await import("./RebalanceDialog");
    const fake = (width: number, height: number) => {
      const root = document.createElement("div");
      const divider = document.createElement("div");
      divider.setAttribute("data-part", "split-divider");
      divider.getBoundingClientRect = () => ({ width, height }) as DOMRect;
      root.append(divider);
      return root;
    };
    expect(measureDividerPx(fake(700, 10))).toBe(10); // column divider: wide, thin
    expect(measureDividerPx(fake(10, 500))).toBe(10); // row divider: tall, narrow
    expect(measureDividerPx(fake(0, 0))).toBe(10); // unmeasurable → default (jsdom has no token)
  });
});

describe("RebalanceDialog", () => {
  test("Mod+Shift+K opens it; cards render with a recommendation and the diagnosis", () => {
    const wb = brokenWorkbench();
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Rebalance />
      </>,
    );
    expect(baseElement.querySelector('[data-part="rebalance"]')).toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: "k", ctrlKey: true, shiftKey: true });
    });
    expect(wb.store.getState().rebalanceOpen).toBe(true);
    expect(baseElement.querySelector('[data-part="rebalance"]')).not.toBeNull();
    const cards = [...baseElement.querySelectorAll('[data-part="rebalance-card"]')];
    expect(cards.length).toBeGreaterThan(1);
    // LEAVE AS IS is always first (tier 0); some card carries the PICK badge.
    expect(cards[0]?.textContent).toMatch(/LEAVE AS IS/);
    expect(baseElement.querySelector('[data-part="rebalance-diagnosis"]')?.textContent).toMatch(/under minimum/);
    const picked = cards.find((card) => /PICK/.test(card.textContent ?? ""));
    expect(picked).toBeDefined();
    expect(picked?.textContent).toMatch(/all fit/);
  });

  test("Apply commits the recommended resize batch atomically and arms Undo", () => {
    const onMutate = vi.fn();
    const wb = createWorkbench({
      apps: demoApps,
      initial: layout(split("row", 0.95, tile("counter"), tile("notes"))),
      onMutate,
    });
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Rebalance />
      </>,
    );
    act(() => {
      wb.perform({ kind: "rebalance.open" });
    });
    const before = rootRatio(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId));
    expect(before).toBeCloseTo(0.95, 6);
    const apply = [...baseElement.querySelectorAll("button")].find((b) => b.textContent === "Apply");
    expect(apply).toBeDefined();
    act(() => {
      fireEvent.click(apply!);
    });
    const after = rootRatio(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId));
    expect(after).toBeLessThan(0.95); // the sliver got its pixels back
    expect(baseElement.querySelector('[data-part="rebalance-status"]')?.textContent).toMatch(/Applied/);
    // The dialog stays open (lab behaviour) so Undo has a home.
    expect(wb.store.getState().rebalanceOpen).toBe(true);
    const undo = [...baseElement.querySelectorAll("button")].find((b) => b.textContent === "Undo");
    const mutationsBeforeUndo = onMutate.mock.calls.length;
    act(() => {
      fireEvent.click(undo!);
    });
    const restored = rootRatio(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId));
    expect(restored).toBeCloseTo(0.95, 6);
    // Undo notified the persistence hook (PR #19): it is a mutation, not a
    // silent document replacement that would look undone until reload.
    expect(onMutate.mock.calls.length).toBe(mutationsBeforeUndo + 1);
  });

  test("the rebalance verbs are data: perform round-trips open and close", () => {
    const wb = brokenWorkbench();
    expect(wb.perform({ kind: "rebalance.open" })).toBe(true);
    expect(wb.store.getState().rebalanceOpen).toBe(true);
    expect(wb.perform({ kind: "rebalance.close" })).toBe(true);
    expect(wb.store.getState().rebalanceOpen).toBe(false);
  });

  test("a repair applies even when the rendered split is too small for the verb's clamp (PR #19)", () => {
    const wb = brokenWorkbench();
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Rebalance />
      </>,
    );
    // Give the root split a rendered size below 2×minInlinePx: the
    // `split.resize` verb's ratioBounds would return null here and refuse the
    // whole repair. The dialog's raw mutation batch must not consult it.
    const rootSplitId = workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId)?.id ?? "";
    const splitElement = baseElement.querySelector<HTMLElement>(`[data-split-id="${rootSplitId}"]`);
    if (splitElement) {
      splitElement.getBoundingClientRect = () =>
        ({ left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    }
    expect(wb.verbs.ratioBounds(rootSplitId)).toBeNull(); // the clamp WOULD refuse
    act(() => {
      wb.perform({ kind: "rebalance.open" });
    });
    const apply = [...baseElement.querySelectorAll("button")].find((b) => b.textContent === "Apply");
    act(() => {
      fireEvent.click(apply!);
    });
    const after = rootRatio(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId));
    expect(after).toBeLessThan(0.95); // committed despite the stale rendered bounds
  });

  test("a plain click on a card applies the proposal and closes the dialog", () => {
    const wb = brokenWorkbench();
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Rebalance />
      </>,
    );
    act(() => {
      wb.perform({ kind: "rebalance.open" });
    });
    const ripple = baseElement.querySelector('[id="rebalance:ripple"]');
    expect(ripple).toBeDefined();
    act(() => {
      fireEvent.click(ripple!);
    });
    const after = rootRatio(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId));
    expect(after).toBeLessThan(0.95); // applied…
    expect(wb.store.getState().rebalanceOpen).toBe(false); // …and closed
  });

  test("clicking LEAVE AS IS just closes — the layout is untouched", () => {
    const wb = brokenWorkbench();
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Rebalance />
      </>,
    );
    act(() => {
      wb.perform({ kind: "rebalance.open" });
    });
    act(() => {
      fireEvent.click(baseElement.querySelector('[id="rebalance:none"]')!);
    });
    expect(rootRatio(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId))).toBeCloseTo(0.95, 6);
    expect(wb.store.getState().rebalanceOpen).toBe(false);
  });

  test("a structural proposal applies through workspace.setTree and Undo restores", () => {
    // A column of four 160px-min tiles needs 4·160 + 3·10 = 670px of height
    // on a 640px fallback screen — impossible for weights, fixed by reshape.
    const wb = createWorkbench({
      apps: demoApps,
      initial: layout(
        split(
          "row",
          0.5,
          tile("counter"),
          split("col", 0.25, tile("notes"), split("col", 1 / 3, tile("counter"), split("col", 0.5, tile("counter"), tile("counter")))),
        ),
      ),
    });
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Rebalance />
      </>,
    );
    act(() => {
      wb.perform({ kind: "rebalance.open" });
    });
    const beforeDoc = wb.store.getState().document;
    const structuralCard = [...baseElement.querySelectorAll('[data-part="rebalance-card"]')].find((card) =>
      /RESHAPE|REBUILD/.test(card.textContent ?? ""),
    );
    expect(structuralCard).toBeDefined();
    // Shift+click: apply but KEEP the dialog open, so Undo has a home.
    act(() => {
      fireEvent.click(structuralCard!, { shiftKey: true });
    });
    const afterTree = workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId);
    const beforeTree = workspaceTree(beforeDoc, wb.store.getState().workspaceId);
    expect(afterTree).not.toEqual(beforeTree); // the tree was replaced wholesale
    expect(wb.store.getState().rebalanceOpen).toBe(true); // Shift held it open
    expect(baseElement.querySelector('[data-part="rebalance-status"]')?.textContent).toMatch(/Applied/);
    const undo = [...baseElement.querySelectorAll("button")].find((b) => b.textContent === "Undo");
    act(() => {
      fireEvent.click(undo!);
    });
    // Undo goes through the MUTATION path (PR #19), so the document is a new
    // object whose tree equals the original — not the same reference.
    const wsId = wb.store.getState().workspaceId;
    expect(workspaceTree(wb.store.getState().document, wsId)).toEqual(workspaceTree(beforeDoc, wsId));
  });

  test("a healthy layout collapses to LEAVE AS IS with agreeing generators", () => {
    const wb = createWorkbench({
      apps: demoApps,
      initial: layout(split("row", 0.5, tile("counter"), tile("notes"))),
    });
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Rebalance />
      </>,
    );
    act(() => {
      wb.perform({ kind: "rebalance.open" });
    });
    const cards = [...baseElement.querySelectorAll('[data-part="rebalance-card"]')];
    const baseline = cards[0];
    expect(baseline?.textContent).toMatch(/LEAVE AS IS/);
    expect(baseline?.textContent).toMatch(/PICK/);
    expect(baseElement.querySelector('[data-part="rebalance-diagnosis"]')?.textContent).toMatch(
      /every tile clears its minimum/,
    );
  });
});
