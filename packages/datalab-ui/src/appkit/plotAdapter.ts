import {
  annotationId,
  fieldId,
  layerId,
  plotId,
  renderPlot,
  variableId,
  type AestheticMapping,
  type AnnotationSpec,
  type CompositionSpec,
  type LayerSpec,
  type PlotData,
  type PlotDocument,
  type PlotOutcome,
  type PlotSchema,
  type ValueRef,
  type VariableId,
} from "@hyperslop-systems/plot";
import {
  annotation,
  composition,
  geom,
  layer,
  plot,
  position,
  scale,
  stat,
  value,
  variable,
} from "@hyperslop-systems/plot/author";
import type { AuthoringFieldRef, AuthoringView, Coverage } from "../model/graphic";
import type { AnalyticalField, FieldType, Row } from "../model/table";

export interface PlotAnalysisResult {
  readonly rows: Row[];
  readonly fields: AnalyticalField[];
  readonly coverage: Coverage;
  readonly resultTruncated: boolean;
}

export interface DatalabPlotInput {
  readonly document: PlotDocument;
  readonly schema: PlotSchema;
  readonly data: PlotData;
}

const semanticType = (type: FieldType) =>
  type === "q"
    ? ("quantitative" as const)
    : type === "t"
      ? ("temporal" as const)
      : ("nominal" as const);

const variableFor = (reference: AuthoringFieldRef): VariableId => variableId(reference.fieldId);
const valueFor = (reference: AuthoringFieldRef): ValueRef => value.variable(variableFor(reference));
const resultField = (fields: readonly AnalyticalField[], reference: AuthoringFieldRef) =>
  fields.find((candidate) => candidate.fieldId === reference.fieldId);

export function collectPlotReferences(view: AuthoringView): readonly AuthoringFieldRef[] {
  const unique = new Map<string, AuthoringFieldRef>();
  for (const reference of Object.values(view.encodings)) {
    if (reference) unique.set(reference.fieldId, reference);
  }
  return [...unique.values()];
}

export function buildPlotSchema(view: AuthoringView, result: PlotAnalysisResult): PlotSchema {
  return {
    fields: collectPlotReferences(view).flatMap((reference) => {
      const source = resultField(result.fields, reference);
      return source
        ? [
            {
              id: fieldId(reference.fieldId),
              name: reference.name,
              column: reference.name,
              semanticType: semanticType(source.type),
              nullable: (source.null_count ?? 0) > 0,
              ...(source.type === "t" ? { timezone: "UTC" } : {}),
            },
          ]
        : [];
    }),
  };
}

export function buildPlotVariables(view: AuthoringView): PlotDocument["variables"] {
  return Object.fromEntries(
    collectPlotReferences(view).map((reference) => [
      variableFor(reference),
      variable.field(fieldId(reference.fieldId), { label: reference.name }),
    ]),
  );
}

function facetComposition(view: AuthoringView): CompositionSpec["facets"] {
  const facet = view.encodings.facet;
  return facet
    ? {
        columns: [valueFor(facet)],
        scales: view.facetScales,
      }
    : undefined;
}

function grouping(view: AuthoringView, result: PlotAnalysisResult): readonly ValueRef[] {
  const color = view.encodings.color;
  const colorSource = color ? resultField(result.fields, color) : undefined;
  const colorGroups =
    color &&
    colorSource?.type !== "q" &&
    (view.mark === "line" ||
      view.mark === "area" ||
      view.analysis.kind === "regression" ||
      view.analysis.kind === "density")
      ? [valueFor(color)]
      : [];
  if ((view.analysis.kind === "summary" || view.analysis.kind === "boxplot") && view.encodings.x) {
    return [valueFor(view.encodings.x), ...colorGroups];
  }
  return colorGroups;
}

export function buildPlotComposition(
  view: AuthoringView,
  result: PlotAnalysisResult,
): CompositionSpec {
  const facets = facetComposition(view);
  return composition.cartesian({
    ...(view.encodings.x ? { x: valueFor(view.encodings.x) } : {}),
    ...(view.encodings.y ? { y: valueFor(view.encodings.y) } : {}),
    groups: grouping(view, result),
    ...(facets ? { facets } : {}),
  });
}

