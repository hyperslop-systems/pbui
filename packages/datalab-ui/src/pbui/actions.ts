import {
  available,
  createActionRegistry,
  createPresentationTypeGraph,
  defineActions,
  inapplicable,
  legacyDescriptorFamily,
  unavailable,
} from "@hyperslop-systems/pbui/presentation";
import type {
  ActionContribution,
  ActionQuery,
  LegacyFacts,
  SelectionSnapshot,
} from "@hyperslop-systems/pbui/presentation";
import { CHANNELS, CHANNEL_ACCEPTS } from "../model/graphic";
import { TYPE_LABEL, asText } from "../model/table";
import type { FieldType } from "../model/table";
import { datadropRegistry } from "./registry";
import type { DatumRef, DocId, FieldRef, PbuiEnvironment, StageRef, PresentationValues } from "./types";
import type { Verb } from "./verbs";

/**
 * The Datalab action registry (PBUI-ACTIONS-2 P3).
 *
 * Four presentation types — field, datum, doc, stage — now declare their
 * actions as kernel rules and one bounded family; every other type still
 * routes through the legacy descriptor family until its own migration. The
 * migrated descriptors keep label/describe/tone and have NO `actions()`
 * callback, so the legacy family naturally contributes nothing for them:
 * one engine, no double rows.
 *
 * Rule ids follow the source guide's Appendix B (`datalab.field.map.x`);
 * action ids name the conceptual operation (`chart.mapping.x`). Labels,
 * reasons, and verbs are byte-identical to the pre-migration descriptors —
 * the golden tests are the fence.
 */

/* ---------------------------------------------------------------- facts --- */

/**
 * Query-local immutable facts (source guide §9.4): schema-only derivation, so
 * the cost boundary DR-40 draws — `fieldsFor` on render-adjacent paths,
 * `tableFor` only where rows are genuinely needed — survives the migration.
 * The environment rides along for the legacy family.
 */
export interface DatalabFacts extends LegacyFacts<PbuiEnvironment> {
  activeDocId: DocId | null;
  /** field/datum subjects: the document the verb will land on. */
  targetDocId: DocId | null;
  targetName: string;
  /** field subject only. */
  fieldType: FieldType | null;
  /** datum subject only: row columns that are categorical, uncapped. */
  categoricalFields: readonly string[];
}

export function snapshotForDatalab(
  query: ActionQuery<PresentationValues>,
  environment: PbuiEnvironment,
): SelectionSnapshot<DatalabFacts> {
  let targetDocId: DocId | null = environment.activeDocId;
  let fieldType: FieldType | null = null;
  let categoricalFields: readonly string[] = [];

  if (query.subject.type === "field") {
    const ref = query.subject.value as FieldRef;
    targetDocId = ref.docId ?? environment.activeDocId;
    fieldType =
      environment.fieldsFor(ref.docId).find((field) => field.name === ref.name)?.type ?? null;
  } else if (query.subject.type === "datum") {
    const ref = query.subject.value as DatumRef;
    targetDocId = ref.docId ?? environment.activeDocId;
    const fields = environment.fieldsFor(ref.docId);
    categoricalFields = Object.keys(ref.row).filter((name) => {
      const field = fields.find((candidate) => candidate.name === name);
      return field !== undefined && field.type !== "q";
    });
  }

  const targetName = environment.nameOf(targetDocId);
  return {
    // The revision names exactly the derived facts: it moves iff they move.
    revision: [
      environment.activeDocId ?? "",
      targetDocId ?? "",
      fieldType ?? "",
      categoricalFields.join("|"),
    ].join("::"),
    scopes: ["datalab", "global"],
    modes: new Set(),
    capabilities: new Set(),
    product: {
      environment,
      activeDocId: environment.activeDocId,
      targetDocId,
      targetName,
      fieldType,
      categoricalFields,
    },
  };
}

/* ---------------------------------------------------------------- rules --- */

const define = defineActions<PresentationValues, DatalabFacts, Verb>();

