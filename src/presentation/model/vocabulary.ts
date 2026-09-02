import type { ActionRegistry } from "../actions/registry";
import type { HelpContribution } from "../help/types";
import type { RelationSystem } from "../relations/system";
import type { PresentationValues } from "../types";
import type { PresentationVocabulary, VocabularyFragmentEntry } from "./types";

/**
 * The static vocabulary projection (PBUI-KERNEL-1 §15.1): the action
 * vocabulary (types + actions), relation definitions, help rule declarations,
 * and fragment summaries, each entry tagged with the fragment that declared
 * it. Serializable; snapshot-free; suitable for a golden JSON test.
 *
 * Help entries list DECLARATIONS. Emitted help kinds are dynamic
 * (`help(context)` decides them), so no `kinds` field is claimed here (§11.2).
 */
export function vocabularyOfModel<Values extends PresentationValues, ProductFacts, Verb>(input: {
  readonly version: string | number;
  readonly actions: ActionRegistry<Values, ProductFacts, Verb>;
  readonly relations: RelationSystem<Values, ProductFacts>;
  readonly help: readonly HelpContribution<Values, ProductFacts>[];
  readonly fragments: readonly string[];
  readonly originOf: (
    kind: "type" | "action" | "relation" | "help" | "predicate",
    id: string,
  ) => string | null;
}): PresentationVocabulary {
  const origin = (kind: "type" | "action" | "relation" | "help", id: string) =>
    input.originOf(kind, id) ?? "";
  const base = input.actions.vocabulary();
  const types = base.types.map((entry) => ({ ...entry, fragment: origin("type", entry.type) }));
  const actions = base.actions.map((entry) => ({ ...entry, fragment: origin("action", entry.id) }));
  const relations = input.relations
    .definitions()
    .map((entry) => ({ ...entry, fragment: origin("relation", entry.id) }));
  const help = input.help.map((rule) => ({
    id: rule.id,
    subject: { kind: "type" as const, type: rule.subject, match: rule.match },
    scopes: [...rule.scopes],
    priority: rule.priority ?? 0,
    fragment: origin("help", rule.id),
  }));
  const fragments: VocabularyFragmentEntry[] = input.fragments.map((id) => ({
    id,
    types: types.filter((entry) => entry.fragment === id).length,
    actions: actions.filter((entry) => entry.fragment === id).length,
    relations: relations.filter((entry) => entry.fragment === id).length,
    help: help.filter((entry) => entry.fragment === id).length,
  }));
  return { version: input.version, types, actions, relations, help, fragments };
}
