import { describe, expect, it } from "vitest";
import { compileIdentity, compileIdentityQuotient, type IdentityClass, type IdentityDeclaration, type IdentityQuotient } from "./identity";
import type { PortDefinition } from "./snapshot";
import { definePort, portId, type PortDeclarationInput, type PortId } from "./types";

/*
 * Identity properties (KERNEL-1 guide §19.7; PBUI-KERNEL-3 P1). The quotient
 * Ports / ~ must be a function of the SET of admitted edges, not of the
 * order in which they were declared, the order of the port map, or how many
 * times an edge was written. Each property is checked against a naive
 * reference partition over many seeded random edge sets, so the union-find,
 * the fiber split and the canonical ordering are held to the definition
 * rather than to a handful of hand-written cases.
 */

const declare = (viewId: string, input: PortDeclarationInput): PortDefinition => ({
  id: portId(viewId, input.name),
  viewId,
  appId: "app",
  declaration: definePort(input),
  tileTitle: viewId,
});

const selection = (authorityDomain: string): PortDeclarationInput => ({
  name: "selection",
  direction: "inout",
  contract: { valueType: "datum", semanticRole: "selection", cardinality: "many", authorityDomain },
  doc: "the selection",
});

/** Eight ports in one fiber, four in another, one output-only, one with a different role. */
const FIBER_A = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"].map((v) => declare(v, selection("orders")));
const FIBER_B = ["b1", "b2", "b3", "b4"].map((v) => declare(v, selection("daily_sales")));
const OUTPUT_ONLY = declare("o1", { ...selection("orders"), direction: "out" });
const OTHER_ROLE = declare("r1", { ...selection("orders"), contract: { valueType: "datum", semanticRole: "brush", cardinality: "many", authorityDomain: "orders" } });
const ALL = [...FIBER_A, ...FIBER_B, OUTPUT_ONLY, OTHER_ROLE];
const PORT_MAP = new Map(ALL.map((p) => [p.id, p] as const));

/** mulberry32: a small seeded generator so a failing case is reproducible from its seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const edge = (linkId: string, left: PortId, right: PortId): IdentityDeclaration => ({ linkId, left, right, mergePolicy: "prefer-left" });

/** A random edge set over ALL ports, including edges the compiler must reject. */
function randomEdges(random: () => number, count: number): IdentityDeclaration[] {
  const ids = ALL.map((p) => p.id);
  const out: IdentityDeclaration[] = [];
  for (let i = 0; i < count; i += 1) {
    const l = ids[Math.floor(random() * ids.length)]!;
    const r = ids[Math.floor(random() * ids.length)]!;
    if (l === r) continue;
    out.push(edge(`E${i}`, l, r));
  }
  return out;
}

/** The definition: reflexive–symmetric–transitive closure of the COMPATIBLE edges, as sorted member lists, dropping singletons. */
function referencePartition(edges: readonly IdentityDeclaration[], ports: ReadonlyMap<PortId, PortDefinition>): string[][] {
  const admitted = edges.filter((e) => {
    const L = ports.get(e.left);
    const R = ports.get(e.right);
    if (!L || !R) return false;
    if (L.declaration.direction === "out" || R.declaration.direction === "out") return false;
    const c = (p: PortDefinition) => JSON.stringify(p.declaration.contract);
    return c(L) === c(R);
  });
  const adjacency = new Map<PortId, Set<PortId>>();
  for (const e of admitted) {
    (adjacency.get(e.left) ?? adjacency.set(e.left, new Set()).get(e.left)!).add(e.right);
    (adjacency.get(e.right) ?? adjacency.set(e.right, new Set()).get(e.right)!).add(e.left);
  }
  const seen = new Set<PortId>();
  const cells: string[][] = [];
  for (const start of [...adjacency.keys()].sort()) {
    if (seen.has(start)) continue;
    const members: PortId[] = [];
    const stack = [start];
    while (stack.length) {
      const p = stack.pop()!;
      if (seen.has(p)) continue;
      seen.add(p);
      members.push(p);
      for (const q of adjacency.get(p) ?? []) if (!seen.has(q)) stack.push(q);
    }
    if (members.length > 1) cells.push(members.sort());
  }
  return cells.sort((a, b) => a[0]!.localeCompare(b[0]!));
}

