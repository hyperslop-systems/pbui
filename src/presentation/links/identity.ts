import type { LinkSnapshot, PortDefinition } from "./snapshot";
import { contractFingerprint, contractMismatches, type ContractMismatch, type PortId } from "./types";

/*
 * Identity classes over value ports (PBUI-LINK-1 Phase 5; design D8), the
 * subset of the P06 identity compiler pbui needs:
 *
 * - two ports may be IDENTIFIED only when their normalized contracts agree
 *   on every field (`contractMismatches` lists the disagreements — the menu
 *   says "different authority domain: orders vs daily_sales", never just no);
 * - identity links are partitioned by contract FIBER (fingerprint) and
 *   unioned within a fiber; a class is the connected component, sorted;
 * - class ids are PERSISTENT: a recompile after a change keeps the id of the
 *   previous class that overlaps most, so undo restores exact cells and the
 *   badge does not renumber; lineage says what happened to each class;
 * - a class of one is no class: the port simply reads its own value again.
 *
 * Declarations are retained; classes are compiled from them and persisted
 * beside them so the ids survive a reload. `Alias(c)` is never written as a
 * term — it is the effective binding of a member, derived by the snapshot.
 */

export type MergePolicy = "prefer-left" | "prefer-right" | "require-equal";
export type SplitPolicy = "copy" | "history" | "reset";

export interface IdentityDeclaration {
  readonly linkId: string;
  readonly left: PortId;
  readonly right: PortId;
  readonly mergePolicy: MergePolicy;
}

export interface IdentityClass {
  readonly id: string;
  /** Sorted, unique. */
  readonly members: readonly PortId[];
  readonly fingerprint: string;
}

export type ClassLineage = "new" | "unchanged" | "expanded" | "contracted" | "merged" | "split";

export interface IdentityDiagnostic {
  readonly linkId: string;
  readonly code: "port-missing" | "incompatible" | "direction";
  readonly message: string;
}

export interface CompiledIdentity {
  readonly classes: readonly IdentityClass[];
  /** Port → class id, for every member. */
  readonly aliases: ReadonlyMap<PortId, string>;
  readonly lineage: ReadonlyMap<string, ClassLineage>;
  readonly diagnostics: readonly IdentityDiagnostic[];
}

export type Compatibility = { readonly ok: true; readonly fingerprint: string } | { readonly ok: false; readonly mismatches: readonly ContractMismatch[]; readonly because: string };

const FIELD_WORDS: Record<ContractMismatch["field"], string> = {
  valueType: "value type",
  semanticRole: "semantic role",
  cardinality: "cardinality",
  mode: "mode",
  authorityDomain: "authority domain",
  updateAlgebra: "update algebra",
  lifetime: "lifetime",
};

export function compatibilityOf(a: PortDefinition, b: PortDefinition): Compatibility {
  const mismatches = contractMismatches(a.declaration.contract, b.declaration.contract);
  if (mismatches.length === 0) return { ok: true, fingerprint: contractFingerprint(a.declaration.contract) };
  const because = mismatches.map((m) => `different ${FIELD_WORDS[m.field]}: ${m.left} vs ${m.right}`).join("; ");
  return { ok: false, mismatches, because };
}

export function checkIdentityCompatibility(a: PortId, b: PortId, s: LinkSnapshot): Compatibility {
  const A = s.ports.get(a);
  const B = s.ports.get(b);
  if (!A || !B) return { ok: false, mismatches: [], because: "that port no longer exists" };
  return compatibilityOf(A, B);
}

class UnionFind {
  private readonly parent = new Map<PortId, PortId>();
  private readonly rank = new Map<PortId, number>();
  find(x: PortId): PortId {
    let root = x;
    while (
      this.parent.get(root) !== undefined &&
      this.parent.get(root) !== root
    ) {
      root = this.parent.get(root)!;
    }
    let cursor = x;
    while (
      this.parent.get(cursor) !== undefined &&
      this.parent.get(cursor) !== root
    ) {
      const next = this.parent.get(cursor)!;
      this.parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }
  add(x: PortId): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }
  union(a: PortId, b: PortId): void {
    this.add(a);
    this.add(b);
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;

    const rankA = this.rank.get(ra) ?? 0;
    const rankB = this.rank.get(rb) ?? 0;
    if (rankA < rankB) {
      this.parent.set(ra, rb);
      return;
    }
    if (rankB < rankA) {
      this.parent.set(rb, ra);
      return;
    }

    // Equal-rank ties use lexical order so compilation remains deterministic.
    const root = ra < rb ? ra : rb;
    const child = root === ra ? rb : ra;
    this.parent.set(child, root);
    this.rank.set(root, rankA + 1);
  }
  members(): Map<PortId, PortId[]> {
    const out = new Map<PortId, PortId[]>();
    for (const key of this.parent.keys()) {
      const root = this.find(key);
      const list = out.get(root) ?? [];
      list.push(key);
      out.set(root, list);
    }
    return out;
  }
}

function nextClassId(previous: readonly IdentityClass[], taken: Set<string>): string {
  let n = 0;
  for (const cls of [...previous.map((c) => c.id), ...taken]) {
    const match = /^σ(\d+)$/.exec(cls);
    if (match) n = Math.max(n, Number(match[1]));
  }
  let candidate = `σ${n + 1}`;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `σ${n + 1}`;
  }
  return candidate;
}

/**
 * Compile declarations into classes. `previous` are the persisted classes
 * from the last compile, consulted only for id assignment and lineage.
 */
