import type {
  Diagnostic,
  FieldId,
  FieldSymbol,
  LogicalExpression,
  LogicalGraphic,
  LogicalOperation,
  ValueId,
} from "../model/graphic";
import { duckDBType, fieldAlias, quoteIdentifier } from "./quote";
import {
  DUCKDB_TARGET_VERSION,
  type CompiledRelation,
  type DuckDBParameter,
  type PhysicalCompileResult,
  type RegisteredSource,
} from "./types";

interface CompileState {
  params: DuckDBParameter[];
  diagnostics: Diagnostic[];
  aliases: Map<FieldId, string>;
}

function error(state: CompileState, code: string, message: string, nodeId?: string): void {
  state.diagnostics.push({ severity: "error", code, message, ...(nodeId ? { nodeId } : {}) });
}

function expressionSQL(
  expression: LogicalExpression,
  state: CompileState,
  nodeId: string,
): string | null {
  switch (expression.kind) {
    case "field": {
      const alias = state.aliases.get(expression.fieldId);
      if (!alias) {
        error(state, "duckdb.field", `No physical alias for field ${expression.fieldId}`, nodeId);
        return null;
      }
      return quoteIdentifier(alias);
    }
    case "literal": {
      if (
        expression.value !== null &&
        typeof expression.value !== "boolean" &&
        typeof expression.value !== "number" &&
        typeof expression.value !== "string"
      ) {
        error(
          state,
          "duckdb.parameter",
          "DuckDB MVP accepts only scalar literal parameters",
          nodeId,
        );
        return null;
      }
      if (typeof expression.value === "number" && !Number.isFinite(expression.value)) {
        error(state, "duckdb.parameter", "DuckDB MVP does not bind non-finite numbers", nodeId);
        return null;
      }
      state.params.push(expression.value);
      return "?";
    }
    case "parameter":
      error(
        state,
        "duckdb.parameter.unbound",
        `Logical parameter ${expression.parameterId} must be bound before physical compilation`,
        nodeId,
      );
      return null;
    case "cast": {
      const value = expressionSQL(expression.expression, state, nodeId);
      const type = duckDBType(expression.to);
      if (!value || !type) {
        if (!type)
          error(state, "duckdb.cast", "Cannot lower a cast to unknown physical type", nodeId);
        return null;
      }
      return `${expression.onFailure === "null" ? "TRY_CAST" : "CAST"}(${value} AS ${type})`;
    }
    case "call": {
      const args = expression.arguments.map((argument) => expressionSQL(argument, state, nodeId));
      if (args.some((argument) => argument === null)) return null;
      const a = args as string[];
      switch (expression.function) {
        case "eq":
          return `(${a[0]} = ${a[1]})`;
        case "ne":
          return `(${a[0]} <> ${a[1]})`;
        case "gt":
          return `(${a[0]} > ${a[1]})`;
        case "lt":
          return `(${a[0]} < ${a[1]})`;
        case "and":
          return `(${a.join(" AND ")})`;
        case "or":
          return `(${a.join(" OR ")})`;
        case "not":
          return `(NOT ${a[0]})`;
        case "add":
          return `(${a[0]} + ${a[1]})`;
        case "subtract":
          return `(${a[0]} - ${a[1]})`;
        case "multiply":
          return `(${a[0]} * ${a[1]})`;
        case "divide":
          return `(${a[0]} / NULLIF(${a[1]}, 0))`;
        case "log10":
          return `(CASE WHEN ${a[0]} > 0 THEN log10(${a[0]}) ELSE NULL END)`;
        case "is_null":
          return `(${a[0]} IS NULL)`;
        case "is_finite":
          return `isfinite(${a[0]})`;
      }
    }
  }
}

function aliasFor(fieldId: FieldId, state: CompileState, operationId: string): string | null {
  const alias = state.aliases.get(fieldId);
  if (!alias) error(state, "duckdb.field", `No physical alias for field ${fieldId}`, operationId);
  return alias ?? null;
}

function selectFields(
  fields: FieldSymbol[],
  state: CompileState,
  operationId: string,
): string | null {
  const aliases = fields.map((field) => aliasFor(field.id, state, operationId));
  return aliases.some((alias) => alias === null)
    ? null
    : (aliases as string[]).map(quoteIdentifier).join(", ");
}

