import type { RuntimeTypeId } from "../actions/ids";
import {
  dependenciesOfBinding,
  programOf,
  type BindingDependencies,
  type BindingExpression,
  type BindingProgram,
} from "./expression";
import { reaches, titleOfPort, type LinkDeps, type LinkSnapshot } from "./snapshot";
import type { Binding } from "./terms";
import type { PortId } from "./types";

export interface BindingCheckDiagnostic {
  readonly code:
    | "unresolved"
    | "context-missing"
    | "source-missing"
    | "class-missing"
    | "relation-missing"
    | "relation-source"
    | "type"
    | "cycle";
  readonly message: string;
}

export type BindingCheckResult =
  | {
      readonly kind: "valid";
      readonly program: BindingProgram;
      readonly resultType: RuntimeTypeId;
      readonly dependencies: BindingDependencies;
    }
  | { readonly kind: "invalid"; readonly diagnostic: BindingCheckDiagnostic };

function inferExpression(
  expression: BindingExpression,
  snapshot: LinkSnapshot,
  deps: LinkDeps,
): RuntimeTypeId | BindingCheckDiagnostic {
  if (expression.kind === "apply") {
    const input = inferExpression(expression.input, snapshot, deps);
    if (typeof input !== "string") return input;
    const relation = deps.relations?.find(
      (candidate) => candidate.id === expression.relationId,
    );
    if (!relation) {
      return {
        code: "relation-missing",
        message: `no relation called ${expression.relationId}`,
      };
    }
    const sourceMatches =
      relation.match === "exact"
        ? input === relation.from
        : reaches(input, relation.from, deps.graph);
    if (!sourceMatches) {
      return {
        code: "relation-source",
        message: `<${input}> does not reach relation ${relation.id}'s <${relation.from}> source`,
      };
    }
    return relation.to;
  }

  switch (expression.source.kind) {
    case "constant":
      return expression.source.reference.type;
    case "context": {
      const context = snapshot.contexts.get(expression.source.key);
      return context?.valueType ?? {
        code: "context-missing",
        message: `no context called ${expression.source.key}`,
      };
    }
    case "port": {
      const definition = snapshot.ports.get(expression.source.port);
      return definition?.declaration.contract.valueType ?? {
        code: "source-missing",
        message: `${expression.source.port} is not a declared port`,
      };
    }
    case "cell": {
      const cell = snapshot.classes.get(expression.source.classId);
      const member = cell?.members[0];
      const definition = member ? snapshot.ports.get(member) : undefined;
      return definition?.declaration.contract.valueType ?? {
        code: "class-missing",
        message: `identity class ${expression.source.classId} has no declared member`,
      };
    }
    case "error":
      return {
        code: "unresolved",
        message: expression.source.diagnostic.message,
      };
  }
}

function inferProgram(
  program: BindingProgram,
  snapshot: LinkSnapshot,
  deps: LinkDeps,
): RuntimeTypeId | BindingCheckDiagnostic {
  switch (program.kind) {
    case "live":
      return inferExpression(program.expression, snapshot, deps);
    case "held":
      return program.reference.type;
    case "broken":
      return { code: "unresolved", message: program.diagnostic.message };
  }
}

/**
 * Does `port`'s explicit chain read, transitively, from `target`? The ONE
 * dependency walk of the kernel (PBUI-KERNEL-2 P2): it follows
 * `dependenciesOfBinding` over the program, suspended wires included, so a
 * held term that would close a loop on resume is refused before the resume.
 * The planners ask this through the checker; nothing walks terms by hand.
 */
export function dependsOn(port: PortId, target: PortId, snapshot: LinkSnapshot, seen: Set<PortId> = new Set()): boolean {
  if (port === target) return true;
  if (seen.has(port)) return false;
  seen.add(port);
  const binding = snapshot.bindings.get(port);
  if (!binding) return false;
  return [...dependenciesOfBinding(binding).ports].some((source) => dependsOn(source, target, snapshot, seen));
}

/** Typecheck and dependency-check a candidate expression for a destination. */
export function checkBinding(
  binding: Binding,
  snapshot: LinkSnapshot,
  deps: LinkDeps,
  destination?: PortId,
): BindingCheckResult {
  const program = programOf(binding);
  const dependencies = dependenciesOfBinding(binding);
  const resultType = inferProgram(program, snapshot, deps);
  if (typeof resultType !== "string") {
    return { kind: "invalid", diagnostic: resultType };
  }

  if (destination) {
    const definition = snapshot.ports.get(destination);
    if (!definition) {
      return {
        kind: "invalid",
        diagnostic: {
          code: "source-missing",
          message: `${destination} is not a declared port`,
        },
      };
    }
    for (const source of dependencies.ports) {
      if (dependsOn(source, destination, snapshot)) {
        const S = snapshot.ports.get(source);
        return {
          kind: "invalid",
          diagnostic: {
            code: "cycle",
            message: `${S ? titleOfPort(S) : source} already reads from ${titleOfPort(definition)}; that would be a cycle`,
          },
        };
      }
    }
    if (!reaches(resultType, definition.declaration.contract.valueType, deps.graph)) {
      return {
        kind: "invalid",
        diagnostic: {
          code: "type",
          message:
            `<${resultType}> does not reach ` +
            `<${definition.declaration.contract.valueType}>`,
        },
      };
    }
  }

  return { kind: "valid", program, resultType, dependencies };
}
