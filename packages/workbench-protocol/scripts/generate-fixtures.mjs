/**
 * Regenerates fixtures/mutations/*.json — the TS<->Go applier parity corpus.
 *
 * Each fixture is { name, document, mutation, expected } in protojson form,
 * or { name, document, mutation, error: true, errorCode } for a mutation
 * both appliers must reject. The `expected` documents are produced by the
 * TypeScript applier and asserted against the Go applier by
 * pkg/workbench/parity_fixtures_test.go, so a semantic drift on either side
 * breaks a build instead of causing a runtime 422.
 *
 * Run from the package directory, after a build:
 *   pnpm build && node scripts/generate-fixtures.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fromJson, toJson } from "@bufbuild/protobuf";
import { MutationSchema, WorkbenchDocumentSchema } from "../dist/index.js";
import { applyMutation, MutationError } from "../dist/client/index.js";

/** The shared base document: one workspace, one split, two views, one document. */
const baseDocument = {
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
      title: "Mass and yield",
      documents: { primary: "document-1" },
    },
    "view-launcher": { id: "view-launcher", appId: "launcher" },
  },
  viewOrder: ["view-chart", "view-launcher"],
  documents: {
    "document-1": {
      id: "document-1",
      format: "example.doc",
      schemaVersion: 1,
      body: { name: "Demo" },
    },
  },
};

/** A single-leaf variant: view-launcher exists but is not placed. */
const singleLeafDocument = {
  ...baseDocument,
  workspaces: [
    {
      id: "workspace-a",
      name: "Overview",
      tree: { id: "placement-a", leaf: { viewId: "view-chart" } },
    },
  ],
};

/** A two-workspace variant for the workspace mutations. */
const twoWorkspaceDocument = {
  ...baseDocument,
  workspaces: [
    ...baseDocument.workspaces,
    {
      id: "workspace-b",
      name: "Detail",
      tree: { id: "placement-c", leaf: { viewId: "view-chart" } },
    },
  ],
};

/** A variant carrying one document no view binds. */
const unusedDocumentDocument = {
  ...baseDocument,
  documents: {
    ...baseDocument.documents,
    "document-unused": {
      id: "document-unused",
      format: "example.doc",
      schemaVersion: 1,
      body: { name: "Unused" },
    },
  },
};

