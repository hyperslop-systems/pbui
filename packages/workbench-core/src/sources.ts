import { create, type JsonObject } from "@bufbuild/protobuf";
import { DocumentPayloadSchema, MutationSchema, type DocumentPayload, type Mutation, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import type { WorkbenchCore } from "./createWorkbenchCore";

/**
 * A set of host-owned resources that applications bind by id.
 *
 * The core validates every `view.documents` binding against the document
 * store (`unknown_document`, as `pkg/workbench` does), so a resource that
 * lives outside the workbench document — a conversation in a registry, a
 * program in a library, a product in a catalogue — needs a document that
 * stands for it before a view can bind it. A source names those resources;
 * `connectDocumentSource` keeps one STUB document per resource in the store.
 * The host stays the resource's home: the stub carries its identity and,
 * optionally, a small body, never a copy of the resource.
 *
 * Ownership (design doc 04 §9.6): a stub records which source wrote it in
 * the reserved body field `$source`, so two sources sharing one format can
 * coexist and a stub of another format under a listed id is a collision,
 * never overwritten.
 */
export interface DocumentSource {
  /** The source's identity, recorded in every stub it writes. */
  readonly id: string;
  /** The format every stub this source contributes carries. */
  readonly format: string;
  /** Default 1. */
  readonly schemaVersion?: number;
  /**
   * `"identity-only"` (default): a stub's body is written once, when it is
   * created. `"replace-body"`: the body follows the source's on every
   * reconcile.
   */
  readonly update?: "identity-only" | "replace-body";
  /** The resources that exist right now. */
  list(): readonly SourceDocument[];
  /** Fires when membership (or, under `replace-body`, a body) may have changed; omit for a static source. */
  subscribe?(listener: () => void): () => void;
  /** Override the ownership test; default: the stub's `$source` equals this source's id, or the stub carries no `$source` (a stub from before ownership was recorded). */
  owns?(payload: DocumentPayload): boolean;
}

export interface SourceDocument {
  readonly id: string;
  readonly body?: JsonObject;
}

/** A listed id already names a document of ANOTHER format: the source does not own it and must not overwrite it. */
export interface SourceCollision {
  readonly id: string;
  readonly format: string;
}

export interface SourceReconciliation {
  readonly mutations: Mutation[];
  readonly collisions: SourceCollision[];
}

/** The reserved body field that names the writing source. */
export const SOURCE_OWNER_FIELD = "$source";

const ownedBy = (source: DocumentSource, payload: DocumentPayload): boolean => {
  if (source.owns) return source.owns(payload);
  const owner = payload.body?.[SOURCE_OWNER_FIELD];
  return owner === undefined || owner === source.id;
};

const bodyOf = (source: DocumentSource, item: SourceDocument): JsonObject => ({ ...(item.body ?? {}), [SOURCE_OWNER_FIELD]: source.id });

const sameBody = (a: JsonObject | undefined, b: JsonObject) => JSON.stringify(a ?? {}) === JSON.stringify(b);

/**
 * The batch that brings the document's stubs in line with the source:
 *
 *     same id + owned stub of this format     → update (replace-body) or nothing
 *     same id + a document of another format  → collision, untouched
 *     same format + owned by another source   → untouched
 *     missing from the source + still bound   → retained (documentDelete would be refused)
 *     missing from the source + unbound + owned → deleted
 */
export function documentSourceMutations(doc: WorkbenchDocument, source: DocumentSource): SourceReconciliation {
  const mutations: Mutation[] = [];
  const collisions: SourceCollision[] = [];
  const present = new Set<string>();
  const put = (item: SourceDocument) =>
    mutations.push(
      create(MutationSchema, {
        body: {
          case: "documentPut",
          value: { document: create(DocumentPayloadSchema, { id: item.id, format: source.format, schemaVersion: source.schemaVersion ?? 1, body: bodyOf(source, item) }) },
        },
      }),
    );
  for (const item of source.list()) {
    present.add(item.id);
    const existing = doc.documents[item.id];
    if (!existing) {
      put(item);
      continue;
    }
    if (existing.format !== source.format) {
      collisions.push({ id: item.id, format: existing.format });
      continue;
    }
    if (!ownedBy(source, existing)) continue;
    if ((source.update ?? "identity-only") === "replace-body" && !sameBody(existing.body as JsonObject | undefined, bodyOf(source, item))) put(item);
  }
  const bound = new Set(Object.values(doc.views).flatMap((view) => Object.values(view.documents)));
  for (const [id, payload] of Object.entries(doc.documents)) {
    if (payload.format !== source.format || present.has(id) || bound.has(id) || !ownedBy(source, payload)) continue;
    mutations.push(create(MutationSchema, { body: { case: "documentDelete", value: { documentId: id } } }));
  }
  return { mutations, collisions };
}

export interface ConnectDocumentSourceOptions {
  /** A listed id names a document of another format; default `console.warn`, once per id. */
  onCollision?(collision: SourceCollision, source: DocumentSource): void;
}

/**
 * Keep the core's document in line with a source: once on connect, again on
 * every change the source reports, and again whenever the core's document
 * changes under it (a restore, a reset, a sync adoption), so a document that
 * arrived without stubs gets them. The returned function disconnects.
 *
 * Reconciliation is tried synchronously — a resource added and bound in
 * the same tick finds its stub — and, when the core refuses it as reentrant
 * (the signal came from inside a publication), retried once in a microtask,
 * after the publication that triggered it. A sync that finds nothing to do
 * applies nothing, which is what stops the core subscription feeding itself.
 */
export function connectDocumentSource(core: WorkbenchCore, source: DocumentSource, options: ConnectDocumentSourceOptions = {}): () => void {
  let disposed = false;
  let deferred = false;
  const reported = new Set<string>();
  const sync = () => {
    if (disposed) return;
    const { mutations, collisions } = documentSourceMutations(core.getState().document, source);
    for (const collision of collisions) {
      if (reported.has(collision.id)) continue;
      reported.add(collision.id);
      if (options.onCollision) options.onCollision(collision, source);
      else console.warn(`workbench-core: document source "${source.id}" lists "${collision.id}", which is a "${collision.format}" document, not "${source.format}"; left untouched`);
    }
    if (mutations.length === 0) return;
    const applied = core.apply(mutations);
    if (!applied.ok && applied.code === "reentrant_execution" && !deferred) {
      deferred = true;
      queueMicrotask(() => {
        deferred = false;
        sync();
      });
    }
  };
  sync();
  const unsubscribeSource = source.subscribe?.(sync) ?? (() => undefined);
  const unsubscribeCore = core.subscribe(sync);
  return () => {
    disposed = true;
    unsubscribeSource();
    unsubscribeCore();
  };
}