function aesthetics(view: AuthoringView): AestheticMapping {
  return {
    ...(view.encodings.color ? { color: valueFor(view.encodings.color) } : {}),
    ...(view.encodings.size ? { size: valueFor(view.encodings.size) } : {}),
  };
}

const makeLayer = (id: string, input: Omit<LayerSpec, "id">): LayerSpec =>
  layer({ id: layerId(id), ...input });

export function buildPlotLayers(view: AuthoringView): readonly LayerSpec[] {
  const mapping = aesthetics(view);
  switch (view.analysis.kind) {
    case "identity":
      return [
        makeLayer("root", {
          mapping,
          stat: stat.identity(),
          geom: geom[view.mark](),
          position: view.mark === "bar" ? position.dodge() : position.identity(),
        }),
      ];
    case "histogram":
      return [
        makeLayer("histogram", {
          composition: { dimensions: { y: value.afterStat("count") } },
          stat: stat.bin({ bins: view.analysis.bins }),
          geom: geom.bar(),
          position: position.identity(),
        }),
      ];
    case "summary": {
      const statistic = stat.summary({
        function: "mean",
        interval: {
          kind: view.analysis.interval,
          multiplier: view.analysis.multiplier,
        },
      });
      return [
        makeLayer("summary:error", {
          mapping,
          stat: statistic,
          geom: geom.errorbar(),
          position: position.identity(),
        }),
        makeLayer("summary:mean", {
          mapping,
          stat: statistic,
          geom: geom.point({ radius: 4 }),
          position: position.identity(),
        }),
      ];
    }
    case "regression": {
      const statistic = stat.regression({
        method: "ols",
        confidence: view.analysis.confidence,
      });
      return [
        makeLayer("observations", {
          mapping,
          stat: stat.identity(),
          geom: geom.point({ radius: 2.5, opacity: 0.55 }),
          position: position.identity(),
        }),
        makeLayer("regression:interval", {
          mapping,
          stat: statistic,
          geom: geom.ribbon({ opacity: 0.16 }),
          position: position.identity(),
        }),
        makeLayer("regression:fit", {
          mapping,
          stat: statistic,
          geom: geom.line({ width: 2 }),
          position: position.identity(),
        }),
      ];
    }
    case "boxplot":
      return [
        makeLayer("boxplot", {
          mapping,
          stat: stat.boxplot({ whisker: "tukey" }),
          geom: geom.boxplot(),
          position: position.identity(),
        }),
      ];
    case "density":
      return [
        makeLayer("density", {
          composition: { dimensions: { y: value.afterStat("density") } },
          mapping,
          stat: stat.density({ points: view.analysis.points }),
          geom: geom.line({ width: 2 }),
          position: position.identity(),
        }),
      ];
  }
}

export function buildPlotAnnotations(view: AuthoringView): readonly AnnotationSpec[] {
  return (view.references ?? []).map((reference, index) =>
    annotation.rule({
      id: annotationId(
        `reference:${index}:${reference.on}:${reference.value}:${reference.intent ?? "reference"}`,
      ),
      channel: reference.on,
      value: value.constant(reference.value),
      ...(reference.label === undefined ? {} : { label: reference.label }),
      ...(reference.intent === undefined ? {} : { intent: reference.intent }),
      facets: "all",
    }),
  );
}

export function buildDatalabPlot(
  documentId: string,
  view: AuthoringView,
  result: PlotAnalysisResult,
): DatalabPlotInput {
  const schema = buildPlotSchema(view, result);
  const document = plot({
    id: plotId(documentId),
    variables: buildPlotVariables(view),
    composition: buildPlotComposition(view, result),
    layers: buildPlotLayers(view),
    scales: {
      y:
        view.analysis.kind === "histogram" || view.analysis.kind === "density"
          ? scale.linear()
          : view.yScale === "log"
            ? scale.log()
            : scale.linear(),
    },
    annotations: buildPlotAnnotations(view),
  });
  return {
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
  };
}

/** Datalab's sole pure boundary into the renderer-neutral Plot package. */
export function renderPbuiPlot(
  documentId: string,
  view: AuthoringView,
  result: PlotAnalysisResult,
  width: number,
  height: number,
): PlotOutcome {
  return renderPlot({
    ...buildDatalabPlot(documentId, view, result),
    viewport: { width, height },
  });
}
