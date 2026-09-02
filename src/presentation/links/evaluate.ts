import type { LinkDeps, LinkSnapshot } from "./snapshot";
import { terms, type Binding, type Diagnostic, type SerializableReference } from "./terms";
import type { PortId } from "./types";

/*
 * Effective bindings and pull evaluation (design §8.1, D5).
 *
 * `effectiveBinding` is the precedence rule of D2: an explicit term in the
 * link document wins; else a document slot reads as a constant; else the
 * declared ambient fallback; else `Unresolved("unbound")`. `evaluatePort`
 * walks the term to a value with a `visiting` set, so a cycle that slipped
 * past the planner is reported, never looped.
 */

export type Evaluation =
  | { readonly kind: "value"; readonly reference: SerializableReference; readonly provenance: Binding; readonly path: readonly PortId[] }
  | { readonly kind: "empty"; readonly provenance: Binding; readonly path: readonly PortId[] }
  | { readonly kind: "error"; readonly diagnostic: Diagnostic; readonly provenance: Binding; readonly path: readonly PortId[] };

export function effectiveBinding(port: PortId, s: LinkSnapshot): Binding {
  const explicit = s.bindings.get(port);
  if (explicit) return explicit;
  // A member of an identity class reads the shared cell (never written as a term; derived here).
  const classId = s.aliases.get(port);
  if (classId) return terms.alias(classId);
  const slot = s.documentSlots.get(port);
  if (slot) return terms.constant(slot);
  const definition = s.ports.get(port);
  if (!definition) return terms.unresolved("port-missing", `${port} is not a declared port of a placed view`);
  if (definition.declaration.fallbackContext) return terms.ambient(definition.declaration.fallbackContext);
  return terms.unresolved("unbound", `${definition.declaration.name} is not bound`);
}

export function evaluatePort(port: PortId, s: LinkSnapshot, deps: LinkDeps, visiting: readonly PortId[] = []): Evaluation {
  if (visiting.includes(port)) {
    const path = [...visiting, port];
    return { kind: "error", diagnostic: { code: "cycle", message: `cycle through ${path.join(" → ")}` }, provenance: terms.unresolved("cycle", "cycle"), path };
  }
  const binding = effectiveBinding(port, s);
  // An OUTPUT or INOUT port with no term is its own source: it reads what it last emitted.
  if (binding.kind === "unresolved" && binding.diagnostic.code === "unbound") {
    const definition = s.ports.get(port);
    if (definition && definition.declaration.direction !== "in") {
      const own = s.values.emitted(port);
      return own ? { kind: "value", reference: own, provenance: binding, path: [...visiting, port] } : { kind: "empty", provenance: binding, path: [...visiting, port] };
    }
  }
  return evaluateBinding(binding, s, deps, [...visiting, port]);
}

export function evaluateBinding(binding: Binding, s: LinkSnapshot, deps: LinkDeps, path: readonly PortId[]): Evaluation {
  switch (binding.kind) {
    case "ambient": {
      const cell = s.values.context(binding.key);
      return cell ? { kind: "value", reference: cell, provenance: binding, path } : { kind: "empty", provenance: binding, path };
    }
    case "constant":
      return { kind: "value", reference: binding.reference, provenance: binding, path };
    case "hold":
      return { kind: "value", reference: binding.reference, provenance: binding, path };
    case "follow": {
      const source = s.ports.get(binding.source);
      if (!source) {
        return { kind: "error", diagnostic: { code: "source-missing", message: `${binding.source} is gone` }, provenance: binding, path };
      }
      // Following a follower: an INPUT's value is whatever it reads.
      if (source.declaration.direction === "in") {
        const inner = evaluatePort(binding.source, s, deps, path);
        return inner.kind === "value" ? { kind: "value", reference: inner.reference, provenance: binding, path: inner.path } : { ...inner, provenance: binding };
      }
      const emitted = s.values.emitted(binding.source);
      return emitted ? { kind: "value", reference: emitted, provenance: binding, path: [...path, binding.source] } : { kind: "empty", provenance: binding, path: [...path, binding.source] };
    }
    case "alias": {
      const cell = s.values.classCell?.(binding.classId);
      if (cell === undefined) {
        return { kind: "error", diagnostic: { code: "class-missing", message: `no identity class ${binding.classId}` }, provenance: binding, path };
      }
      return cell ? { kind: "value", reference: cell, provenance: binding, path } : { kind: "empty", provenance: binding, path };
    }
    case "derived": {
      const inner = evaluateBinding(binding.source, s, deps, path);
      if (inner.kind !== "value") return { ...inner, provenance: binding };
      if (!deps.relation) {
        return { kind: "error", diagnostic: { code: "relation-missing", message: `no relation registry can apply ${binding.relationId}` }, provenance: binding, path: inner.path };
      }
      const out = deps.relation(binding.relationId, inner.reference, s);
      return out ? { kind: "value", reference: out, provenance: binding, path: inner.path } : { kind: "empty", provenance: binding, path: inner.path };
    }
    case "unresolved":
      return { kind: "error", diagnostic: binding.diagnostic, provenance: binding, path };
  }
}

/** The value Pin would freeze: what was last presented as attended on the port, else its evaluation. */
export function valueToHold(port: PortId, s: LinkSnapshot, deps: LinkDeps): SerializableReference | null {
  const attended = s.values.attended(port);
  if (attended) return attended;
  const evaluation = evaluatePort(port, s, deps);
  return evaluation.kind === "value" ? evaluation.reference : null;
}