function fieldContributions(): ActionContribution<PresentationValues, DatalabFacts, Verb>[] {
  const mapping = CHANNELS.map((channel, index) =>
    define.exact("field", {
      id: `datalab.field.map.${channel}`,
      action: `chart.mapping.${channel}`,
      scopes: ["datalab"],
      test: ({ snapshot }) => {
        const type = snapshot.product.fieldType;
        if (type !== null && CHANNEL_ACCEPTS[channel].includes(type)) return available();
        // Offered and disabled, never hidden: the greyed row is the lesson.
        return unavailable(
          type === null
            ? "not in the pipeline output"
            : `${channel} accepts ${CHANNEL_ACCEPTS[channel].map((t) => TYPE_LABEL[t]).join(", ")}`,
        );
      },
      metadata: {
        label: ({ snapshot }) => `Map to ${channel}  (chart ${snapshot.product.targetName})`,
        order: index,
      },
      bind: ({ subject, snapshot }) => ({
        kind: "setMapping",
        docId: snapshot.product.targetDocId,
        channel,
        field: subject.value.name,
      }),
    }),
  );

  return [
    ...mapping,
    define.exact("field", {
      id: "datalab.field.filter",
      action: "field.filter",
      scopes: ["datalab"],
      metadata: { label: "Filter on this field", order: 10 },
      bind: ({ subject, snapshot }) => ({
        kind: "addFilter",
        docId: snapshot.product.targetDocId,
        field: subject.value.name,
        op: snapshot.product.fieldType === "q" ? ">" : "=",
        value: "",
      }),
    }),
    define.exact("field", {
      id: "datalab.field.group-count",
      action: "field.group-count",
      scopes: ["datalab"],
      // Counting the levels of a quantitative column is not a meaningful
      // question — not relevant, rather than forbidden-with-reason.
      test: ({ snapshot }) =>
        snapshot.product.fieldType !== null && snapshot.product.fieldType !== "q"
          ? available()
          : inapplicable(),
      metadata: { label: "Group by + count", order: 11 },
      bind: ({ subject, snapshot }) => ({
        kind: "addSummarize",
        docId: snapshot.product.targetDocId,
        by: subject.value.name,
        fn: "count",
        field: subject.value.name,
      }),
    }),
    define.exact("field", {
      id: "datalab.field.sort-desc",
      action: "field.sort",
      scopes: ["datalab"],
      metadata: { label: "Sort output by (descending)", order: 12 },
      bind: ({ subject, snapshot }) => ({
        kind: "addSort",
        docId: snapshot.product.targetDocId,
        field: subject.value.name,
        dir: "desc",
      }),
    }),
  ];
}

function datumContributions(): ActionContribution<PresentationValues, DatalabFacts, Verb>[] {
  return [
    define.family("datum", {
      id: "datalab.datum.filters",
      scopes: ["datalab"],
      expand: ({ subject, snapshot }) => {
        const ref = subject.value as DatumRef;
        // The cap is a policy, stated here and visible in the goldens.
        return snapshot.product.categoricalFields.slice(0, 4).flatMap((name, index) => {
          const value = asText(ref.row[name]);
          return [
            {
              key: `keep:${name}`,
              action: `datum.keep.${name}`,
              metadata: {
                label: `Keep only ${name} = ${value}  (chart ${snapshot.product.targetName})`,
                order: index * 2,
              },
              bind: () => ({
                kind: "addFilter" as const,
                docId: snapshot.product.targetDocId,
                field: name,
                op: "=" as const,
                value,
              }),
            },
            {
              key: `exclude:${name}`,
              action: `datum.exclude.${name}`,
              metadata: { label: `Exclude ${name} = ${value}`, order: index * 2 + 1 },
              bind: () => ({
                kind: "addFilter" as const,
                docId: snapshot.product.targetDocId,
                field: name,
                op: "!=" as const,
                value,
              }),
            },
          ];
        });
      },
    }),
  ];
}

function docContributions(): ActionContribution<PresentationValues, DatalabFacts, Verb>[] {
  return [
    define.exact("doc", {
      id: "datalab.doc.activate",
      action: "doc.activate",
      scopes: ["datalab"],
      // Already active ⇒ simply not relevant, and nothing falls back to it.
      test: ({ subject, snapshot }) =>
        snapshot.product.activeDocId === subject.value ? inapplicable() : available(),
      metadata: { label: "Make the ACTIVE chart", order: 0 },
      bind: ({ subject }) => ({ kind: "setActiveDoc", docId: subject.value }),
    }),
    define.exact("doc", {
      id: "datalab.doc.snapshot",
      action: "doc.snapshot",
      scopes: ["datalab"],
      metadata: { label: "⚑ Snapshot it", order: 1 },
      bind: ({ subject }) => ({ kind: "snapshot", docId: subject.value }),
    }),
    define.exact("doc", {
      id: "datalab.doc.duplicate",
      action: "doc.duplicate",
      scopes: ["datalab"],
      metadata: { label: "Duplicate document", order: 2 },
      bind: ({ subject }) => ({ kind: "duplicateDoc", docId: subject.value }),
    }),
    define.exact("doc", {
      id: "datalab.doc.delete",
      action: "doc.delete",
      scopes: ["datalab"],
      metadata: { label: "Delete document", order: 3 },
      bind: ({ subject }) => ({ kind: "deleteDoc", docId: subject.value }),
    }),
  ];
}

