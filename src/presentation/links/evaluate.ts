import {
  bindingOf,
  programOf,
  type BindingExpression,
  type BindingProgram,
  type BindingSource,
} from "./expression";
import type { LinkDeps, LinkSnapshot } from "./snapshot";
import {
  terms,
  type Binding,
  type Diagnostic,
  type SerializableReference,
} from "./terms";
import type { PortId } from "./types";

/*
 * Effective bindings and pull evaluation (design §8.1, D5).
 *
 * Persisted `Binding` remains the stable wire format. Evaluation compiles it
 * into a factored program (source/computation/control state) and interprets
 * that program. This makes normalization, dependency extraction and static
 * checking sibling interpreters over one AST rather than special cases.
 */

export type Evaluation =
  | {
      readonly kind: "value";
      readonly reference: SerializableReference;
      readonly provenance: Binding;
      readonly path: readonly PortId[];
    }
  | {
      readonly kind: "empty";
      readonly provenance: Binding;
      readonly path: readonly PortId[];
    }
  | {
      readonly kind: "error";
      readonly diagnostic: Diagnostic;
      readonly provenance: Binding;
      readonly path: readonly PortId[];
    };

export function effectiveBinding(port: PortId, s: LinkSnapshot): Binding {
  const explicit = s.bindings.get(port);
  if (explicit) return explicit;
  const classId = s.aliases.get(port);
  if (classId) return terms.alias(classId);
  const slot = s.documentSlots.get(port);
  if (slot) return terms.constant(slot);
  const definition = s.ports.get(port);
  if (!definition) {
    return terms.unresolved(
      "port-missing",
      `${port} is not a declared port of a placed view`,
    );
  }
  if (definition.declaration.fallbackContext) {
    return terms.ambient(definition.declaration.fallbackContext);
  }
  return terms.unresolved(
    "unbound",
    `${definition.declaration.name} is not bound`,
  );
}

export function effectiveProgram(port: PortId, s: LinkSnapshot): BindingProgram {
  return programOf(effectiveBinding(port, s));
}

export function evaluatePort(
  port: PortId,
  s: LinkSnapshot,
  deps: LinkDeps,
  visiting: readonly PortId[] = [],
): Evaluation {
  if (visiting.includes(port)) {
    const path = [...visiting, port];
    return {
      kind: "error",
      diagnostic: { code: "cycle", message: `cycle through ${path.join(" -> ")}` },
      provenance: terms.unresolved("cycle", "cycle"),
      path,
    };
  }
  const binding = effectiveBinding(port, s);
  if (binding.kind === "unresolved" && binding.diagnostic.code === "unbound") {
    const definition = s.ports.get(port);
    if (definition && definition.declaration.direction !== "in") {
      const own = s.values.emitted(port);
      return own
        ? {
            kind: "value",
            reference: own,
            provenance: binding,
            path: [...visiting, port],
          }
        : { kind: "empty", provenance: binding, path: [...visiting, port] };
    }
  }
  return evaluateProgram(programOf(binding), s, deps, [...visiting, port], binding);
}

export function evaluateBinding(
  binding: Binding,
  s: LinkSnapshot,
  deps: LinkDeps,
  path: readonly PortId[],
): Evaluation {
  return evaluateProgram(programOf(binding), s, deps, path, binding);
}

export function evaluateProgram(
  program: BindingProgram,
  s: LinkSnapshot,
  deps: LinkDeps,
  path: readonly PortId[],
  provenance: Binding = bindingOf(program),
): Evaluation {
  switch (program.kind) {
    case "held":
      return {
        kind: "value",
        reference: program.reference,
        provenance,
        path,
      };
    case "broken":
      return { kind: "error", diagnostic: program.diagnostic, provenance, path };
    case "live":
      return evaluateExpression(program.expression, s, deps, path, provenance);
  }
}

function evaluateExpression(
  expression: BindingExpression,
  s: LinkSnapshot,
  deps: LinkDeps,
  path: readonly PortId[],
  provenance: Binding,
): Evaluation {
  if (expression.kind === "source") {
    return evaluateSource(expression.source, s, deps, path, provenance);
  }

  const inner = evaluateExpression(expression.input, s, deps, path, provenance);
  if (inner.kind !== "value") return { ...inner, provenance };

  if (deps.relationEvaluation) {
    const result = deps.relationEvaluation(
      expression.relationId,
      inner.reference,
      s,
    );
    if (result.kind === "value") {
      return {
        kind: "value",
        reference: result.reference,
        provenance,
        path: inner.path,
      };
    }
    if (result.kind === "empty") {
      return { kind: "empty", provenance, path: inner.path };
    }
    return {
      kind: "error",
      diagnostic: result.diagnostic,
      provenance,
      path: inner.path,
    };
  }

  if (!deps.relation) {
    return {
      kind: "error",
      diagnostic: {
        code: "relation-missing",
        message: `no relation registry can apply ${expression.relationId}`,
      },
      provenance,
      path: inner.path,
    };
  }
  const output = deps.relation(expression.relationId, inner.reference, s);
  return output
    ? { kind: "value", reference: output, provenance, path: inner.path }
    : { kind: "empty", provenance, path: inner.path };
}

function evaluateSource(
  source: BindingSource,
  s: LinkSnapshot,
  deps: LinkDeps,
  path: readonly PortId[],
  provenance: Binding,
): Evaluation {
  switch (source.kind) {
    case "context": {
      const cell = s.values.context(source.key);
      return cell
        ? { kind: "value", reference: cell, provenance, path }
        : { kind: "empty", provenance, path };
    }
    case "constant":
      return { kind: "value", reference: source.reference, provenance, path };
    case "port": {
      const definition = s.ports.get(source.port);
      if (!definition) {
        return {
          kind: "error",
          diagnostic: {
            code: "source-missing",
            message: `${source.port} is gone`,
          },
          provenance,
          path,
        };
      }
      if (definition.declaration.direction === "in") {
        const inner = evaluatePort(source.port, s, deps, path);
        return inner.kind === "value"
          ? {
              kind: "value",
              reference: inner.reference,
              provenance,
              path: inner.path,
            }
          : { ...inner, provenance };
      }
      const emitted = s.values.emitted(source.port);
      return emitted
        ? {
            kind: "value",
            reference: emitted,
            provenance,
            path: [...path, source.port],
          }
        : { kind: "empty", provenance, path: [...path, source.port] };
    }
    case "cell": {
      const cell = s.values.classCell?.(source.classId);
      if (cell === undefined) {
        return {
          kind: "error",
          diagnostic: {
            code: "class-missing",
            message: `no identity class ${source.classId}`,
          },
          provenance,
          path,
        };
      }
      return cell
        ? { kind: "value", reference: cell, provenance, path }
        : { kind: "empty", provenance, path };
    }
    case "error":
      return { kind: "error", diagnostic: source.diagnostic, provenance, path };
  }
}

/** The value Pin would freeze: last attended value, else current evaluation. */
export function valueToHold(
  port: PortId,
  s: LinkSnapshot,
  deps: LinkDeps,
): SerializableReference | null {
  const attended = s.values.attended(port);
  if (attended) return attended;
  const evaluation = evaluatePort(port, s, deps);
  return evaluation.kind === "value" ? evaluation.reference : null;
}
