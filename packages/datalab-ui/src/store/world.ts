import { createSlice, current, isDraft, type PayloadAction } from "@reduxjs/toolkit";
import type {
  AnalysisSpec,
  AuthoringFieldRef,
  AuthoringTransform,
  Channel,
  FacetScalePolicy,
  GraphicDocument,
  Mark,
} from "../model/graphic";
import {
  appendTransform,
  cloneGraphicDocument,
  createGraphicDocument,
  documentLimit,
  moveTransform,
  removeTransform,
  replaceDocumentSource,
  rootView,
  setDocumentLimit,
} from "../model/graphicAuthoring";
import type { SourceRef } from "../model/table";
import type { DocId, PresentationType } from "../pbui/types";
import { remoteWorkbenchLoaded } from "./remote";

/**
 * The world: documents, snapshots, and the trace.
 *
 * Redux with immutable updates rather than the prototype's mutate-and-notify
 * (pbui-gog.jsx:709, :2459-2464), for three reasons in order of weight (DR-7):
 *
 *  - Fifteen tiles over 50 000 rows cannot afford a whole-tree re-render per
 *    keystroke. Selector subscriptions confine an update to the tiles that care.
 *  - In-place mutation defeats useMemo outright: `steps` keeps its identity
 *    through an edit, so a memo keyed on it never invalidates. That is worse
 *    than having no memo, because it is wrong rather than merely slow.
 *  - Serialisable state makes persistence, permalinks and snapshot equality fall
 *    out instead of needing three encoders.
 */

/** The canonical persisted analytical document. */
export type Doc = GraphicDocument;

export interface Snapshot {
  id: string;
  name: string;
  at: string;
  document: GraphicDocument;
}

export interface WatchEntry {
  id: string;
  ptype: PresentationType;
  value: unknown;
}

export interface TraceEntry {
  seq: number;
  type: string;
  detail: string;
  note?: string;
}

export interface WorldState {
  docs: Record<DocId, Doc>;
  docOrder: DocId[];
  activeDocId: DocId | null;
  snapshots: Record<string, Snapshot>;
  snapshotOrder: string[];
  pins: [string | null, string | null];
  watch: WatchEntry[];
  trace: TraceEntry[];
  inspected: { title: string; value: unknown } | null;
}

/**
 * The trace is capped and drops from the front.
 *
 * The prototype's grows without bound (pbui-gog.jsx:710). At one entry per
 * keystroke in a step editor, a long session is a memory leak with a scrollbar.
 * It is a teaching surface, not an audit log of record.
 */
export const TRACE_CAP = 500;

const DOC_NAMES = ["α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ", "λ", "μ"];

/**
 * UUIDs, not counters (DR-12).
 *
 * The prototype's counter-based ids collide after a reload, which it fixes by
 * walking the restored tree and bumping the counter past the highest id
 * (pbui-gog.jsx:236-238). A collision there is a duplicate React key *and* a
 * hit-test returning the wrong tile. UUIDs remove the class of bug instead of
 * the instance, and stay unique across tabs and exported layouts.
 */
export function newId(): string {
  return crypto.randomUUID();
}

export const DEFAULT_LIMIT = 2_000;

/**
 * Deep-copy a spec out of a reducer.
 *
 * `structuredClone` alone throws `DataCloneError` here: createSlice runs
 * reducers under Immer, so `doc.spec` is a Proxy over a draft rather than a
 * plain object, and a Proxy cannot be structurally cloned.
 *
 * Immer's `current()` materialises the draft into a plain value first. This is
 * worth understanding rather than pattern-matching, because the obvious
 * alternative — a spread — does NOT throw. It produces a shallow copy that
 * aliases `steps` and `mapping`, so every snapshot silently tracks the document
 * it was taken from, which is precisely the defect the snapshot tests exist to
 * catch and precisely the kind that survives review.
 */
function cloneDocument(document: GraphicDocument, id = document.id): GraphicDocument {
  const plain = isDraft(document) ? (current(document) as GraphicDocument) : document;
  return cloneGraphicDocument(plain, id);
}

export const initialWorld: WorldState = {
  docs: {},
  docOrder: [],
  activeDocId: null,
  snapshots: {},
  snapshotOrder: [],
  pins: [null, null],
  watch: [],
  trace: [],
  inspected: null,
};

