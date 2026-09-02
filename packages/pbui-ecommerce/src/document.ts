import { create } from "@bufbuild/protobuf";
import { PLOT_DOCUMENT_FORMAT, type PlotDocument } from "@hyperslop-systems/plot";
import { DocumentPayloadSchema, MutationSchema, type Mutation, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { TABLES, type TableName } from "./host";

/*
 * Two payload formats ride in the workbench document:
 *
 * - a PLOT is a `hyperslop.plot` document stored verbatim (its own `format`
 *   and `version` fields are inside the body; the envelope repeats them),
 *   the way plotscript stores scripts and the rebalance dialog its config —
 *   one persistence mechanism, no second one to keep in step;
 * - a TABLE document names one of the host's tables. It exists so a plot
 *   tile's `table` slot is a document id like any other slot, which is the
 *   seam PBUI-DATALAB-1 replaces with a relation document: nothing in the
 *   tile changes, only what the id resolves to.
 */

export const PLOT_FORMAT = PLOT_DOCUMENT_FORMAT;
export const PLOT_SCHEMA_VERSION = 1;
export const TABLE_FORMAT = "pbui-ecommerce.table";
export const TABLE_SCHEMA_VERSION = 1;

/** The slot names the plot tile reads. */
export const PLOT_SLOT = "plot";
export const TABLE_SLOT = "table";

export function tableDocumentId(table: TableName): string {
  return `table:${table}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function readPlotDocument(doc: WorkbenchDocument, id: string): PlotDocument | null {
  const payload = doc.documents[id];
  if (!payload || payload.format !== PLOT_FORMAT) return null;
  const body = payload.body;
  if (!isRecord(body) || body.format !== PLOT_DOCUMENT_FORMAT) return null;
  return body as unknown as PlotDocument;
}

/** Every plot in the document, in key order. */
export function listPlotDocuments(doc: WorkbenchDocument): PlotDocument[] {
  const out: PlotDocument[] = [];
  for (const id of Object.keys(doc.documents)) {
    const plot = readPlotDocument(doc, id);
    if (plot) out.push(plot);
  }
  return out;
}

export function readTableName(doc: WorkbenchDocument, id: string): TableName | null {
  const payload = doc.documents[id];
  if (!payload || payload.format !== TABLE_FORMAT) return null;
  const body = payload.body;
  if (!isRecord(body) || typeof body.table !== "string") return null;
  return (TABLES as readonly string[]).includes(body.table) ? (body.table as TableName) : null;
}

/** One idempotent `documentPut` holding the whole plot; the payload id is the plot id. */
export function plotDocumentMutation(plot: PlotDocument): Mutation {
  return create(MutationSchema, {
    body: {
      case: "documentPut",
      value: {
        document: create(DocumentPayloadSchema, {
          id: plot.id,
          format: PLOT_FORMAT,
          schemaVersion: PLOT_SCHEMA_VERSION,
          // A Struct wants plain JSON; the author helpers return frozen-ish
          // readonly shapes, so round-trip through JSON once.
          body: JSON.parse(JSON.stringify(plot)),
        }),
      },
    },
  });
}

export function tableDocumentMutation(table: TableName): Mutation {
  return create(MutationSchema, {
    body: {
      case: "documentPut",
      value: {
        document: create(DocumentPayloadSchema, {
          id: tableDocumentId(table),
          format: TABLE_FORMAT,
          schemaVersion: TABLE_SCHEMA_VERSION,
          body: { table },
        }),
      },
    },
  });
}
