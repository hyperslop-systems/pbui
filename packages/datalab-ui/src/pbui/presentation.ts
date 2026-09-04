import { definePresentation } from "@hyperslop-systems/pbui/presentation";
import type {
  ActionQuery,
  PresentationReference,
  SelectionSnapshot,
} from "@hyperslop-systems/pbui/presentation";
import {
  datalabContributions,
  datalabContextFor,
  datalabRevision,
  datalabTypeDefinitions,
} from "./actions";
import type { DatalabFacts } from "./actions";
import { createDatalabHelpContributions } from "./help";
import { datadropDescriptors } from "./registry";
import type { CatRef, FieldRef, PbuiEnvironment, PresentationValues } from "./types";
import type { Verb } from "./verbs";

/**
 * Datalab's ONE compiled presentation (PBUI-KERNEL-1 C17: the mechanical
 * migration of the frozen package). Types, descriptors, action rules, the
 * `cat → field` relation and the help rules are one declaration; the graph,
 * the predicate table and the descriptor registry exist once.
 */

const p = definePresentation<PresentationValues, PbuiEnvironment, DatalabFacts, Verb>();

/**
 * A categorical value may stand in for its field during accept mode.
 * Exported as the pure mapping the relation and the tests share.
 */
export function catToField(
  reference: PresentationReference<PresentationValues>,
): PresentationReference<PresentationValues> | undefined {
  if (reference.type !== "cat") return undefined;
  const cat = reference.value as CatRef;
  if (!cat.field) return undefined;
  return {
    type: "field",
    value: { docId: cat.docId, name: cat.field } satisfies FieldRef,
  };
}

export const datalabPresentation = p.create({
  id: "datalab.presentation",
  types: datalabTypeDefinitions,
  knownScopes: ["datalab", "global"],
  defaultActiveScopes: ["datalab", "global"],
  revision: datalabRevision,
  descriptors: datadropDescriptors,
  actions: datalabContributions(),
  relations: [
    p.relation({
      id: "datalab.cat-to-field",
      from: "cat",
      to: "field",
      match: "exact",
      exposure: { acceptance: true },
      apply: (reference) => catToField(reference),
    }),
  ],
  // The actions item of the field help card shows the REAL action
  // resolution; the rule reads it through the compiled presentation, which
  // exists by the time any help resolves.
  help: createDatalabHelpContributions((query, snapshot) =>
    datalabPresentation.actions.resolve(query, snapshot),
  ),
  version: "datalab-1",
});

/** The action registry and help registry, for tests that resolve directly. */
export const datadropActionRegistry = datalabPresentation.actions;
export const datalabHelpRegistry = datalabPresentation.help as NonNullable<
  typeof datalabPresentation.help
>;
export const datadropRegistry = datalabPresentation.descriptors;

/** One snapshot for one query: the product's context projection through the model. */
export function snapshotForDatalab(
  query: ActionQuery<PresentationValues>,
  environment: PbuiEnvironment,
): SelectionSnapshot<DatalabFacts> {
  return datalabPresentation.snapshot(datalabContextFor(query, environment));
}
