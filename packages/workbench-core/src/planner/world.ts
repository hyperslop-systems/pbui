import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { MutationSchema, type Mutation, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import type { IdGenerator } from "@hyperslop-systems/workbench-protocol/client";
import type { ManifestCatalog } from "../apps";
import type { LocalEffect } from "../effects";
import type { GeometrySnapshot } from "../geometry";
import type { WorkbenchIndex } from "../graph";
import type { WorkbenchLinks } from "../links/collaborator";
import type { WorkbenchPolicy } from "../policy";
import type { WorkbenchSession } from "../session";

/**
 * Everything a planner may read (guide §7.3): values only. No store, no
 * DOM, no runtime mutation methods, no React. The links collaborator is
 * present as a value-returning planner; its `install` is not reachable
 * from here.
 */
export interface PlanWorld {
  readonly document: WorkbenchDocument;
  readonly session: WorkbenchSession;
  readonly index: WorkbenchIndex;
  readonly apps: ManifestCatalog;
  readonly policy: WorkbenchPolicy;
  readonly geometry: GeometrySnapshot | null;
  readonly ids: IdGenerator;
  readonly links: WorkbenchLinks | null;
}

/** What one command contributes to a transition. */
export interface PlanFragment {
  readonly mutations: readonly Mutation[];
  /** A patch on the draft session; applied in order with the mutations. */
  readonly session?: Partial<WorkbenchSession>;
  readonly effects?: readonly LocalEffect[];
  /** The placement this command created or landed on. */
  readonly placementId?: string;
  readonly viewId?: string;
  readonly workspaceId?: string;
  /** False when the command was already satisfied (nothing to do). */
  readonly changed: boolean;
}

/** One option of an ambiguous command, for a chooser or an agent. */
export interface Choice {
  readonly id: string;
  readonly label: string;
  readonly explanation: string;
  readonly available: boolean;
  readonly because?: string;
}

export type FragmentOutcome =
  | ({ kind: "prepared" } & PlanFragment)
  | { kind: "refused"; code: string; because: string }
  | { kind: "ambiguous"; because: string; choices: readonly Choice[] };

export const refuse = (code: string, because: string): FragmentOutcome => ({ kind: "refused", code, because });

export const prepared = (fragment: PlanFragment): FragmentOutcome => ({ kind: "prepared", ...fragment });

export const unchanged = (extra: Omit<PlanFragment, "mutations" | "changed"> = {}): FragmentOutcome => prepared({ mutations: [], changed: false, ...extra });

export type MutationBody = MessageInitShape<typeof MutationSchema>["body"];

export function mutation(body: MutationBody): Mutation {
  return create(MutationSchema, { body });
}
