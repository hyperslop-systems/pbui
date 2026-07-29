import { useCallback, useEffect, useMemo } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { api, useDatasetTableQuery, useStreamTableQuery } from "../api/client";
import { useAnalysisResultFor, useDocAnalysis } from "../appkit/AnalysisProvider";
import { buildPlotFromResult } from "../model/plot";
import {
  applyDefaultView,
  cloneGraphicDocument,
  documentLimit,
  fieldsAtRelation,
  rootSource,
  rootView,
} from "../model/graphicAuthoring";
import type { Field, Table } from "../model/table";
import type { DocId } from "../pbui/types";
import type { AppStore, RootState } from "../store";
import { worldActions, type Doc } from "../store/world";

export const DATASET_ROW_LIMIT = 1_000_000;

export function useDocTable(docId: DocId | null): {
  table: Table | undefined;
  loading: boolean;
  error: unknown;
} {
  const doc = useSelector((state: RootState) =>
    docId
      ? state.world.docs[docId]
      : state.world.activeDocId
        ? state.world.docs[state.world.activeDocId]
        : undefined,
  );
  const dispatch = useDispatch();
  const source = doc ? rootSource(doc) : null;
  const limit = doc ? documentLimit(doc) : 2_000;

  const stream = useStreamTableQuery(
    {
      drop: source?.drop ?? "",
      stream: source?.stream ?? "events",
      limit,
      order: "desc",
    },
    { skip: source?.kind !== "stream" || !source.drop },
  );
  const dataset = useDatasetTableQuery(
    {
      drop: source?.drop ?? "",
      dataset: source?.dataset ?? "",
      version: source?.version ?? "latest",
      path: source?.path ?? "",
      limit: DATASET_ROW_LIMIT,
    },
    { skip: source?.kind !== "dataset" || !source.drop },
  );
  const query = source?.kind === "dataset" ? dataset : stream;
  const table = query.data;

  useEffect(() => {
    if (!table || !doc || Object.keys(rootView(doc).encodings).length > 0) return;
    const document = cloneGraphicDocument(doc);
    applyDefaultView(document, table);
    dispatch(worldActions.setDocument({ docId: doc.id, document }));
  }, [table, doc, dispatch]);

  return { table, loading: query.isFetching, error: query.error };
}

/** Synchronous PBUI lookup of the latest current DuckDB result. */
export function useTableFor(): (docId: DocId | null) => Table | null {
  const store = useStore() as AppStore;
  const resultFor = useAnalysisResultFor();
  return useCallback(
    (docId: DocId | null) => {
      const world = store.getState().world;
      const id = docId ?? world.activeDocId;
      if (!id) return null;
      const execution = resultFor(id);
      const doc = world.docs[id];
      const source = doc ? rootSource(doc) : null;
      if (!execution || !source) return null;
      return {
        source,
        fields: execution.result.fields,
        rows: execution.result.rows,
        row_count: execution.result.rows.length,
        truncated: execution.result.coverage.hasMore || execution.result.resultTruncated,
        strategy: execution.result.coverage.strategy,
      };
    },
    [resultFor, store],
  );
}

export function useDocAnalysisResult(docId: DocId | null) {
  const doc = useSelector((state: RootState) =>
    docId
      ? state.world.docs[docId]
      : state.world.activeDocId
        ? state.world.docs[state.world.activeDocId]
        : undefined,
  );
  const { table, loading, error } = useDocTable(docId);
  const analysis = useDocAnalysis(doc, table);
  return {
    doc,
    table,
    pipeline: analysis.execution?.result ?? null,
    metrics: analysis.execution?.metrics ?? null,
    loading: loading || analysis.status === "loading",
    error: error ?? analysis.error,
  };
}

export function useDocPlot(docId: DocId | null, width: number, height: number) {
  const { doc, table, pipeline, metrics, loading, error } = useDocAnalysisResult(docId);
  const view = doc ? rootView(doc) : null;
  const plot = useMemo(
    () => (pipeline && view ? buildPlotFromResult(pipeline, view, width, height) : null),
    [pipeline, view, width, height],
  );
  return { doc, table, pipeline, metrics, plot, loading, error };
}

/** Synchronous schema inference from the canonical graph; never executes rows. */
export function useFieldsFor(): (docId: DocId | null) => Field[] {
  const store = useStore() as AppStore;
  return useCallback(
    (docId: DocId | null) => {
      const world = store.getState().world;
      const doc = world.docs[docId ?? world.activeDocId ?? ""];
      if (!doc) return [];
      const table = selectDocSourceTable(store.getState(), doc);
      if (!table) return [];
      return fieldsAtRelation(doc, table, rootView(doc).relation);
    },
    [store],
  );
}

/** Select the one RTK Query entry described by every canonical source argument. */
export function selectDocSourceTable(state: RootState, doc: Doc): Table | undefined {
  const source = rootSource(doc);
  if (!source?.drop) return undefined;
  const limit = documentLimit(doc);
  if (source.kind === "stream") {
    return api.endpoints.streamTable.select({
      drop: source.drop,
      stream: source.stream ?? "events",
      limit,
      order: "desc",
    })(state).data;
  }
  return api.endpoints.datasetTable.select({
    drop: source.drop,
    dataset: source.dataset ?? "",
    version: source.version ?? "latest",
    path: source.path ?? "",
    limit: DATASET_ROW_LIMIT,
  })(state).data;
}
