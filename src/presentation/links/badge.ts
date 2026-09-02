import { effectiveBinding, evaluatePort, type Evaluation } from "./evaluate";
import { labelOf, type LinkDeps, type LinkSnapshot, type PortDefinition } from "./snapshot";
import { sourcePortOf, type Binding } from "./terms";
import type { PortId } from "./types";

/*
 * The binding badge (design §6.8.1, report §10.1): one small word per bound
 * port in the tile header, the always-on substrate of the whole design. It
 * is derived, never stored, and the same derivation feeds the accessible
 * name and the inspector.
 */

export type BadgeState = "none" | "ambient" | "following" | "shared" | "derived" | "held" | "fixed" | "empty" | "unresolved";

export interface Badge {
  readonly port: PortId;
  readonly name: string;
  readonly state: BadgeState;
  readonly glyph: string;
  /** The words after the glyph. */
  readonly text: string;
  /** One sentence for the hover doc and the accessible name. */
  readonly explanation: string;
  readonly sourcePort?: PortId;
  readonly binding: Binding;
  readonly evaluation: Evaluation;
}

const shortKey = (key: string): string => key.split(".").at(-1) ?? key;

export function badgeOf(definition: PortDefinition, s: LinkSnapshot, deps: LinkDeps): Badge {
  const port = definition.id;
  const name = definition.declaration.name;
  const binding = effectiveBinding(port, s);
  const evaluation = evaluatePort(port, s, deps);
  const base = { port, name, binding, evaluation };
  const shown = evaluation.kind === "value" ? labelOf(evaluation.reference, deps) : null;

  switch (binding.kind) {
    case "unresolved":
      if (binding.diagnostic.code === "unbound") {
        return { ...base, state: "none", glyph: "", text: "", explanation: `${name} is not bound` };
      }
      return { ...base, state: "unresolved", glyph: "⚠", text: name, explanation: `${name}: ${binding.diagnostic.message}` };
    case "ambient":
      return evaluation.kind === "value"
        ? { ...base, state: "ambient", glyph: "○", text: `${name} · ${shortKey(binding.key)}`, explanation: `${name} reads the ${binding.key} context, now ${shown}` }
        : { ...base, state: "empty", glyph: "○", text: `${name} · none`, explanation: `${name} reads the ${binding.key} context, which is empty` };
    case "constant":
      return definition.declaration.documentSlot
        ? { ...base, state: "fixed", glyph: "•", text: String(binding.reference.value), explanation: `${name} is the document ${String(binding.reference.value)}` }
        : { ...base, state: "fixed", glyph: "•", text: shown ?? name, explanation: `${name} is fixed on ${shown ?? "a value"}` };
    case "follow": {
      const source = s.ports.get(binding.source);
      const title = source ? source.tileTitle : binding.source;
      if (evaluation.kind === "error") {
        return { ...base, state: "unresolved", glyph: "⚠", text: name, explanation: `${name}: ${evaluation.diagnostic.message}`, sourcePort: binding.source };
      }
      return {
        ...base,
        state: "following",
        glyph: "→",
        text: evaluation.kind === "value" ? title : `${title} · none`,
        explanation: evaluation.kind === "value" ? `${name} follows ${title}, now ${shown}` : `${name} follows ${title}, which has shown nothing yet`,
        sourcePort: binding.source,
      };
    }
    case "hold": {
      const source = sourcePortOf(binding.suspended);
      const sourceTitle = source ? (s.ports.get(source)?.tileTitle ?? source) : null;
      const resumes =
        binding.suspended.kind === "unresolved"
          ? `cannot resume: ${binding.suspended.diagnostic.message}`
          : sourceTitle
            ? `resume follows ${sourceTitle}`
            : binding.suspended.kind === "ambient"
              ? `resume reads ${binding.suspended.key}`
              : "resume restores its source";
      return { ...base, state: "held", glyph: "⏸", text: shown ?? name, explanation: `${name} is held on ${shown ?? "a value"}; ${resumes}`, ...(source ? { sourcePort: source } : {}) };
    }
    case "alias":
      return { ...base, state: "shared", glyph: "≡", text: `${name} · ${binding.classId}`, explanation: `${name} shares the ${binding.classId} cell` };
    case "derived": {
      const source = sourcePortOf(binding);
      const title = source ? (s.ports.get(source)?.tileTitle ?? source) : "its source";
      return evaluation.kind === "error"
        ? { ...base, state: "unresolved", glyph: "⚠", text: name, explanation: `${name}: ${evaluation.diagnostic.message}`, ...(source ? { sourcePort: source } : {}) }
        : {
            ...base,
            state: "derived",
            glyph: "←",
            text: `${name} ← ${deps.relations?.find((r) => r.id === binding.relationId)?.label ?? binding.relationId}`,
            explanation: evaluation.kind === "value" ? `${name} derives through ${binding.relationId} from ${title}, now ${shown}` : `${name} derives through ${binding.relationId} from ${title}, which has shown nothing yet`,
            ...(source ? { sourcePort: source } : {}),
          };
    }
  }
}

/** The badges of one view's ports: inputs and inouts with a non-trivial term; document slots only when a term overrides them. */
export function badgesOfView(viewId: string, s: LinkSnapshot, deps: LinkDeps): Badge[] {
  const out: Badge[] = [];
  for (const definition of s.ports.values()) {
    if (definition.viewId !== viewId) continue;
    if (definition.declaration.direction === "out") continue;
    if (definition.declaration.documentSlot && !s.bindings.has(definition.id)) continue;
    const badge = badgeOf(definition, s, deps);
    if (badge.state !== "none") out.push(badge);
  }
  return out;
}
