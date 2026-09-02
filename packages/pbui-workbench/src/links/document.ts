import { create } from "@bufbuild/protobuf";
import { EMPTY_LINK_STATE, isBinding, isSerializableReference, type Binding, type IdentityClass, type IdentityDeclaration, type LinkState, type PortId, type SerializableReference } from "@hyperslop-systems/pbui";
import { DocumentPayloadSchema, MutationSchema, type Mutation, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";

/**
 * The link document (design D3): every DECLARATION of the topology — which
 * port follows what, which is held on which serialized value, which ports
 * share a cell (Phase 5), the compiled classes with their persistent ids,
 * and the pre-merge history — as one `pbui.links` DocumentPayload inside the
 * workbench document, beside the rebalance config and the plot scripts. It
 * serializes, restores, syncs and rides `plan`/`applyPlan` wherever the
 * document does; there is no second persistence mechanism. Runtime VALUES
 * never enter it — see `runtime.ts`.
 *
 * A missing or foreign-format payload reads as "no links", never as an
 * error; an entry that fails structural validation is dropped on read.
 */
export const LINKS_DOC_ID = "pbui.links";
export const LINKS_FORMAT = "pbui.links";
export const LINKS_SCHEMA_VERSION = 1;

export interface LinksPayload {
  /** Explicit terms per port. Absent port ⇒ the effective binding is the declared fallback. */
  bindings: Record<PortId, Binding>;
  identity: IdentityDeclaration[];
  classes: IdentityClass[];
  history: Record<PortId, SerializableReference | null>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const MERGE = new Set(["prefer-left", "prefer-right", "require-equal"]);

function isDeclaration(v: unknown): v is IdentityDeclaration {
  return isRecord(v) && typeof v.linkId === "string" && typeof v.left === "string" && typeof v.right === "string" && MERGE.has(String(v.mergePolicy));
}

function isClass(v: unknown): v is IdentityClass {
  return isRecord(v) && typeof v.id === "string" && Array.isArray(v.members) && v.members.every((m) => typeof m === "string") && typeof v.fingerprint === "string";
}

export function readLinks(doc: WorkbenchDocument): LinksPayload {
  const empty: LinksPayload = { bindings: {}, identity: [], classes: [], history: {} };
  const payload = doc.documents[LINKS_DOC_ID];
  if (!payload || payload.format !== LINKS_FORMAT) return empty;
  const body = payload.body;
  if (!isRecord(body)) return empty;
  const bindings: Record<PortId, Binding> = {};
  if (isRecord(body.bindings)) {
    for (const [port, term] of Object.entries(body.bindings)) if (isBinding(term)) bindings[port] = term;
  }
  const identity = Array.isArray(body.identity) ? (body.identity as unknown[]).filter(isDeclaration) : [];
  const classes = Array.isArray(body.classes) ? (body.classes as unknown[]).filter(isClass) : [];
  const history: Record<PortId, SerializableReference | null> = {};
  if (isRecord(body.history)) {
    for (const [port, value] of Object.entries(body.history)) if (value === null || isSerializableReference(value)) history[port] = value;
  }
  return { bindings, identity, classes, history };
}

export function stateOf(doc: WorkbenchDocument): LinkState {
  const payload = readLinks(doc);
  return { bindings: new Map(Object.entries(payload.bindings)), identity: payload.identity, classes: payload.classes, history: new Map(Object.entries(payload.history)) };
}

export function bindingsOf(doc: WorkbenchDocument): ReadonlyMap<PortId, Binding> {
  return stateOf(doc).bindings;
}

function isEmpty(state: LinkState): boolean {
  return state.bindings.size === 0 && state.identity.length === 0 && state.classes.length === 0 && state.history.size === 0;
}

/** One idempotent `documentPut` of the whole payload; an empty state deletes the payload instead. */
export function linksMutation(state: LinkState): Mutation {
  if (isEmpty(state)) {
    return create(MutationSchema, { body: { case: "documentDelete", value: { documentId: LINKS_DOC_ID } } });
  }
  const sorted = [...state.bindings.entries()].sort(([a], [b]) => a.localeCompare(b));
  const history = [...state.history.entries()].sort(([a], [b]) => a.localeCompare(b));
  const body: LinksPayload = { bindings: Object.fromEntries(sorted), identity: [...state.identity], classes: [...state.classes], history: Object.fromEntries(history) };
  return create(MutationSchema, {
    body: {
      case: "documentPut",
      value: {
        document: create(DocumentPayloadSchema, {
          id: LINKS_DOC_ID,
          format: LINKS_FORMAT,
          schemaVersion: LINKS_SCHEMA_VERSION,
          // Terms are JSON by construction (D4); the round trip is what the Struct type wants.
          body: JSON.parse(JSON.stringify(body)),
        }),
      },
    },
  });
}

/** The mutation that turns the document's current state into `next`, or null when nothing changes. */
export function linksChange(doc: WorkbenchDocument, next: LinkState | ReadonlyMap<PortId, Binding>): Mutation | null {
  const current = stateOf(doc);
  const wanted: LinkState = next instanceof Map ? { ...current, bindings: next } : (next as LinkState);
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (
    current.bindings.size === wanted.bindings.size &&
    [...wanted.bindings].every(([port, term]) => same(current.bindings.get(port), term)) &&
    same(current.identity, wanted.identity) &&
    same(current.classes, wanted.classes) &&
    same([...current.history], [...wanted.history])
  ) {
    return null;
  }
  if (isEmpty(wanted) && !doc.documents[LINKS_DOC_ID]) return null;
  return linksMutation(wanted);
}

export { EMPTY_LINK_STATE };
