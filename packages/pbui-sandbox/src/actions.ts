import type { PresentationAction, PresentationReference, PresentationRegistry, PresentationValues } from "@hyperslop-systems/pbui";
import type { UIReference, VerbLike } from "./contracts";
import type { ActionRecord } from "./library";

/**
 * Generated actions reach a menu through a registry WRAPPER, not through a
 * mutable descriptor: `createPresentationRegistry` takes a closed map, and
 * `ObjectMenu` asks `actionsFor` when it opens, so a wrapper that appends the
 * library's actions for the reference's type makes a newly defined action
 * appear in the next menu with no re-registration (guide D6).
 */

/** Replace the placeholders a stored verb carries: "$ref" → the reference, "$ref.id" → its id, "$ref.type" → its type. */
export function substituteRef(value: unknown, reference: UIReference): unknown {
  if (value === "$ref") return reference;
  if (value === "$ref.id") return reference.id;
  if (value === "$ref.type") return reference.type;
  if (Array.isArray(value)) return value.map((item) => substituteRef(item, reference));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) out[key] = substituteRef(inner, reference);
    return out;
  }
  return value;
}

export function substituteVerbRef(verb: VerbLike, reference: UIReference): VerbLike {
  return substituteRef(verb, reference) as VerbLike;
}

export interface GeneratedActionsOptions<Values extends PresentationValues, Verb> {
  getActions(): readonly ActionRecord[];
  /** Build the product's `action.run` verb for one action on one reference. */
  toVerb(action: ActionRecord, reference: PresentationReference<Values>): Verb;
  /** Lets an `openProgram` action disable itself when its program is gone. */
  programExists?(programId: string): boolean;
  /** The menu group generated actions sit in; default "generated". */
  group?: string;
}

export function withGeneratedActions<Values extends PresentationValues, Environment, Verb>(
  base: PresentationRegistry<Values, Environment, Verb>,
  options: GeneratedActionsOptions<Values, Verb>,
): PresentationRegistry<Values, Environment, Verb> {
  const group = options.group ?? "generated";
  return {
    ...base,
    actionsFor(reference, environment) {
      const own = base.actionsFor(reference, environment);
      const generated: PresentationAction<Verb>[] = options
        .getActions()
        .filter((action) => action.types.includes(reference.type))
        .map((action) => {
          const missing =
            action.behaviour.kind === "openProgram" && options.programExists && !options.programExists(action.behaviour.programId)
              ? `program ${action.behaviour.programId} is no longer in the library`
              : undefined;
          return {
            id: `generated:${action.id}`,
            label: action.label,
            group,
            verb: options.toVerb(action, reference),
            description: action.description ?? `added by the ${action.by}`,
            ...(action.danger ? { danger: true } : {}),
            ...(missing ? { disabledBecause: missing } : {}),
          };
        });
      return generated.length === 0 ? own : [...own, ...generated];
    },
  };
}
