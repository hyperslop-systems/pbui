import type { ProductPredicate } from "../actions/conditions";
import type { PredicateId } from "../actions/ids";
import type { PresentationTypeGraph } from "../actions/typeGraph";
import type { InheritedRuleContext, SelectionSnapshot } from "../actions/types";
import { matchSelector, requireScoped, selectorOf } from "../context/selector";
import type { ScopedSelectorMatch } from "../context/types";
import type { PresentationReference, PresentationValues } from "../types";
import type { Availability } from "../actions/availability";
import type { HelpContribution, HelpItem, HelpResolution, ResolvedHelpItem } from "./types";

/**
 * The pure additive help resolver (design doc §15). One subject, one
 * snapshot, one deterministic result. Every matching rule contributes; type
 * distance, scope nearness, and priority order the items but never suppress
 * one rule with another. Duplicate item ids THROW: help does not run during
 * ordinary render, and a duplicate is an authoring defect, not a state to
 * render around (§7.2).
 */

export interface PreparedHelpRegistry<Values extends PresentationValues, ProductFacts> {
  graph: PresentationTypeGraph;
  contributions: readonly HelpContribution<Values, ProductFacts>[];
  predicates: ReadonlyMap<PredicateId, ProductPredicate<Values, ProductFacts>>;
  version: string | number;
}

export function resolveHelp<Values extends PresentationValues, ProductFacts>(
  prepared: PreparedHelpRegistry<Values, ProductFacts>,
  subject: PresentationReference<Values>,
  snapshot: SelectionSnapshot<ProductFacts>,
): HelpResolution {
  const context: InheritedRuleContext<Values, ProductFacts> = { subject, snapshot };
  const collected: ResolvedHelpItem[] = [];

  for (const rule of prepared.contributions) {
    const result = matchSelector(
      selectorOf(rule),
      subject,
      snapshot,
      prepared.graph,
      prepared.predicates,
    );
    if (result.kind === "rejected") continue;
    // Help rules declare explicit scopes (registry rule), so this never throws.
    const match = requireScoped(result.match, `help rule "${rule.id}"`);

    if (rule.test) {
      // Exact and inherited contexts are the same object at runtime; the
      // factories narrowed the exact rule's view at the type level only.
      const status = (
        rule.test as (ctx: InheritedRuleContext<Values, ProductFacts>) => Availability
      )(context);
      // Only `available` matches: additive help has no override ladder for
      // unavailable/inapplicable/hidden to steer (§7.1).
      if (status.kind !== "available") continue;
    }

    const items = (
      rule.help as (ctx: InheritedRuleContext<Values, ProductFacts>) => readonly HelpItem[]
    )(context);
    for (const item of items) {
      validateItem(rule.id, item);
      collected.push(withProvenance(item, rule.id, match));
    }
  }

  rejectDuplicateIds(collected);

  /*
   * Display order (§7.2): nearest type, nearest scope, highest rule priority,
   * ascending item order, stable item id last. Array.prototype.sort is stable,
   * but the id tiebreaker makes the order independent of registration order
   * by construction rather than by engine guarantee.
   */
  collected.sort((a, b) => {
    if (a.provenance.typeDistance !== b.provenance.typeDistance) {
      return a.provenance.typeDistance - b.provenance.typeDistance;
    }
    if (a.provenance.scopeIndex !== b.provenance.scopeIndex) {
      return a.provenance.scopeIndex - b.provenance.scopeIndex;
    }
    if (a.provenance.priority !== b.provenance.priority) {
      return b.provenance.priority - a.provenance.priority;
    }
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.id.localeCompare(b.id);
  });

  return {
    items: collected,
    diagnostics: [],
    snapshotRevision: snapshot.revision,
    registryVersion: prepared.version,
  };
}

function validateItem(ruleId: string, item: HelpItem): void {
  if (item.id.length === 0) {
    throw new Error(`help rule "${ruleId}" emitted an item with an empty id`);
  }
  if (item.kind.length === 0) {
    throw new Error(`help rule "${ruleId}" emitted item "${item.id}" with an empty kind`);
  }
  if (item.order !== undefined && !Number.isFinite(item.order)) {
    throw new Error(`help rule "${ruleId}" emitted item "${item.id}" with a non-finite order`);
  }
}

function withProvenance(
  item: HelpItem,
  ruleId: string,
  match: ScopedSelectorMatch,
): ResolvedHelpItem {
  return {
    ...item,
    provenance: {
      ruleId,
      // A help rule always names a type (no universal help rules in v1).
      declaredType: match.declaredType ?? match.concreteType,
      concreteType: match.concreteType,
      typeDistance: match.typeDistance,
      scope: match.scope,
      scopeIndex: match.scopeIndex,
      priority: match.priority,
    },
  };
}

function rejectDuplicateIds(items: readonly ResolvedHelpItem[]): void {
  const byId = new Map<string, ResolvedHelpItem>();
  for (const item of items) {
    const first = byId.get(item.id);
    if (first) {
      throw new Error(
        `help item id "${item.id}" was emitted by both rule "${first.provenance.ruleId}" ` +
          `and rule "${item.provenance.ruleId}" — item ids must be unique within one resolution`,
      );
    }
    byId.set(item.id, item);
  }
}
