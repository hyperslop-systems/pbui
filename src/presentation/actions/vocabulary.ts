import type { PresentationValues } from "../types";
import type { RuntimeTypeId } from "./ids";
import type { PresentationTypeGraph } from "./typeGraph";
import type {
  ActionContribution,
  ActionInvocation,
} from "./types";

/**
 * The agent-facing vocabulary, GENERATED from the type graph and the action
 * contributions (PBUI-ACTIONS-3 B2). Products used to hand-maintain a
 * parallel "what exists" module for their agent seat; that module could
 * drift from the registry, and "menu and agent disagree about what exists"
 * was a representable state. Generating it makes a rule rename BE the
 * vocabulary bump.
 *
 * The vocabulary is the STATIC shape only — every field is
 * JSON-serializable, so a build step can write it to disk and a golden test
 * can pin it. What is deliberately absent:
 *
 * - Verbs: binding needs a live snapshot and a subject value; agents get
 *   verbs by resolving, not from the vocabulary.
 * - Dynamic labels: a label declared as a function is context-dependent by
 *   construction; the entry carries no label rather than a lie.
 * - Family instances: families expand per snapshot. The vocabulary names
 *   the family and its subject; instances exist only at resolution time.
 *
 * Vocabulary is documentation, not authorization: an entry's presence says
 * a rule is declared, not that any principal may perform it.
 */

export interface VocabularyTypeEntry {
  type: RuntimeTypeId;
  abstract: boolean;
  /** Direct parents (declaration order), not the transitive closure. */
  parents: readonly RuntimeTypeId[];
}

export interface VocabularyActionEntry {
  /** The contribution id (rule id or family id). */
  id: string;
  kind: "exact" | "inherited" | "family";
  /** Absent for families: their action ids live on runtime instances. */
  action?: string;
  subject: RuntimeTypeId | "*";
  scopes: readonly string[];
  /** Absent = discoverable by every invocation. */
  invocations?: readonly ActionInvocation[];
  /** Present only when the rule declares a static string label. */
  label?: string;
  description?: string;
  group?: string;
  order?: number;
  danger: boolean;
  primary: boolean;
}

export interface ActionVocabulary {
  version: string | number;
  types: readonly VocabularyTypeEntry[];
  actions: readonly VocabularyActionEntry[];
}

export function vocabularyOf<Values extends PresentationValues, ProductFacts, Verb>(
  graph: PresentationTypeGraph,
  contributions: readonly ActionContribution<Values, ProductFacts, Verb>[],
  version: string | number,
): ActionVocabulary {
  const types = graph.types().map((type): VocabularyTypeEntry => ({
    type,
    abstract: graph.isAbstract(type),
    parents: graph
      .ancestors(type)
      .filter((ancestor) => ancestor.distance === 1)
      .map((ancestor) => ancestor.type),
  }));

  const actions = contributions.map((contribution): VocabularyActionEntry => {
    if (contribution.kind === "family") {
      return {
        id: contribution.id,
        kind: "family",
        subject: contribution.subject,
        scopes: [...contribution.scopes],
        ...(contribution.invocations ? { invocations: [...contribution.invocations] } : {}),
        danger: false,
        primary: false,
      };
    }
    const { metadata } = contribution;
    return {
      id: contribution.id,
      kind: contribution.match === "exact" ? "exact" : "inherited",
      action: contribution.action,
      subject: contribution.subject as RuntimeTypeId,
      scopes: [...contribution.scopes],
      ...(contribution.invocations ? { invocations: [...contribution.invocations] } : {}),
      ...(typeof metadata.label === "string" ? { label: metadata.label } : {}),
      ...(metadata.description !== undefined ? { description: metadata.description } : {}),
      ...(metadata.group !== undefined ? { group: metadata.group } : {}),
      ...(metadata.order !== undefined ? { order: metadata.order } : {}),
      danger: metadata.danger ?? false,
      primary: metadata.primary ?? false,
    };
  });

  return { version, types, actions };
}
