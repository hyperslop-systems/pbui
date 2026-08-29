import {
  builtinHelpItems,
  createHelpRendererRegistry,
  defineHelpItem,
  actionsHelp,
  markdownHelp,
} from "@hyperslop-systems/pbui";
import type { HelpRendererProps } from "@hyperslop-systems/pbui";
import { createHelpRegistry, defineHelp } from "@hyperslop-systems/pbui/presentation";
import { TYPE_LABEL } from "../model/table";
import type { FieldType } from "../model/table";
import { datadropActionRegistry } from "./actions";
import type { DatalabFacts } from "./actions";
import type { PresentationValues } from "./types";

/**
 * Datalab's contextual help (PBUI-HELP-001 P6): the product proof that the
 * kernel is not limited to prose. A field explains itself with authored
 * Markdown, a CUSTOM typed summary component over the same query-local facts
 * the action rules read, and an actions item whose rows come from resolving
 * the real action registry — never from re-deriving applicability here.
 */

/* ---------------------------------------------- the custom renderer (§10) -- */

export interface FieldSummaryPayload {
  name: string;
  type: FieldType | null;
  targetName: string;
}

function FieldSummaryHelp({ item }: HelpRendererProps<FieldSummaryPayload>) {
  const { name, type, targetName } = item.payload;
  return (
    <div data-part="help-field-summary">
      <strong>{name}</strong>{" "}
      <span>{type === null ? "not in pipeline output" : TYPE_LABEL[type]}</span>
      <span> → chart {targetName}</span>
    </div>
  );
}

export const fieldSummaryHelp = defineHelpItem<FieldSummaryPayload>(
  "datalab.field-summary",
  FieldSummaryHelp,
);

/* ------------------------------------------------------------------ rules -- */

const define = defineHelp<PresentationValues, DatalabFacts>();

export const datalabHelpContributions = [
  define.exact("field", {
    id: "datalab.field.help",
    scopes: ["datalab"],
    help: ({ subject, snapshot }) => [
      markdownHelp.create({
        id: "field.meaning",
        title: "Field",
        order: 0,
        payload: {
          markdown:
            "A **field** is one named column in the current pipeline output.\n\n" +
            "Drop it on a channel to map it; its menu carries the `keep` filters.",
        },
      }),
      fieldSummaryHelp.create({
        id: "field.summary",
        title: "Current context",
        order: 10,
        payload: {
          name: subject.value.name,
          type: snapshot.product.fieldType,
          targetName: snapshot.product.targetName,
        },
      }),
      // Availability comes from the ACTION kernel, resolved with the same
      // subject and snapshot — displayed, not reconstructed (§9.5).
      actionsHelp.create({
        id: "field.actions",
        title: "Actions",
        order: 20,
        payload: {
          actions: datadropActionRegistry.resolve(
            { subject, invocation: "menu" },
            snapshot,
          ).actions,
        },
      }),
    ],
  }),
];

export const datalabHelpRegistry = createHelpRegistry<PresentationValues, DatalabFacts>({
  graph: datadropActionRegistry.graph,
  scopes: ["datalab", "global"],
  contributions: datalabHelpContributions,
  version: "datalab-help-1",
});

export const datadropHelpRenderers = createHelpRendererRegistry([
  ...builtinHelpItems,
  fieldSummaryHelp,
]);
