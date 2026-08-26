import {
  createPresentationRegistry,
  type PresentationDescriptor as GenericPresentationDescriptor,
} from "@hyperslop-systems/pbui";
import type { PbuiEnvironment, PresentationType, PresentationValues } from "./types";
import type { Action } from "./verbs";
import { catDescriptor } from "./descriptors/cat";
import { datumDescriptor } from "./descriptors/datum";
import { docDescriptor } from "./descriptors/doc";
import { fieldDescriptor } from "./descriptors/field";
import { geomDescriptor } from "./descriptors/geom";
import { sourceDescriptor } from "./descriptors/source";
import { memberDescriptor } from "./descriptors/member";
import { stepDescriptor } from "./descriptors/step";
import { tokenDescriptor } from "./descriptors/token";
// DATADROP-11: the trace stops being a write-only log.
import { traceEntryDescriptor } from "./descriptors/traceEntry";
import { uploadDescriptor } from "./descriptors/upload";
import { userDescriptor } from "./descriptors/user";
// DATADROP-8: the three layout types. They were declared presentation types
// with no descriptor since DATADROP-4, which is why right-clicking a tile said
// "no verbs for this object yet".
import { stageDescriptor } from "./descriptors/stage";
import { tileDescriptor } from "./descriptors/tile";
import { workspaceDescriptor } from "./descriptors/workspace";

/**
 * One descriptor per presentation type.
 *
 * The prototype spreads each type across `labelFor`, `describe` and
 * `actionsFor` — three parallel if-chains inside a 314-line `App()`
 * (pbui-gog.jsx:2554-2681). Adding a type means editing three places in the
 * largest function in the file. Here it means adding one file.
 *
 * A descriptor holds no React. The chip that *draws* a presentation lives in
 * components/atoms, and the mapping from type to chip lives there too — because
 * pbui may not import components (the layer graph, enforced by
 * test/layers.test.ts), and putting a component in the descriptor would make
 * that a cycle.
 */
export interface PresentationDescriptor<V = unknown> {
  ptype: PresentationType;
  /** One line: menu headers, the mouse-doc bar, the trace. */
  label(value: V, env: PbuiEnvironment): string;
  /** The full object, for the inspector. Must be JSON-serialisable. */
  describe(value: V, env: PbuiEnvironment): unknown;
  /**
   * The menu, most likely entry first.
   *
   * Pure: (value, environment) in, serialisable verbs out. A test can assert
   * the exact verb a menu entry produces with a literal environment and no
   * store, no Provider, no DOM.
   */
  actions(value: V, env: PbuiEnvironment): Action[];
  /** The token naming this type's accent colour. */
  tone: string;
}

/**
 * The extra segment that keeps two same-kind verbs in one menu apart.
 *
 * PBUI-ACTIONS-2 P0: action ids used to be `${ptype}:${index}:${label}` —
 * a label edit changed identity, and inserting a row renumbered every later
 * one. The kernel migration needs ids that survive both, because they feed
 * overrides, traces, and fresh revalidation. The id is now derived from the
 * verb's semantic content: `${ptype}.${kind}` plus, where one menu can emit
 * the same kind twice, the field that tells the entries apart.
 */
const FILTER_OP_SLUGS: Record<string, string> = { "=": "eq", "!=": "ne", ">": "gt", "<": "lt" };

function verbDiscriminant(verb: Action["verb"]): string | null {
  switch (verb.kind) {
    case "setMapping":
      return verb.channel;
    case "addFilter":
      return `${verb.field}.${FILTER_OP_SLUGS[verb.op] ?? verb.op}`;
    case "addSort":
      return verb.dir;
    case "setGeom":
      return verb.geom;
    case "setYScale":
      return verb.scale;
    case "moveStep":
      return verb.by === -1 ? "up" : "down";
    case "pinSnapshot":
      return `slot-${verb.slot}`;
    case "splitTile":
      return verb.dir;
    case "signIn":
      return verb.intent;
    case "setMemberRole":
      return verb.role;
    default:
      return null;
  }
}

function bindProductDescriptor<Value>(
  descriptor: PresentationDescriptor<Value>,
): GenericPresentationDescriptor<Value, PbuiEnvironment, Action["verb"]> {
  return {
    label: descriptor.label,
    describe: descriptor.describe,
    tone: descriptor.tone,
    actions: (value, environment) => {
      /*
       * `disabledBecause` passes straight through since pbui 0.4.0.
       *
       * These two lines used to be here:
       *
       *     disabled: action.disabledBecause !== undefined,
       *     disabledReason: action.disabledBecause,
       *
       * because this product had merged the pair into one field on its own,
       * years before the library did, and had to translate back into pbui's
       * two-field shape at this boundary. It was the only one of four products
       * that never shipped the disabled/reason disconnect — and it paid this
       * adapter for the privilege. pbui adopted the field and the name from
       * here (PBUI-HARDEN-1 P3.1), so the translation is gone and not one
       * descriptor changed.
       */
      const seen = new Set<string>();
      return descriptor.actions(value, environment).map((action) => {
        const discriminant = verbDiscriminant(action.verb);
        const id = discriminant
          ? `${descriptor.ptype}.${action.verb.kind}.${discriminant}`
          : `${descriptor.ptype}.${action.verb.kind}`;
        // A collision means two menu entries would be indistinguishable to
        // overrides and revalidation — loud now beats subtly wrong later.
        if (seen.has(id)) {
          throw new Error(
            `duplicate action id "${id}" in the <${descriptor.ptype}> menu — ` +
              `add a case to verbDiscriminant() for this verb kind`,
          );
        }
        seen.add(id);
        return {
          id,
          label: action.label,
          verb: action.verb,
          disabledBecause: action.disabledBecause,
        };
      });
    },
  };
}

/**
 * The Datadrop descriptor vocabulary bound to PBUI's generic registry.
 *
 * Types without a descriptor remain legal presentations and receive PBUI's
 * safe label/description/action defaults. That preserves the existing
 * descriptor-coverage contract while moving registry mechanics out of the
 * product.
 */
export const datadropRegistry = createPresentationRegistry<
  PresentationValues,
  PbuiEnvironment,
  Action["verb"]
>({
  field: bindProductDescriptor(fieldDescriptor),
  source: bindProductDescriptor(sourceDescriptor),
  doc: bindProductDescriptor(docDescriptor),
  cat: bindProductDescriptor(catDescriptor),
  datum: bindProductDescriptor(datumDescriptor),
  geom: bindProductDescriptor(geomDescriptor),
  step: bindProductDescriptor(stepDescriptor),
  user: bindProductDescriptor(userDescriptor),
  token: bindProductDescriptor(tokenDescriptor),
  member: bindProductDescriptor(memberDescriptor),
  upload: bindProductDescriptor(uploadDescriptor),
  tile: bindProductDescriptor(tileDescriptor),
  workspace: bindProductDescriptor(workspaceDescriptor),
  stage: bindProductDescriptor(stageDescriptor),
  traceEntry: bindProductDescriptor(traceEntryDescriptor),
});
