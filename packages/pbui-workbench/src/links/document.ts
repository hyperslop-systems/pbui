import { create } from "@bufbuild/protobuf";
import { isBinding, type Binding, type PortId } from "@hyperslop-systems/pbui";
import { DocumentPayloadSchema, MutationSchema, type Mutation, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";

/**
 * The link document (design D3): every DECLARATION of the topology — which
 * port follows what, which is held on which serialized value — as one
 * `pbui.links` DocumentPayload inside the workbench document, beside the
 * rebalance config and the plot scripts. It serializes, restores, syncs and
 * rides `plan`/`applyPlan` wherever the document does; there is no second
 * persistence mechanism. Runtime VALUES (what a port emitted, what a context
 * holds) never enter it — see `runtime.ts`.
 *
 * A missing or foreign-format payload reads as "no links", never as an
 * error; a term that fails structural validation is dropped on read.
 */
export const LINKS_DOC_ID = "pbui.links";
export const LINKS_FORMAT = "pbui.links";
export const LINKS_SCHEMA_VERSION = 1;

export interface LinksPayload {
  /** Explicit terms per port. Absent port ⇒ the effective binding is the declared fallback. */
  bindings: Record<PortId, Binding>;
}

const EMPTY: LinksPayload = { bindings: {} };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function readLinks(doc: WorkbenchDocument): LinksPayload {
  const payload = doc.documents[LINKS_DOC_ID];
  if (!payload || payload.format !== LINKS_FORMAT) return EMPTY;
  const body = payload.body;
  if (!isRecord(body) || !isRecord(body.bindings)) return EMPTY;
  const bindings: Record<PortId, Binding> = {};
  for (const [port, term] of Object.entries(body.bindings)) {
    if (isBinding(term)) bindings[port] = term;
  }
  return { bindings };
}

export function bindingsOf(doc: WorkbenchDocument): ReadonlyMap<PortId, Binding> {
  return new Map(Object.entries(readLinks(doc).bindings));
}

/** One idempotent `documentPut` of the whole payload; an empty map deletes the payload instead. */
export function linksMutation(bindings: ReadonlyMap<PortId, Binding>): Mutation {
  if (bindings.size === 0) {
    return create(MutationSchema, { body: { case: "documentDelete", value: { documentId: LINKS_DOC_ID } } });
  }
  const sorted = [...bindings.entries()].sort(([a], [b]) => a.localeCompare(b));
  return create(MutationSchema, {
    body: {
      case: "documentPut",
      value: {
        document: create(DocumentPayloadSchema, {
          id: LINKS_DOC_ID,
          format: LINKS_FORMAT,
          schemaVersion: LINKS_SCHEMA_VERSION,
          // Terms are JSON by construction (D4); the round trip is what the Struct type wants.
          body: JSON.parse(JSON.stringify({ bindings: Object.fromEntries(sorted) })),
        }),
      },
    },
  });
}

/** The mutation that turns the document's current bindings into `next`, or null when nothing changes. */
export function linksChange(doc: WorkbenchDocument, next: ReadonlyMap<PortId, Binding>): Mutation | null {
  const current = bindingsOf(doc);
  if (current.size === next.size && [...next].every(([port, term]) => JSON.stringify(current.get(port)) === JSON.stringify(term))) return null;
  if (next.size === 0 && !doc.documents[LINKS_DOC_ID]) return null;
  return linksMutation(next);
}
