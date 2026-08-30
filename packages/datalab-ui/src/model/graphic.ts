import type { FieldType, SourceRef } from "./table";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type DocumentId = string;
export type SourceNodeId = string;
export type TransformId = string;
export type ViewId = string;
export type FieldId = string;
export type ValueId = string;
export type OperationId = string;
export type ParameterId = string;

export type SemanticType = "quantitative" | "nominal" | "ordinal" | "temporal";

export type PhysicalType =
  | { kind: "boolean" }
  | { kind: "int64" }
  | { kind: "float64" }
  | { kind: "string" }
  | { kind: "timestamp"; unit: "ms"; timezone?: string }
  | { kind: "unknown" };

export interface ValueType {
  physical: PhysicalType;
  nullable: boolean;
}

export interface AuthoringFieldRef {
  fieldId: FieldId;
  name: string;
}

export type CoreFunction =
  | "eq"
  | "ne"
  | "gt"
  | "lt"
  | "and"
  | "or"
  | "not"
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "log10"
  | "is_null"
  | "is_finite";

export type Expression =
  | { kind: "field"; field: AuthoringFieldRef }
  | { kind: "literal"; value: JsonValue; valueType?: PhysicalType }
  | { kind: "parameter"; parameterId: ParameterId }
  | { kind: "call"; function: CoreFunction; arguments: Expression[] }
  | { kind: "cast"; expression: Expression; to: PhysicalType; onFailure: "null" | "error" };

export interface AuthoringSource {
  id: SourceNodeId;
  source: SourceRef;
  scope: { kind: "bounded-window"; limit: number; strategy: "head" | "latest" };
}

export type RelationRef =
  | { kind: "source"; sourceId: SourceNodeId }
  | { kind: "transform"; transformId: TransformId };

interface TransformBase {
  id: TransformId;
  input: RelationRef;
  enabled: boolean;
  state: "complete" | "draft";
  label?: string;
}

export type AuthoringTransform =
  | (TransformBase & { kind: "core:filter"; predicate: Expression | null })
  | (TransformBase & {
      kind: "core:extend";
      name: string;
      expression: Expression | null;
      semanticType: SemanticType;
    })
  | (TransformBase & { kind: "core:project"; fields: AuthoringFieldRef[] })
  | (TransformBase & {
      kind: "core:aggregate";
      groupBy: AuthoringFieldRef[];
      measures: Array<{
        name: string;
        function: "mean" | "sum" | "min" | "max" | "count_rows";
        field?: AuthoringFieldRef;
      }>;
    })
  | (TransformBase & {
      kind: "core:sort";
      fields: Array<{
        field: AuthoringFieldRef;
        direction: "asc" | "desc";
        nulls: "first" | "last";
      }>;
    })
  | (TransformBase & { kind: "core:limit"; count: number });

export type Mark = "point" | "line" | "bar" | "area";
export type Channel = "x" | "y" | "color" | "size" | "facet";
export type AnalysisSpec =
  | { kind: "identity" }
  | { kind: "histogram"; bins: number }
  | {
      kind: "summary";
      interval: "standard-deviation" | "standard-error";
      multiplier: number;
    }
  | { kind: "regression"; confidence: number }
  | { kind: "boxplot" }
  | { kind: "density"; points: number };
export type AnalysisKind = AnalysisSpec["kind"];
export type FacetScalePolicy = "fixed" | "free-x" | "free-y" | "free";

export const MARKS: Mark[] = ["point", "line", "bar", "area"];
export const CHANNELS: Channel[] = ["x", "y", "color", "size", "facet"];
export const CHANNEL_ACCEPTS: Record<Channel, FieldType[]> = {
  x: ["q", "n", "t"],
  y: ["q"],
  color: ["q", "n", "t"],
  size: ["q"],
  facet: ["n", "t"],
};

export interface ReferenceLine {
  on: "x" | "y";
  value: number;
  label?: string;
  intent?: "reference" | "target" | "limit";
}

export interface AuthoringView {
  id: ViewId;
  relation: RelationRef;
  mark: Mark;
  encodings: Partial<Record<Channel, AuthoringFieldRef>>;
  yScale: "linear" | "log";
  analysis: AnalysisSpec;
  facetScales: FacetScalePolicy;
  /** Declarative data-unit guides rendered as chart chrome, never row objects. */
  references?: ReferenceLine[];
}

