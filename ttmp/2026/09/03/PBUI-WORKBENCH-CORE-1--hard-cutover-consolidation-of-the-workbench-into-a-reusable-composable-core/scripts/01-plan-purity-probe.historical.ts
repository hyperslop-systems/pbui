import { describe, expect, it } from "vitest";
import { createPresentationTypeGraph, linkVerbs } from "../../../../../../src/presentation/index.ts";
import { leaves, workspaceTree } from "../../../../../../packages/workbench-protocol/src/client/index.ts";
import { defineApp } from "../../../../../../packages/pbui-workbench/src/apps.ts";
import { createWorkbench } from "../../../../../../packages/pbui-workbench/src/createWorkbench.tsx";
import { layout, split, tile } from "../../../../../../packages/pbui-workbench/src/document.ts";

describe("workbench plan purity probe", () => {
  it("records whether planning an identity merge mutates the live runtime", () => {
    const graph = createPresentationTypeGraph([{ id: "datum" }]);
    const selection = {
      name: "selection",
      direction: "inout" as const,
      contract: {
        valueType: "datum",
        semanticRole: "selection",
        cardinality: "many" as const,
        authorityDomain: "orders",
      },
      doc: "the selection",
    };
    const apps = ["table", "plot"].map((id) =>
      defineApp({
        id,
        title: id,
        tone: "var(--pbui-pane-alt)",
        singleton: false,
        ports: [selection],
        Component: () => null,
      }),
    );
    const wb = createWorkbench({
      apps,
      initial: layout(split("row", 0.5, tile("table"), tile("plot"))),
      links: { graph },
    });
    const [left, right] = leaves(
      workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId),
    ).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
    const reference = { type: "datum", value: [{ relation: "orders", identity: { id: "A" } }] };
    wb.links.runtime.emit(`${left}/selection`, reference);

    const documentBefore = wb.store.getState().document;
    const runtimeBefore = wb.links.runtime.getState();
    const planned = wb.plan([
      linkVerbs.identityAdd(`${left}/selection`, `${right}/selection`, "prefer-left"),
    ]);
    const runtimeAfter = wb.links.runtime.getState();
    const evidence = {
      planOk: planned.ok,
      documentUnchanged: wb.store.getState().document === documentBefore,
      runtimeRevisionBefore: runtimeBefore.revision,
      runtimeRevisionAfter: runtimeAfter.revision,
      classCountBefore: runtimeBefore.classes.size,
      classCountAfter: runtimeAfter.classes.size,
      classIdsAfter: [...runtimeAfter.classes.keys()],
    };
    console.log(`PURITY_PROBE ${JSON.stringify(evidence)}`);

    expect(planned.ok).toBe(true);
    expect(evidence.documentUnchanged).toBe(true);
    // This assertion documents the current defect. The target architecture
    // changes it to equality and keeps runtime effects inside the plan.
    expect(evidence.runtimeRevisionAfter).toBeGreaterThan(evidence.runtimeRevisionBefore);
    expect(evidence.classCountAfter).toBeGreaterThan(evidence.classCountBefore);
  });
});
