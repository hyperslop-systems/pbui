/*
 * Refusal presentation (PBUI-KERNEL-4 P4). A displayed menu row is a
 * proposal; when the fresh resolution at click time no longer agrees, the
 * runtime refuses instead of performing (guide §14.3). KERNEL-1 made the
 * product's `onRefuse` handler REQUIRED so that a refusal could not vanish
 * by omission. This module gives the runtime its own presentation of a
 * refusal — one sentence a notice can show — so a product that has no
 * better place for it need not write a handler at all.
 */

export interface RefusalFacts {
  readonly code: string;
  readonly because?: string;
  /** The row's label as text, when it was a string. */
  readonly label?: string;
  /** The subject's label as text. */
  readonly subjectLabel?: string;
}

export interface RefusalPresentation {
  /** One sentence: what did not happen and why. */
  readonly headline: string;
  /** The product's reason, when the fresh status carried one. */
  readonly detail: string | null;
  /** What the user can do about it. */
  readonly hint: string;
}

const REOPEN = "open the menu again to see what applies now";

export function describeRefusal(facts: RefusalFacts): RefusalPresentation {
  const what = facts.label ? `“${facts.label}”` : "that action";
  const on = facts.subjectLabel ? ` on ${facts.subjectLabel}` : "";
  const detail = facts.because ?? null;
  switch (facts.code) {
    case "action-no-longer-available":
      return { headline: `${what} is no longer available${on}`, detail, hint: REOPEN };
    case "action-no-longer-resolves":
      return { headline: `${what} no longer applies${on}`, detail, hint: REOPEN };
    case "action-became-ambiguous":
      return { headline: `${what} now matches more than one rule${on}`, detail, hint: "open the menu to choose between them" };
    case "action-implementation-changed":
      return { headline: `${what} changed while the menu was open`, detail, hint: REOPEN };
    default:
      return { headline: `${what} was refused${on} (${facts.code})`, detail, hint: REOPEN };
  }
}
