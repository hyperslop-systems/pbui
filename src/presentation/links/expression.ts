import type { Binding, Diagnostic, SerializableReference } from "./terms";
import type { PortId } from "./types";

/** Atomic sources in the normalized binding expression language. */
export type BindingSource =
  | { readonly kind: "context"; readonly key: string }
  | { readonly kind: "constant"; readonly reference: SerializableReference }
  | { readonly kind: "port"; readonly port: PortId; readonly linkId: string }
  | { readonly kind: "cell"; readonly classId: string }
  | { readonly kind: "error"; readonly diagnostic: Diagnostic };

/** Computation is explicit syntax: sources plus named relation application. */
export type BindingExpression =
  | { readonly kind: "source"; readonly source: BindingSource }
  | {
      readonly kind: "apply";
      readonly relationId: string;
      readonly input: BindingExpression;
      readonly linkId: string;
    };

/** Runtime control state is factored from the computation it controls. */
export type BindingProgram =
  | { readonly kind: "live"; readonly expression: BindingExpression }
  | {
      readonly kind: "held";
      readonly reference: SerializableReference;
      readonly suspended: BindingProgram;
    }
  | { readonly kind: "broken"; readonly diagnostic: Diagnostic };

export interface BindingDependencies {
  readonly ports: ReadonlySet<PortId>;
  readonly relations: ReadonlySet<string>;
  readonly links: ReadonlySet<string>;
}

function expressionOf(binding: Binding): BindingExpression {
  switch (binding.kind) {
    case "ambient":
      return { kind: "source", source: { kind: "context", key: binding.key } };
    case "constant":
      return {
        kind: "source",
        source: { kind: "constant", reference: binding.reference },
      };
    case "follow":
      return {
        kind: "source",
        source: {
          kind: "port",
          port: binding.source,
          linkId: binding.linkId,
        },
      };
    case "alias":
      return {
        kind: "source",
        source: { kind: "cell", classId: binding.classId },
      };
    case "derived":
      return {
        kind: "apply",
        relationId: binding.relationId,
        input: expressionOf(binding.source),
        linkId: binding.linkId,
      };
    case "hold":
      // A derived-over-hold term is representable but non-canonical: only the
      // frozen value participates in that computation.
      return {
        kind: "source",
        source: { kind: "constant", reference: binding.reference },
      };
    case "unresolved":
      return {
        kind: "source",
        source: { kind: "error", diagnostic: binding.diagnostic },
      };
  }
}

/** Compile the stable PBUI-LINK-1 document grammar into normalized IR. */
export function programOf(binding: Binding): BindingProgram {
  if (binding.kind === "hold") {
    return {
      kind: "held",
      reference: binding.reference,
      suspended: programOf(binding.suspended),
    };
  }
  if (binding.kind === "unresolved") {
    return { kind: "broken", diagnostic: binding.diagnostic };
  }
  return { kind: "live", expression: expressionOf(binding) };
}

function bindingOfExpression(expression: BindingExpression): Binding {
  if (expression.kind === "apply") {
    return {
      kind: "derived",
      source: bindingOfExpression(expression.input),
      relationId: expression.relationId,
      linkId: expression.linkId,
    };
  }
  switch (expression.source.kind) {
    case "context":
      return { kind: "ambient", key: expression.source.key };
    case "constant":
      return { kind: "constant", reference: expression.source.reference };
    case "port":
      return {
        kind: "follow",
        source: expression.source.port,
        linkId: expression.source.linkId,
      };
    case "cell":
      return { kind: "alias", classId: expression.source.classId };
    case "error":
      return { kind: "unresolved", diagnostic: expression.source.diagnostic };
  }
}

/** Lower normalized IR back to the stable persisted grammar. */
export function bindingOf(program: BindingProgram): Binding {
  switch (program.kind) {
    case "live":
      return bindingOfExpression(program.expression);
    case "held":
      return {
        kind: "hold",
        reference: program.reference,
        suspended: bindingOf(program.suspended),
      };
    case "broken":
      return { kind: "unresolved", diagnostic: program.diagnostic };
  }
}

/** Idempotent canonicalization over the legacy wire format. */
export function normalizeBinding(binding: Binding): Binding {
  return bindingOf(programOf(binding));
}

function collectExpression(
  expression: BindingExpression,
  ports: Set<PortId>,
  relations: Set<string>,
  links: Set<string>,
): void {
  if (expression.kind === "apply") {
    relations.add(expression.relationId);
    links.add(expression.linkId);
    collectExpression(expression.input, ports, relations, links);
    return;
  }
  if (expression.source.kind === "port") {
    ports.add(expression.source.port);
    links.add(expression.source.linkId);
  }
}

/** Structural dependencies. Suspended wires are included unless excluded. */
export function dependenciesOfProgram(
  program: BindingProgram,
  options: { readonly includeSuspended?: boolean } = {},
): BindingDependencies {
  const ports = new Set<PortId>();
  const relations = new Set<string>();
  const links = new Set<string>();
  const includeSuspended = options.includeSuspended ?? true;

  function visit(current: BindingProgram): void {
    switch (current.kind) {
      case "live":
        collectExpression(current.expression, ports, relations, links);
        return;
      case "held":
        if (includeSuspended) visit(current.suspended);
        return;
      case "broken":
        return;
    }
  }

  visit(program);
  return { ports, relations, links };
}

export function dependenciesOfBinding(
  binding: Binding,
  options?: { readonly includeSuspended?: boolean },
): BindingDependencies {
  return dependenciesOfProgram(programOf(binding), options);
}

/** Compatibility projection for algorithms that need only source ports. */
export function sourcePortsOfBinding(
  binding: Binding,
  options?: { readonly includeSuspended?: boolean },
): readonly PortId[] {
  return [...dependenciesOfBinding(binding, options).ports];
}
