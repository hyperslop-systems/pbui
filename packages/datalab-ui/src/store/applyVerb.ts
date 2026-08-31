import type { UnknownAction } from "@reduxjs/toolkit";
import {
  draftToTransform,
  newTransformDraft,
  type TransformDraft,
  type TransformKind,
} from "../model/transformEditor";
import type { Field, Table } from "../model/table";
import { datadropRegistry } from "../pbui/registry";
import type { DatadropPresentationReference } from "../pbui/runtime";
import type { PbuiEnvironment } from "../pbui/types";
import type { Verb } from "../pbui/verbs";
import type { AppThunk } from "./index";
import { actionsForLayoutVerb } from "./applyLayoutVerb";
import type { LayoutState } from "./layout";
import { worldActions, type WorldState } from "./world";

/**
 * Where a verb becomes a state change.
 *
 * This is the seam phase 1 designed for. Descriptors emit serialisable verbs
 * and know nothing about reducers; this function is the only place that maps
 * one to the other, so adding a verb means adding one case here rather than
 * threading a dispatch through eleven descriptors.
 *
 * Returns the actions to dispatch rather than dispatching, which keeps it a
 * pure function of (verb, state) and therefore testable without a store.
 *
 * ## Widened by DATADROP-8 (DR-68), in two ways
 *
 * It takes the **whole** state rather than only the world, because every verb
 * this ticket adds targets the layout. And it may return a **thunk**, because
 * export, import and the template library are not reducer applications at all
 * but effects with a promise in the middle.
 *
 * The purity claim survives both and needs stating precisely, because "returns
 * a thunk" sounds like a loophole: this function *returns* a thunk, it never
 * runs one. A test can still assert the exact consequence of a verb with a
 * literal state and no store — and for the effects, with a store whose
 * clipboard is a fake that records what it was given.
 */
export type VerbResult = UnknownAction | AppThunk<unknown>;

