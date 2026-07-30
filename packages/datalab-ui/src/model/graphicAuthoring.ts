import {
  compileGraphicDocument,
  semanticFromFieldType,
  type AuthoringFieldRef,
  type AuthoringTransform,
  type AuthoringView,
  type CompileEnvironment,
  type CompileResult,
  type FieldId,
  type GraphicDocument,
  type PhysicalType,
  type RelationRef,
  type SourceField,
  type SourceNodeId,
  type TransformId,
} from "./graphic";
import type { Field, Row, SourceRef, Table } from "./table";

export function sourceFieldId(sourceId: SourceNodeId, name: string): FieldId {
  return `field:${sourceId}:${encodeURIComponent(name)}`;
}

export function physicalTypeForField(field: Field, rows: Row[]): PhysicalType {
  if (field.type === "q") return { kind: "float64" };
  if (field.type === "t") return { kind: "timestamp", unit: "ms", timezone: "UTC" };
  const values = rows.map((row) => row[field.name]).filter((value) => value != null);
  if (values.length > 0 && values.every((value) => typeof value === "boolean")) {
    return { kind: "boolean" };
  }
  if (
    values.length > 0 &&
    values.every((value) => typeof value === "number" && Number.isSafeInteger(value))
  ) {
    return { kind: "int64" };
  }
  return { kind: "string" };
}

export function sourceFields(
  sourceId: SourceNodeId,
  table: Table,
  inspectValues = true,
): SourceField[] {
  return table.fields.map((field) => ({
    id: sourceFieldId(sourceId, field.name),
    name: field.name,
    path: field.name,
    valueType: {
      physical: inspectValues
        ? physicalTypeForField(field, table.rows)
        : field.type === "q"
          ? { kind: "float64" }
          : field.type === "t"
            ? { kind: "timestamp", unit: "ms", timezone: "UTC" }
            : { kind: "string" },
      nullable:
        field.null_count !== undefined
          ? field.null_count > 0
          : table.rows.some((row) => row[field.name] == null),
    },
    semanticType: semanticFromFieldType(field.type),
  }));
}

export function compileEnvironmentForTable(
  document: GraphicDocument,
  table: Table,
  inspectValues = true,
): CompileEnvironment {
  const source = Object.values(document.sources).find((candidate) =>
    sameSource(candidate.source, table.source),
  );
  if (!source) return { sources: {} };
  return {
    sources: {
      [source.id]: {
        fields: sourceFields(source.id, table, inspectValues),
        coverage: {
          kind: "bounded",
          strategy: table.strategy,
          rows: table.rows.length,
          hasMore: table.truncated,
        },
      },
    },
  };
}

export function createGraphicDocument(
  id: string,
  name: string,
  source: SourceRef,
  limit: number,
): GraphicDocument {
  const sourceId = "source:root";
  const viewId = "view:root";
  return {
    format: "datadrop.gog.document",
    version: 1,
    id,
    name,
    sources: {
      [sourceId]: {
        id: sourceId,
        source,
        scope: {
          kind: "bounded-window",
          limit,
          strategy: source.kind === "stream" ? "latest" : "head",
        },
      },
    },
    transforms: {},
    views: {
      [viewId]: {
        id: viewId,
        relation: { kind: "source", sourceId },
        mark: "point",
        encodings: {},
        yScale: "linear",
        analysis: { kind: "identity" },
        facetScales: "fixed",
      },
    },
    rootView: viewId,
    parameters: {},
  };
}

export function rootView(document: GraphicDocument): AuthoringView {
  const view = document.views[document.rootView];
  if (!view)
    throw new Error(`graphic document ${document.id} has no root view ${document.rootView}`);
  return view;
}

export function rootSource(document: GraphicDocument): SourceRef | null {
  const chain = relationChain(document, rootView(document).relation);
  const first = chain[0];
  if (first?.kind !== "source") return null;
  return document.sources[first.sourceId]?.source ?? null;
}

