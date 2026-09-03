import type { DocumentPayload, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { documentSlots, type WorkbenchAppManifest } from "./apps";
import type { WorkbenchIndex } from "./graph";

/**
 * How a freshly created view of an application finds the documents it
 * shows (guide §8.6, simplification S11). Slot-aware: the policy sees every
 * declared document slot of the manifest, never one privileged `source` key
 * (F10). An application with no slots always gets `{}`.
 */
export interface InitialDocumentInput {
  readonly app: WorkbenchAppManifest;
  /** The manifest's document-slot port names, in declaration order. */
  readonly slots: readonly string[];
  /** What the caller asked for; keys outside `slots` are the caller's mistake and are reported. */
  readonly requested: Readonly<Record<string, string>>;
  readonly document: WorkbenchDocument;
  readonly index: WorkbenchIndex;
}

export type InitialDocumentResolution =
  | { kind: "bound"; documents: Readonly<Record<string, string>> }
  | { kind: "refused"; code: string; because: string; missing: readonly string[] };

export interface InitialDocumentPolicy {
  resolve(input: InitialDocumentInput): InitialDocumentResolution;
}

/** The default: bind exactly what was requested; a slot nobody named stays unbound. */
export function bindRequestedOnly(): InitialDocumentPolicy {
  return {
    resolve: ({ requested }) => ({ kind: "bound", documents: { ...requested } }),
  };
}

export interface FollowTheCrowdOptions {
  /** Which payloads may be bound by default. Omitted means any. */
  isBindable?(payload: DocumentPayload): boolean;
  /** Applications whose slots are never auto-filled (a launcher pane, an empty state). */
  unbound?: readonly string[];
  /**
   * Override the pick for one slot: return a document id, or null for
   * "nothing to bind". Default: the document another view already binds
   * under this slot, else the first bindable document.
   */
  pick?(doc: WorkbenchDocument, slot: string): string | null;
}

/**
 * The policy every family product had hand-written: a tile that opens
 * showing what everything else shows is almost always what the user meant.
 * Per slot: the requested id wins; else follow the crowd; else the first
 * bindable document; else leave the slot unbound (never refuse — an unbound
 * tile is legal and shows its empty state).
 */
export function followTheCrowd(options: FollowTheCrowdOptions = {}): InitialDocumentPolicy {
  const bindable = options.isBindable ?? (() => true);
  const pick =
    options.pick ??
    ((doc: WorkbenchDocument, slot: string): string | null => {
      for (const viewId of doc.viewOrder) {
        const bound = doc.views[viewId]?.documents[slot];
        if (bound && doc.documents[bound]) return bound;
      }
      for (const [documentId, payload] of Object.entries(doc.documents)) {
        if (bindable(payload)) return documentId;
      }
      return null;
    });
  return {
    resolve: ({ app, slots, requested, document: doc }) => {
      const documents: Record<string, string> = { ...requested };
      if (options.unbound?.includes(app.id)) return { kind: "bound", documents };
      for (const slot of slots) {
        if (documents[slot]) continue;
        const chosen = pick(doc, slot);
        if (chosen) documents[slot] = chosen;
      }
      return { kind: "bound", documents };
    },
  };
}

/**
 * The one door the planner uses. Requested keys that are not declared slots
 * are refused before a view is minted: the server would reject the batch as
 * `unknown_binding`, and an optimistic document that sits invalid until a
 * conflict repair is worse than a refusal now.
 */
export function resolveInitialDocuments(policy: InitialDocumentPolicy, app: WorkbenchAppManifest, requested: Readonly<Record<string, string>>, doc: WorkbenchDocument, index: WorkbenchIndex): InitialDocumentResolution {
  const slots = documentSlots(app);
  const unknown = Object.keys(requested).filter((key) => !slots.includes(key));
  if (unknown.length > 0) {
    return { kind: "refused", code: "unknown_binding", because: `application "${app.id}" does not define binding ${unknown.map((k) => `"${k}"`).join(", ")}`, missing: [] };
  }
  const resolved = policy.resolve({ app, slots, requested, document: doc, index });
  if (resolved.kind === "bound") {
    for (const [slot, documentId] of Object.entries(resolved.documents)) {
      if (!doc.documents[documentId]) return { kind: "refused", code: "unknown_document", because: `document "${documentId}" (for slot "${slot}") does not exist`, missing: [slot] };
    }
  }
  return resolved;
}