export interface GraphicDocument {
  format: "datadrop.gog.document";
  version: 2;
  id: DocumentId;
  name: string;
  sources: Record<SourceNodeId, AuthoringSource>;
  transforms: Record<TransformId, AuthoringTransform>;
  views: Record<ViewId, AuthoringView>;
  rootView: ViewId;
  parameters: Record<ParameterId, JsonValue>;
  metadata?: Record<string, JsonValue>;
}

export interface SourceField {
  id: FieldId;
  name: string;
  valueType: ValueType;
  semanticType: SemanticType;
  path: string;
}

export interface SourceSchema {
  fields: SourceField[];
  coverage: Coverage;
}

export interface CompileEnvironment {
  sources: Record<SourceNodeId, SourceSchema>;
  parameters?: Record<ParameterId, ValueType>;
}

export type Coverage = {
  kind: "bounded";
  strategy: "head" | "latest";
  rows: number;
  hasMore: boolean;
};

export interface FieldSymbol {
  id: FieldId;
  name: string;
  valueType: ValueType;
  semanticType: SemanticType;
  provenance:
    | { kind: "source"; sourceId: SourceNodeId; path: string }
    | { kind: "operation"; operationId: OperationId; output: string };
}

export interface RelationType {
  fields: FieldSymbol[];
  coverage: Coverage;
}

export type LogicalExpression =
  | { kind: "field"; fieldId: FieldId; valueType: ValueType }
  | { kind: "literal"; value: JsonValue; valueType: ValueType }
  | { kind: "parameter"; parameterId: ParameterId; valueType: ValueType }
  | {
      kind: "call";
      function: CoreFunction;
      arguments: LogicalExpression[];
      valueType: ValueType;
    }
  | {
      kind: "cast";
      expression: LogicalExpression;
      to: PhysicalType;
      onFailure: "null" | "error";
      valueType: ValueType;
    };

interface LogicalBase {
  id: OperationId;
  input?: ValueId;
  output: ValueId;
  relation: RelationType;
  origin: SourceNodeId | TransformId;
}

export type LogicalOperation =
  | (LogicalBase & { kind: "core:scan"; sourceId: SourceNodeId })
  | (LogicalBase & { kind: "core:filter"; input: ValueId; predicate: LogicalExpression })
  | (LogicalBase & {
      kind: "core:extend";
      input: ValueId;
      field: FieldSymbol;
      expression: LogicalExpression;
    })
  | (LogicalBase & { kind: "core:project"; input: ValueId; fieldIds: FieldId[] })
  | (LogicalBase & {
      kind: "core:aggregate";
      input: ValueId;
      groupBy: FieldId[];
      measures: Array<{
        field: FieldSymbol;
        function: "mean" | "sum" | "min" | "max" | "count_rows";
        inputFieldId?: FieldId;
      }>;
    })
  | (LogicalBase & {
      kind: "core:sort";
      input: ValueId;
      fields: Array<{ fieldId: FieldId; direction: "asc" | "desc"; nulls: "first" | "last" }>;
    })
  | (LogicalBase & { kind: "core:limit"; input: ValueId; count: number });

export interface LogicalView {
  id: ViewId;
  relation: ValueId;
  mark: Mark;
  encodings: Partial<Record<Channel, FieldId>>;
  yScale: "linear" | "log";
  analysis: AnalysisSpec;
  facetScales: FacetScalePolicy;
}

export interface LogicalGraphic {
  documentId: DocumentId;
  operations: LogicalOperation[];
  relations: Record<ValueId, RelationType>;
  views: Record<ViewId, LogicalView>;
  rootView: ViewId;
}

export interface Diagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
  path?: string;
}

export interface CompileResult {
  documentVersion: number;
  logical: LogicalGraphic | null;
  diagnostics: Diagnostic[];
}

const boolType = (nullable: boolean): ValueType => ({ physical: { kind: "boolean" }, nullable });
const floatType = (nullable: boolean): ValueType => ({ physical: { kind: "float64" }, nullable });