/** Cells as a set: the compiler orders cells by fingerprint, the reference by first member; the PARTITION is what must agree. */
const cellsOf = (q: IdentityQuotient) => q.cells.map((c) => [...c.members]).sort((a, b) => a[0]!.localeCompare(b[0]!));
const byPort = (q: IdentityQuotient) => [...q.cellByPort.entries()].sort(([a], [b]) => a.localeCompare(b));

const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i * 7919);

describe("§19.7 the quotient is the closure of the admitted edges", () => {
  for (const seed of SEEDS) {
    it(`matches the reference partition (seed ${seed})`, () => {
      const random = rng(seed);
      const edges = randomEdges(random, 3 + Math.floor(random() * 14));
      expect(cellsOf(compileIdentityQuotient(edges, PORT_MAP))).toEqual(referencePartition(edges, PORT_MAP));
    });
  }
});

describe("§19.7 union(a,b) == union(b,a)", () => {
  for (const seed of SEEDS.slice(0, 20)) {
    it(`flipping every edge leaves the cells and the port map unchanged (seed ${seed})`, () => {
      const edges = randomEdges(rng(seed), 10);
      const flipped = edges.map((e) => edge(e.linkId, e.right, e.left));
      const a = compileIdentityQuotient(edges, PORT_MAP);
      const b = compileIdentityQuotient(flipped, PORT_MAP);
      expect(cellsOf(b)).toEqual(cellsOf(a));
      expect(byPort(b)).toEqual(byPort(a));
    });
  }
});

describe("§19.7 duplicate edges are idempotent", () => {
  for (const seed of SEEDS.slice(0, 20)) {
    it(`writing every edge twice, under new link ids, changes nothing (seed ${seed})`, () => {
      const edges = randomEdges(rng(seed), 10);
      const doubled = [...edges, ...edges.map((e) => edge(`${e.linkId}-again`, e.left, e.right))];
      expect(cellsOf(compileIdentityQuotient(doubled, PORT_MAP))).toEqual(cellsOf(compileIdentityQuotient(edges, PORT_MAP)));
    });
  }
});

describe("§19.7 edge permutations preserve cells", () => {
  for (const seed of SEEDS.slice(0, 20)) {
    it(`any order of edges and of the port map yields the same cells, ids and lineage (seed ${seed})`, () => {
      const random = rng(seed);
      const edges = randomEdges(random, 12);
      const reference = compileIdentityQuotient(edges, PORT_MAP);
      for (let round = 0; round < 5; round += 1) {
        const permuted = compileIdentityQuotient(shuffled(edges, random), new Map(shuffled([...PORT_MAP], random)));
        expect(permuted.cells).toEqual(reference.cells);
        expect(byPort(permuted)).toEqual(byPort(reference));
        expect([...permuted.lineage]).toEqual([...reference.lineage]);
      }
    });
  }
});

