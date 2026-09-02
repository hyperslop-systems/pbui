import { evaluatePort } from "./evaluate";
import type { LinkDeps, LinkSnapshot } from "./snapshot";
import { linkIdOf, sourcePortOf } from "./terms";

/*
 * The system invariants of report §7.11 that Phase 2 can already check
 * (design §12.2). Used by tests and, in Phase 7, by the inspector. A
 * violation is a fact with a sentence, never an exception.
 */

export interface Violation {
  readonly code: "term-without-port" | "source-missing" | "duplicate-link-id" | "cycle" | "slot-constant" | "type";
  readonly message: string;
}

export function checkInvariants(s: LinkSnapshot, deps: LinkDeps): Violation[] {
  const out: Violation[] = [];
  const linkIds = new Map<string, string>();
  for (const [port, binding] of s.bindings) {
    const definition = s.ports.get(port);
    if (!definition) {
      out.push({ code: "term-without-port", message: `${port} has a term but is not a declared port` });
      continue;
    }
    if (definition.declaration.documentSlot && binding.kind === "constant") {
      out.push({ code: "slot-constant", message: `${port} is a document slot; its constant belongs in view.documents` });
    }
    const source = sourcePortOf(binding);
    if (source && !s.ports.has(source) && binding.kind !== "hold") {
      out.push({ code: "source-missing", message: `${port} reads ${source}, which is not a declared port` });
    }
    const linkId = linkIdOf(binding);
    if (linkId) {
      const previous = linkIds.get(linkId);
      if (previous) out.push({ code: "duplicate-link-id", message: `link ${linkId} is carried by both ${previous} and ${port}` });
      linkIds.set(linkId, port);
    }
    const evaluation = evaluatePort(port, s, deps);
    if (evaluation.kind === "error" && evaluation.diagnostic.code === "cycle") {
      out.push({ code: "cycle", message: evaluation.diagnostic.message });
    }
  }
  return out;
}
