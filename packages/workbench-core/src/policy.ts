import type { AppView } from "@hyperslop-systems/workbench-protocol";
import type { WorkbenchAppManifest } from "./apps";
import { bindRequestedOnly, type InitialDocumentPolicy } from "./binding";

/** A split axis: `"row"` places children side by side, `"col"` stacks them. */
export type Axis = "row" | "col";

export interface PaneConstraints {
  /** Minimum width of either child in a row split. */
  minInlinePx: number;
  /** Minimum height of either child in a column split. */
  minBlockPx: number;
  /** Headless/relative floor even when rendered geometry is unavailable. */
  minFraction: number;
}

export const DEFAULT_PANE_CONSTRAINTS: PaneConstraints = { minInlinePx: 240, minBlockPx: 160, minFraction: 0.1 };

/**
 * What a bare duplicate of a tile (`placement.duplicate` with no app named)
 * puts in the new pane: `"clone"` mints an independent view with the same
 * bindings, `"link"` places the same view again, `{ app }` opens an empty
 * pane of that application (a launcher, an empty state), or a function of
 * the view being duplicated. A `viewCardinality: "one"` or
 * `duplicatePlacement: "link"` application always links regardless.
 */
export type DuplicatePolicy =
  | "clone"
  | "link"
  | { app: string }
  | ((view: AppView, app: WorkbenchAppManifest | null) => "clone" | "link" | { app: string });

export interface WorkbenchPolicy {
  readonly split: PaneConstraints & {
    /** The axis automatic placement splits along when no geometry is supplied (guide §23 Q5). */
    readonly headlessAxis: Axis;
  };
  readonly duplicate: DuplicatePolicy;
  /**
   * The application a pane shows when it holds NOTHING yet. Aiming a new
   * tile at the centre of such a pane FILLS it instead of splitting it.
   * Defaults to the id in an object-form `duplicate` policy; null switches
   * the rule off.
   */
  readonly emptyPlacement: { readonly appId: string } | null;
  readonly initialDocuments: InitialDocumentPolicy;
}

export interface WorkbenchPolicyInput {
  split?: Partial<PaneConstraints & { headlessAxis: Axis }>;
  duplicate?: DuplicatePolicy;
  emptyPlacement?: { appId: string } | null;
  initialDocuments?: InitialDocumentPolicy;
}

/** Fill defaults and refuse a policy the planner could not honour. */
export function compilePolicy(input: WorkbenchPolicyInput = {}): WorkbenchPolicy {
  const split = { ...DEFAULT_PANE_CONSTRAINTS, headlessAxis: "row" as Axis, ...input.split };
  if (
    !Number.isFinite(split.minInlinePx) || split.minInlinePx <= 0 ||
    !Number.isFinite(split.minBlockPx) || split.minBlockPx <= 0 ||
    !Number.isFinite(split.minFraction) || split.minFraction <= 0 || split.minFraction > 0.5
  ) {
    throw new Error("workbench-core: pane constraints require positive pixel minima and minFraction in (0, 0.5]");
  }
  if (split.headlessAxis !== "row" && split.headlessAxis !== "col") throw new Error(`workbench-core: headlessAxis must be "row" or "col"`);
  const duplicate = input.duplicate ?? "clone";
  const emptyPlacement =
    input.emptyPlacement !== undefined
      ? input.emptyPlacement
      : typeof duplicate === "object"
        ? { appId: duplicate.app }
        : null;
  if (emptyPlacement && !emptyPlacement.appId) throw new Error("workbench-core: emptyPlacement needs an application id");
  return { split, duplicate, emptyPlacement, initialDocuments: input.initialDocuments ?? bindRequestedOnly() };
}