function samePhysical(a: PhysicalType, b: PhysicalType): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function literalType(value: JsonValue, declared?: PhysicalType): ValueType {
  if (declared) return { physical: declared, nullable: value === null };
  if (value === null) return { physical: { kind: "unknown" }, nullable: true };
  if (typeof value === "boolean") return { physical: { kind: "boolean" }, nullable: false };
  if (typeof value === "number") return floatType(false);
  if (typeof value === "string") return { physical: { kind: "string" }, nullable: false };
  return { physical: { kind: "unknown" }, nullable: false };
}

function isNumeric(type: PhysicalType): boolean {
  return type.kind === "int64" || type.kind === "float64";
}

function relationValue(id: string): ValueId {
  return `value:${id}`;
}

function operationId(id: string): OperationId {
  return `operation:${id}`;
}

function outputFieldId(id: string, output: string): FieldId {
  return `field:${id}:${encodeURIComponent(output)}`;
}

function report(
  diagnostics: Diagnostic[],
  code: string,
  message: string,
  nodeId?: string,
  path?: string,
): void {
  diagnostics.push({
    severity: "error",
    code,
    message,
    ...(nodeId ? { nodeId } : {}),
    ...(path ? { path } : {}),
  });
}

interface SourcePass {
  operations: LogicalOperation[];
  relations: Record<ValueId, RelationType>;
  resolved: Map<string, ValueId>;
  diagnostics: Diagnostic[];
}

/** Pass 1: validate source declarations and seed the logical relation graph. */
export function compileSources(
  document: GraphicDocument,
  environment: CompileEnvironment,
): SourcePass {
  const operations: LogicalOperation[] = [];
  const relations: Record<ValueId, RelationType> = {};
  const resolved = new Map<string, ValueId>();
  const diagnostics: Diagnostic[] = [];

  for (const source of Object.values(document.sources)) {
    const schema = environment.sources[source.id];
    if (!schema) {
      report(diagnostics, "source.schema", `Source ${source.id} has no resolved schema`, source.id);
      continue;
    }
    if (!Number.isInteger(source.scope.limit) || source.scope.limit < 0) {
      report(
        diagnostics,
        "source.limit",
        "Bounded source limit must be a non-negative integer",
        source.id,
        "scope.limit",
      );
      continue;
    }
    const relation: RelationType = {
      fields: schema.fields.map((field) => ({
        id: field.id,
        name: field.name,
        valueType: field.valueType,
        semanticType: field.semanticType,
        provenance: { kind: "source", sourceId: source.id, path: field.path },
      })),
      coverage: schema.coverage,
    };
    const output = relationValue(source.id);
    operations.push({
      id: operationId(source.id),
      kind: "core:scan",
      sourceId: source.id,
      output,
      relation,
      origin: source.id,
    });
    relations[output] = relation;
    resolved.set(`source:${source.id}`, output);
  }
  return { operations, relations, resolved, diagnostics };
}

function resolveField(
  ref: AuthoringFieldRef,
  relation: RelationType,
  diagnostics: Diagnostic[],
  nodeId: string,
  path: string,
): FieldSymbol | null {
  const field = relation.fields.find((candidate) => candidate.id === ref.fieldId);
  if (field) return field;
  report(
    diagnostics,
    "field.missing",
    `Field ${ref.name} (${ref.fieldId}) is not produced by the input relation`,
    nodeId,
    path,
  );
  return null;
}

