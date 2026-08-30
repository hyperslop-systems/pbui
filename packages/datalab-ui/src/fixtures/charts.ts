import type {
  AnalysisSpec,
  FacetScalePolicy,
  GraphicDocument,
  Mark,
  ReferenceLine,
} from "../model/graphic";
import {
  appendTransform,
  applyDefaultView,
  createGraphicDocument,
  fieldRef,
  fieldRefsAtRelation,
  rootView,
} from "../model/graphicAuthoring";
import type { AnalyticalField, Table } from "../model/table";
import {
  draftToTransform,
  type AggregateFunction,
  type DeriveOperator,
  type FilterOperator,
  type TransformDraft,
} from "../model/transformEditor";
import { readings } from "./index";

export const READINGS = {
  time: "time",
  temp: "data.temp_c",
  humidity: "data.humidity",
  station: "data.station",
  ok: "data.ok",
  seq: "seq",
} as const;

let transformId = 0;
const nextId = () => `transform-${++transformId}`;

export const draft = {
  filter: (field: string, op: FilterOperator, value: string): TransformDraft => ({
    id: nextId(),
    kind: "filter",
    enabled: true,
    field,
    op,
    value,
  }),
  summarize: (by: string, fn: AggregateFunction, field: string): TransformDraft => ({
    id: nextId(),
    kind: "summarize",
    enabled: true,
    by,
    fn,
    field,
  }),
  sort: (field: string, dir: "asc" | "desc" = "asc"): TransformDraft => ({
    id: nextId(),
    kind: "sort",
    enabled: true,
    field,
    dir,
  }),
  limit: (n: number): TransformDraft => ({ id: nextId(), kind: "limit", enabled: true, n }),
  derive: (name: string, a: string, op: DeriveOperator, b: string): TransformDraft => ({
    id: nextId(),
    kind: "derive",
    enabled: true,
    name,
    op,
    a,
    b,
  }),
};

export interface GraphicFixtureOptions {
  source?: Table["source"];
  transforms?: TransformDraft[];
  geom?: Mark;
  mapping?: Partial<Record<"x" | "y" | "color" | "size" | "facet", string | null>>;
  yScale?: "linear" | "log";
  analysis?: AnalysisSpec;
  facetScales?: FacetScalePolicy;
  references?: ReferenceLine[];
}

/** Canonical declarative fixture; it never evaluates rows in JavaScript. */
export function graphicFixture(
  options: GraphicFixtureOptions = {},
  id = "fixture-document",
  name = "fixture",
  limit = 2_000,
  table: Table = readings,
): GraphicDocument {
  const source = options.source ?? table.source;
  const fixtureTable = source === table.source ? table : { ...table, source };
  const document = createGraphicDocument(id, name, source, limit);
  applyDefaultView(document, fixtureTable);
  const view = rootView(document);
  if (options.geom) view.mark = options.geom;
  if (options.yScale) view.yScale = options.yScale;
  if (options.analysis) view.analysis = structuredClone(options.analysis);
  if (options.facetScales) view.facetScales = options.facetScales;
  if (options.references) view.references = structuredClone(options.references);
  for (const transform of options.transforms ?? []) {
    appendTransform(document, draftToTransform(transform, fixtureTable.fields));
  }
  if (options.mapping) {
    const fields = fieldRefsAtRelation(document, fixtureTable, view.relation);
    for (const [channel, field] of Object.entries(options.mapping)) {
      if (field === null) {
        delete view.encodings[channel as keyof typeof view.encodings];
        continue;
      }
      const reference = fields.find((candidate) => candidate.name === field);
      if (!reference) throw new Error(`fixture relation does not produce field ${field}`);
      view.encodings[channel as keyof typeof view.encodings] = reference;
    }
  }
  return document;
}

export function fixtureResult(table: Table = readings): {
  rows: Table["rows"];
  fields: AnalyticalField[];
  err: null;
  dropped: Record<string, never>;
} {
  return {
    rows: table.rows,
    fields: table.fields.map((field) => ({
      ...field,
      fieldId: field.fieldId ?? fieldRef("source:root", field.name).fieldId,
    })),
    err: null,
    dropped: {},
  };
}
