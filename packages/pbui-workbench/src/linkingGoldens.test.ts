import { afterEach, describe, expect, it, vi } from "vitest";
import { leaves, viewsOfApp, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { defineApp } from "./apps";
import { createWorkbench } from "./createWorkbench";
import { describeWorkbench } from "./describe";
import { layout, split, tile } from "./document";
import { demoApps } from "./stories/demoApps";

/*
 * PBUI-LINK-1 Phase 0: what tile linking must not break.
 *
 * `workbench.test.ts` already freezes replace's retarget-versus-mint rule,
 * link's orphan deletion, and the BindingConfig defaults. The two cases below
 * were the ones without a test: a doc-bound open whose twin lives in another
 * workspace, and the exact shape `describeWorkbench` reports for a doc-bound
 * application — the thing Phase 1 changes when `bindings`/`docBound` become
 * ports, and Phase 7 extends with ports and links. A reviewed diff of the
 * snapshot is the contract.
 */

const skuApp = defineApp({
  id: "sku",
  title: "SKU",
  tone: "var(--pbui-cat-1)",
  singleton: false,
  duplicable: false,
  docBound: true,
  bindings: ["product"],
  blurb: "one product, in detail",
  group: "shop",
  titleFor: (view) => `SKU ${view.documents["product"] ?? "?"}`,
  Component: () => null,
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("doc-bound de-duplication across workspaces", () => {
  it("openView with bindings already shown in ANOTHER workspace goes there instead of minting a twin", () => {
    const wb = createWorkbench({
      apps: [...demoApps, skuApp],
      initial: layout(split("row", 0.5, tile("counter"), tile("sku", { documents: { product: "2049" } }))),
    });
    const home = wb.store.getState().workspaceId;
    const homeLeaves = leaves(workspaceTree(wb.store.getState().document, home)).length;
    wb.verbs.createWorkspace("second", tile("counter"));
    const second = wb.store.getState().workspaceId;
    expect(second).not.toBe(home);

    const placement = wb.verbs.openView("sku", { product: "2049" });

    expect(placement).not.toBeNull();
    expect(wb.store.getState().workspaceId).toBe(home);
    expect(viewsOfApp(wb.store.getState().document, "sku")).toHaveLength(1);
    expect(leaves(workspaceTree(wb.store.getState().document, home)).length).toBe(homeLeaves);
    expect(leaves(workspaceTree(wb.store.getState().document, second)).length).toBe(1);
  });

  it("openView with DIFFERENT bindings mints a second view here, not there", () => {
    const wb = createWorkbench({
      apps: [...demoApps, skuApp],
      initial: layout(split("row", 0.5, tile("counter"), tile("sku", { documents: { product: "2049" } }))),
    });
    wb.verbs.createWorkspace("second", tile("counter"));
    const second = wb.store.getState().workspaceId;

    const placement = wb.verbs.openView("sku", { product: "3110" });

    expect(placement).not.toBeNull();
    expect(wb.store.getState().workspaceId).toBe(second);
    expect(viewsOfApp(wb.store.getState().document, "sku")).toHaveLength(2);
    expect(leaves(workspaceTree(wb.store.getState().document, second)).length).toBe(2);
  });
});

describe("describeWorkbench golden", () => {
  it("reports a doc-bound app and its tiles in the shape the agent reads today", () => {
    const wb = createWorkbench({
      apps: [...demoApps, skuApp],
      initial: layout(
        split("row", 0.6, tile("counter"), split("col", 0.5, tile("notes"), tile("sku", { documents: { product: "2049" } }))),
        { workspaceId: "ws-main", workspaceName: "main" },
      ),
    });
    const description = describeWorkbench(wb);
    // Ids are minted per document; the shape, not the ids, is the golden.
    const stable = JSON.parse(
      JSON.stringify(description).replace(/"(n|v|s)-[a-z0-9]+-[a-z0-9]+"/g, (_m, prefix: string) => `"${prefix}-*"`),
    );
    expect(stable).toMatchSnapshot();
  });
});
