import { create, fromJson, type JsonObject, type JsonValue, toJson } from "@bufbuild/protobuf";
import {
  DocumentPayloadSchema,
  type DocumentPayload,
  type WorkbenchDocument,
  WorkbenchDocumentSchema,
} from "@hyperslop-systems/workbench-protocol";
import type { GraphicDocument } from "../model/graphic";
import { GRAPHIC_DOCUMENT_FORMAT, GRAPHIC_DOCUMENT_SCHEMA_VERSION } from "../store/graphicSource";
import { WORKBENCH_FORMAT, WORKBENCH_SCHEMA_VERSION } from "./types";

/**
 * The protocol codec, and only the codec (design §14.1).
 *
 * What is left after PBUI-DATALAB-WORKBENCH-1: the JSON boundary of the
 * workbench document, and the envelope codec for a `GraphicDocument` — the
 * one payload the wire carries in full where the local workbench holds an
 * identity stub. The node/view/workspace conversion that used to live here
 * is gone: the local document IS the protocol's. What decides which
 * workspaces go to the server and how a server document is adopted is
 * `projection.ts`; what talks HTTP is `appkit/useRemoteWorkbench.ts`.
 */

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

/** The HTTP/RTK Query boundary: a server response body into a workbench document. */
export function parseRemoteWorkbenchJSON(value: unknown): WorkbenchDocument {
  return fromJson(WorkbenchDocumentSchema, checkedJSON(value, "workbench"), {
    ignoreUnknownFields: false,
  });
}

/** Canonical protobuf JSON, for requests and fixtures. */
export function workbenchDocumentJSON(document: WorkbenchDocument): unknown {
  return toJson(WorkbenchDocumentSchema, document);
}

/** The structural facts about a server document that every adoption checks first. */
export function assertRemoteEnvelope(document: WorkbenchDocument): void {
  if (document.format !== WORKBENCH_FORMAT || document.schemaVersion !== WORKBENCH_SCHEMA_VERSION) {
    throw new Error("unsupported workbench format or version");
  }
  if (document.workspaces.length === 0) throw new Error("at least one workspace is required");
  text(document.id, "id");
  text(document.name, "name");
  for (const [id, view] of Object.entries(document.views)) {
    if (view.id !== id) throw new Error(`views.${id} has inconsistent identity`);
  }
}

/** A wire payload back into a canonical graphic document; the envelope carries the identity. */
export function decodeGraphicDocument(payload: DocumentPayload, id: string): GraphicDocument {
  const body = payload.body;
  if (
    payload.id !== id ||
    payload.format !== GRAPHIC_DOCUMENT_FORMAT ||
    payload.schemaVersion !== GRAPHIC_DOCUMENT_SCHEMA_VERSION ||
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

/** A canonical graphic document as a wire payload: identity in the envelope, everything else in the body. */
export function encodeGraphicDocument(graphic: GraphicDocument): DocumentPayload {
  const { format, version, id, ...body } = graphic;
  return create(DocumentPayloadSchema, {
    id,
    format,
    schemaVersion: version,
    body: checkedJSONObject(body, `documents.${id}.body`),
  });
}

/** Every full graphic document a server workbench carries, keyed by id. Throws for a payload that is not one. */
export function decodeRemoteGraphics(document: WorkbenchDocument): Record<string, GraphicDocument> {
  const graphics: Record<string, GraphicDocument> = {};
  for (const [id, payload] of Object.entries(document.documents)) {
    graphics[id] = decodeGraphicDocument(payload, id);
  }
  return graphics;
}