function stageContributions(): ActionContribution<PresentationValues, DatalabFacts, Verb>[] {
  return [
    define.exact("stage", {
      id: "datalab.stage.switch",
      action: "stage.switch",
      scopes: ["datalab"],
      test: ({ subject }) => ((subject.value as StageRef).current ? inapplicable() : available()),
      metadata: { label: "Switch to it", order: 0 },
      bind: ({ subject }) => ({ kind: "switchStage", stageId: subject.value.stageId }),
    }),
    define.exact("stage", {
      id: "datalab.stage.export",
      action: "stage.export",
      scopes: ["datalab"],
      metadata: { label: "Copy this stage to the clipboard", order: 1 },
      bind: ({ subject }) => ({ kind: "exportStage", stageId: subject.value.stageId }),
    }),
    define.exact("stage", {
      id: "datalab.stage.import-stage",
      action: "stage.import",
      scopes: ["datalab"],
      metadata: { label: "Add a stage from the clipboard …", order: 2 },
      bind: () => ({ kind: "importStage" }),
    }),
    define.exact("stage", {
      id: "datalab.stage.import-workspace",
      action: "workspace.import",
      scopes: ["datalab"],
      metadata: { label: "Add a workspace from the clipboard …", order: 3 },
      bind: ({ subject }) => ({ kind: "importWorkspace", stageId: subject.value.stageId }),
    }),
    define.exact("stage", {
      id: "datalab.stage.template",
      action: "stage.template",
      scopes: ["datalab"],
      metadata: { label: "Save as a template …", order: 4 },
      bind: ({ subject }) => ({
        kind: "storeTemplate",
        source: { kind: "stage", stageId: subject.value.stageId },
        name: subject.value.name,
      }),
    }),
  ];
}

/* -------------------------------------------------------------- registry --- */

/**
 * The runtime type graph (PBUI-ACTIONS-2 P5).
 *
 * Two abstract nodes exist because reuse DEMONSTRATED them: every migrated
 * type carried an identical Inspect rule and three carried an identical
 * Watch rule, so `inspectable` and `watchable` replace eight per-type
 * declarations with two inherited ones. Only migrated types declare parents
 * — a legacy-family type must not inherit rules while its menu still comes
 * from its descriptor callback, or its rows would double.
 *
 * Stage is deliberately inspectable but NOT watchable: its menu never
 * offered Watch, and inheritance must not add rows as a side effect of
 * refactoring. Growing stage a Watch row is a product decision.
 */
const TYPE_DEFINITIONS = [
  { id: "inspectable", abstract: true },
  { id: "watchable", abstract: true },
  { id: "field", parents: ["inspectable", "watchable"] },
  { id: "datum", parents: ["inspectable", "watchable"] },
  { id: "doc", parents: ["inspectable", "watchable"] },
  { id: "stage", parents: ["inspectable"] },
  ...["source", "cat", "geom", "step", "user", "token", "member", "upload", "tile", "workspace", "traceEntry"].map(
    (id) => ({ id }),
  ),
];

function inheritedContributions(): ActionContribution<PresentationValues, DatalabFacts, Verb>[] {
  return [
    define.inherited("inspectable", {
      id: "datalab.inspect",
      action: "object.inspect",
      scopes: ["datalab"],
      // 13/14 sit above every migrated type's own rows (field tops out at 12,
      // doc at 3, stage at 4) and below datum's family — wait, datum's family
      // used 0..7; 13/14 keep Inspect/Watch last there too. One order pair,
      // four preserved menus; checked by the goldens.
      metadata: { label: "Inspect", order: 13 },
      bind: ({ subject }) => ({ kind: "inspect", ptype: subject.type, value: subject.value }),
    }),
    define.inherited("watchable", {
      id: "datalab.watch",
      action: "object.watch",
      scopes: ["datalab"],
      metadata: { label: "Add to watchlist", order: 14 },
      bind: ({ subject }) => ({ kind: "watch", ptype: subject.type, value: subject.value }),
    }),
  ];
}

export const datadropActionRegistry = createActionRegistry<
  PresentationValues,
  DatalabFacts,
  Verb
>({
  graph: createPresentationTypeGraph(TYPE_DEFINITIONS),
  scopes: ["datalab", "global"],
  contributions: [
    // Unmigrated types still speak through their descriptor callbacks; a
    // migrated descriptor has no callback, so the family yields nothing for
    // it and the rules below are the only voice. One engine, no double rows.
    legacyDescriptorFamily<PresentationValues, PbuiEnvironment, Verb>({
      id: "legacy.descriptor-actions",
      descriptors: datadropRegistry,
    }),
    ...fieldContributions(),
    ...datumContributions(),
    ...docContributions(),
    ...stageContributions(),
    ...inheritedContributions(),
  ],
});
