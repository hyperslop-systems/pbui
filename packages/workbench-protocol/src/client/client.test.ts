import { fromJson } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { WorkbenchDocumentSchema, type WorkbenchDocument } from "../index.js";
import {
  applyMutations,
  closePlacement,
  createWorkbenchClient,
  dockPlacement,
  leaves,
  placementCount,
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

const client = createWorkbenchClient({
  sourceBinding: "primary",
  launcherAppId: "launcher",
  isBindableDocument: (payload) => payload.format === "example.doc",
});

describe("createWorkbenchClient", () => {
  it("defaultSourceDocumentId follows an existing bound view", () => {
    expect(client.defaultSourceDocumentId(baseDocument())).toBe("document-1");
  });

  it("defaultSourceDocumentId falls back to the first bindable document", () => {
    const doc = baseDocument();
    doc.views["view-chart"].documents = {};
    delete doc.documents["document-1"];
    // document-2 is not bindable under this config: nothing to bind.
    expect(client.defaultSourceDocumentId(doc)).toBeNull();
    const permissive = createWorkbenchClient({ sourceBinding: "primary", launcherAppId: "launcher" });
    expect(permissive.defaultSourceDocumentId(doc)).toBe("document-2");
  });

  it("replaceApp retargets a lone launcher view in place, binding the default source", () => {
    const doc = baseDocument();
    const mutations = client.replaceApp(doc, "placement-b", "table", false);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].body.case).toBe("viewConfigure");
    const next = applyMutations(doc, mutations);
    expect(next.views["view-launcher"].appId).toBe("table");
    expect(next.views["view-launcher"].documents).toEqual({ primary: "document-1" });
  });

  it("replaceApp links a singleton's existing view and deletes the launcher view", () => {
    const doc = baseDocument();
    const mutations = client.replaceApp(doc, "placement-b", "chart", true);
    expect(mutations.map((m) => m.body.case)).toEqual(["placementReplace", "viewDelete"]);
    const next = applyMutations(doc, mutations);
    expect(placementCount(next, "view-chart")).toBe(2);
    expect(next.views["view-launcher"]).toBeUndefined();
  });

  it("splitPlacement opens a launcher pane beside the placement", () => {
    const doc = baseDocument();
    const next = applyMutations(doc, client.splitPlacement(doc, "placement-a", "row"));
    expect(leaves(next.workspaces[0].tree)).toHaveLength(3);
    const launcherViews = Object.values(next.views).filter((v) => v.appId === "launcher");
    expect(launcherViews).toHaveLength(2);
  });

  it("splitWithApp mints a bound view and never touches the origin tile", () => {
    const doc = baseDocument();
    const next = applyMutations(doc, client.splitWithApp(doc, "placement-a", "col", "table", false));
    expect(next.workspaces[0].tree && leaves(next.workspaces[0].tree)).toHaveLength(3);
    const table = Object.values(next.views).find((v) => v.appId === "table");
    expect(table?.documents).toEqual({ primary: "document-1" });
    expect(placementCount(next, "view-chart")).toBe(1);
  });

  it("linkViewIntoPlacement deletes an orphaned launcher view", () => {
    const doc = baseDocument();
    const mutations = client.linkViewIntoPlacement(doc, "placement-b", "view-chart");
    const next = applyMutations(doc, mutations);
    expect(placementCount(next, "view-chart")).toBe(2);
    expect(next.views["view-launcher"]).toBeUndefined();
  });
});

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
