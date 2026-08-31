import type { Availability } from "../actions/availability";
import type { Condition } from "../actions/conditions";
import type { RuntimeTypeId, ScopeId } from "../actions/ids";
import type {
  ExactRuleContext,
  InheritedRuleContext,
  SelectionSnapshot,
} from "../actions/types";
import type { PresentationReference, PresentationType, PresentationValues } from "../types";

/**
 * The help kernel's contracts (PBUI-HELP-001, design doc §§5, 7, 8).
 *
 * Help is the action kernel's SIBLING: the same typed subject, scope stack,
 * conditions, named predicates, and immutable snapshot decide whether a rule
 * applies — through the shared contextual matcher — but the terminal
 * semantics differ. Actions compete per action id and select one verb; help
 * rules ACCUMULATE: every matching rule contributes items, and type distance,
 * scope nearness, and priority determine display ORDER only, never
 * suppression. Nothing here is a verb, participates in the override ladder,
 * or reaches `onPerform`.
 *
 * Like the action kernel, everything in this directory is data and pure
 * functions over data — no React at runtime, no stores, no effects. The React
 * renderer registry lives in `src/components/ContextHelp/`.
 */

/* ------------------------------------------------------------- identities -- */

/** Names one help declaration by one package (`datalab.field.help`). */
export type HelpRuleId = string;
/** Names one semantic item WITHIN one resolution (`field.summary`). */
export type HelpItemId = string;
/** Selects a renderer (`help.markdown`, `datalab.field-summary`). */
export type HelpKind = string;

/* ------------------------------------------------------------------ items -- */

export interface HelpItem<Payload = unknown> {
  id: HelpItemId;
  kind: HelpKind;
  title?: string;
  /** Display ordering within the resolved list; never a filter. */
  order?: number;
  payload: Payload;
}

/* ------------------------------------------------------------------ rules -- */

export interface ExactHelpRule<
  Values extends PresentationValues,
  Type extends PresentationType<Values>,
  ProductFacts,
> {
  kind: "rule";
  id: HelpRuleId;
  subject: Type;
  match: "exact";
  scopes: readonly ScopeId[];
  when?: Condition;
  /**
   * Opaque escape hatch. For help, ONLY `available` matches: `unavailable`,
   * `inapplicable`, and `hidden` all contribute nothing — additive help has
   * no override ladder for the other states to steer (design doc §7.1).
   */
  test?(context: ExactRuleContext<Values, Type, ProductFacts>): Availability;
  /** Display-ordering tiebreaker after type distance and scope; never a filter. */
  priority?: number;
  help(context: ExactRuleContext<Values, Type, ProductFacts>): readonly HelpItem[];
}

export interface InheritedHelpRule<Values extends PresentationValues, ProductFacts> {
  kind: "rule";
  id: HelpRuleId;
  subject: RuntimeTypeId;
  match: "subtypes";
  scopes: readonly ScopeId[];
  when?: Condition;
  test?(context: InheritedRuleContext<Values, ProductFacts>): Availability;
  priority?: number;
  help(context: InheritedRuleContext<Values, ProductFacts>): readonly HelpItem[];
}

export type HelpContribution<Values extends PresentationValues, ProductFacts> =
  | ExactHelpRule<Values, PresentationType<Values>, ProductFacts>
  | InheritedHelpRule<Values, ProductFacts>;

/* ----------------------------------------------------------------- results -- */

export interface ResolvedHelpItem<Payload = unknown> extends HelpItem<Payload> {
  provenance: {
    ruleId: HelpRuleId;
    declaredType: RuntimeTypeId;
    concreteType: RuntimeTypeId;
    typeDistance: number;
    scope: ScopeId;
    scopeIndex: number;
    priority: number;
  };
}

export interface HelpDiagnostic {
  code: string;
  ruleIds: readonly HelpRuleId[];
  detail: string;
}

export interface HelpResolution {
  items: readonly ResolvedHelpItem[];
  /** Reserved: v1 authoring defects throw instead (duplicate item ids). */
  diagnostics: readonly HelpDiagnostic[];
  snapshotRevision: string | number;
  registryVersion: string | number;
}

/* ------------------------------------------------------------------ query --- */

export interface HelpQuery<Values extends PresentationValues> {
  subject: PresentationReference<Values>;
}

export type { SelectionSnapshot };