function compileExpression(
  expression: Expression,
  relation: RelationType,
  environment: CompileEnvironment,
  diagnostics: Diagnostic[],
  nodeId: string,
  path: string,
): LogicalExpression | null {
  switch (expression.kind) {
    case "field": {
      const field = resolveField(expression.field, relation, diagnostics, nodeId, path);
      return field ? { kind: "field", fieldId: field.id, valueType: field.valueType } : null;
    }
    case "literal":
      return {
        kind: "literal",
        value: expression.value,
        valueType: literalType(expression.value, expression.valueType),
      };
    case "parameter": {
      const valueType = environment.parameters?.[expression.parameterId];
      if (!valueType) {
        report(
          diagnostics,
          "parameter.missing",
          `Parameter ${expression.parameterId} has no declared type`,
          nodeId,
          path,
        );
        return null;
      }
      return { kind: "parameter", parameterId: expression.parameterId, valueType };
    }
    case "cast": {
      const inner = compileExpression(
        expression.expression,
        relation,
        environment,
        diagnostics,
        nodeId,
        `${path}.expression`,
      );
      if (!inner) return null;
      return {
        kind: "cast",
        expression: inner,
        to: expression.to,
        onFailure: expression.onFailure,
        valueType: {
          physical: expression.to,
          nullable: inner.valueType.nullable || expression.onFailure === "null",
        },
      };
    }
    case "call": {
      const args = expression.arguments.map((arg, index) =>
        compileExpression(
          arg,
          relation,
          environment,
          diagnostics,
          nodeId,
          `${path}.arguments[${index}]`,
        ),
      );
      if (args.some((arg) => arg === null)) return null;
      const complete = args as LogicalExpression[];
      const nullable = complete.some((arg) => arg.valueType.nullable);
      const arity = complete.length;
      const numeric = complete.every((arg) => isNumeric(arg.valueType.physical));
      let result: ValueType | null = null;
      switch (expression.function) {
        case "not":
          if (arity === 1 && complete[0]?.valueType.physical.kind === "boolean")
            result = boolType(nullable);
          break;
        case "and":
        case "or":
          if (arity >= 2 && complete.every((arg) => arg.valueType.physical.kind === "boolean"))
            result = boolType(nullable);
          break;
        case "eq":
        case "ne":
          if (
            arity === 2 &&
            (samePhysical(complete[0]!.valueType.physical, complete[1]!.valueType.physical) ||
              complete.some((arg) => arg.valueType.physical.kind === "unknown"))
          )
            result = boolType(nullable);
          break;
        case "gt":
        case "lt":
          if (
            arity === 2 &&
            (numeric ||
              complete.every(
                (arg) =>
                  arg.valueType.physical.kind === "string" ||
                  arg.valueType.physical.kind === "timestamp",
              ))
          )
            result = boolType(nullable);
          break;
        case "add":
        case "subtract":
        case "multiply":
          if (arity === 2 && numeric) result = floatType(nullable);
          break;
        case "divide":
          if (arity === 2 && numeric) result = floatType(true);
          break;
        case "log10":
          if (arity === 1 && numeric) result = floatType(true);
          break;
        case "is_null":
        case "is_finite":
          if (arity === 1 && (expression.function === "is_null" || numeric))
            result = boolType(false);
          break;
      }
      if (!result) {
        report(
          diagnostics,
          "expression.signature",
          `Function ${expression.function} does not accept the supplied argument types`,
          nodeId,
          path,
        );
        return null;
      }
      return {
        kind: "call",
        function: expression.function,
        arguments: complete,
        valueType: result,
      };
    }
  }
}

export function semanticFromFieldType(type: FieldType): SemanticType {
  if (type === "q") return "quantitative";
  if (type === "t") return "temporal";
  return "nominal";
}