const fixtures = [
  {
    name: "workbench-rename-trims",
    document: baseDocument,
    mutation: { workbenchRename: { name: "  Renamed workbench  " } },
  },
  {
    name: "workspace-create",
    document: baseDocument,
    mutation: {
      workspaceCreate: {
        workspaceId: "workspace-new",
        name: "  Scratch  ",
        rootPlacement: { id: "placement-new", leaf: { viewId: "view-launcher" } },
      },
    },
  },
  {
    name: "workspace-rename-trims",
    document: baseDocument,
    mutation: { workspaceRename: { workspaceId: "workspace-a", name: "  Renamed  " } },
  },
  {
    name: "workspace-delete",
    document: twoWorkspaceDocument,
    mutation: { workspaceDelete: { workspaceId: "workspace-b" } },
  },
  {
    name: "document-put",
    document: baseDocument,
    mutation: {
      documentPut: {
        document: {
          id: "document-2",
          format: "example.doc",
          schemaVersion: 1,
          body: { name: "Second" },
        },
      },
    },
  },
  {
    name: "document-delete-unused",
    document: unusedDocumentDocument,
    mutation: { documentDelete: { documentId: "document-unused" } },
  },
  {
    name: "view-create",
    document: baseDocument,
    mutation: {
      viewCreate: {
        view: { id: "view-new", appId: "table", documents: { primary: "document-1" } },
      },
    },
  },
  {
    name: "view-configure-app-and-documents",
    document: baseDocument,
    mutation: {
      viewConfigure: {
        viewId: "view-launcher",
        appId: "chart",
        replaceDocuments: { values: { primary: "document-1" } },
      },
    },
  },
  {
    name: "view-configure-set-title-trims",
    document: baseDocument,
    mutation: { viewConfigure: { viewId: "view-chart", setTitle: "  Padded title  " } },
  },
  {
    name: "view-configure-clear-title",
    document: baseDocument,
    mutation: { viewConfigure: { viewId: "view-chart", clearTitle: {} } },
  },
  {
    name: "view-clone-preserves-bindings",
    document: baseDocument,
    mutation: {
      viewClone: {
        sourceViewId: "view-chart",
        newViewId: "view-copy",
        setTitle: "Mass and yield (copy)",
      },
    },
  },
  {
    name: "view-delete-unplaced",
    document: singleLeafDocument,
    mutation: { viewDelete: { viewId: "view-launcher" } },
  },
  {
    name: "view-close-collapses-to-sibling",
    document: baseDocument,
    mutation: { viewClose: { viewId: "view-chart", fallbackViewId: "view-launcher" } },
  },
  {
    name: "view-close-empty-tree-gets-fallback",
    document: singleLeafDocument,
    mutation: { viewClose: { viewId: "view-chart", fallbackViewId: "view-launcher" } },
  },
  {
    name: "placement-replace",
    document: baseDocument,
    mutation: {
      placementReplace: {
        workspaceId: "workspace-a",
        placementId: "placement-a",
        viewId: "view-launcher",
      },
    },
  },
  {
    name: "placement-split-after",
    document: baseDocument,
    mutation: {
      placementSplit: {
        workspaceId: "workspace-a",
        placementId: "placement-a",
        direction: "DIRECTION_COLUMN",
        ratio: 0.4,
        splitId: "split-new",
        newPlacement: { id: "placement-new", leaf: { viewId: "view-launcher" } },
        place: "PLACEMENT_POSITION_AFTER",
      },
    },
  },
  {
    name: "placement-split-before",
    document: baseDocument,
    mutation: {
      placementSplit: {
        workspaceId: "workspace-a",
        placementId: "placement-b",
        direction: "DIRECTION_ROW",
        ratio: 0.5,
        splitId: "split-new",
        newPlacement: { id: "placement-new", leaf: { viewId: "view-chart" } },
        place: "PLACEMENT_POSITION_BEFORE",
      },
    },
  },
  {
    name: "placement-close-collapses-split",
    document: baseDocument,
    mutation: { placementClose: { workspaceId: "workspace-a", placementId: "placement-b" } },
  },
  {
    name: "split-resize",
    document: baseDocument,
    mutation: { splitResize: { workspaceId: "workspace-a", splitId: "split-root", ratio: 0.66 } },
  },
  {
    name: "reject-view-create-duplicate-id",
    document: baseDocument,
    mutation: { viewCreate: { view: { id: "view-chart", appId: "chart" } } },
    errorCode: "duplicate_id",
  },
  {
    name: "reject-view-delete-still-placed",
    document: baseDocument,
    mutation: { viewDelete: { viewId: "view-chart" } },
    errorCode: "view_in_use",
  },
  {
    name: "reject-placement-close-last",
    document: singleLeafDocument,
    mutation: { placementClose: { workspaceId: "workspace-a", placementId: "placement-a" } },
    errorCode: "last_placement",
  },
  {
    name: "reject-placement-split-unspecified-position",
    document: baseDocument,
    mutation: {
      placementSplit: {
        workspaceId: "workspace-a",
        placementId: "placement-a",
        direction: "DIRECTION_ROW",
        ratio: 0.5,
        splitId: "split-new",
        newPlacement: { id: "placement-new", leaf: { viewId: "view-launcher" } },
      },
    },
    errorCode: "invalid_position",
  },
  {
    name: "reject-document-delete-bound",
    document: baseDocument,
    mutation: { documentDelete: { documentId: "document-1" } },
    errorCode: "document_in_use",
  },
  {
    name: "reject-workspace-delete-last",
    document: baseDocument,
    mutation: { workspaceDelete: { workspaceId: "workspace-a" } },
    errorCode: "last_workspace",
  },
  {
    name: "reject-split-resize-unknown-split",
    document: baseDocument,
    mutation: { splitResize: { workspaceId: "workspace-a", splitId: "split-missing", ratio: 0.5 } },
    errorCode: "unknown_split",
  },
];

const outDir = new URL("../fixtures/mutations/", import.meta.url);
mkdirSync(outDir, { recursive: true });

for (const fixture of fixtures) {
  // Strict parses catch typos in the hand-written protojson literals.
  const document = fromJson(WorkbenchDocumentSchema, fixture.document, {
    ignoreUnknownFields: false,
  });
  const mutation = fromJson(MutationSchema, fixture.mutation, { ignoreUnknownFields: false });

  let payload;
  if (fixture.errorCode) {
    let caught = null;
    try {
      applyMutation(document, mutation);
    } catch (error) {
      caught = error;
    }
    if (!(caught instanceof MutationError)) {
      throw new Error(`${fixture.name}: expected a MutationError, got ${caught}`);
    }
    if (caught.code !== fixture.errorCode) {
      throw new Error(`${fixture.name}: error code ${caught.code}, want ${fixture.errorCode}`);
    }
    payload = {
      name: fixture.name,
      document: fixture.document,
      mutation: fixture.mutation,
      error: true,
      errorCode: fixture.errorCode,
    };
  } else {
    const applied = applyMutation(document, mutation);
    payload = {
      name: fixture.name,
      document: fixture.document,
      mutation: fixture.mutation,
      expected: toJson(WorkbenchDocumentSchema, applied),
    };
  }

  const file = new URL(`${fixture.name}.json`, outDir);
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`wrote fixtures/mutations/${fixture.name}.json`);
}
console.log(`${fixtures.length} fixtures`);
