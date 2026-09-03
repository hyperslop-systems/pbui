import type { RuntimeTypeId } from "../actions/ids";
import type { PresentationTypeGraph } from "../actions/typeGraph";
import { reaches } from "./snapshot";
import type { SerializableReference } from "./terms";
import {
  PORT_PROTOCOL_FIELDS,
  VALUE_CONTRACT_FIELDS,
  type ContractMismatch,
  type PortContract,
  type PortProtocol,
  type ValueContract,
} from "./types";

/*
 * Operation-specific port compatibility (PBUI-KERNEL-3 P2; KERNEL-1 guide
 * §13.2). A contract is a value contract times a protocol:
 *
 *   ValueContract = valueType × semanticRole × cardinality
 *   PortProtocol  = mode × authorityDomain × updateAlgebra × lifetime
 *
 * and the link operations ask DIFFERENT questions of it. Flow asks whether a
 * value can travel from one port to another: value reachability, nothing
 * about protocol. Acceptance asks whether a reference can be written into a
 * port: the same question with a reference as the source. Sharing a cell
 * asks whether two ports may be the same cell: equality on both
 * projections, because a shared cell has one authority, one algebra and one
 * lifetime. Merging updates asks only whether two endpoints agree on how
 * writes combine. Before this module every question was answered by one
 * whole-contract comparison or one bare `reaches`; now each has a name, a
 * code and a sentence, and the callers say which they mean.
 */

export type Verdict = { readonly ok: true } | { readonly ok: false; readonly code: string; readonly because: string };

const FIELD_WORDS: Record<ContractMismatch["field"], string> = {
  valueType: "value type",
  semanticRole: "semantic role",
  cardinality: "cardinality",
  mode: "mode",
  authorityDomain: "authority domain",
  updateAlgebra: "update algebra",
  lifetime: "lifetime",
};

const OK = { ok: true } as const;

function mismatchesOver<K extends keyof PortContract>(fields: readonly K[], left: Pick<PortContract, K>, right: Pick<PortContract, K>): ContractMismatch[] {
  const out: ContractMismatch[] = [];
  for (const field of fields) {
    if (left[field] !== right[field]) out.push({ field, left: String(left[field]), right: String(right[field]) });
  }
  return out;
}

/** The value-projection disagreements, in the fingerprint's field order. */
export function valueMismatches(left: ValueContract, right: ValueContract): ContractMismatch[] {
  return mismatchesOver(VALUE_CONTRACT_FIELDS, left, right);
}

/** The protocol-projection disagreements, in the fingerprint's field order. */
export function protocolMismatches(left: PortProtocol, right: PortProtocol): ContractMismatch[] {
  return mismatchesOver(PORT_PROTOCOL_FIELDS, left, right);
}

/** One sentence naming every field that differs: "different authority domain: orders vs daily_sales". */
export function describeMismatches(mismatches: readonly ContractMismatch[]): string {
  return mismatches.map((m) => `different ${FIELD_WORDS[m.field]}: ${m.left} vs ${m.right}`).join("; ");
}

/**
 * FLOW: may a value of `from` be read by a port whose value contract is
 * `into`? Value reachability through the product's type graph (`any` accepts
 * everything). Direction is a property of the PORT, not of the contract,
 * and stays with the planner; cardinality and role are not consulted, which
 * is the PBUI-LINK-1 law this predicate names rather than changes.
 */
export function canFlow(from: ValueContract | RuntimeTypeId, into: ValueContract, graph: PresentationTypeGraph): Verdict {
  const fromType = typeof from === "string" ? from : from.valueType;
  if (reaches(fromType, into.valueType, graph)) return OK;
  return { ok: false, code: "type", because: `<${fromType}> does not reach <${into.valueType}>` };
}

/** ACCEPTANCE: may `reference` be written into a port whose value contract is `into`? Flow with a reference as the source. */
export function canAccept(reference: SerializableReference, into: ValueContract, graph: PresentationTypeGraph): Verdict {
  return canFlow(reference.type, into, graph);
}

/** UPDATE MERGING: do two endpoints combine writes the same way? Only the algebra is consulted. */
export function canMergeUpdates(left: PortProtocol, right: PortProtocol): Verdict {
  if (left.updateAlgebra === right.updateAlgebra) return OK;
  return { ok: false, code: "update-algebra", because: describeMismatches(mismatchesOver(["updateAlgebra"], left, right)) };
}

export type ShareVerdict =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: "incompatible";
      readonly because: string;
      /** Disagreements on the value projection. */
      readonly value: readonly ContractMismatch[];
      /** Disagreements on the protocol projection (the update algebra among them). */
      readonly protocol: readonly ContractMismatch[];
    };

/**
 * SHARING A CELL: may two ports be one logical cell? Both projections must
 * agree on every field — a shared cell has one value type and role, one
 * cardinality, one authority, one algebra (`canMergeUpdates`) and one
 * lifetime. The verdict keeps the two projections apart so a menu can say
 * whether the ports disagree about WHAT they hold or about HOW they hold it.
 */
export function canShareCell(left: PortContract, right: PortContract): ShareVerdict {
  const value = valueMismatches(left, right);
  const protocol = protocolMismatches(left, right);
  if (value.length === 0 && protocol.length === 0) return OK;
  return { ok: false, code: "incompatible", because: describeMismatches([...value, ...protocol]), value, protocol };
}
