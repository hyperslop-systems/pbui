import { create } from "@bufbuild/protobuf";
import { DocumentPayloadSchema, MutationSchema, type Mutation, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";

/**
 * A plot script rides IN the workbench document as a `DocumentPayload`
 * (design D3), exactly as pbui-workbench keeps its rebalance config
 * (`rebalance/configDocument.ts`) and datalab keeps its graphic documents:
 * it serialises, restores and syncs wherever the document does, and there is
 * no second persistence mechanism to keep in step.
 *
 * `id`, `format` and `schemaVersion` live on the envelope; the body carries
 * only what the envelope does not. A foreign format reads as "not a script",
 * never as an error.
 */
export const PLOTSCRIPT_FORMAT = "pbui.plotscript";
export const PLOTSCRIPT_SCHEMA_VERSION = 1;

export interface PlotScriptDoc {
  id: string;
  name: string;
  /** The last source that was RUN; the editor's live draft lives in the draft store. */
  source: string;
  /** ISO time of the last write. */
  updatedAt: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function readPlotScript(doc: WorkbenchDocument, id: string): PlotScriptDoc | null {
  const payload = doc.documents[id];
  if (!payload || payload.format !== PLOTSCRIPT_FORMAT) return null;
  const body = payload.body;
  if (!isRecord(body)) return null;
  return {
    id: payload.id,
    name: typeof body.name === "string" ? body.name : payload.id,
    source: typeof body.source === "string" ? body.source : "",
    updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : "",
  };
}

/** Every script in the document, in the document's own key order. */
export function listPlotScripts(doc: WorkbenchDocument): PlotScriptDoc[] {
  const out: PlotScriptDoc[] = [];
  for (const id of Object.keys(doc.documents)) {
    const script = readPlotScript(doc, id);
    if (script) out.push(script);
  }
  return out;
}

/** One `documentPut` that stores the whole script (an idempotent overwrite). */
export function plotScriptMutation(script: PlotScriptDoc): Mutation {
  return create(MutationSchema, {
    body: {
      case: "documentPut",
      value: {
        document: create(DocumentPayloadSchema, {
          id: script.id,
          format: PLOTSCRIPT_FORMAT,
          schemaVersion: PLOTSCRIPT_SCHEMA_VERSION,
          body: { name: script.name, source: script.source, updatedAt: script.updatedAt },
        }),
      },
    },
  });
}

export function deletePlotScriptMutation(id: string): Mutation {
  return create(MutationSchema, { body: { case: "documentDelete", value: { documentId: id } } });
}
