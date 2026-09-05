import { create, fromJson } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { MutationSchema, WorkbenchDocumentSchema, type WorkbenchDocument } from "../index.js";
import {
  applyMutations,
  closePlacement,
  dockPlacement,
  leaves,
  placementCount,
  replacePlacement,
  resizeSplit,
  snapRatio,
  splitPlacement,
  swapPlacements,
  workspaceOfPlacement,
} from "./index.js";

/** The parity corpus' base document, reused for builder behavior tests. */
function baseDocument(): WorkbenchDocument {
  return fromJson(WorkbenchDocumentSchema, {
    format: "pbui.workbench",
    schemaVersion: 1,
    id: "workbench-1",
    name: "Production",
    workspaces: [
      {
        id: "workspace-a",
        name: "Overview",
        tree: {
          id: "split-root",
          split: {
            direction: "DIRECTION_ROW",
            ratio: 0.5,
            a: { id: "placement-a", leaf: { viewId: "view-chart" } },
            b: { id: "placement-b", leaf: { viewId: "view-launcher" } },
          },
        },
      },
    ],
    views: {
      "view-chart": {
        id: "view-chart",
        appId: "chart",
        documents: { primary: "document-1" },
      },
      "view-launcher": { id: "view-launcher", appId: "launcher" },
    },
    viewOrder: ["view-chart", "view-launcher"],
    documents: {
      "document-1": { id: "document-1", format: "example.doc", schemaVersion: 1, body: {} },
      "document-2": { id: "document-2", format: "other.doc", schemaVersion: 1, body: {} },
    },
  });
}

describe("config-independent verbs", () => {
  it("closePlacement deletes the view with its last placement", () => {
    const doc = baseDocument();
    const next = applyMutations(doc, closePlacement(doc, "placement-b"));
    expect(next.views["view-launcher"]).toBeUndefined();
    expect(next.workspaces[0].tree?.id).toBe("placement-a");
  });

  it("swapPlacements exchanges the two leaf references", () => {
    const doc = baseDocument();
    const next = applyMutations(doc, swapPlacements(doc, "placement-a", "placement-b"));
    const [a, b] = leaves(next.workspaces[0].tree);
    expect(a.body.case === "leaf" && a.body.value.viewId).toBe("view-launcher");
    expect(b.body.case === "leaf" && b.body.value.viewId).toBe("view-chart");
  });

  it("replacePlacement: the target shows the source's view, the source closes, the orphan dies", () => {
    const doc = baseDocument();
    const next = applyMutations(doc, replacePlacement(doc, "placement-b", "placement-a"));
    const placements = leaves(next.workspaces[0].tree);
    expect(placements).toHaveLength(1);
    expect(placements[0].id).toBe("placement-a"); // the target's rectangle survives
    expect(placements[0].body.case === "leaf" && placements[0].body.value.viewId).toBe("view-launcher");
    expect(next.views["view-chart"]).toBeUndefined(); // old target view had no other placement
    expect(workspaceOfPlacement(next, "placement-b")).toBeNull();
  });

  it("replacePlacement on linked twins collapses to the target placement", () => {
    const doc = baseDocument();
    // Point both placements at one view first, then replace across the link.
    const linked = applyMutations(doc, [
      create(MutationSchema, {
        body: {
          case: "placementReplace",
          value: { workspaceId: "workspace-a", placementId: "placement-b", viewId: "view-chart" },
        },
      }),
    ]);
    const next = applyMutations(linked, replacePlacement(linked, "placement-b", "placement-a"));
    expect(leaves(next.workspaces[0].tree)).toHaveLength(1);
    expect(next.views["view-chart"]).toBeDefined(); // the shared view survives
  });

  it("dockPlacement splits the target and closes the source", () => {
    const doc = baseDocument();
    const next = applyMutations(doc, dockPlacement(doc, "placement-b", "placement-a", "top"));
    const placements = leaves(next.workspaces[0].tree);
    expect(placements).toHaveLength(2);
    expect(placements[0].body.case === "leaf" && placements[0].body.value.viewId).toBe(
      "view-launcher",
    );
    expect(workspaceOfPlacement(next, "placement-b")).toBeNull();
  });

  it("resizeSplit finds the workspace by split id", () => {
    const doc = baseDocument();
    const next = applyMutations(doc, resizeSplit(doc, "split-root", 0.66));
    const tree = next.workspaces[0].tree;
    expect(tree?.body.case === "split" && tree.body.value.ratio).toBe(0.66);
  });

  it("plain splitPlacement takes the app id as a parameter", () => {
    const doc = baseDocument();
    const next = applyMutations(doc, splitPlacement(doc, "placement-a", "row", "table"));
    expect(Object.values(next.views).some((v) => v.appId === "table")).toBe(true);
  });
});

describe("snapRatio", () => {
  it("snaps near a canonical share and passes other values through", () => {
    expect(snapRatio(0.51)).toEqual({ ratio: 0.5, snapped: true });
    expect(snapRatio(1 / 3 + 0.01)).toEqual({ ratio: 1 / 3, snapped: true });
    expect(snapRatio(0.42)).toEqual({ ratio: 0.42, snapped: false });
  });
});
