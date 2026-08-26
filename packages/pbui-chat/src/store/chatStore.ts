import { useSyncExternalStore } from "react";
import type { Reference } from "../types";
import { referenceKey } from "../types";

export interface TableFilter {
  field: string;
  op: string;
  value: string;
}

export interface TableSort {
  field: string;
  dir: "asc" | "desc";
}

export interface TableState {
  filters: TableFilter[];
  sort: TableSort | null;
}

export interface InspectedReference {
  title: string;
  reference: Reference;
}

export interface ComposerDraft {
  text: string;
  /** References inserted through `insertReference`, keyed by `type:id`. */
  refs: Record<string, Reference>;
}

export interface PbuiChatState {
  inspected: InspectedReference | null;
  watchlist: Reference[];
  tables: Record<string, TableState>;
  /** Widget instance ids that `openInTile` moved out of the transcript. */
  tiles: string[];
  /** The last presentation the pointer or focus rested on. */
  focus: Reference | null;
  /** Composer-owned state, isolated by conversation id. */
  drafts: Record<string, ComposerDraft>;
}

export const EMPTY_TABLE_STATE: TableState = { filters: [], sort: null };

const initialState: PbuiChatState = {
  inspected: null,
  watchlist: [],
  tables: {},
  tiles: [],
  focus: null,
  drafts: {},
};

/**
 * The small amount of UI state the chat layer owns outside chat-provider's
 * redux store: what is inspected, what is watched, local table filters, which
 * widgets live in tiles, the composer's draft. A `useSyncExternalStore` store
 * rather than another redux slice because the router — plain code, no React —
 * is its main writer and products read it from their own components.
 */
export interface PbuiChatStore {
  getState(): PbuiChatState;
  subscribe(listener: () => void): () => void;
  setState(update: Partial<PbuiChatState> | ((state: PbuiChatState) => Partial<PbuiChatState>)): void;
  reset(): void;

  inspect(reference: Reference, title?: string): void;
  clearInspected(): void;
  watch(reference: Reference): void;
  unwatch(reference: Pick<Reference, "type" | "id">): void;

  tableState(tableId: string): TableState;
  addFilter(tableId: string, filter: TableFilter): void;
  removeFilter(tableId: string, index: number): void;
  clearFilters(tableId: string): void;
  sortBy(tableId: string, field: string, dir: "asc" | "desc"): void;

  openTile(widgetId: string): void;
  closeTile(widgetId: string): void;

  setFocus(reference: Reference | null): void;

  draftFor(conversationId: string): ComposerDraft;
  setDraftText(conversationId: string, text: string): void;
  /** Append `[[type:id|label]]` to one conversation's draft and remember the reference. */
  insertReference(conversationId: string, reference: Reference, label: string): void;
  removeDraftReference(conversationId: string, reference: Pick<Reference, "type" | "id">): void;
  clearDraft(conversationId: string): void;
  forgetDraft(conversationId: string): void;
}

export function createPbuiChatStore(): PbuiChatStore {
  let state: PbuiChatState = initialState;
  const listeners = new Set<() => void>();

  function setState(update: Partial<PbuiChatState> | ((state: PbuiChatState) => Partial<PbuiChatState>)) {
    const patch = typeof update === "function" ? update(state) : update;
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  }

  function updateTable(tableId: string, fn: (table: TableState) => TableState) {
    setState((s) => ({ tables: { ...s.tables, [tableId]: fn(s.tables[tableId] ?? EMPTY_TABLE_STATE) } }));
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setState,
    reset: () => setState(initialState),

    inspect: (reference, title) =>
      setState({ inspected: { title: title ?? `<${reference.type}> ${reference.id}`, reference } }),
    clearInspected: () => setState({ inspected: null }),
    watch: (reference) =>
      setState((s) => {
        const key = referenceKey(reference.type, reference.id);
        if (s.watchlist.some((r) => referenceKey(r.type, r.id) === key)) return {};
        return { watchlist: [...s.watchlist, reference] };
      }),
    unwatch: (reference) =>
      setState((s) => ({
        watchlist: s.watchlist.filter((r) => !(r.type === reference.type && r.id === reference.id)),
      })),

    tableState: (tableId) => state.tables[tableId] ?? EMPTY_TABLE_STATE,
    addFilter: (tableId, filter) => updateTable(tableId, (t) => ({ ...t, filters: [...t.filters, filter] })),
    removeFilter: (tableId, index) =>
      updateTable(tableId, (t) => ({ ...t, filters: t.filters.filter((_, i) => i !== index) })),
    clearFilters: (tableId) => updateTable(tableId, (t) => ({ ...t, filters: [] })),
    sortBy: (tableId, field, dir) => updateTable(tableId, (t) => ({ ...t, sort: { field, dir } })),

    openTile: (widgetId) =>
      setState((s) => (s.tiles.includes(widgetId) ? {} : { tiles: [...s.tiles, widgetId] })),
    closeTile: (widgetId) => setState((s) => ({ tiles: s.tiles.filter((id) => id !== widgetId) })),

    setFocus: (reference) => setState({ focus: reference }),

    draftFor: (conversationId) => state.drafts[conversationId] ?? { text: "", refs: {} },
    setDraftText: (conversationId, text) =>
      setState((s) => ({ drafts: { ...s.drafts, [conversationId]: { ...(s.drafts[conversationId] ?? { text: "", refs: {} }), text } } })),
    insertReference: (conversationId, reference, label) =>
      setState((s) => {
        const draft = s.drafts[conversationId] ?? { text: "", refs: {} };
        const mention = `[[${reference.type}:${reference.id}|${label.replace(/[\]\n]/g, " ").trim() || reference.id}]]`;
        const text = draft.text.length === 0 || /\s$/.test(draft.text) ? `${draft.text}${mention} ` : `${draft.text} ${mention} `;
        return {
          drafts: {
            ...s.drafts,
            [conversationId]: { text, refs: { ...draft.refs, [referenceKey(reference.type, reference.id)]: reference } },
          },
        };
      }),
    removeDraftReference: (conversationId, reference) =>
      setState((s) => {
        const draft = s.drafts[conversationId];
        if (!draft) return {};
        const key = referenceKey(reference.type, reference.id);
        const refs = { ...draft.refs };
        delete refs[key];
        return { drafts: { ...s.drafts, [conversationId]: { ...draft, refs } } };
      }),
    clearDraft: (conversationId) =>
      setState((s) => ({ drafts: { ...s.drafts, [conversationId]: { text: "", refs: {} } } })),
    forgetDraft: (conversationId) =>
      setState((s) => {
        if (!(conversationId in s.drafts)) return {};
        const drafts = { ...s.drafts };
        delete drafts[conversationId];
        return { drafts };
      }),
  };
}

const identity = <T,>(value: T): T => value;

export function usePbuiChatStore<T = PbuiChatState>(
  store: PbuiChatStore,
  selector: (state: PbuiChatState) => T = identity as (state: PbuiChatState) => T,
): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
