import { create, fromJson, type JsonObject, type JsonValue, toJson } from "@bufbuild/protobuf";
import {
  AppViewSchema,
  Direction,
  DocumentPayloadSchema,
  type Node as ProtocolNode,
  NodeSchema,
  type WorkbenchDocument,
  WorkbenchDocumentSchema,
  WorkspaceSchema,
} from "@hyperslop-systems/workbench-protocol";
import type { GraphicDocument } from "../model/graphic";
import type { AppView, Node } from "../store/layout";
import {
  WORKBENCH_FORMAT,
  WORKBENCH_SCHEMA_VERSION,
  type RemoteWorkbenchState,
  type RemoteWorkspace,
} from "./types";

function text(value: string, path: string): string {
  if (value.trim() === "") throw new Error(`${path} must be a non-empty string`);
  return value;
}

function checkedJSON(value: unknown, path: string): JsonValue {
  let encoded: string | undefined;
  try {
    encoded = JSON.stringify(value);
  } catch (error) {
    throw new Error(`${path} is not JSON-serializable`, { cause: error });
  }
  if (encoded === undefined) throw new Error(`${path} is not a JSON value`);
  return JSON.parse(encoded) as JsonValue;
}

function checkedJSONObject(value: unknown, path: string): JsonObject {
  const json = checkedJSON(value, path);
  if (json === null || Array.isArray(json) || typeof json !== "object") {
    throw new Error(`${path} must be a JSON object`);
  }
  return json;
}

function decodeNode(
  value: ProtocolNode | undefined,
  path: string,
  nodeIds: Set<string>,
  viewIds: ReadonlySet<string>,
  depth = 1,
): Node {
  if (!value || depth > 24) throw new Error(`${path} is not a valid node`);
  const id = text(value.id, `${path}.id`);
  if (nodeIds.has(id)) throw new Error(`${path}.id duplicates ${id}`);
  nodeIds.add(id);

  if (value.body.case === "leaf") {
    const viewId = text(value.body.value.viewId, `${path}.leaf.viewId`);
    if (!viewIds.has(viewId)) throw new Error(`${path}.leaf.viewId references missing ${viewId}`);
    return { id, type: "leaf", viewId };
  }
  if (value.body.case !== "split") throw new Error(`${path}.body is invalid`);
  const split = value.body.value;
  const dir =
    split.direction === Direction.ROW
      ? "row"
      : split.direction === Direction.COLUMN
        ? "col"
        : undefined;
  if (!dir) throw new Error(`${path}.split.direction is invalid`);
  if (split.ratio < 0.05 || split.ratio > 0.95) {
    throw new Error(`${path}.split.ratio is invalid`);
  }
  return {
    id,
    type: "split",
    dir,
    ratio: split.ratio,
    a: decodeNode(split.a, `${path}.split.a`, nodeIds, viewIds, depth + 1),
    b: decodeNode(split.b, `${path}.split.b`, nodeIds, viewIds, depth + 1),
  };
}

function decodeGraphicDocument(
  payload: WorkbenchDocument["documents"][string],
  id: string,
): GraphicDocument {
  const body = payload.body;
  if (
    payload.id !== id ||
    payload.format !== "datadrop.gog.document" ||
    payload.schemaVersion !== 2 ||
    !body ||
    typeof body.name !== "string" ||
    typeof body.sources !== "object" ||
    typeof body.transforms !== "object" ||
    typeof body.views !== "object" ||
    typeof body.rootView !== "string" ||
    typeof body.parameters !== "object"
  ) {
    throw new Error(`documents.${id} is not a canonical graphic document`);
  }
  for (const key of ["id", "format", "version"]) {
    if (Object.hasOwn(body, key)) {
      throw new Error(`documents.${id}.body.${key} is reserved for envelope identity`);
    }
  }
  return structuredClone({
    ...body,
    format: payload.format,
    version: payload.schemaVersion,
    id: payload.id,
  }) as unknown as GraphicDocument;
}

function encodeNode(node: Node): ProtocolNode {
  return node.type === "leaf"
    ? create(NodeSchema, {
        id: node.id,
        body: { case: "leaf", value: { viewId: node.viewId } },
      })
    : create(NodeSchema, {
        id: node.id,
        body: {
          case: "split",
          value: {
            direction: node.dir === "row" ? Direction.ROW : Direction.COLUMN,
            ratio: node.ratio,
            a: encodeNode(node.a),
            b: encodeNode(node.b),
          },
        },
      });
}

