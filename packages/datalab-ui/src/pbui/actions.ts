import {
  available,
  createActionRegistry,
  createPresentationTypeGraph,
  defineActions,
  inapplicable,
  unavailable,
} from "@hyperslop-systems/pbui/presentation";
import type {
  ActionContribution,
  ActionQuery,
  LegacyFacts,
  SelectionSnapshot,
} from "@hyperslop-systems/pbui/presentation";
import { CHANNELS, CHANNEL_ACCEPTS } from "../model/graphic";
import type { Mark } from "../model/graphic";
import { TYPE_LABEL, asText } from "../model/table";
import type { FieldType } from "../model/table";
import type { CatRef, DatumRef, DocId, FieldRef, MemberRef, PbuiEnvironment, StageRef, TileRef, TokenRef, UploadRef, PresentationValues, WorkspaceRef } from "./types";
import type { Verb } from "./verbs";

/**
 * The Datalab action registry (PBUI-ACTIONS-2 P3).
 *
 * Every presentation type declares its menu as kernel rules here (PBUI-ACTIONS-2
 * P3 migrated four types, P7 the remaining eleven); the descriptors are
 * representation only. Rule ids follow the source guide's Appendix B
 * (`datalab.field.map.x`); action ids name the conceptual operation. Labels,
 * reasons, and verbs are byte-identical to the descriptor callbacks they
 * replaced — the golden tests are the fence.
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
  } else if (query.subject.type === "cat") {
    const ref = query.subject.value as CatRef;
    targetDocId = ref.docId ?? environment.activeDocId;
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
  { id: "source", parents: ["inspectable", "watchable"] },
  { id: "cat", parents: ["inspectable", "watchable"] },
  { id: "geom", parents: ["inspectable"] },
  { id: "token", parents: ["inspectable"] },
  { id: "member", parents: ["inspectable"] },
  { id: "upload", parents: ["inspectable"] },
  { id: "tile", parents: ["inspectable"] },
  { id: "workspace", parents: ["inspectable"] },
  // step has no Inspect row; user and traceEntry word theirs differently
  // ("Watch", "Inspect this entry") — different labels are different rows,
  // so they keep their own rules rather than inheriting a wrong word.
  ...["step", "user", "traceEntry"].map((id) => ({ id })),
];

function sourceContributions(): ActionContribution<PresentationValues, DatalabFacts, Verb>[] {
  return [
    define.exact("source", {
      id: "datalab.source.load",
      action: "source.load",
      scopes: ["datalab"],
      metadata: {
        label: ({ snapshot }) => `Load into chart ${snapshot.product.targetName}`,
        order: 0,
      },
      bind: ({ subject, snapshot }) => ({
        kind: "setSource",
        docId: snapshot.product.activeDocId,
        source: subject.value,
      }),
    }),
    define.exact("source", {
      id: "datalab.source.new-doc",
      action: "source.new-doc",
      scopes: ["datalab"],
      metadata: { label: "New chart document from it", order: 1 },
      bind: ({ subject }) => ({ kind: "newDoc", source: subject.value }),
    }),
  ];
}

function catContributions(): ActionContribution<PresentationValues, DatalabFacts, Verb>[] {
  return [
    define.exact("cat", {
      id: "datalab.cat.keep",
      action: "cat.addFilter.eq",
      scopes: ["datalab"],
      metadata: {
        label: ({ subject, snapshot }) => {
          const ref = subject.value as CatRef;
          return `Keep only ${ref.field} = ${ref.value}  (chart ${snapshot.product.targetName})`;
        },
        order: 0,
      },
      bind: ({ subject, snapshot }) => ({
        kind: "addFilter",
        docId: snapshot.product.targetDocId,
        field: subject.value.field,
        op: "=",
        value: subject.value.value,
      }),
    }),
    define.exact("cat", {
      id: "datalab.cat.exclude",
      action: "cat.addFilter.ne",
      scopes: ["datalab"],
      metadata: {
        label: ({ subject }) => {
          const ref = subject.value as CatRef;
          return `Exclude ${ref.field} = ${ref.value}`;
        },
        order: 1,
      },
      bind: ({ subject, snapshot }) => ({
        kind: "addFilter",
        docId: snapshot.product.targetDocId,
        field: subject.value.field,
        op: "!=",
        value: subject.value.value,
      }),
    }),
    define.exact("cat", {
      id: "datalab.cat.facet",
      action: "chart.mapping.facet",
      scopes: ["datalab"],
      metadata: {
        label: ({ subject }) => `Facet by ${(subject.value as CatRef).field}`,
        order: 2,
      },
      bind: ({ subject, snapshot }) => ({
        kind: "setMapping",
        docId: snapshot.product.targetDocId,
        channel: "facet",
        field: subject.value.field,
      }),
    }),
  ];
}

function geomStepContributions(): ActionContribution<PresentationValues, DatalabFacts, Verb>[] {
  return [
    define.exact("geom", {
      id: "datalab.geom.use",
      action: "chart.geom",
      scopes: ["datalab"],
      metadata: {
        label: ({ snapshot }) => `Use this geom  (chart ${snapshot.product.targetName})`,
        order: 0,
      },
      bind: ({ subject, snapshot }) => ({
        kind: "setGeom",
        docId: snapshot.product.activeDocId,
        // The <geom> presentation value is the mark name as a string; the
        // verb narrows it — same trust the descriptor callback had.
        geom: subject.value as Mark,
      }),
    }),
    define.exact("step", {
      id: "datalab.step.toggle",
      action: "step.toggle",
      scopes: ["datalab"],
      metadata: { label: "Enable / disable (keeps it in the chain)", order: 0 },
      bind: ({ subject, snapshot }) => ({
        kind: "toggleStep",
        docId: snapshot.product.activeDocId,
        stepId: subject.value,
      }),
    }),
    define.exact("step", {
      id: "datalab.step.move-up",
      action: "step.move.up",
      scopes: ["datalab"],
      metadata: { label: "Move up ↑", order: 1 },
      bind: ({ subject, snapshot }) => ({
        kind: "moveStep",
        docId: snapshot.product.activeDocId,
        stepId: subject.value,
        by: -1,
      }),
    }),
    define.exact("step", {
      id: "datalab.step.move-down",
      action: "step.move.down",
      scopes: ["datalab"],
      metadata: { label: "Move down ↓", order: 2 },
      bind: ({ subject, snapshot }) => ({
        kind: "moveStep",
        docId: snapshot.product.activeDocId,
        stepId: subject.value,
        by: 1,
      }),
    }),
    define.exact("step", {
      id: "datalab.step.remove",
      action: "step.remove",
      scopes: ["datalab"],
      metadata: { label: "Remove", order: 3 },
      bind: ({ subject, snapshot }) => ({
        kind: "removeStep",
        docId: snapshot.product.activeDocId,
        stepId: subject.value,
      }),
    }),
  ];
}

function accountContributions(): ActionContribution<PresentationValues, DatalabFacts, Verb>[] {
  return [
    define.exact("user", {
      id: "datalab.user.inspect",
      action: "object.inspect",
      scopes: ["datalab"],
      metadata: { label: "Inspect", order: 0 },
      bind: ({ subject }) => ({ kind: "inspect", ptype: "user", value: subject.value }),
    }),
    define.exact("user", {
      id: "datalab.user.watch",
      action: "object.watch",
      scopes: ["datalab"],
      metadata: { label: "Watch", order: 1 },
      bind: ({ subject }) => ({ kind: "watch", ptype: "user", value: subject.value }),
    }),
    define.exact("token", {
      id: "datalab.token.revoke",
      action: "token.revoke",
      scopes: ["datalab"],
      test: ({ subject }) =>
        (subject.value as TokenRef).revokedAt
          ? unavailable("this token is already revoked")
          : available(),
      metadata: { label: "Revoke", order: 0 },
      bind: ({ subject }) => ({ kind: "revokeToken", tokenId: subject.value.id }),
    }),
    define.family("member", {
      id: "datalab.member.roles",
      scopes: ["datalab"],
      expand: ({ subject }) => {
        const member = subject.value as MemberRef;
        const ownerReason = member.isOwner ? "the owner's role cannot be changed" : undefined;
        return (["reader", "writer", "admin"] as const)
          .filter((role) => role !== member.role)
          .map((role, index) => ({
            key: `role:${role}`,
            action: `member.role.${role}`,
            ...(ownerReason ? { status: unavailable(ownerReason) } : {}),
            metadata: { label: `Set role → ${role}`, order: index },
            bind: () => ({
              kind: "setMemberRole" as const,
              drop: member.drop,
              userId: member.user.id,
              role,
            }),
          }));
      },
    }),
    define.exact("member", {
      id: "datalab.member.remove",
      action: "member.remove",
      scopes: ["datalab"],
      test: ({ subject }) =>
        (subject.value as MemberRef).isOwner
          ? unavailable("the owner's role cannot be changed")
          : available(),
      metadata: { label: "Remove from this drop", order: 10 },
      bind: ({ subject }) => ({
        kind: "removeMember",
        drop: subject.value.drop,
        userId: subject.value.user.id,
      }),
    }),
    define.exact("upload", {
      id: "datalab.upload.retry",
      action: "upload.retry",
      scopes: ["datalab"],
      test: ({ subject }) => {
        const upload = subject.value as UploadRef;
        if (upload.state === "done") return unavailable("already uploaded");
        if (upload.state === "failed") return available();
        return unavailable("still in progress");
      },
      metadata: { label: "Retry", order: 0 },
      bind: ({ subject }) => ({
        kind: "retryUpload",
        batchId: subject.value.batchId,
        path: subject.value.path,
      }),
    }),
    define.exact("traceEntry", {
      id: "datalab.trace-entry.inspect",
      action: "object.inspect",
      scopes: ["datalab"],
      metadata: { label: "Inspect this entry", order: 0 },
      bind: ({ subject }) => ({ kind: "inspect", ptype: "traceEntry", value: subject.value }),
    }),
    define.exact("traceEntry", {
      id: "datalab.trace-entry.watch",
      action: "object.watch",
      scopes: ["datalab"],
      metadata: { label: "Watch it", order: 1 },
      bind: ({ subject }) => ({ kind: "watch", ptype: "traceEntry", value: subject.value }),
    }),
  ];
}

function layoutContributions(): ActionContribution<PresentationValues, DatalabFacts, Verb>[] {
  const tileRule = (
    slug: string,
    action: string,
    order: number,
    label: string | ((tile: TileRef) => string),
    bind: (tile: TileRef) => Verb,
    test?: (tile: TileRef) => ReturnType<typeof available>,
  ): ActionContribution<PresentationValues, DatalabFacts, Verb> =>
    define.exact("tile", {
      id: `datalab.tile.${slug}`,
      action,
      scopes: ["datalab"],
      ...(test ? { test: ({ subject }) => test(subject.value as TileRef) } : {}),
      metadata: {
        label:
          typeof label === "function"
            ? ({ subject }) => label(subject.value as TileRef)
            : label,
        order,
      },
      bind: ({ subject }) => bind(subject.value as TileRef),
    });

  return [
    tileRule("replace", "tile.replace", 0, "Replace …", (tile) => ({
      kind: "openReplaceView",
      placementId: tile.placementId,
    })),
    tileRule("rename", "view.rename", 1, "Rename …", (tile) => ({
      kind: "beginRenameView",
      placementId: tile.placementId,
    })),
    tileRule("link", "view.link", 2, "Create linked duplicate", (tile) => ({
      kind: "createLinkedDuplicate",
      placementId: tile.placementId,
    })),
    tileRule(
      "duplicate",
      "view.duplicate",
      3,
      "Duplicate",
      (tile) => ({ kind: "duplicateView", placementId: tile.placementId }),
      (tile) =>
        tile.duplicable
          ? available()
          : unavailable(`a second ${tile.app} tile would show the same thing`),
    ),
    tileRule("split-right", "tile.split.row", 4, "Split right", (tile) => ({
      kind: "splitTile",
      nodeId: tile.placementId,
      dir: "row",
    })),
    tileRule("split-below", "tile.split.col", 5, "Split below", (tile) => ({
      kind: "splitTile",
      nodeId: tile.placementId,
      dir: "col",
    })),
    tileRule("export", "tile.export", 6, "Copy view to clipboard", (tile) => ({
      kind: "exportTile",
      nodeId: tile.placementId,
    })),
    tileRule("import", "tile.import", 7, "Replace from clipboard …", (tile) => ({
      kind: "importIntoTile",
      nodeId: tile.placementId,
    })),
    tileRule("template", "tile.template", 8, "Save as a template …", (tile) => ({
      kind: "storeTemplate",
      source: { kind: "tile", nodeId: tile.placementId },
      name: tile.title,
    })),
    // Inherited Inspect sits at order 13 — between template (8) and these.
    tileRule(
      "remove",
      "tile.close",
      20,
      "Remove from this workspace",
      (tile) => ({ kind: "removePlacement", placementId: tile.placementId }),
      (tile) =>
        tile.canClose ? available() : unavailable("the last tile in a workspace cannot close"),
    ),
    tileRule(
      "close-view",
      "view.close",
      21,
      (tile) => (tile.placementCount > 1 ? "Close view everywhere" : "Close view"),
      (tile) => ({ kind: "closeView", viewId: tile.viewId }),
    ),
    define.exact("workspace", {
      id: "datalab.workspace.switch-stage",
      action: "stage.switch",
      scopes: ["datalab"],
      metadata: { label: "Switch to it", order: 0 },
      bind: ({ subject }) => ({
        kind: "switchStage",
        stageId: (subject.value as WorkspaceRef).stageId,
      }),
    }),
    define.exact("workspace", {
      id: "datalab.workspace.rename",
      action: "workspace.rename",
      scopes: ["datalab"],
      test: ({ subject }) =>
        (subject.value as WorkspaceRef).pinned
          ? unavailable("defined in code — cannot be renamed")
          : available(),
      metadata: { label: "Rename this workspace …", order: 1 },
      bind: ({ subject }) => ({
        kind: "beginRenameWorkspace",
        spaceId: (subject.value as WorkspaceRef).spaceId,
      }),
    }),
    define.exact("workspace", {
      id: "datalab.workspace.duplicate",
      action: "workspace.duplicate",
      scopes: ["datalab"],
      metadata: { label: "Duplicate", order: 2 },
      bind: ({ subject }) => ({
        kind: "duplicateWorkspace",
        spaceId: (subject.value as WorkspaceRef).spaceId,
      }),
    }),
    define.exact("workspace", {
      id: "datalab.workspace.export",
      action: "workspace.export",
      scopes: ["datalab"],
      metadata: { label: "Copy this workspace to the clipboard", order: 3 },
      bind: ({ subject }) => ({
        kind: "exportWorkspace",
        spaceId: (subject.value as WorkspaceRef).spaceId,
      }),
    }),
    define.exact("workspace", {
      id: "datalab.workspace.import",
      action: "workspace.import",
      scopes: ["datalab"],
      metadata: { label: "Add a workspace from the clipboard …", order: 4 },
      bind: ({ subject }) => ({
        kind: "importWorkspace",
        stageId: (subject.value as WorkspaceRef).stageId,
      }),
    }),
    define.exact("workspace", {
      id: "datalab.workspace.template",
      action: "workspace.template",
      scopes: ["datalab"],
      metadata: { label: "Save as a template …", order: 5 },
      bind: ({ subject }) => ({
        kind: "storeTemplate",
        source: { kind: "workspace", spaceId: (subject.value as WorkspaceRef).spaceId },
        name: (subject.value as WorkspaceRef).name,
      }),
    }),
    define.exact("workspace", {
      id: "datalab.workspace.delete",
      action: "workspace.delete",
      scopes: ["datalab"],
      test: ({ subject }) => {
        const space = subject.value as WorkspaceRef;
        if (space.pinned) return unavailable("defined in code — cannot be deleted");
        return space.canDelete
          ? available()
          : unavailable("the last workspace in a stage cannot be deleted");
      },
      metadata: { label: "Delete", order: 20 },
      bind: ({ subject }) => ({
        kind: "deleteWorkspace",
        spaceId: (subject.value as WorkspaceRef).spaceId,
      }),
    }),
  ];
}

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
    // PBUI-ACTIONS-2 P7: every type is kernel-native; the legacy descriptor
    // family is gone from this product entirely.
    ...fieldContributions(),
    ...datumContributions(),
    ...docContributions(),
    ...stageContributions(),
    ...sourceContributions(),
    ...catContributions(),
    ...geomStepContributions(),
    ...accountContributions(),
    ...layoutContributions(),
    ...inheritedContributions(),
  ],
});
