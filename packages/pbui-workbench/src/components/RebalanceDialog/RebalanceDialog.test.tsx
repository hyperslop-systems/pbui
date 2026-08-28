import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
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
    act(() => {
      fireEvent.click(undo!);
    });
    const restored = rootRatio(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId));
    expect(restored).toBeCloseTo(0.95, 6);
  });

  test("the rebalance verbs are data: perform round-trips open and close", () => {
    const wb = brokenWorkbench();
    expect(wb.perform({ kind: "rebalance.open" })).toBe(true);
    expect(wb.store.getState().rebalanceOpen).toBe(true);
    expect(wb.perform({ kind: "rebalance.close" })).toBe(true);
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
    act(() => {
      fireEvent.click(structuralCard!);
    });
    const apply = [...baseElement.querySelectorAll("button")].find((b) => b.textContent === "Apply");
    act(() => {
      fireEvent.click(apply!);
    });
    const afterTree = workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId);
    const beforeTree = workspaceTree(beforeDoc, wb.store.getState().workspaceId);
    expect(afterTree).not.toEqual(beforeTree); // the tree was replaced wholesale
    expect(baseElement.querySelector('[data-part="rebalance-status"]')?.textContent).toMatch(/Applied/);
    const undo = [...baseElement.querySelectorAll("button")].find((b) => b.textContent === "Undo");
    act(() => {
      fireEvent.click(undo!);
    });
    expect(wb.store.getState().document).toBe(beforeDoc);
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
