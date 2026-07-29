import type { AppDescriptor } from "../../../appkit/registry";
import type { SelectOption } from "@hyperslop-systems/pbui";

/**
 * What the tile's application picker offers, and why an entry is unavailable.
 *
 * Extracted as a pure function beside the component because it carries three
 * rules that interact, and every one of them has a failure mode that is
 * invisible in a screenshot.
 *
 * ## 1. The tile's own application is always in the list, and never disabled
 *
 * The rule predates this ticket and the reason is in `Tile.tsx`: a `<select>`
 * whose value matches no option renders blank and silently reassigns on the
 * next change, so a seeded layout naming an out-of-scope application would lose
 * that tile the first time anyone touched the dropdown. With three composed
 * scopes instead of one, the chance of a layout naming an out-of-scope
 * application goes up, not down.
 *
 * It must not be *disabled* either, for the same reason one level down: a
 * selected `<option disabled>` is legal HTML and displays, but it reads as
 * "this tile is showing something it may not show", which is not what is meant.
 * The tile is showing it; the picker is saying what else you may make it.
 *
 * ## 2. Everything else that cannot be chosen is HIDDEN, not greyed (DATADROP-14 DR-95)
 *
 * This reverses what this file used to do, and the reversal is deliberate
 * enough to be worth the paragraph.
 *
 * The old rule was: show an unavailable application greyed, with the reason
 * appended, because hiding an unavailable option hides the rule that makes it
 * unavailable — a user who never sees `trace` in the list does not learn that
 * it is a singleton, they conclude the application is missing. `verbs.ts` still
 * argues exactly that, **and it is still right there**.
 *
 * What makes it wrong *here* is the ratio. A verb menu on a field chip offers
 * four to eight verbs, one of them greyed, and the greyed one teaches. This
 * picker offers twenty-five applications, of which the sign-in stage offers
 * three — so the old rule produced twenty-two greyed rows burying the three
 * that work, which teaches nothing and reads as a broken control.
 *
 * The evidence that this was already the project's position: `Workbench.tsx`
 * carried a hand-written `AppScope` exception doing precisely this for the
 * sign-in stage, with a comment calling twenty-three greyed rows "noise rather
 * than teaching". DATADROP-14 makes it the rule and deletes the exception.
 *
 * What is given up is discoverability of stage-gated applications, and the
 * mitigations are elsewhere: the stage bar names the current stage and its
 * alternatives, and the launcher's empty state says how many this stage offers.
 *
 * ## 3. All three scope levels now behave identically
 *
 * Instance, stage and workspace scope all filter, so `apps` arrives fully
 * narrowed and `unavailable` reports only what the *workspace state* forbids.
 * The old signature took `reasonFor(id): string | undefined` because the
 * strings were rendered; nothing renders them now, and keeping a string that
 * nothing displays is how a codebase accumulates lies.
 */
export interface PickerInput {
  /** The registry, narrowed by instance ∩ stage ∩ workspace scope. */
  apps: readonly AppDescriptor[];
  /** The descriptor for this tile's application, or null if unknown. */
  own: AppDescriptor | null;
  /** The application id this tile currently holds. */
  ownApp: string;
  /** Application ids held by OTHER tiles in this workspace. */
  elsewhere: ReadonlySet<string>;
  /**
   * May this application not be chosen here, for a reason other than scope?
   *
   * A boolean rather than a reason string: the caller has nowhere to render a
   * reason any more. Kept as a hook rather than folded into `apps` because the
   * remaining rule — a singleton already open — depends on the *other tiles in
   * this workspace* rather than on the scope, and computing it needs the tree.
   */
  unavailable?(id: string): boolean;
}

export function pickerOptions({
  apps,
  own,
  ownApp,
  elsewhere,
  unavailable,
}: PickerInput): SelectOption[] {
  const listed = apps.some((app) => app.id === ownApp) ? apps : [...(own ? [own] : []), ...apps];

  return listed.flatMap((app) => {
    // Rule 1, and it comes first for a reason: the tile's own application is
    // listed and enabled even when every rule below would remove it.
    if (app.id === ownApp) return [{ value: app.id, label: app.title }];
    if (app.singleton && elsewhere.has(app.id)) return [];
    if (unavailable?.(app.id)) return [];
    return [{ value: app.id, label: app.title }];
  });
}