export function relationChain(document: GraphicDocument, end: RelationRef): RelationRef[] {
  const reversed: RelationRef[] = [];
  const seen = new Set<TransformId>();
  let current: RelationRef = end;
  while (true) {
    reversed.push(current);
    if (current.kind === "source") break;
    if (seen.has(current.transformId))
      throw new Error(`transform cycle includes ${current.transformId}`);
    seen.add(current.transformId);
    const transform = document.transforms[current.transformId];
    if (!transform) throw new Error(`missing transform ${current.transformId}`);
    current = transform.input;
  }
  return reversed.reverse();
}

export function orderedTransformIds(document: GraphicDocument): TransformId[] {
  return relationChain(document, rootView(document).relation)
    .filter((ref): ref is Extract<RelationRef, { kind: "transform" }> => ref.kind === "transform")
    .map((ref) => ref.transformId);
}

export function fieldRef(sourceId: SourceNodeId, name: string): AuthoringFieldRef {
  return { fieldId: sourceFieldId(sourceId, name), name };
}

const ENVELOPE_COLUMNS = new Set(["id", "drop", "stream", "seq", "source", "type", "subject"]);

export function createDefaultGraphic(
  id: string,
  name: string,
  table: Table,
  limit = 2_000,
): GraphicDocument {
  const document = createGraphicDocument(id, name, table.source, limit);
  applyDefaultView(document, table);
  return document;
}

export function applyDefaultView(document: GraphicDocument, table: Table): void {
  const view = rootView(document);
  const payload = table.fields.filter((field) => !ENVELOPE_COLUMNS.has(field.name));
  const envelope = table.fields.filter((field) => ENVELOPE_COLUMNS.has(field.name));
  const ranked = [...payload, ...envelope];
  const quantitative = ranked.filter((field) => field.type === "q");
  const temporal = ranked.find((field) => field.type === "t");
  const color = ranked
    .filter(
      (field) =>
        field.type === "n" &&
        !ENVELOPE_COLUMNS.has(field.name) &&
        (field.distinct ?? 0) >= 2 &&
        (field.distinct ?? 0) <= 8,
    )
    .sort((a, b) => (b.distinct ?? 0) - (a.distinct ?? 0))[0];
  const sourceId = Object.keys(document.sources)[0];
  if (!sourceId) throw new Error(`graphic document ${document.id} has no source`);
  const x = temporal?.name ?? quantitative[0]?.name;
  const y = temporal ? quantitative[0]?.name : (quantitative[1]?.name ?? quantitative[0]?.name);
  view.mark = temporal ? "line" : "point";
  view.encodings = {
    ...(x ? { x: fieldRef(sourceId, x) } : {}),
    ...(y ? { y: fieldRef(sourceId, y) } : {}),
    ...(color ? { color: fieldRef(sourceId, color.name) } : {}),
  };
}

export function compileTableDocument(
  document: GraphicDocument,
  table: Table,
  inspectValues = true,
): CompileResult {
  return compileGraphicDocument(
    document,
    compileEnvironmentForTable(document, table, inspectValues),
  );
}

export function fieldsAtRelation(
  document: GraphicDocument,
  table: Table,
  relation: RelationRef,
): Field[] {
  const probe = cloneGraphicDocument(document);
  rootView(probe).relation = relation;
  rootView(probe).encodings = {};
  const compiled = compileGraphicDocument(probe, compileEnvironmentForTable(probe, table, false));
  const logical = compiled.logical;
  const view = logical?.views[logical.rootView];
  const relationType = view ? logical?.relations[view.relation] : null;
  return (relationType?.fields ?? []).map((field) => ({
    name: field.name,
    type:
      field.semanticType === "quantitative" ? "q" : field.semanticType === "temporal" ? "t" : "n",
    inferred_from: field.provenance.kind === "source" ? "schema" : "values",
  }));
}

export function documentLimit(document: GraphicDocument): number {
  const source = Object.values(document.sources)[0];
  if (!source) throw new Error(`graphic document ${document.id} has no source`);
  return source.scope.limit;
}

export function setDocumentLimit(document: GraphicDocument, limit: number): void {
  if (!Number.isInteger(limit) || limit < 0) throw new Error("document limit must be non-negative");
  const source = Object.values(document.sources)[0];
  if (!source) throw new Error(`graphic document ${document.id} has no source`);
  source.scope.limit = limit;
}

