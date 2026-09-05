import { describe, expect, it } from "vitest";
import { createPresentationTypeGraph, linkVerbs } from "../../../../../../src/presentation/index.ts";
import { leaves, workspaceTree } from "../../../../../../packages/workbench-protocol/src/client/index.ts";
import { defineAppManifest } from "../../../../../../packages/workbench-core/src/apps.ts";
import { createWorkbenchCore } from "../../../../../../packages/workbench-core/src/createWorkbenchCore.ts";
import { layout, split, tile } from "../../../../../../packages/workbench-core/src/document.ts";
import { createWorkbenchLinks } from "../../../../../../packages/workbench-core/src/links/collaborator.ts";
import type { WorkbenchCommand } from "../../../../../../packages/workbench-core/src/commands.ts";

/**
 * The Phase 0 probe (01-plan-purity-probe.test.ts), INVERTED for the core
 * (guide §17 Phase 3): planning an identity merge through `preview` must
 * leave the live link runtime exactly as it was.
 */
describe("workbench-core plan purity probe", () => {
  it("previewing an identity merge does not mutate the live runtime", () => {
    const graph = createPresentationTypeGraph([{ id: "datum" }]);
    const selection = {
      name: "selection",
      direction: "inout" as const,
      contract: { valueType: "datum", semanticRole: "selection", cardinality: "many" as const, authorityDomain: "orders" },
      doc: "the selection",
    };
    const apps = ["table", "plot"].map((id) => defineAppManifest({ id, ports: [selection] }));
    const links = createWorkbenchLinks({ deps: { graph } });
    const core = createWorkbenchCore({ apps, initial: layout(split("row", 0.5, tile("table"), tile("plot"))), links });
    const [left, right] = leaves(workspaceTree(core.getState().document, core.getState().session.workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
    const reference = { type: "datum", value: [{ relation: "orders", identity: { id: "A" } }] };
    links.runtime.emit(`${left}/selection`, reference);

    const documentBefore = core.getState().document;
    const runtimeBefore = links.runtime.getState();
    const previewed = core.preview(linkVerbs.identityAdd(`${left}/selection`, `${right}/selection`, "prefer-left") as WorkbenchCommand);
    const runtimeAfter = links.runtime.getState();
    const evidence = {
      planOk: previewed.ok,
      documentUnchanged: core.getState().document === documentBefore,
      runtimeRevisionBefore: runtimeBefore.revision,
      runtimeRevisionAfter: runtimeAfter.revision,
      classCountBefore: runtimeBefore.classes.size,
      classCountAfter: runtimeAfter.classes.size,
      classIdsAfter: [...runtimeAfter.classes.keys()],
    };
    console.log(`PURITY_PROBE_CORE ${JSON.stringify(evidence)}`);

    expect(previewed.ok).toBe(true);
    expect(evidence.documentUnchanged).toBe(true);
    expect(evidence.runtimeRevisionAfter).toBe(evidence.runtimeRevisionBefore);
    expect(evidence.classCountAfter).toBe(evidence.classCountBefore);
  });
});