export function actionsForVerb(
  verb: Verb,
  state: { world: WorldState; layout: LayoutState },
  env: PbuiEnvironment,
): VerbResult[] {
  const a = worldActions;
  const world = state.world;

  // The layout half lives in its own file so neither becomes a 400-line switch.
  // It returns null for a verb it does not own, so there is no second list of
  // verb kinds to keep in step with this switch.
  const layoutResult = actionsForLayoutVerb(verb, state.layout);
  if (layoutResult) return layoutResult;
  // The reducers accept `docId: null` and resolve it to the active document
  // themselves, so an ambient verb is resolved at APPLICATION time rather than
  // at menu-build time. The active document can change while a menu is open.
  const out: unknown[] = [];

  const transformFor = (
    docId: string | null,
    kind: TransformKind,
  ): { draft: TransformDraft; fields: Field[] } | null => {
    const doc = world.docs[docId ?? world.activeDocId ?? ""];
    const fields = env.fieldsFor(docId);
    if (!doc) return null;
    return { draft: newTransformDraft(kind, fields), fields };
  };

  switch (verb.kind) {
    case "inspect":
      out.push(
        a.inspect({
          title: `<${verb.ptype}>`,
          value: datadropRegistry.describeFor(
            { type: verb.ptype, value: verb.value } as DatadropPresentationReference,
            env,
          ),
        }),
      );
      break;

    case "watch":
      out.push(a.watchAdd(verb.ptype, verb.value));
      break;

    case "setMapping": {
      if (verb.field === null) {
        out.push(a.setMapping({ docId: verb.docId, channel: verb.channel, field: null }));
        break;
      }
      const field = env.fieldsFor(verb.docId).find((candidate) => candidate.name === verb.field);
      if (field?.fieldId) {
        out.push(
          a.setMapping({
            docId: verb.docId,
            channel: verb.channel,
            field: { fieldId: field.fieldId, name: field.name },
          }),
        );
      }
      break;
    }

    case "setGeom":
      out.push(a.setGeom({ docId: verb.docId, geom: verb.geom }));
      break;

    case "setYScale":
      out.push(a.setYScale({ docId: verb.docId, scale: verb.scale }));
      break;

    case "addFilter": {
      const candidate = transformFor(verb.docId, "filter");
      if (candidate?.draft.kind === "filter") {
        const draft = {
          ...candidate.draft,
          // A descriptor may deliberately open a blank filter editor. Keep it
          // inactive until a predicate value exists, but make populated menu
          // filters immediately useful.
          enabled: verb.value.trim() !== "",
          field: verb.field,
          op: verb.op,
          value: verb.value,
        };
        out.push(
          a.addTransform({
            docId: verb.docId,
            transform: draftToTransform(draft, candidate.fields),
          }),
        );
      }
      break;
    }

    case "addSummarize": {
      const candidate = transformFor(verb.docId, "summarize");
      if (candidate?.draft.kind === "summarize") {
        const draft = { ...candidate.draft, by: verb.by, fn: verb.fn, field: verb.field };
        out.push(
          a.addTransform({
            docId: verb.docId,
            transform: draftToTransform(draft, candidate.fields),
          }),
        );
      }
      break;
    }

    case "addSort": {
      const candidate = transformFor(verb.docId, "sort");
      if (candidate?.draft.kind === "sort") {
        const draft = { ...candidate.draft, field: verb.field, dir: verb.dir };
        out.push(
          a.addTransform({
            docId: verb.docId,
            transform: draftToTransform(draft, candidate.fields),
          }),
        );
      }
      break;
    }

    case "toggleStep":
      out.push(a.toggleTransform({ docId: verb.docId, transformId: verb.stepId }));
      break;

    case "moveStep":
      out.push(a.moveTransform({ docId: verb.docId, transformId: verb.stepId, by: verb.by }));
      break;

    case "removeStep":
      out.push(a.removeTransform({ docId: verb.docId, transformId: verb.stepId }));
      break;

    case "setSource":
      out.push(a.setDocSource({ docId: verb.docId, source: verb.source }));
      break;

    case "newDoc":
      out.push(a.newDoc(verb.source));
      break;

    case "setActiveDoc":
      out.push(a.setActiveDoc(verb.docId));
      break;

    case "duplicateDoc":
      out.push(a.duplicateDoc({ docId: verb.docId, id: crypto.randomUUID() }));
      break;

    case "deleteDoc":
      out.push(a.deleteDoc(verb.docId));
      break;

    case "snapshot":
      // The timestamp is passed in rather than read inside the reducer: a
      // reducer that calls Date.now() is not a pure function of its inputs, and
      // a state tree that changes when you replay it is not replayable.
      out.push(a.snapshot(verb.docId, new Date().toISOString()));
      break;

    case "restoreSnapshot":
      out.push(a.restoreSnapshot({ snapshotId: verb.snapshotId, docId: verb.docId }));
      break;

    case "restoreAsNewDoc":
      // Two actions, in order: the new document becomes active, and the restore
      // then lands on it with docId null.
      out.push(a.newDoc(null));
      out.push(a.restoreSnapshot({ snapshotId: verb.snapshotId, docId: null }));
      break;

    case "pinSnapshot":
      out.push(a.pinSnapshot({ slot: verb.slot, snapshotId: verb.snapshotId }));
      break;

    case "deleteSnapshot":
      out.push(a.deleteSnapshot(verb.snapshotId));
      break;
  }

  return out as VerbResult[];
}

/**
 * The environment a descriptor sees, built from world state and two lookups.
 *
 * Two, not one, and the split is DR-40. `fieldsFor` is the render path — cheap,
 * O(steps), called once per field chip per frame. `tableFor` evaluates the
 * pipeline and belongs to the menu path. Taking both from the caller keeps this
 * a pure mapping and keeps the cost visible where it is paid.
 */
export function environmentFor(
  worldOrCurrent: WorldState | (() => WorldState),
  tableOf: (docId: string | null) => Table | null,
  fieldsOf: (docId: string | null) => Field[],
): PbuiEnvironment {
  const current = typeof worldOrCurrent === "function" ? worldOrCurrent : () => worldOrCurrent;
  return {
    fieldsFor: (docId) => fieldsOf(docId ?? current().activeDocId),
    tableFor: (docId) => tableOf(docId ?? current().activeDocId),
    get activeDocId() {
      return current().activeDocId;
    },
    nameOf: (docId) => {
      const world = current();
      return world.docs[docId ?? world.activeDocId ?? ""]?.name ?? "—";
    },
  };
}
