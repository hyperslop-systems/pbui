import type { ResolvedAction } from "../actions/types";
import type { PresentationValues } from "../types";

/*
 * The click ladder as one pure function (PBUI-KERNEL-4 P1; KERNEL-1 guide
 * §14.4). A left click or an Enter/Space on a presentation does exactly one
 * of four things, decided in one order:
 *
 *   attempt-accept    an accept request is pending and this object fits it
 *                     (or fits it in several ways: the chooser opens). The
 *                     accept flow commits; nothing else may also fire.
 *   activate-host     the element carries an `activate`. Its `run` (if any)
 *                     runs, and the gesture BUBBLES so the host sees its own
 *                     click.
 *   perform-primary   the kernel resolves exactly one available primary
 *                     action. This element acts; the gesture stops here.
 *   open-menu         otherwise. Opening a menu is this element acting.
 *
 * The pointer handler and the keyboard handler used to each spell this
 * ladder; they now both ask this function and only differ in how they carry
 * out the outcome (a keyboard activate-host synthesises a bubbling click; a
 * keyboard open-menu anchors at the element's box). The primary resolution
 * is a thunk so it runs only when the ladder reaches it.
 */

export type ActivationOutcome<Values extends PresentationValues, Verb> =
  | { readonly kind: "attempt-accept" }
  | { readonly kind: "activate-host"; readonly bubble: true; readonly run: (() => void) | undefined }
  | { readonly kind: "perform-primary"; readonly action: ResolvedAction<Values, Verb> }
  | { readonly kind: "open-menu" };

export interface ActivationInput<Values extends PresentationValues, Verb> {
  /** `pbui.isAcceptable(reference)`: a pending request this object satisfies, directly or through a chooser. */
  readonly acceptable: boolean;
  /** The element's `activate` prop, if present; `run` may be absent when the host owns the click entirely. */
  readonly activate: { readonly run?: () => void } | null | undefined;
  /** The unique available primary action, resolved lazily; null for zero or several. */
  readonly primary: () => ResolvedAction<Values, Verb> | null;
}

export function activationOutcome<Values extends PresentationValues, Verb>(
  input: ActivationInput<Values, Verb>,
): ActivationOutcome<Values, Verb> {
  if (input.acceptable) return { kind: "attempt-accept" };
  if (input.activate) return { kind: "activate-host", bubble: true, run: input.activate.run };
  const action = input.primary();
  if (action) return { kind: "perform-primary", action };
  return { kind: "open-menu" };
}

/** Whether the outcome is this element acting (the gesture must stop) or the host's (it bubbles). */
export function stopsPropagation<Values extends PresentationValues, Verb>(outcome: ActivationOutcome<Values, Verb>): boolean {
  return outcome.kind !== "activate-host";
}
