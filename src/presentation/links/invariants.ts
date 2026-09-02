import { evaluatePort } from "./evaluate";
import type { LinkDeps, LinkSnapshot } from "./snapshot";
import { dependenciesOfBinding } from "./expression";
import { linkIdOf } from "./terms";
import { contractFingerprint } from "./types";

/*
 * The system invariants of report §7.11 that Phase 2 can already check
 * (design §12.2). Used by tests and, in Phase 7, by the inspector. A
 * violation is a fact with a sentence, never an exception.
 */

export interface Violation {
  readonly code: "term-without-port" | "source-missing" | "duplicate-link-id" | "cycle" | "slot-constant" | "type" | "class-heterogeneous" | "alias-multiple" | "identity-port-missing";
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
    for (const source of dependenciesOfBinding(binding, { includeSuspended: false }).ports) {
      if (!s.ports.has(source)) {
        out.push({ code: "source-missing", message: `${port} reads ${source}, which is not a declared port` });
      }
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
  // Identity (Phase 5): every alias port in exactly one class; classes contract-homogeneous; declarations over existing ports.
  const seen = new Map<string, string>();
  for (const cls of s.classes.values()) {
    for (const member of cls.members) {
      const definition = s.ports.get(member);
      if (!definition) {
        out.push({ code: "identity-port-missing", message: `${member} is in ${cls.id} but is not a declared port` });
        continue;
      }
      if (contractFingerprint(definition.declaration.contract) !== cls.fingerprint) {
        out.push({ code: "class-heterogeneous", message: `${member} does not match ${cls.id}'s contract` });
      }
      const previous = seen.get(member);
      if (previous) out.push({ code: "alias-multiple", message: `${member} is in both ${previous} and ${cls.id}` });
      seen.set(member, cls.id);
    }
  }
  for (const declaration of s.identity) {
    for (const port of [declaration.left, declaration.right]) {
      if (!s.ports.has(port)) out.push({ code: "identity-port-missing", message: `identity ${declaration.linkId} names ${port}, which is not a declared port` });
    }
  }
  return out;
}
