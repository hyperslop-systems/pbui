import {
  fieldId,
  layerId,
  renderPlot,
  type FieldRef,
  type LayerSpec,
  type MappingSpec,
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

const afterStat = (
  field: "lower" | "upper" | "count" | "q1" | "q3" | "whiskerMin" | "whiskerMax" | "density",
) => ({ kind: "afterStat", field }) as const;

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
  const mappedChannels = Object.fromEntries(
    references.map(([channel, reference]) => [channel, identity(reference)]),
  );
  // Lines and areas need stable series grouping. A nominal color field is the
  // visible series identity in PBUI, so make that relationship explicit.
  const color = view.encodings.color && find(result.fields, view.encodings.color);
  if ((view.mark === "line" || view.mark === "area") && color && color.type !== "q") {
    mappedChannels.group = identity(view.encodings.color!);
  }
  const mapping = mappedChannels as MappingSpec;
  const analyticalMapping: MappingSpec = {
    ...(mapping.x ? { x: mapping.x } : {}),
    ...(mapping.y ? { y: mapping.y } : {}),
    ...(mapping.color ? { color: mapping.color, group: mapping.color } : {}),
    ...(mapping.facet ? { facet: mapping.facet } : {}),
  };
  const annotationLayers: LayerSpec[] = (view.references ?? []).map((reference, index) => ({
    id: layerId(
      `rule:${reference.on}:${reference.value}:${reference.intent ?? "reference"}:${encodeURIComponent(reference.label ?? String(index))}`,
    ),
    inheritMapping: false,
    mapping: {
      [reference.on]: { kind: "constant" as const, value: reference.value },
    },
    stat: { kind: "identity" },
    geom: {
      kind: "rule",
      ...(reference.label === undefined ? {} : { label: reference.label }),
      ...(reference.intent === undefined ? {} : { intent: reference.intent }),
      facetMode: "all",
    },
    position: { kind: "identity" },
  }));
  const analysisLayers = (): LayerSpec[] => {
    switch (view.analysis.kind) {
      case "histogram":
        return [
          {
            id: layerId("histogram"),
            inheritMapping: false,
            mapping: {
              ...(mapping.x ? { x: mapping.x } : {}),
              y: afterStat("count"),
            },
            stat: { kind: "bin", bins: view.analysis.bins },
            geom: { kind: "bar" },
            position: { kind: "identity" },
          },
        ];
      case "summary": {
        const stat = {
          kind: "summary" as const,
          function: "mean" as const,
          interval: {
            kind: view.analysis.interval,
            multiplier: view.analysis.multiplier,
          },
        };
        return [
          {
            id: layerId("summary:error"),
            inheritMapping: false,
            mapping: {
              ...analyticalMapping,
              ymin: afterStat("lower"),
              ymax: afterStat("upper"),
            },
            stat,
            geom: { kind: "errorbar" },
            position: { kind: "identity" },
          },
          {
            id: layerId("summary:mean"),
            inheritMapping: false,
            mapping: analyticalMapping,
            stat,
            geom: { kind: "point", radius: 4 },
            position: { kind: "identity" },
          },
        ];
      }
      case "regression": {
        const stat = {
          kind: "regression" as const,
          method: "ols" as const,
          confidence: view.analysis.confidence,
        };
        return [
          {
            id: layerId("observations"),
            inheritMapping: false,
            mapping: analyticalMapping,
            stat: { kind: "identity" },
            geom: { kind: "point", radius: 2.5, opacity: 0.55 },
            position: { kind: "identity" },
          },
          {
            id: layerId("regression:interval"),
            inheritMapping: false,
            mapping: {
              ...analyticalMapping,
              ymin: afterStat("lower"),
              ymax: afterStat("upper"),
            },
            stat,
            geom: { kind: "ribbon", opacity: 0.16 },
            position: { kind: "identity" },
          },
          {
            id: layerId("regression:fit"),
            inheritMapping: false,
            mapping: analyticalMapping,
            stat,
            geom: { kind: "line", width: 2 },
            position: { kind: "identity" },
          },
        ];
      }
      case "boxplot":
        return [
          {
            id: layerId("boxplot"),
            inheritMapping: false,
            mapping: {
              ...analyticalMapping,
              ymin: afterStat("q1"),
              ymax: afterStat("q3"),
              whiskerMin: afterStat("whiskerMin"),
              whiskerMax: afterStat("whiskerMax"),
            },
            stat: { kind: "boxplot", whisker: "tukey" },
            geom: { kind: "boxplot" },
            position: { kind: "identity" },
          },
        ];
      case "density":
        return [
          {
            id: layerId("density"),
            inheritMapping: false,
            mapping: {
              ...(mapping.x ? { x: mapping.x } : {}),
              ...(mapping.color ? { color: mapping.color, group: mapping.color } : {}),
              ...(mapping.facet ? { facet: mapping.facet } : {}),
              y: afterStat("density"),
            },
            stat: { kind: "density", points: view.analysis.points },
            geom: { kind: "line", width: 2 },
            position: { kind: "identity" },
          },
        ];
      case "identity":
        return [
          {
            id: layerId("root"),
            mapping,
            stat: { kind: "identity" },
            geom: { kind: view.mark },
            position: view.mark === "bar" ? { kind: "dodge" } : { kind: "identity" },
          },
        ];
    }
  };
  const document: PlotDocument = {
    format: "hyperslop.plot",
    version: 1,
    id: documentId,
    mapping,
    layers: [...annotationLayers, ...analysisLayers()],
    scales: {
      y:
        view.analysis.kind === "histogram" || view.analysis.kind === "density"
          ? { kind: "linear" }
          : view.yScale === "log"
            ? { kind: "log" }
            : { kind: "linear" },
    },
    facets: { scales: view.facetScales },
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
