import {
  createPresentationRegistry,
  type PresentationDescriptor as GenericPresentationDescriptor,
} from "@hyperslop-systems/pbui";
import type { PbuiEnvironment, PresentationType, PresentationValues } from "./types";
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
  /** The token naming this type's accent colour. */
  tone: string;
}

function bindProductDescriptor<Value>(
  descriptor: PresentationDescriptor<Value>,
): GenericPresentationDescriptor<Value, PbuiEnvironment> {
  return {
    label: descriptor.label,
    describe: descriptor.describe,
    tone: descriptor.tone,
    /*
     * PBUI-ACTIONS-2 P7: no descriptor carries actions() any more — every
     * menu resolves through the kernel registry in ./actions.ts. This
     * adapter binds representation only.
     */
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
  PbuiEnvironment
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