function operationSQL(
  operation: LogicalOperation,
  cteForValue: Map<ValueId, string>,
  sourceNames: Map<string, string>,
  state: CompileState,
): string | null {
  if (operation.kind === "core:scan") {
    const sourceName = sourceNames.get(operation.sourceId);
    if (!sourceName) {
      error(state, "duckdb.source", `Source ${operation.sourceId} is not registered`, operation.id);
      return null;
    }
    const columns = operation.relation.fields.map((field) => {
      const path = field.provenance.kind === "source" ? field.provenance.path : field.name;
      return `${quoteIdentifier(path)} AS ${quoteIdentifier(state.aliases.get(field.id)!)}`;
    });
    return `SELECT ${columns.join(", ")} FROM ${quoteIdentifier(sourceName)}`;
  }

  const input = operation.input ? cteForValue.get(operation.input) : undefined;
  if (!input) {
    error(state, "duckdb.input", `Operation ${operation.id} has no compiled input`, operation.id);
    return null;
  }
  const from = quoteIdentifier(input);

  switch (operation.kind) {
    case "core:filter": {
      const predicate = expressionSQL(operation.predicate, state, operation.id);
      return predicate ? `SELECT * FROM ${from} WHERE ${predicate}` : null;
    }
    case "core:extend": {
      const expression = expressionSQL(operation.expression, state, operation.id);
      const alias = aliasFor(operation.field.id, state, operation.id);
      return expression && alias
        ? `SELECT *, ${expression} AS ${quoteIdentifier(alias)} FROM ${from}`
        : null;
    }
    case "core:project": {
      const fields = selectFields(operation.relation.fields, state, operation.id);
      return fields ? `SELECT ${fields} FROM ${from}` : null;
    }
    case "core:aggregate": {
      const groups = operation.groupBy.map((id) => aliasFor(id, state, operation.id));
      if (groups.some((alias) => alias === null)) return null;
      const groupAliases = groups as string[];
      const measures = operation.measures.map((measure) => {
        const output = aliasFor(measure.field.id, state, operation.id);
        if (!output) return null;
        if (measure.function === "count_rows") return `count(*) AS ${quoteIdentifier(output)}`;
        const inputField = measure.inputFieldId
          ? aliasFor(measure.inputFieldId, state, operation.id)
          : null;
        if (!inputField) return null;
        return `${measure.function}(${quoteIdentifier(inputField)}) AS ${quoteIdentifier(output)}`;
      });
      if (measures.some((measure) => measure === null)) return null;
      const selections = [...groupAliases.map(quoteIdentifier), ...(measures as string[])].join(
        ", ",
      );
      const groupBy =
        groupAliases.length > 0 ? ` GROUP BY ${groupAliases.map(quoteIdentifier).join(", ")}` : "";
      return `SELECT ${selections} FROM ${from}${groupBy}`;
    }
    case "core:sort": {
      const order = operation.fields.map((item) => {
        const alias = aliasFor(item.fieldId, state, operation.id);
        return alias
          ? `${quoteIdentifier(alias)} ${item.direction.toUpperCase()} NULLS ${item.nulls.toUpperCase()}`
          : null;
      });
      return order.some((item) => item === null)
        ? null
        : `SELECT * FROM ${from} ORDER BY ${(order as string[]).join(", ")}`;
    }
    case "core:limit":
      state.params.push(operation.count);
      return `SELECT * FROM ${from} LIMIT ?`;
  }
}

export function compileDuckDBRelation(
  logical: LogicalGraphic,
  relation: ValueId,
  registeredSources: RegisteredSource[],
): PhysicalCompileResult {
  const state: CompileState = { params: [], diagnostics: [], aliases: new Map() };
  const aliasOwners = new Map<string, FieldId>();
  for (const relationType of Object.values(logical.relations)) {
    for (const field of relationType.fields) {
      if (state.aliases.has(field.id)) continue;
      const alias = fieldAlias(field.id);
      const owner = aliasOwners.get(alias);
      if (owner && owner !== field.id) {
        error(
          state,
          "duckdb.alias.collision",
          `Fields ${owner} and ${field.id} have the same physical alias`,
        );
      } else {
        aliasOwners.set(alias, field.id);
        state.aliases.set(field.id, alias);
      }
    }
  }

  const target = logical.relations[relation];
  if (!target) error(state, "duckdb.relation", `Requested relation ${relation} does not exist`);
  const duplicateNames = target
    ? target.fields.filter(
        (field, index, fields) =>
          fields.findIndex((candidate) => candidate.name === field.name) !== index,
      )
    : [];
  if (duplicateNames.length > 0) {
    error(
      state,
      "duckdb.output.duplicate",
      `Output field name ${duplicateNames[0]!.name} is duplicated`,
    );
  }

  const sourceNames = new Map(
    registeredSources.map((source) => [source.sourceId, source.relationName]),
  );
  const operationsByOutput = new Map(
    logical.operations.map((operation) => [operation.output, operation]),
  );
  const required = new Set<ValueId>();
  const requireValue = (value: ValueId): void => {
    if (required.has(value)) return;
    required.add(value);
    const operation = operationsByOutput.get(value);
    if (operation?.input) requireValue(operation.input);
  };
  requireValue(relation);

  const cteForValue = new Map<ValueId, string>();
  const ctes: string[] = [];
  const operationMetadata: CompiledRelation["operations"] = [];
  let targetReached = false;

  for (const operation of logical.operations) {
    if (!required.has(operation.output)) continue;
    const cte = `relation_${ctes.length}`;
    const sql = operationSQL(operation, cteForValue, sourceNames, state);
    if (!sql) continue;
    ctes.push(`${quoteIdentifier(cte)} AS (${sql})`);
    operationMetadata.push({ operationId: operation.id, cte });
    cteForValue.set(operation.output, cte);
    if (operation.output === relation) {
      targetReached = true;
      break;
    }
  }

  if (!targetReached)
    error(state, "duckdb.relation.unreachable", `Requested relation ${relation} was not compiled`);
  const targetCte = cteForValue.get(relation);
  if (!target || !targetCte || state.diagnostics.some((item) => item.severity === "error")) {
    return { compiled: null, diagnostics: state.diagnostics };
  }

  const finalColumns = target.fields.map((field) => {
    const alias = state.aliases.get(field.id)!;
    return `${quoteIdentifier(alias)} AS ${quoteIdentifier(field.name)}`;
  });
  return {
    compiled: {
      sql: `WITH\n  ${ctes.join(",\n  ")}\nSELECT ${finalColumns.join(", ")} FROM ${quoteIdentifier(targetCte)}`,
      params: state.params,
      output: target.fields,
      relation,
      targetVersion: DUCKDB_TARGET_VERSION,
      operations: operationMetadata,
    },
    diagnostics: state.diagnostics,
  };
}
