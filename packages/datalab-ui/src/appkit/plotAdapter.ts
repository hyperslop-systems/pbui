import {
  fieldId,
  layerId,
  renderPlot,
  type FieldRef,
  type PlotDocument,
  type PlotOutcome,
  type PlotSchema,
} from "@hyperslop-systems/plot";
import type { AuthoringFieldRef, AuthoringView, Channel, Coverage } from "../model/graphic";
import type { Field, FieldType, Row } from "../model/table";

export interface PlotAnalysisResult {
  readonly rows: Row[];
  readonly fields: Field[];
  readonly coverage: Coverage;
  readonly resultTruncated: boolean;
}

const semantic = (type: FieldType) =>
  type === "q"
    ? ("quantitative" as const)
    : type === "t"
      ? ("temporal" as const)
      : ("nominal" as const);
const identity = (reference: AuthoringFieldRef): FieldRef => ({
  kind: "field",
  fieldId: fieldId(reference.fieldId ?? `pbui:${encodeURIComponent(reference.name)}`),
  name: reference.name,
});
const find = (fields: readonly Field[], reference: AuthoringFieldRef) =>
  fields.find((candidate) => candidate.name === reference.name);

/**
 * PBUI's sole composition boundary into the plotting package.
 *
 * The persisted `datadrop.gog.document` remains an authoring document. This
 * function projects its current root view and current DuckDB result into the
 * package's stable PlotDocument/Schema/Data contract; the package never imports
 * PBUI formats, Redux state, or backend response types.
 */
export function renderPbuiPlot(
  documentId: string,
  view: AuthoringView,
  result: PlotAnalysisResult,
  width: number,
  height: number,
): PlotOutcome {
  const references = Object.entries(view.encodings).filter(
    (entry): entry is [Channel, AuthoringFieldRef] => Boolean(entry[1]),
  );
  const schema: PlotSchema = {
    fields: references
      .flatMap(([, reference]) => {
        const source = find(result.fields, reference);
        return source
          ? [
              {
                id: fieldId(reference.fieldId ?? `pbui:${encodeURIComponent(reference.name)}`),
                name: reference.name,
                column: reference.name,
                semanticType: semantic(source.type),
                nullable: (source.null_count ?? 0) > 0,
                ...(source.type === "t" ? { timezone: "UTC" } : {}),
              },
            ]
          : [];
      })
      .filter(
        (candidate, index, fields) =>
          fields.findIndex((field) => field.id === candidate.id) === index,
      ),
  };
  const mapping = Object.fromEntries(
    references.map(([channel, reference]) => [channel, identity(reference)]),
  );
  // Lines and areas need stable series grouping. A nominal color field is the
  // visible series identity in PBUI, so make that relationship explicit.
  const color = view.encodings.color && find(result.fields, view.encodings.color);
  if ((view.mark === "line" || view.mark === "area") && color && color.type !== "q") {
    mapping.group = identity(view.encodings.color!);
  }
  const document: PlotDocument = {
    format: "hyperslop.plot",
    version: 1,
    id: documentId,
    layers: [
      {
        id: layerId("root"),
        mapping,
        stat: { kind: "identity" },
        geom: { kind: view.mark },
        position: { kind: "identity" },
      },
    ],
    scales: { y: view.yScale === "log" ? { kind: "log" } : { kind: "linear" } },
    references: view.references,
  };
  return renderPlot({
    document,
    schema,
    data: {
      rows: result.rows,
      coverage: {
        kind: "bounded",
        rowCount: result.rows.length,
        hasMore: result.coverage.hasMore || result.resultTruncated,
        strategy: result.coverage.strategy,
      },
    },
    viewport: { width, height },
  });
}
