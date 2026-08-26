import type { RuntimeTypeId } from "./ids";

/**
 * The nominal runtime type graph (PBUI-ACTIONS-2, source guide §8).
 *
 * The graph answers exactly two questions — reachability and shortest-path
 * distance — and nothing else. Runtime subtyping and TypeScript payload
 * assignability are DIFFERENT facts: a rule declared for abstract `document`
 * may receive an `image-file` reference whose payload is
 * `Values["image-file"]`, and the graph never converts payloads. The
 * exact/inherited rule factories make that visible in their contexts.
 *
 * Validation is fail-fast: duplicate ids, unknown parents, and cycles throw
 * at construction. Every resolver guarantee assumes a valid graph — the
 * research lab collected graph problems and continued; production must not.
 */

export interface PresentationTypeDefinition {
  id: RuntimeTypeId;
  parents?: readonly RuntimeTypeId[];
  abstract?: boolean;
}

export interface AncestorEntry {
  type: RuntimeTypeId;
  distance: number;
}

export interface PresentationTypeGraph {
  has(type: RuntimeTypeId): boolean;
  isAbstract(type: RuntimeTypeId): boolean;
  /** Reflexive: every declared type is a subtype of itself. */
  isSubtype(type: RuntimeTypeId, supertype: RuntimeTypeId): boolean;
  /**
   * Shortest ancestor distance (0 = itself), or `Infinity` when unrelated or
   * either id is undeclared. Callers compare distances; they never do
   * arithmetic on `Infinity`.
   */
  distance(type: RuntimeTypeId, supertype: RuntimeTypeId): number;
  /**
   * Self plus every ancestor with its shortest distance, in deterministic
   * breadth-first order (parents in declaration order). An undeclared type
   * yields just itself at distance 0 — an isolated node, so a product may
   * present types it never declared (the legacy adapter depends on this).
   */
  ancestors(type: RuntimeTypeId): readonly AncestorEntry[];
  /** Declared ids in declaration order, for validation sweeps. */
  types(): readonly RuntimeTypeId[];
}

export function createPresentationTypeGraph(
  definitions: readonly PresentationTypeDefinition[],
): PresentationTypeGraph {
  const byId = new Map<RuntimeTypeId, PresentationTypeDefinition>();
  for (const definition of definitions) {
    if (byId.has(definition.id)) {
      throw new Error(`duplicate runtime type id "${definition.id}" in the type graph`);
    }
    byId.set(definition.id, definition);
  }
  for (const definition of definitions) {
    for (const parent of definition.parents ?? []) {
      if (!byId.has(parent)) {
        throw new Error(
          `runtime type "${definition.id}" names unknown parent "${parent}" — ` +
            `declare the parent before its children can inherit actions through it`,
        );
      }
    }
  }

  // Cycle detection via iterative DFS coloring, before any BFS caches build.
  const state = new Map<RuntimeTypeId, "visiting" | "done">();
  function visit(id: RuntimeTypeId, path: RuntimeTypeId[]): void {
    const seen = state.get(id);
    if (seen === "done") return;
    if (seen === "visiting") {
      throw new Error(
        `the type graph has a cycle: ${[...path, id].join(" → ")} — ` +
          `an action-inheritance hierarchy must be acyclic`,
      );
    }
    state.set(id, "visiting");
    for (const parent of byId.get(id)?.parents ?? []) visit(parent, [...path, id]);
    state.set(id, "done");
  }
  for (const definition of definitions) visit(definition.id, []);

  /** BFS ancestor lists with shortest distances, cached per type. */
  const ancestorCache = new Map<RuntimeTypeId, readonly AncestorEntry[]>();
  function ancestorsOf(type: RuntimeTypeId): readonly AncestorEntry[] {
    const cached = ancestorCache.get(type);
    if (cached) return cached;
    if (!byId.has(type)) {
      const isolated: readonly AncestorEntry[] = [{ type, distance: 0 }];
      ancestorCache.set(type, isolated);
      return isolated;
    }
    const order: AncestorEntry[] = [];
    const best = new Map<RuntimeTypeId, number>([[type, 0]]);
    const queue: RuntimeTypeId[] = [type];
    while (queue.length > 0) {
      const current = queue.shift() as RuntimeTypeId;
      const distance = best.get(current) as number;
      order.push({ type: current, distance });
      for (const parent of byId.get(current)?.parents ?? []) {
        if (!best.has(parent)) {
          best.set(parent, distance + 1);
          queue.push(parent);
        }
      }
    }
    ancestorCache.set(type, order);
    return order;
  }

  return {
    has: (type) => byId.has(type),
    isAbstract: (type) => byId.get(type)?.abstract === true,
    isSubtype(type, supertype) {
      return ancestorsOf(type).some((entry) => entry.type === supertype);
    },
    distance(type, supertype) {
      const entry = ancestorsOf(type).find((candidate) => candidate.type === supertype);
      return entry ? entry.distance : Number.POSITIVE_INFINITY;
    },
    ancestors: ancestorsOf,
    types: () => [...byId.keys()],
  };
}