describe("§19.7 incompatible declarations never enter the quotient", () => {
  it("cross-fiber, output-only, other-role and missing-port edges are diagnosed and leave no trace in the cells", () => {
    const edges = [
      edge("ok1", "a1/selection", "a2/selection"),
      edge("x-fiber", "a2/selection", "b1/selection"),
      edge("x-out", "a3/selection", "o1/selection"),
      edge("x-role", "a4/selection", "r1/selection"),
      edge("x-gone", "a5/selection", "zz/selection"),
      edge("ok2", "b1/selection", "b2/selection"),
    ];
    const q = compileIdentityQuotient(edges, PORT_MAP);
    expect(cellsOf(q)).toEqual([
      ["a1/selection", "a2/selection"],
      ["b1/selection", "b2/selection"],
    ]);
    expect(q.diagnostics.map((d) => `${d.linkId}:${d.code}`)).toEqual(["x-fiber:incompatible", "x-out:direction", "x-role:incompatible", "x-gone:port-missing"]);
    for (const p of ["b1/selection", "o1/selection", "r1/selection", "a3/selection", "a4/selection", "a5/selection"]) {
      expect(q.cellByPort.get(p) === undefined || q.cellByPort.get(p) === q.cellByPort.get("b2/selection")).toBe(true);
    }
    expect(q.cellByPort.has("a3/selection")).toBe(false);
    expect(q.cellByPort.has("o1/selection")).toBe(false);
  });

  for (const seed of SEEDS.slice(0, 10)) {
    it(`no cell ever mixes fingerprints (seed ${seed})`, () => {
      const q = compileIdentityQuotient(randomEdges(rng(seed), 20), PORT_MAP);
      for (const cell of q.cells) {
        const fingerprints = new Set(cell.members.map((m) => JSON.stringify(PORT_MAP.get(m)!.declaration.contract)));
        expect(fingerprints.size).toBe(1);
        expect(cell.members.every((m) => PORT_MAP.get(m)!.declaration.direction !== "out")).toBe(true);
      }
    });
  }
});

describe("§19.7 unchanged components retain class ids", () => {
  for (const seed of SEEDS.slice(0, 20)) {
    it(`adding edges elsewhere never renumbers an untouched cell (seed ${seed})`, () => {
      const random = rng(seed);
      const base = compileIdentity([edge("A", "a1/selection", "a2/selection"), edge("B", "b1/selection", "b2/selection")], PORT_MAP);
      const extra = randomEdges(random, 8).filter((e) => !["a1/selection", "a2/selection"].includes(e.left) && !["a1/selection", "a2/selection"].includes(e.right));
      const next = compileIdentity([edge("A", "a1/selection", "a2/selection"), ...extra], PORT_MAP, base.classes);
      const untouched = next.classes.find((c) => c.members.includes("a1/selection"));
      expect(untouched?.id).toBe(base.aliases.get("a1/selection"));
      expect(next.lineage.get(untouched!.id)).toBe("unchanged");
    });
  }
});

describe("§19.7 lineage is deterministic across merge/split/expand/contract fixtures", () => {
  const A12 = edge("A12", "a1/selection", "a2/selection");
  const A34 = edge("A34", "a3/selection", "a4/selection");
  const A23 = edge("A23", "a2/selection", "a3/selection");
  const A15 = edge("A15", "a1/selection", "a5/selection");

  const fixtures: Array<{ name: string; before: IdentityDeclaration[]; after: IdentityDeclaration[]; expect: Record<string, string> }> = [
    { name: "expand", before: [A12], after: [A12, A15], expect: { σ1: "expanded" } },
    { name: "contract", before: [A12, A15], after: [A12], expect: { σ1: "contracted" } },
    { name: "merge", before: [A12, A34], after: [A12, A34, A23], expect: { σ1: "merged" } },
    { name: "split", before: [A12, A34, A23], after: [A12, A34], expect: { σ1: "contracted", σ2: "split" } },
    { name: "new beside unchanged", before: [A12], after: [A12, A34], expect: { σ1: "unchanged", σ2: "new" } },
  ];

  for (const fixture of fixtures) {
    it(`${fixture.name}: the same lineage from any declaration order`, () => {
      const previous: IdentityClass[] = [...compileIdentity(fixture.before, PORT_MAP).classes];
      const reference = compileIdentity(fixture.after, PORT_MAP, previous);
      expect(Object.fromEntries(reference.lineage)).toEqual(fixture.expect);
      const random = rng(7);
      for (let round = 0; round < 6; round += 1) {
        const permuted = compileIdentity(shuffled(fixture.after, random), new Map(shuffled([...PORT_MAP], random)), shuffled(previous, random));
        expect(permuted.classes).toEqual(reference.classes);
        expect([...permuted.lineage].sort()).toEqual([...reference.lineage].sort());
      }
    });
  }
});
