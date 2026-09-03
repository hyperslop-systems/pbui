import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { layout, split, splitRatioBounds, tile } from "@hyperslop-systems/workbench-core";
import type { Node } from "@hyperslop-systems/workbench-protocol";
import { workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { createWorkbench } from "../../createWorkbenchShell";
import { demoApps } from "../../stories/demoApps";
import { rebalanceGeometry } from "./RebalanceDialog";

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

describe("rebalanceGeometry", () => {
  test("reads the track's THICKNESS from the measured geometry, and falls back when nothing is laid out", () => {
    const base = { placements: new Map(), splits: new Map() };
    expect(rebalanceGeometry({ ...base, viewport: { x: 0, y: 0, width: 900, height: 500 }, divider: { inline: 10, block: 700 } }).dividerPx).toBe(10); // column divider: wide, thin
    expect(rebalanceGeometry({ ...base, viewport: { x: 0, y: 0, width: 900, height: 500 }, divider: { inline: 500, block: 10 } }).dividerPx).toBe(10); // row divider: tall, narrow
    expect(rebalanceGeometry(null)).toEqual({ rect: { x: 0, y: 0, w: 1024, h: 640 }, dividerPx: 10 }); // unmeasurable → fallback
    expect(rebalanceGeometry({ ...base, viewport: { x: 0, y: 0, width: 900, height: 500 }, divider: { inline: 8, block: 8 } }).rect).toEqual({ x: 0, y: 0, w: 900, h: 500 });
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
    expect(wb.shell.getState().rebalanceOpen).toBe(true);
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
    const onCommit = vi.fn();
    const wb = createWorkbench({
      apps: demoApps,
      initial: layout(split("row", 0.95, tile("counter"), tile("notes"))),
      onCommit,
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
    const before = rootRatio(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId));
    expect(before).toBeCloseTo(0.95, 6);
    const apply = [...baseElement.querySelectorAll("button")].find((b) => b.textContent === "Apply");
    expect(apply).toBeDefined();
    act(() => {
      fireEvent.click(apply!);
    });
    const after = rootRatio(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId));
    expect(after).toBeLessThan(0.95); // the sliver got its pixels back
    expect(baseElement.querySelector('[data-part="rebalance-status"]')?.textContent).toMatch(/Applied/);
    // The dialog stays open (lab behaviour) so Undo has a home.
    expect(wb.shell.getState().rebalanceOpen).toBe(true);
    const undo = [...baseElement.querySelectorAll("button")].find((b) => b.textContent === "Undo");
    const mutationsBeforeUndo = onCommit.mock.calls.length;
    act(() => {
      fireEvent.click(undo!);
    });
    const restored = rootRatio(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId));
    expect(restored).toBeCloseTo(0.95, 6);
    // Undo notified the persistence hook (PR #19): it is a mutation, not a
    // silent document replacement that would look undone until reload.
    expect(onCommit.mock.calls.length).toBe(mutationsBeforeUndo + 1);
  });

  test("the rebalance verbs are data: perform round-trips open and close", () => {
    const wb = brokenWorkbench();
    expect(wb.perform({ kind: "rebalance.open" })).toBe(true);
    expect(wb.shell.getState().rebalanceOpen).toBe(true);
    expect(wb.perform({ kind: "rebalance.close" })).toBe(true);
    expect(wb.shell.getState().rebalanceOpen).toBe(false);
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
    const rootSplitId = workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId)?.id ?? "";
    const splitElement = baseElement.querySelector<HTMLElement>(`[data-split-id="${rootSplitId}"]`);
    if (splitElement) {
      splitElement.getBoundingClientRect = () =>
        ({ left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    }
    expect(splitRatioBounds(wb.measure(), rootSplitId, "row", wb.core.policy.split)).toBeNull(); // the clamp WOULD refuse
    act(() => {
      wb.perform({ kind: "rebalance.open" });
    });
    const apply = [...baseElement.querySelectorAll("button")].find((b) => b.textContent === "Apply");
    act(() => {
      fireEvent.click(apply!);
    });
    const after = rootRatio(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId));
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
    const after = rootRatio(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId));
    expect(after).toBeLessThan(0.95); // applied…
    expect(wb.shell.getState().rebalanceOpen).toBe(false); // …and closed
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
    expect(rootRatio(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId))).toBeCloseTo(0.95, 6);
    expect(wb.shell.getState().rebalanceOpen).toBe(false);
  });

  test("a structural proposal applies through workspace.rebalance and Undo restores", () => {
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
    const beforeDoc = wb.core.getState().document;
    const structuralCard = [...baseElement.querySelectorAll('[data-part="rebalance-card"]')].find((card) =>
      /RESHAPE|REBUILD/.test(card.textContent ?? ""),
    );
    expect(structuralCard).toBeDefined();
    // Shift+click: apply but KEEP the dialog open, so Undo has a home.
    act(() => {
      fireEvent.click(structuralCard!, { shiftKey: true });
    });
    const afterTree = workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId);
    const beforeTree = workspaceTree(beforeDoc, wb.core.getState().session.workspaceId);
    expect(afterTree).not.toEqual(beforeTree); // the tree was replaced wholesale
    expect(wb.shell.getState().rebalanceOpen).toBe(true); // Shift held it open
    expect(baseElement.querySelector('[data-part="rebalance-status"]')?.textContent).toMatch(/Applied/);
    const undo = [...baseElement.querySelectorAll("button")].find((b) => b.textContent === "Undo");
    act(() => {
      fireEvent.click(undo!);
    });
    // Undo goes through the MUTATION path (PR #19), so the document is a new
    // object whose tree equals the original — not the same reference.
    const wsId = wb.core.getState().session.workspaceId;
    expect(workspaceTree(wb.core.getState().document, wsId)).toEqual(workspaceTree(beforeDoc, wsId));
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

describe("live preview (Phase 6)", () => {
  test("selecting a repair renders its panes on the surface without touching the document", () => {
    const wb = brokenWorkbench();
    const before = wb.core.getState().document;
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Rebalance />
      </>,
    );
    act(() => {
      wb.perform({ kind: "rebalance.open" });
    });
    // The recommended card is selected on open; it proposes a real repair,
    // so the read-only overlay appears with one outline per pane.
    const overlay = baseElement.querySelector('[data-part="rebalance-preview"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute("aria-hidden")).toBe("true");
    expect(overlay?.children.length).toBe(2);
    // Preview is never a mutation: the protocol document is untouched.
    expect(wb.core.getState().document).toBe(before);
  });

  test("the baseline previews nothing — the surface itself is that preview", () => {
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
    // Healthy layout: LEAVE AS IS is recommended and selected; no overlay.
    expect(baseElement.querySelector('[data-part="rebalance"]')).not.toBeNull();
    expect(baseElement.querySelector('[data-part="rebalance-preview"]')).toBeNull();
  });
});
