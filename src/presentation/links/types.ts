import type { RuntimeTypeId } from "../actions/ids";

/*
 * Ports and contracts (PBUI-LINK-1 Phase 1).
 *
 * A PORT is a named, typed, directional input or output of an application
 * view — the thing a link connects. A CONTRACT is the seven normalized fields
 * of a port that decide whether two ports may be IDENTIFIED (share one cell,
 * Phase 5) as opposed to merely connected. The distinction comes from the
 * P06 identity compiler: two ports of the same value type may still disagree
 * on role, cardinality, mode, authority, update algebra or lifetime, and
 * identifying them then produces the "type laundering" the research report
 * warns about. Following (Phase 2) needs only type reachability; identity
 * needs equality on every field.
 *
 * Nothing here knows about documents, tiles, React or stores. The shell
 * (`pbui-workbench`) decides what a port's value IS at runtime; this module
 * only says what a declaration looks like and how it normalizes.
 */

export type PortDirection = "in" | "out" | "inout";
export type PortCardinality = "one" | "optional" | "many";
export type PortMode = "read" | "write" | "read-write" | "event-source" | "event-sink";
export type PortLifetime = "tile" | "workspace" | "persistent";
/** How an input with several live producers resolves (report §11). Default `single-producer`. */
export type FanInPolicy = "single-producer" | "active-source" | "last-event";
/** What a follower does when its source view closes (report §11.3). Default `freeze`. */
export type SourceClosePolicy = "freeze" | "clear" | "ambient" | "reroute" | "prompt";

/** The value carried by a port, independent of its communication protocol. */
export interface ValueContract {
  /** A runtime type id in the product's presentation type graph; compared nominally. */
  readonly valueType: RuntimeTypeId;
  /** The semantic role, e.g. `order.current`, `selection`, `subject`. */
  readonly semanticRole: string;
  readonly cardinality: PortCardinality;
}

/** Authority, update and lifetime semantics of the communication endpoint. */
export interface PortProtocol {
  readonly mode: PortMode;
  /** Who is allowed to write the cell; a table name, relation id, or `workspace`. */
  readonly authorityDomain: string;
  /** `replace` (the default) or a product-named algebra such as `union`. */
  readonly updateAlgebra: "replace" | (string & {});
  readonly lifetime: PortLifetime;
}

/** Normalized contract = value contract x endpoint protocol. */
export interface PortContract extends ValueContract, PortProtocol {}

/** What an application writes: only `valueType` is required. */
export interface PortContractInput {
  readonly valueType: RuntimeTypeId;
  readonly semanticRole?: string;
  readonly cardinality?: PortCardinality;
  readonly mode?: PortMode;
  readonly authorityDomain?: string;
  readonly updateAlgebra?: PortContract["updateAlgebra"];
  readonly lifetime?: PortLifetime;
}

export interface PortDeclarationInput {
  /** Unique within the application; an identifier without `/`. */
  readonly name: string;
  readonly direction: PortDirection;
  /** The full contract, or just the value type id as shorthand. */
  readonly contract: PortContractInput | RuntimeTypeId;
  /** One line, shown in the badge menu, the connect-mode rail, and `describeWorkbench`. */
  readonly doc: string;
  /** Ambient fallback for an unbound INPUT: a context key. Absent ⇒ `Unresolved("unbound")`. */
  readonly fallbackContext?: string;
  /**
   * The context an OUTPUT drives by default, so an unlinked detail has
   * something ambient to read: the orders table's `order` port drives
   * `workspace.order`, and every detail declaring that fallback follows it.
   * Symmetric with `fallbackContext`; a declaration, never a global.
   */
  readonly drivesContext?: string;
  readonly fanIn?: FanInPolicy;
  readonly onSourceClose?: SourceClosePolicy;
  /**
   * Set when this port IS a document slot: its constant is read from
   * `view.documents[name]`, never from the link document (design D2). The
   * application is then "doc-bound" in the workbench's sense.
   */
  readonly documentSlot?: boolean;
  /**
   * Refine the contract per VIEW (open question Q7): a plot tile's selection
   * has the authority of whichever table the view is bound to, which only the
   * view knows. Returns the fields that differ; the rest stay as declared.
   * Must be pure and cheap; it runs whenever the snapshot is rebuilt.
   */
  readonly refineContract?: (view: { readonly documents: Readonly<Record<string, string>> }) => Partial<PortContractInput>;
}

/** A declaration after `definePort`: every optional policy filled in, the contract normalized. */
export interface PortDeclaration {
  readonly name: string;
  readonly direction: PortDirection;
  readonly contract: PortContract;
  readonly doc: string;
  readonly fallbackContext?: string;
  readonly drivesContext?: string;
  readonly fanIn: FanInPolicy;
  readonly onSourceClose: SourceClosePolicy;
  readonly documentSlot: boolean;
  readonly refineContract?: (view: { readonly documents: Readonly<Record<string, string>> }) => Partial<PortContractInput>;
}

/** The declaration as it applies to ONE view: `refineContract` folded into the contract. */
export function refineDeclaration(declaration: PortDeclaration, view: { readonly documents: Readonly<Record<string, string>> }): PortDeclaration {
  if (!declaration.refineContract) return declaration;
  const patch = declaration.refineContract(view);
  if (!patch || Object.keys(patch).length === 0) return declaration;
  return { ...declaration, contract: normalizeContract({ ...declaration.contract, ...patch }, declaration.direction) };
}

/**
 * The address of one port of one VIEW: `${viewId}/${name}`. View, not
 * placement: two placements of one view share bindings by construction, so
 * the port must too.
 */
export type PortId = string;

/** The conventional value type of a document-slot port. Products need not declare it in their graph. */
export const DOCUMENT_VALUE_TYPE: RuntimeTypeId = "document";

const NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export function portId(viewId: string, name: string): PortId {
  return `${viewId}/${name}`;
}

/** Split a `PortId` at its FIRST `/`: view ids never contain one, port names may not. */
export function parsePortId(id: PortId): { viewId: string; name: string } | null {
  const slash = id.indexOf("/");
  if (slash <= 0 || slash === id.length - 1) return null;
  return { viewId: id.slice(0, slash), name: id.slice(slash + 1) };
}

/**
 * Fill the defaults so readers never branch on `undefined`. The mode default
 * follows the direction: an input reads, an output writes, an inout does both.
 */
export function normalizeContract(input: PortContractInput | RuntimeTypeId, direction: PortDirection): PortContract {
  const spec: PortContractInput = typeof input === "string" ? { valueType: input } : input;
  if (!spec.valueType) throw new Error("pbui/links: a port contract needs a valueType");
  return {
    valueType: spec.valueType,
    semanticRole: spec.semanticRole ?? spec.valueType,
    cardinality: spec.cardinality ?? "one",
    mode: spec.mode ?? (direction === "in" ? "read" : direction === "out" ? "write" : "read-write"),
    authorityDomain: spec.authorityDomain ?? "workspace",
    updateAlgebra: spec.updateAlgebra ?? "replace",
    lifetime: spec.lifetime ?? "workspace",
  };
}

/** Fields relevant to value compatibility. */
export const VALUE_CONTRACT_FIELDS: readonly (keyof ValueContract)[] = [
  "valueType",
  "semanticRole",
  "cardinality",
];

/** Fields relevant to endpoint protocol compatibility. */
export const PORT_PROTOCOL_FIELDS: readonly (keyof PortProtocol)[] = [
  "mode",
  "authorityDomain",
  "updateAlgebra",
  "lifetime",
];

/** The identity fields in the fixed order P06 hashes them. */
export const CONTRACT_IDENTITY_FIELDS: readonly (keyof PortContract)[] = [
  ...VALUE_CONTRACT_FIELDS,
  ...PORT_PROTOCOL_FIELDS,
];

export function valueContractOf(contract: PortContract): ValueContract {
  return {
    valueType: contract.valueType,
    semanticRole: contract.semanticRole,
    cardinality: contract.cardinality,
  };
}

export function portProtocolOf(contract: PortContract): PortProtocol {
  return {
    mode: contract.mode,
    authorityDomain: contract.authorityDomain,
    updateAlgebra: contract.updateAlgebra,
    lifetime: contract.lifetime,
  };
}

/** A stable string two contracts share exactly when they are identity-compatible. */
export function contractFingerprint(contract: PortContract): string {
  return CONTRACT_IDENTITY_FIELDS.map((field) => `${field}=${String(contract[field])}`).join("|");
}

export interface ContractMismatch {
  readonly field: keyof PortContract;
  readonly left: string;
  readonly right: string;
}

/**
 * Field-by-field comparison, returning the LIST of disagreements rather than
 * a boolean — the menu that refuses an identity link has to say which field
 * ("different authority domain: orders vs daily_sales"), as P06's
 * `checkIdentityCompatibility` does.
 */
export function contractMismatches(left: PortContract, right: PortContract): ContractMismatch[] {
  const out: ContractMismatch[] = [];
  for (const field of CONTRACT_IDENTITY_FIELDS) {
    if (left[field] !== right[field]) out.push({ field, left: String(left[field]), right: String(right[field]) });
  }
  return out;
}

export function definePort(input: PortDeclarationInput): PortDeclaration {
  if (!NAME.test(input.name)) {
    throw new Error(`pbui/links: port name "${input.name}" must be an identifier (no "/" or spaces)`);
  }
  if (!input.doc) throw new Error(`pbui/links: port "${input.name}" needs a one-line doc`);
  return {
    name: input.name,
    direction: input.direction,
    contract: normalizeContract(input.contract, input.direction),
    doc: input.doc,
    ...(input.fallbackContext ? { fallbackContext: input.fallbackContext } : {}),
    ...(input.drivesContext ? { drivesContext: input.drivesContext } : {}),
    fanIn: input.fanIn ?? "single-producer",
    onSourceClose: input.onSourceClose ?? "freeze",
    documentSlot: input.documentSlot ?? false,
    ...(input.refineContract ? { refineContract: input.refineContract } : {}),
  };
}

/** Normalize a whole declaration list; fails fast on a duplicate name. */
export function definePorts(inputs: readonly PortDeclarationInput[]): PortDeclaration[] {
  const seen = new Set<string>();
  return inputs.map((input) => {
    if (seen.has(input.name)) throw new Error(`pbui/links: port "${input.name}" is declared twice`);
    seen.add(input.name);
    return definePort(input);
  });
}

/**
 * The declaration a doc-bound application writes for the slot it reads —
 * what `bindings: ["plot"]` plus `docBound: true` used to say in two fields.
 */
export function documentSlotPort(name: string, doc = `the ${name} document this tile is a view of`): PortDeclarationInput {
  return {
    name,
    direction: "in",
    contract: { valueType: DOCUMENT_VALUE_TYPE, semanticRole: `document.${name}`, lifetime: "persistent" },
    doc,
    documentSlot: true,
  };
}

/** The document-slot names of a declaration list — the old `bindings`. */
export function documentSlotsOf(ports: readonly PortDeclaration[] | undefined): string[] {
  return (ports ?? []).filter((port) => port.documentSlot).map((port) => port.name);
}

/** Does the list declare at least one document slot — the old `docBound`? */
export function hasDocumentSlot(ports: readonly PortDeclaration[] | undefined): boolean {
  return (ports ?? []).some((port) => port.documentSlot);
}
