import { create, type JsonObject } from "@bufbuild/protobuf";
import { DocumentPayloadSchema, MutationSchema, type Mutation, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
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
 */
export interface DocumentSource {
  /** The format every stub this source contributes carries; the connector removes only stubs of this format. */
  readonly format: string;
  /** Default 1. */
  readonly schemaVersion?: number;
  /** The resources that exist right now. A body is written once, when the stub is created. */
  list(): readonly { id: string; body?: JsonObject }[];
  /** Fires when membership may have changed; omit for a source that never changes. */
  subscribe?(listener: () => void): () => void;
}

/**
 * The batch that brings the document's stubs in line with the source: a
 * stub for every resource the source lists, and no stub of this format for
 * a resource it no longer lists — unless a view still binds it. The applier
 * refuses to delete a bound document (`document_in_use`), so such a stub
 * stays until the view goes, and the next sync removes it.
 */
export function documentSourceMutations(doc: WorkbenchDocument, source: DocumentSource): Mutation[] {
  const out: Mutation[] = [];
  const present = new Set<string>();
  for (const item of source.list()) {
    present.add(item.id);
    if (doc.documents[item.id]) continue;
    out.push(
      create(MutationSchema, {
        body: {
          case: "documentPut",
          value: { document: create(DocumentPayloadSchema, { id: item.id, format: source.format, schemaVersion: source.schemaVersion ?? 1, body: item.body ?? {} }) },
        },
      }),
    );
  }
  const bound = new Set(Object.values(doc.views).flatMap((view) => Object.values(view.documents)));
  for (const [id, payload] of Object.entries(doc.documents)) {
    if (payload.format !== source.format || present.has(id) || bound.has(id)) continue;
    out.push(create(MutationSchema, { body: { case: "documentDelete", value: { documentId: id } } }));
  }
  return out;
}

/**
 * Keep the core's document in line with a source: once on connect, again on
 * every change the source reports, and again whenever the core's document
 * changes under it (a restore, a reset, a sync adoption), so a document that
 * arrived without stubs gets them. The returned function disconnects.
 *
 * A sync that finds nothing to do applies nothing, which is what stops the
 * core subscription from feeding itself.
 */
export function connectDocumentSource(core: WorkbenchCore, source: DocumentSource): () => void {
  let disposed = false;
  let deferred = false;
  const sync = () => {
    if (disposed) return;
    const mutations = documentSourceMutations(core.getState().document, source);
    if (mutations.length === 0) return;
    const applied = core.apply(mutations);
    // Signalled from inside a publication (a core subscriber, a receipt
    // hook): the core refuses a nested transaction (design doc 04 §6.3), so
    // the reconcile runs after it — one microtask, however many signals.
    // Outside a publication the stub lands synchronously, which is what a
    // caller that adds a resource and opens a view in the same tick needs.
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
