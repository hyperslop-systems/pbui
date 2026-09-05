import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { ReactNode } from "react";
import { layout, split, tile } from "@hyperslop-systems/workbench-core";
import { WorkbenchContext } from "../../context";
import { createWorkbench } from "../../createWorkbenchShell";
import { demoApps } from "../../stories/demoApps";
import { RebalanceStatusBadge } from "./RebalanceBadge";

afterEach(cleanup);

/** A hog-and-sliver layout: notes gets 5% of the 1024px fallback width. */
function brokenWorkbench() {
  return createWorkbench({
    apps: demoApps,
    initial: layout(split("row", 0.95, tile("counter"), tile("notes"))),
  });
}

function healthyWorkbench() {
  return createWorkbench({
    apps: demoApps,
    initial: layout(split("row", 0.5, tile("counter"), tile("notes"))),
  });
}

/** Render the badge inside the workbench's context, as a product would. */
function Host({ wb, children }: { wb: ReturnType<typeof createWorkbench>; children?: ReactNode }) {
  return (
    <WorkbenchContext.Provider value={wb}>
      <RebalanceStatusBadge />
      {children}
    </WorkbenchContext.Provider>
  );
}

describe("RebalanceStatusBadge", () => {
  test("renders nothing on a healthy layout — a quiet DETECT is the contract", () => {
    const wb = healthyWorkbench();
    const { container } = render(<Host wb={wb} />);
    expect(container.querySelector('[data-part="rebalance-badge"]')).toBeNull();
  });

  test("names the violation count and opens the dialog on click", () => {
    const wb = brokenWorkbench();
    const { container } = render(<Host wb={wb} />);
    const badge = container.querySelector('[data-part="rebalance-badge"]');
    expect(badge).not.toBeNull();
    // The count is stated in words, and the title carries the shortfall.
    expect(badge?.textContent).toMatch(/1 tile under minimum/);
    expect(badge?.getAttribute("title")).toMatch(/worst shortfall \d+px/);
    fireEvent.click(badge!);
    expect(wb.shell.getState().rebalanceOpen).toBe(true);
  });
});