export function compileIdentity(declarations: readonly IdentityDeclaration[], ports: ReadonlyMap<PortId, PortDefinition>, previous: readonly IdentityClass[] = []): CompiledIdentity {
  const diagnostics: IdentityDiagnostic[] = [];
  const fibers = new Map<string, UnionFind>();
  for (const declaration of declarations) {
    const left = ports.get(declaration.left);
    const right = ports.get(declaration.right);
    if (!left || !right) {
      diagnostics.push({ linkId: declaration.linkId, code: "port-missing", message: `${!left ? declaration.left : declaration.right} is not a declared port` });
      continue;
    }
    if (left.declaration.direction === "out" || right.declaration.direction === "out") {
      diagnostics.push({ linkId: declaration.linkId, code: "direction", message: "an output-only port cannot share a cell; make it inout" });
      continue;
    }
    const compatibility = compatibilityOf(left, right);
    if (!compatibility.ok) {
      diagnostics.push({ linkId: declaration.linkId, code: "incompatible", message: compatibility.because });
      continue;
    }
    const fiber = fibers.get(compatibility.fingerprint) ?? new UnionFind();
    fiber.union(declaration.left, declaration.right);
    fibers.set(compatibility.fingerprint, fiber);
  }

  // Components, canonically ordered: by fingerprint, then by smallest member.
  const components: Array<{ fingerprint: string; members: PortId[] }> = [];
  for (const [fingerprint, fiber] of [...fibers.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const members of fiber.members().values()) {
      if (members.length < 2) continue;
      components.push({ fingerprint, members: [...members].sort() });
    }
  }
  components.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint) || (a.members[0] ?? "").localeCompare(b.members[0] ?? ""));

  // Persistent ids: each component takes the id of the previous class it overlaps most (ties by id), unclaimed.
  const taken = new Set<string>();
  const claimedBy = new Map<string, number>();
  const classes: IdentityClass[] = [];
  const lineage = new Map<string, ClassLineage>();
  const overlapOf = (component: { members: PortId[] }, cls: IdentityClass) => cls.members.filter((m) => component.members.includes(m)).length;
  const assignments: Array<{ component: (typeof components)[number]; id: string; overlaps: number }> = [];
  for (const component of components) {
    const candidates = previous
      .map((cls) => ({ cls, overlap: overlapOf(component, cls) }))
      .filter(({ overlap }) => overlap > 0)
      .sort((a, b) => b.overlap - a.overlap || a.cls.id.localeCompare(b.cls.id));
    const winner = candidates.find(({ cls }) => !taken.has(cls.id));
    const id = winner ? winner.cls.id : nextClassId(previous, taken);
    taken.add(id);
    if (winner) claimedBy.set(winner.cls.id, (claimedBy.get(winner.cls.id) ?? 0) + 1);
    assignments.push({ component, id, overlaps: candidates.length });
  }
  const previousById = new Map(previous.map((cls) => [cls.id, cls]));
  for (const { component, id, overlaps } of assignments) {
    const before = previousById.get(id);
    let what: ClassLineage;
    if (!before) what = overlaps > 0 ? "split" : "new";
    else if (overlaps > 1) what = "merged";
    else if (before.members.length === component.members.length && before.members.every((m, i) => m === component.members[i])) what = "unchanged";
    else if (component.members.every((m) => before.members.includes(m))) what = "contracted";
    else if (before.members.every((m) => component.members.includes(m))) what = "expanded";
    else what = "merged";
    lineage.set(id, what);
    classes.push({ id, members: component.members, fingerprint: component.fingerprint });
  }
  // A previous class whose members now live in several classes: the ones that lost the id are "split".
  for (const [id, count] of claimedBy) {
    if (count <= 1) continue;
    for (const cls of classes) {
      if (cls.id !== id && previousById.get(id)?.members.some((m) => cls.members.includes(m))) lineage.set(cls.id, "split");
    }
  }

  const aliases = new Map<PortId, string>();
  for (const cls of classes) for (const member of cls.members) aliases.set(member, cls.id);
  return { classes, aliases, lineage, diagnostics };
}

/** A logical shared cell is one equivalence class in the quotient Ports / ~. */
export type LogicalCell = IdentityClass;

/** Runtime quotient view: declarations induce cells; directed bindings do not. */
export interface IdentityQuotient {
  readonly cells: readonly LogicalCell[];
  readonly cellByPort: ReadonlyMap<PortId, string>;
  readonly lineage: ReadonlyMap<string, ClassLineage>;
  readonly diagnostics: readonly IdentityDiagnostic[];
}

export function identityQuotientOf(
  compiled: CompiledIdentity,
): IdentityQuotient {
  return {
    cells: compiled.classes,
    cellByPort: compiled.aliases,
    lineage: compiled.lineage,
    diagnostics: compiled.diagnostics,
  };
}

export function compileIdentityQuotient(
  declarations: readonly IdentityDeclaration[],
  ports: ReadonlyMap<PortId, PortDefinition>,
  previous: readonly IdentityClass[] = [],
): IdentityQuotient {
  return identityQuotientOf(compileIdentity(declarations, ports, previous));
}

export function logicalCellOf(
  port: PortId,
  quotient: IdentityQuotient,
): LogicalCell | null {
  const id = quotient.cellByPort.get(port);
  return id ? quotient.cells.find((cell) => cell.id === id) ?? null : null;
}