export function replaceDocumentSource(document: GraphicDocument, source: SourceRef): void {
  const sourceId = Object.keys(document.sources)[0] ?? `source:${document.id}`;
  const limit = Object.values(document.sources)[0]?.scope.limit ?? 2_000;
  const replacement = createGraphicDocument(document.id, document.name, source, limit);
  const generatedSourceId = "source:root";
  replacement.sources[sourceId] = {
    ...replacement.sources[generatedSourceId]!,
    id: sourceId,
  };
  if (sourceId !== generatedSourceId) delete replacement.sources[generatedSourceId];
  const view = rootView(replacement);
  view.relation = { kind: "source", sourceId };
  document.sources = replacement.sources;
  document.transforms = {};
  document.views = replacement.views;
  document.rootView = replacement.rootView;
  document.parameters = {};
}

export function appendTransform(document: GraphicDocument, transform: AuthoringTransform): void {
  if (document.transforms[transform.id]) throw new Error(`duplicate transform ${transform.id}`);
  transform.input = rootView(document).relation;
  document.transforms[transform.id] = transform;
  rootView(document).relation = { kind: "transform", transformId: transform.id };
}

export function removeTransform(document: GraphicDocument, transformId: TransformId): void {
  const ids = orderedTransformIds(document);
  const index = ids.indexOf(transformId);
  if (index < 0) return;
  delete document.transforms[transformId];
  reconnectTransformChain(
    document,
    ids.filter((id) => id !== transformId),
  );
}

export function moveTransform(
  document: GraphicDocument,
  transformId: TransformId,
  by: -1 | 1,
): void {
  const ids = orderedTransformIds(document);
  const from = ids.indexOf(transformId);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to]!, ids[from]!];
  reconnectTransformChain(document, ids);
}

function reconnectTransformChain(document: GraphicDocument, ids: TransformId[]): void {
  const sourceId = Object.keys(document.sources)[0];
  if (!sourceId) throw new Error(`graphic document ${document.id} has no source`);
  let relation: RelationRef = { kind: "source", sourceId };
  for (const id of ids) {
    const transform = document.transforms[id];
    if (!transform) throw new Error(`missing transform ${id}`);
    transform.input = relation;
    relation = { kind: "transform", transformId: id };
  }
  rootView(document).relation = relation;
}

export function cloneGraphicDocument(document: GraphicDocument, id = document.id): GraphicDocument {
  const clone = structuredClone(document);
  clone.id = id;
  return clone;
}

export function graphicFacts(document: GraphicDocument): Array<[string, string]> {
  const source = rootSource(document);
  const view = rootView(document);
  const sourceLabel = !source?.drop
    ? "no source"
    : source.kind === "stream"
      ? `${source.drop} / ${source.stream ?? "events"}`
      : `${source.drop} / ${source.dataset} v${source.version ?? "latest"} / ${source.path}`;
  const facts: Array<[string, string]> = [
    ["source", sourceLabel],
    ["geom", view.mark],
    ["analysis", view.analysis.kind],
    ["y scale", view.yScale],
    ["facet scales", view.facetScales],
    [
      "steps",
      orderedTransformIds(document)
        .map((id) => document.transforms[id])
        .filter((transform) => transform?.enabled)
        .map((transform) => transform!.kind.replace("core:", ""))
        .join(" ⊳ ") || "(none)",
    ],
  ];
  for (const channel of ["x", "y", "color", "size", "facet"] as const) {
    facts.push([channel === "color" ? "colour" : channel, view.encodings[channel]?.name ?? "—"]);
  }
  return facts;
}

export function describeSource(source: SourceRef): string {
  return source.kind === "stream"
    ? `${source.drop} / ${source.stream ?? "events"}`
    : `${source.drop} / ${source.dataset} v${source.version ?? "latest"} / ${source.path}`;
}

export function sameSource(a: SourceRef, b: SourceRef): boolean {
  return (
    a.kind === b.kind &&
    a.drop === b.drop &&
    (a.stream ?? "") === (b.stream ?? "") &&
    (a.dataset ?? "") === (b.dataset ?? "") &&
    (a.version ?? 0) === (b.version ?? 0) &&
    (a.path ?? "") === (b.path ?? "")
  );
}
