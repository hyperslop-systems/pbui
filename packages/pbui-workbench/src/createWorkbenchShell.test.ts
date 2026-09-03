import { describe, expect, test } from "vitest";
import { createWorkbenchCore, createWorkbenchLinks, defineAppManifest, layout, tile } from "@hyperslop-systems/workbench-core";
import { manifestsOf } from "./app";
import { createWorkbenchShell } from "./createWorkbenchShell";
import { demoApps } from "./stories/demoApps";

describe("createWorkbenchShell construction (design doc 04 §6.8)", () => {
  test("every manifest in the core needs a presentation, and every presentation a manifest", () => {
    const extra = defineAppManifest({ id: "ledger" });
    const core = createWorkbenchCore({ apps: [...manifestsOf(demoApps), extra], initial: layout(tile("notes")), links: createWorkbenchLinks() });
    expect(() => createWorkbenchShell({ core, apps: demoApps })).toThrow(/"ledger" has a manifest in the core but no presentation/);
    const complete = createWorkbenchCore({ apps: manifestsOf(demoApps), initial: layout(tile("notes")), links: createWorkbenchLinks() });
    expect(() => createWorkbenchShell({ core: complete, apps: demoApps })).not.toThrow();
  });

  test("focusPlacement with no root mounted focuses nothing (never the global document)", async () => {
    const core = createWorkbenchCore({ apps: manifestsOf(demoApps), initial: layout(tile("notes")), links: createWorkbenchLinks() });
    const shell = createWorkbenchShell({ core, apps: demoApps });
    const stray = document.createElement("div");
    stray.setAttribute("data-placement-id", core.getState().document.workspaces[0]!.tree!.id);
    const cell = document.createElement("div");
    cell.setAttribute("data-part", "workbench-tile");
    cell.tabIndex = -1;
    cell.appendChild(stray);
    document.body.appendChild(cell);
    shell.focusPlacement(core.getState().document.workspaces[0]!.tree!.id);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.activeElement).not.toBe(cell);
    cell.remove();
  });
});