// parseRemoteWorkbenchJSON belongs at the HTTP/RTK Query boundary.
export function parseRemoteWorkbenchJSON(value: unknown): WorkbenchDocument {
  return fromJson(WorkbenchDocumentSchema, checkedJSON(value, "workbench"), {
    ignoreUnknownFields: false,
  });
}

// workbenchDocumentJSON emits canonical protobuf JSON for requests and fixtures.
export function workbenchDocumentJSON(document: WorkbenchDocument): unknown {
  return toJson(WorkbenchDocumentSchema, document);
}

export function decodeRemoteWorkbench(document: WorkbenchDocument): RemoteWorkbenchState {
  if (document.format !== WORKBENCH_FORMAT || document.schemaVersion !== WORKBENCH_SCHEMA_VERSION) {
    throw new Error("unsupported workbench format or version");
  }
  if (document.workspaces.length === 0) throw new Error("at least one workspace is required");

  const documents: Record<string, GraphicDocument> = {};
  for (const [id, payload] of Object.entries(document.documents)) {
    documents[id] = decodeGraphicDocument(payload, id);
  }

  const views: Record<string, AppView> = {};
  for (const [id, candidate] of Object.entries(document.views)) {
    if (candidate.id !== id) throw new Error(`views.${id} has inconsistent identity`);
    const bindings: Record<string, string> = {};
    for (const [binding, documentId] of Object.entries(candidate.documents)) {
      if (!documents[documentId]) {
        throw new Error(`views.${id}.documents.${binding} is unresolved`);
      }
      bindings[binding] = documentId;
    }
    views[id] = {
      id,
      appId: text(candidate.appId, `views.${id}.appId`),
      documents: bindings,
      ...(candidate.title === undefined
        ? {}
        : { title: text(candidate.title, `views.${id}.title`) }),
    };
  }

  const viewOrder = [...document.viewOrder];
  if (
    viewOrder.length !== Object.keys(views).length ||
    new Set(viewOrder).size !== viewOrder.length ||
    viewOrder.some((id) => !views[id])
  ) {
    throw new Error("viewOrder does not exactly enumerate views");
  }

  const nodeIds = new Set<string>();
  const workspaceIds = new Set<string>();
  const viewIds = new Set(Object.keys(views));
  const workspaces: RemoteWorkspace[] = document.workspaces.map((candidate, index) => {
    const id = text(candidate.id, `workspaces[${index}].id`);
    if (workspaceIds.has(id)) throw new Error(`workspaces[${index}].id duplicates ${id}`);
    workspaceIds.add(id);
    return {
      id,
      name: text(candidate.name, `workspaces[${index}].name`),
      tree: decodeNode(candidate.tree, `workspaces[${index}].tree`, nodeIds, viewIds),
    };
  });

  return {
    id: text(document.id, "id"),
    name: text(document.name, "name"),
    workspaces,
    views,
    viewOrder,
    documents,
  };
}

export function assertRemoteDocumentNamespace(
  remote: RemoteWorkbenchState,
  preservedDocumentIds: Iterable<string>,
): void {
  for (const id of preservedDocumentIds) {
    if (Object.hasOwn(remote.documents, id)) {
      throw new Error(`remote document ${id} collides with a code-defined stage document`);
    }
  }
}

export function encodeRemoteWorkbench(state: RemoteWorkbenchState): WorkbenchDocument {
  const views: WorkbenchDocument["views"] = {};
  for (const id of state.viewOrder) {
    const view = state.views[id];
    if (!view) throw new Error(`viewOrder references missing ${id}`);
    views[id] = create(AppViewSchema, {
      id: view.id,
      appId: view.appId,
      documents: { ...view.documents },
      title: view.title,
    });
  }

  const documents: WorkbenchDocument["documents"] = {};
  for (const [id, graphic] of Object.entries(state.documents)) {
    const { format, version, id: embeddedId, ...body } = graphic;
    if (embeddedId !== id) throw new Error(`documents.${id} has inconsistent identity`);
    documents[id] = create(DocumentPayloadSchema, {
      id,
      format,
      schemaVersion: version,
      body: checkedJSONObject(body, `documents.${id}.body`),
    });
  }

  return create(WorkbenchDocumentSchema, {
    format: WORKBENCH_FORMAT,
    schemaVersion: WORKBENCH_SCHEMA_VERSION,
    id: state.id,
    name: state.name,
    workspaces: state.workspaces.map((workspace) =>
      create(WorkspaceSchema, {
        id: workspace.id,
        name: workspace.name,
        tree: encodeNode(workspace.tree),
      }),
    ),
    views,
    viewOrder: [...state.viewOrder],
    documents,
  });
}
