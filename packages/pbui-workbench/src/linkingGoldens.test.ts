import { afterEach, describe, expect, it, vi } from "vitest";
import { create } from "@bufbuild/protobuf";
import { documentSlotPort } from "@hyperslop-systems/pbui";
import { commands, layout, split, tile } from "@hyperslop-systems/workbench-core";
import { DocumentPayloadSchema, MutationSchema, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, leaves, viewsOfApp, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { defineWorkbenchApp } from "./app";
import { createWorkbench } from "./createWorkbenchShell";
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

const skuApp = defineWorkbenchApp({
  manifest: { id: "sku", duplicatePlacement: "link", ports: [documentSlotPort("product", "the product this tile details")] },
  presentation: { title: "SKU", tone: "var(--pbui-cat-1)", blurb: "one product, in detail", group: "shop", titleFor: (view) => `SKU ${view.documents["product"] ?? "?"}`, Component: () => null },
});

/** The core validates bindings at its door, so the seed must hold the documents the sku tiles name. */
const withProducts = (doc: WorkbenchDocument, ...ids: string[]) =>
  applyMutations(doc, ids.map((id) => create(MutationSchema, { body: { case: "documentPut", value: { document: create(DocumentPayloadSchema, { id, format: "shop.product", schemaVersion: 1, body: {} }) } } })));

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("doc-bound de-duplication across workspaces", () => {
  it("openView with bindings already shown in ANOTHER workspace goes there instead of minting a twin", () => {
    const wb = createWorkbench({
      apps: [...demoApps, skuApp],
      initial: withProducts(layout(split("row", 0.5, tile("counter"), tile("sku", { documents: { product: "2049" } }))), "2049"),
    });
    const home = wb.core.getState().session.workspaceId;
    const homeLeaves = leaves(workspaceTree(wb.core.getState().document, home)).length;
    wb.execute(commands.createWorkspace("second", tile("counter")));
    const second = wb.core.getState().session.workspaceId;
    expect(second).not.toBe(home);

    const result = wb.execute(commands.open("sku", { product: "2049" }));

    expect(result.ok && result.placementId).toBeTruthy();
    expect(wb.core.getState().session.workspaceId).toBe(home);
    expect(viewsOfApp(wb.core.getState().document, "sku")).toHaveLength(1);
    expect(leaves(workspaceTree(wb.core.getState().document, home)).length).toBe(homeLeaves);
    expect(leaves(workspaceTree(wb.core.getState().document, second)).length).toBe(1);
  });

  it("openView with DIFFERENT bindings mints a second view here, not there", () => {
    const wb = createWorkbench({
      apps: [...demoApps, skuApp],
      initial: withProducts(layout(split("row", 0.5, tile("counter"), tile("sku", { documents: { product: "2049" } }))), "2049", "3110"),
    });
    wb.execute(commands.createWorkspace("second", tile("counter")));
    const second = wb.core.getState().session.workspaceId;

    const result = wb.execute(commands.open("sku", { product: "3110" }));

    expect(result.ok && result.placementId).toBeTruthy();
    expect(wb.core.getState().session.workspaceId).toBe(second);
    expect(viewsOfApp(wb.core.getState().document, "sku")).toHaveLength(2);
    expect(leaves(workspaceTree(wb.core.getState().document, second)).length).toBe(2);
  });
});

describe("describeWorkbench golden", () => {
  it("reports a doc-bound app and its tiles in the shape the agent reads today", () => {
    const wb = createWorkbench({
      apps: [...demoApps, skuApp],
      initial: withProducts(layout(split("row", 0.6, tile("counter"), split("col", 0.5, tile("notes"), tile("sku", { documents: { product: "2049" } }))), { workspaceId: "ws-main", workspaceName: "main" }), "2049"),
    });
    const description = wb.describe();
    // Ids are minted per document; the shape, not the ids, is the golden.
    const stable = JSON.parse(
      JSON.stringify(description).replace(/"(n|v|s)-[a-z0-9]+-[a-z0-9]+"/g, (_m, prefix: string) => `"${prefix}-*"`),
    );
    expect(stable).toMatchSnapshot();
  });
});