export function compileGraphicDocument(
  document: GraphicDocument,
  environment: CompileEnvironment,
): CompileResult {
  const diagnostics: Diagnostic[] = [];
  if (document.format !== "datadrop.gog.document" || document.version !== 2) {
    report(diagnostics, "document.version", "Unsupported graphic document format or version");
    return { documentVersion: document.version, logical: null, diagnostics };
  }

  const sourcePass = compileSources(document, environment);
  diagnostics.push(...sourcePass.diagnostics);
  const { operations, relations, resolved } = sourcePass;
  const visiting = new Set<TransformId>();

  const resolveRelation = (ref: RelationRef, owner: string): ValueId | null => {
    if (ref.kind === "source") {
      const value = resolved.get(`source:${ref.sourceId}`);
      if (!value)
        report(diagnostics, "relation.source", `Unknown or invalid source ${ref.sourceId}`, owner);
      return value ?? null;
    }
    const existing = resolved.get(`transform:${ref.transformId}`);
    if (existing) return existing;
    return compileTransform(ref.transformId);
  };

  const compileTransform = (id: TransformId): ValueId | null => {
    const existing = resolved.get(`transform:${id}`);
    if (existing) return existing;
    const transform = document.transforms[id];
    if (!transform) {
      report(diagnostics, "transform.missing", `Unknown transform ${id}`, id);
      return null;
    }
    if (visiting.has(id)) {
      report(diagnostics, "transform.cycle", `Transform cycle includes ${id}`, id);
      return null;
    }
    visiting.add(id);
    const input = resolveRelation(transform.input, id);
    visiting.delete(id);
    if (!input) return null;
    if (!transform.enabled) {
      resolved.set(`transform:${id}`, input);
      return input;
    }
    if (transform.state !== "complete") {
      report(diagnostics, "transform.draft", `Transform ${id} is incomplete`, id);
      return null;
    }
    const inputRelation = relations[input];
    if (!inputRelation) return null;
    const output = relationValue(id);
    const opId = operationId(id);
    let operation: LogicalOperation | null = null;

    switch (transform.kind) {
      case "core:filter": {
        if (!transform.predicate) {
          report(diagnostics, "filter.predicate", "Filter requires a predicate", id, "predicate");
          break;
        }
        const predicate = compileExpression(
          transform.predicate,
          inputRelation,
          environment,
          diagnostics,
          id,
          "predicate",
        );
        if (predicate && predicate.valueType.physical.kind !== "boolean") {
          report(diagnostics, "filter.type", "Filter predicate must be Boolean", id, "predicate");
          break;
        }
        if (predicate)
          operation = {
            id: opId,
            kind: "core:filter",
            input,
            output,
            relation: inputRelation,
            predicate,
            origin: id,
          };
        break;
      }
      case "core:extend": {
        if (!transform.name.trim()) {
          report(
            diagnostics,
            "extend.name",
            "Extended field requires a non-empty name",
            id,
            "name",
          );
          break;
        }
        if (inputRelation.fields.some((field) => field.name === transform.name)) {
          report(
            diagnostics,
            "extend.duplicate",
            `Field ${transform.name} already exists`,
            id,
            "name",
          );
          break;
        }
        if (!transform.expression) {
          report(
            diagnostics,
            "extend.expression",
            "Extended field requires an expression",
            id,
            "expression",
          );
          break;
        }
        const expression = compileExpression(
          transform.expression,
          inputRelation,
          environment,
          diagnostics,
          id,
          "expression",
        );
        if (!expression) break;
        const field: FieldSymbol = {
          id: outputFieldId(id, transform.name),
          name: transform.name,
          valueType: expression.valueType,
          semanticType: transform.semanticType,
          provenance: { kind: "operation", operationId: opId, output: transform.name },
        };
        const relation = { ...inputRelation, fields: [...inputRelation.fields, field] };
        operation = {
          id: opId,
          kind: "core:extend",
          input,
          output,
          relation,
          field,
          expression,
          origin: id,
        };
        break;
      }
      case "core:project": {
        const fields = transform.fields.map((field, index) =>
          resolveField(field, inputRelation, diagnostics, id, `fields[${index}]`),
        );
        if (fields.some((field) => field === null)) break;
        const selected = fields as FieldSymbol[];
        if (new Set(selected.map((field) => field.id)).size !== selected.length) {
          report(
            diagnostics,
            "project.duplicate",
            "Projection contains a field more than once",
            id,
            "fields",
          );
          break;
        }
        const relation = { ...inputRelation, fields: selected };
        operation = {
          id: opId,
          kind: "core:project",
          input,
          output,
          relation,
          fieldIds: selected.map((field) => field.id),
          origin: id,
        };
        break;
      }
      case "core:aggregate": {
        const groups = transform.groupBy.map((field, index) =>
          resolveField(field, inputRelation, diagnostics, id, `groupBy[${index}]`),
        );
        if (groups.some((field) => field === null)) break;
        const names = new Set((groups as FieldSymbol[]).map((field) => field.name));
        const measures: Extract<LogicalOperation, { kind: "core:aggregate" }>["measures"] = [];
        for (let index = 0; index < transform.measures.length; index++) {
          const measure = transform.measures[index]!;
          if (!measure.name.trim() || names.has(measure.name)) {
            report(
              diagnostics,
              "aggregate.name",
              `Aggregate output ${measure.name || "(empty)"} is empty or duplicated`,
              id,
              `measures[${index}].name`,
            );
            continue;
          }
          names.add(measure.name);
          let inputField: FieldSymbol | null = null;
          if (measure.function !== "count_rows") {
            if (!measure.field) {
              report(
                diagnostics,
                "aggregate.field",
                `${measure.function} requires a field`,
                id,
                `measures[${index}].field`,
              );
              continue;
            }
            inputField = resolveField(
              measure.field,
              inputRelation,
              diagnostics,
              id,
              `measures[${index}].field`,
            );
            if (!inputField) continue;
            if (!isNumeric(inputField.valueType.physical)) {
              report(
                diagnostics,
                "aggregate.type",
                `${measure.function} requires a numeric field`,
                id,
                `measures[${index}].field`,
              );
              continue;
            }
          }
          const field: FieldSymbol = {
            id: outputFieldId(id, measure.name),
            name: measure.name,
            valueType:
              measure.function === "count_rows"
                ? { physical: { kind: "int64" }, nullable: false }
                : floatType(true),
            semanticType: "quantitative",
            provenance: { kind: "operation", operationId: opId, output: measure.name },
          };
          measures.push({
            field,
            function: measure.function,
            ...(inputField ? { inputFieldId: inputField.id } : {}),
          });
        }
        if (measures.length !== transform.measures.length) break;
        const relation = {
          ...inputRelation,
          fields: [...(groups as FieldSymbol[]), ...measures.map((measure) => measure.field)],
        };
        operation = {
          id: opId,
          kind: "core:aggregate",
          input,
          output,
          relation,
          groupBy: (groups as FieldSymbol[]).map((field) => field.id),
          measures,
          origin: id,
        };
        break;
      }
      case "core:sort": {
        const fields = transform.fields.map((item, index) => {
          const field = resolveField(
            item.field,
            inputRelation,
            diagnostics,
            id,
            `fields[${index}].field`,
          );
          return field ? { fieldId: field.id, direction: item.direction, nulls: item.nulls } : null;
        });
        if (fields.some((field) => field === null)) break;
        operation = {
          id: opId,
          kind: "core:sort",
          input,
          output,
          relation: inputRelation,
          fields: fields as Extract<LogicalOperation, { kind: "core:sort" }>["fields"],
          origin: id,
        };
        break;
      }
      case "core:limit":
        if (!Number.isInteger(transform.count) || transform.count < 0) {
          report(diagnostics, "limit.count", "Limit must be a non-negative integer", id, "count");
          break;
        }
        operation = {
          id: opId,
          kind: "core:limit",
          input,
          output,
          relation: inputRelation,
          count: transform.count,
          origin: id,
        };
        break;
    }

    if (!operation) return null;
    operations.push(operation);
    relations[output] = operation.relation;
    resolved.set(`transform:${id}`, output);
    return output;
  };

  const views: Record<ViewId, LogicalView> = {};
  for (const view of Object.values(document.views)) {
    const relationId = resolveRelation(view.relation, view.id);
    if (!relationId) continue;
    const relation = relations[relationId];
    if (!relation) continue;
    const encodings: Partial<Record<Channel, FieldId>> = {};
    for (const [channel, fieldRef] of Object.entries(view.encodings) as Array<
      [Channel, AuthoringFieldRef]
    >) {
      const field = resolveField(fieldRef, relation, diagnostics, view.id, `encodings.${channel}`);
      if (field) encodings[channel] = field.id;
    }
    views[view.id] = {
      id: view.id,
      relation: relationId,
      mark: view.mark,
      encodings,
      yScale: view.yScale,
      analysis: view.analysis,
      facetScales: view.facetScales,
    };
  }

  if (!document.views[document.rootView])
    report(
      diagnostics,
      "view.root",
      `Root view ${document.rootView} does not exist`,
      document.rootView,
    );
  if (!views[document.rootView])
    report(
      diagnostics,
      "view.invalid",
      `Root view ${document.rootView} could not be compiled`,
      document.rootView,
    );

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { documentVersion: document.version, logical: null, diagnostics };
  }
  return {
    documentVersion: document.version,
    logical: { documentId: document.id, operations, relations, views, rootView: document.rootView },
    diagnostics,
  };
}
