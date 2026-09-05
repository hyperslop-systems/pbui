import { create } from "@bufbuild/protobuf";
import {
  DocumentPayloadSchema,
  MutationSchema,
  type DocumentPayload,
  type Mutation,
} from "@hyperslop-systems/workbench-protocol";
import { SOURCE_OWNER_FIELD, type DocumentSource } from "@hyperslop-systems/workbench-core";
import type { WorldState } from "./world";

/**
 * The analytical world as a workbench document SOURCE (design §6.3, Decision 3).
 *
 * Workbench core validates every `view.documents` binding against its own
 * document store, so a chart bound to a `GraphicDocument` needs a document in
 * the workbench that stands for it. That document is an IDENTITY STUB — the
 * id, the format, and the source's ownership mark — never a copy of the
 * graphic. The full `GraphicDocument` stays canonical in `world.docs`; the
 * remote projection and the portable bundles join it back in at their own
 * boundaries, and nothing in the product reads a graphic out of the workbench.
 *
 * Identity-only, so a stub written once is never rewritten: a world edit
 * changes no workbench document and therefore wakes no workbench subscriber.
 *
 * A stub may also stand for a document the world does not hold YET. The
 * pinned welcome workspaces bind the versioned demo documents before
 * `/v1/me` has advertised them; the seed writes those stubs itself, and the
 * source leaves a bound stub alone whether or not the world has caught up.
 */
export const GRAPHIC_DOCUMENT_FORMAT = "datadrop.gog.document";
export const GRAPHIC_DOCUMENT_SCHEMA_VERSION = 2;
export const GRAPHIC_SOURCE_ID = "datalab.graphic-documents";

/** The identity stub for one graphic document id. */
export function graphicStub(id: string): DocumentPayload {
  return create(DocumentPayloadSchema, {
    id,
    format: GRAPHIC_DOCUMENT_FORMAT,
    schemaVersion: GRAPHIC_DOCUMENT_SCHEMA_VERSION,
    body: { [SOURCE_OWNER_FIELD]: GRAPHIC_SOURCE_ID },
  });
}

export function graphicStubMutation(id: string): Mutation {
  return create(MutationSchema, {
    body: { case: "documentPut", value: { document: graphicStub(id) } },
  });
}

/** Is this payload an identity stub of the graphic source, rather than a full graphic? */
export function isGraphicStub(payload: DocumentPayload): boolean {
  if (payload.format !== GRAPHIC_DOCUMENT_FORMAT) return false;
  const body = payload.body ?? {};
  return !Object.hasOwn(body, "sources") && !Object.hasOwn(body, "views");
}

/**
 * The source over one store's world. `read` and `subscribe` rather than the
 * store itself, so the same function serves a Redux store, a test's plain
 * object, and a remote merge that reasons about a world it has not
 * installed yet.
 */
export function graphicDocumentSource(
  read: () => Pick<WorldState, "docOrder">,
  subscribe?: (listener: () => void) => () => void,
): DocumentSource {
  return {
    id: GRAPHIC_SOURCE_ID,
    format: GRAPHIC_DOCUMENT_FORMAT,
    schemaVersion: GRAPHIC_DOCUMENT_SCHEMA_VERSION,
    update: "identity-only",
    list: () => read().docOrder.map((id) => ({ id })),
    ...(subscribe ? { subscribe } : {}),
  };
}