/** Append to the trace, dropping from the front at the cap. */
function trace(state: WorldState, type: string, detail: string, note?: string) {
  const seq = (state.trace[state.trace.length - 1]?.seq ?? 0) + 1;
  state.trace.push({ seq, type, detail, ...(note ? { note } : {}) });
  if (state.trace.length > TRACE_CAP) state.trace.splice(0, state.trace.length - TRACE_CAP);
}

/** Resolve a verb's target: an explicit document, or the active one. */
function target(state: WorldState, docId: DocId | null): Doc | null {
  const id = docId ?? state.activeDocId;
  return id ? (state.docs[id] ?? null) : null;
}

function nextName(state: WorldState): string {
  const used = new Set(Object.values(state.docs).map((d) => d.name));
  const free = DOC_NAMES.find((n) => !used.has(n));
  return free ?? `${DOC_NAMES[0]}${state.docOrder.length}`;
}

/**
 * Product-internal Redux implementation.
 *
 * Sibling source modules and reducer tests use the slice directly, but it is
 * not part of the package export map. Keeping it out of declaration output
 * also prevents Immer's private draft implementation types from becoming an
 * accidental consumer contract.
 *
 * @internal
 */
export const worldSlice = createSlice({
  name: "world",
  initialState: initialWorld,
  reducers: {
    newDoc: {
      reducer(
        state,
        action: PayloadAction<{ id: DocId; source: SourceRef | null; limit: number }>,
      ) {
        const { id, source, limit } = action.payload;
        const doc = createGraphicDocument(
          id,
          nextName(state),
          source ?? { kind: "stream", drop: "" },
          limit,
        );
        state.docs[id] = doc;
        state.docOrder.push(id);
        state.activeDocId = id;
        trace(state, "doc_added", doc.name);
      },
      prepare(source: SourceRef | null, limit = DEFAULT_LIMIT) {
        return { payload: { id: newId(), source, limit } };
      },
    },

    /**
     * Merge documents minted by an import (DATADROP-8).
     *
     * The ids are already fixed by the caller — `store/effects.ts` mints them
     * so the conversion stays a pure function — so this reducer only has to
     * place them. It deliberately does NOT change `activeDocId`: importing a
     * workspace should not re-aim every ambient verb in the tiles the user was
     * already looking at.
     */
    addDocs(state, action: PayloadAction<Record<DocId, Doc>>) {
      for (const doc of Object.values(action.payload)) {
        if (state.docs[doc.id]) continue;
        state.docs[doc.id] = doc;
        state.docOrder.push(doc.id);
        trace(state, "doc_imported", doc.name);
      }
      if (!state.activeDocId) state.activeDocId = state.docOrder[0] ?? null;
    },

    /**
     * Note in the trace that something was copied out.
     *
     * The KIND and the NAME, never the payload. The trace is a teaching surface
     * people screenshot, and a bundle contains the sources and filters the user
     * set — which is exactly what §7.6 says must not be deposited anywhere it
     * was not deliberately pasted.
     */
    noteExport: {
      reducer(state, action: PayloadAction<{ kind: string; name: string }>) {
        trace(
          state,
          "exported",
          `${action.payload.kind} “${action.payload.name}”`,
          "to the clipboard",
        );
      },
      prepare(kind: string, name: string) {
        return { payload: { kind, name } };
      },
    },

    setActiveDoc(state, action: PayloadAction<DocId>) {
      const doc = state.docs[action.payload];
      if (!doc || state.activeDocId === doc.id) return;
      state.activeDocId = doc.id;
      trace(state, "doc_activated", doc.name, "ambient verbs now act on it");
    },

    renameDoc(state, action: PayloadAction<{ docId: DocId; name: string }>) {
      const doc = state.docs[action.payload.docId];
      if (!doc || !action.payload.name) return;
      doc.name = action.payload.name;
      trace(state, "doc_renamed", doc.name);
    },

    duplicateDoc(state, action: PayloadAction<{ docId: DocId; id: DocId }>) {
      const source = state.docs[action.payload.docId];
      if (!source) return;
      const doc = cloneDocument(source, action.payload.id);
      doc.name = `${source.name}′`;
      state.docs[doc.id] = doc;
      state.docOrder.push(doc.id);
      state.activeDocId = doc.id;
      trace(state, "doc_duplicated", `${source.name} → ${doc.name}`);
    },

    deleteDoc(state, action: PayloadAction<DocId>) {
      // Keep at least one document: every doc-bound tile would otherwise have
      // nothing to show and no way to get something.
      if (state.docOrder.length < 2) return;
      const doc = state.docs[action.payload];
      if (!doc) return;
      delete state.docs[doc.id];
      state.docOrder = state.docOrder.filter((id) => id !== doc.id);
      // Reassign rather than leaving activeDocId dangling, which would make
      // every ambient verb a silent no-op.
      if (state.activeDocId === doc.id) state.activeDocId = state.docOrder[0] ?? null;
      trace(state, "doc_removed", doc.name);
    },

    setDocSource(state, action: PayloadAction<{ docId: DocId | null; source: SourceRef }>) {
      const doc = target(state, action.payload.docId);
      if (!doc) return;
      // A new source invalidates the pipeline and the encoding: both name
      // columns that the new source may not have. Resetting is honest; keeping
      // them would produce a chart that refuses to draw with no obvious cause.
      replaceDocumentSource(doc, action.payload.source);
      trace(state, "source_set", action.payload.source.drop, "pipeline and encoding reset");
    },

    setDocLimit(state, action: PayloadAction<{ docId: DocId | null; limit: number }>) {
      const doc = target(state, action.payload.docId);
      if (!doc) return;
      setDocumentLimit(doc, action.payload.limit);
      trace(state, "limit_set", `${action.payload.limit} rows`);
    },

    setDocument(state, action: PayloadAction<{ docId: DocId | null; document: GraphicDocument }>) {
      const doc = target(state, action.payload.docId);
      if (!doc) return;
      state.docs[doc.id] = action.payload.document;
    },

    setMapping(
      state,
      action: PayloadAction<{
        docId: DocId | null;
        channel: Channel;
        field: AuthoringFieldRef | null;
      }>,
    ) {
      const doc = target(state, action.payload.docId);
      if (!doc) return;
      const view = rootView(doc);
      if (action.payload.field === null) delete view.encodings[action.payload.channel];
      else view.encodings[action.payload.channel] = action.payload.field;
      trace(
        state,
        "encoded",
        `${action.payload.channel} ↦ ${action.payload.field?.name ?? "(none)"}`,
      );
    },

    setGeom(state, action: PayloadAction<{ docId: DocId | null; geom: Mark }>) {
      const doc = target(state, action.payload.docId);
      if (!doc) return;
      rootView(doc).mark = action.payload.geom;
      trace(state, "geom_set", action.payload.geom);
    },

    setYScale(state, action: PayloadAction<{ docId: DocId | null; scale: "linear" | "log" }>) {
      const doc = target(state, action.payload.docId);
      if (!doc) return;
      rootView(doc).yScale = action.payload.scale;
      trace(state, "scale_set", `y ${action.payload.scale}`);
    },

    setAnalysis(state, action: PayloadAction<{ docId: DocId | null; analysis: AnalysisSpec }>) {
      const doc = target(state, action.payload.docId);
      if (!doc) return;
      rootView(doc).analysis = action.payload.analysis;
      trace(state, "analysis_set", action.payload.analysis.kind);
    },

    setFacetScales(
      state,
      action: PayloadAction<{ docId: DocId | null; scales: FacetScalePolicy }>,
    ) {
      const doc = target(state, action.payload.docId);
      if (!doc) return;
      rootView(doc).facetScales = action.payload.scales;
      trace(state, "facet_scales_set", action.payload.scales);
    },

    addTransform(
      state,
      action: PayloadAction<{ docId: DocId | null; transform: AuthoringTransform }>,
    ) {
      const doc = target(state, action.payload.docId);
      if (!doc) return;
      appendTransform(doc, action.payload.transform);
      trace(state, "transform_added", action.payload.transform.kind);
    },

    updateTransform(
      state,
      action: PayloadAction<{ docId: DocId | null; transform: AuthoringTransform }>,
    ) {
      const doc = target(state, action.payload.docId);
      if (!doc?.transforms[action.payload.transform.id]) return;
      doc.transforms[action.payload.transform.id] = action.payload.transform;
    },

    toggleTransform(state, action: PayloadAction<{ docId: DocId | null; transformId: string }>) {
      const doc = target(state, action.payload.docId);
      const transform = doc?.transforms[action.payload.transformId];
      if (!transform) return;
      transform.enabled = !transform.enabled;
      trace(state, "transform_toggled", `${transform.kind} ${transform.enabled ? "on" : "off"}`);
    },

    moveTransform(
      state,
      action: PayloadAction<{ docId: DocId | null; transformId: string; by: -1 | 1 }>,
    ) {
      const doc = target(state, action.payload.docId);
      if (!doc) return;
      moveTransform(doc, action.payload.transformId, action.payload.by);
      trace(state, "transform_moved", action.payload.by < 0 ? "up" : "down");
    },

    removeTransform(state, action: PayloadAction<{ docId: DocId | null; transformId: string }>) {
      const doc = target(state, action.payload.docId);
      if (!doc) return;
      removeTransform(doc, action.payload.transformId);
      trace(state, "transform_removed", action.payload.transformId);
    },

    snapshot: {
      reducer(state, action: PayloadAction<{ id: string; docId: DocId; at: string }>) {
        const doc = state.docs[action.payload.docId];
        if (!doc) return;
        const snapshot: Snapshot = {
          id: action.payload.id,
          name: `${doc.name}-${state.snapshotOrder.length + 1}`,
          at: action.payload.at,
          // A deep copy, so later mutation of the document does not move the
          // snapshot. This is the one line the whole feature depends on.
          document: cloneDocument(doc),
        };
        state.snapshots[snapshot.id] = snapshot;
        state.snapshotOrder.push(snapshot.id);
        trace(state, "snapshotted", snapshot.name);
      },
      prepare(docId: DocId, at: string) {
        return { payload: { id: newId(), docId, at } };
      },
    },

    restoreSnapshot(state, action: PayloadAction<{ snapshotId: string; docId: DocId | null }>) {
      const snapshot = state.snapshots[action.payload.snapshotId];
      const doc = target(state, action.payload.docId);
      if (!snapshot || !doc) return;
      state.docs[doc.id] = cloneDocument(snapshot.document, doc.id);
      trace(state, "restored", `${snapshot.name} → ${doc.name}`);
    },

    deleteSnapshot(state, action: PayloadAction<string>) {
      delete state.snapshots[action.payload];
      state.snapshotOrder = state.snapshotOrder.filter((id) => id !== action.payload);
      state.pins = state.pins.map((p) => (p === action.payload ? null : p)) as [
        string | null,
        string | null,
      ];
      trace(state, "snapshot_deleted", action.payload);
    },

    pinSnapshot(state, action: PayloadAction<{ slot: 0 | 1; snapshotId: string }>) {
      state.pins[action.payload.slot] = action.payload.snapshotId;
      trace(state, "pinned", action.payload.slot === 0 ? "A" : "B");
    },

    watchAdd: {
      reducer(state, action: PayloadAction<WatchEntry>) {
        state.watch.push(action.payload);
        trace(state, "watched", action.payload.ptype);
      },
      prepare(ptype: PresentationType, value: unknown) {
        return { payload: { id: newId(), ptype, value } };
      },
    },

    watchRemove(state, action: PayloadAction<string>) {
      state.watch = state.watch.filter((w) => w.id !== action.payload);
    },

    inspect(state, action: PayloadAction<{ title: string; value: unknown }>) {
      state.inspected = action.payload;
      trace(state, "inspected", action.payload.title);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(remoteWorkbenchLoaded, (state, action) => {
      const preserved = new Set(action.payload.preserveDocumentIds);
      const docs: Record<DocId, Doc> = {};
      const docOrder: DocId[] = [];
      for (const id of state.docOrder) {
        const document = state.docs[id];
        if (preserved.has(id) && document) {
          docs[id] = document;
          docOrder.push(id);
        }
      }
      for (const [id, document] of Object.entries(action.payload.state.documents)) {
        if (preserved.has(id)) continue;
        docs[id] = document;
        if (!docOrder.includes(id)) docOrder.push(id);
      }
      state.docs = docs;
      state.docOrder = docOrder;
      if (!state.activeDocId || !docs[state.activeDocId]) {
        state.activeDocId = Object.keys(action.payload.state.documents)[0] ?? docOrder[0] ?? null;
      }
    });
  },
});

/**
 * Product-internal action creators.
 *
 * Components dispatch these inside the bundled implementation; package
 * consumers do not import them. Their inferred RTK types include Immer draft
 * details and therefore belong in source typechecking, not in the public
 * declaration artifact.
 *
 * @internal
 */
export const worldActions = worldSlice.actions;

export { documentLimit };
