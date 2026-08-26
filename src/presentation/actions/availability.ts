/**
 * The four availability states (PBUI-ACTIONS-2, source guide §10).
 *
 * The UI still renders three outcomes — enabled, disabled-with-reason,
 * absent — but the resolver needs four states because ABSENCE has two
 * different override meanings:
 *
 * - `inapplicable` leaves the competition entirely: a less-specific
 *   implementation of the same action MAY be selected instead. "Restore" on a
 *   live file is simply not relevant; it must not block a genuine fallback.
 * - `hidden` stays IN the competition: if the hidden rule wins its action
 *   partition, no row is shown AND less-specific fallbacks stay suppressed.
 *   A non-disclosed `secret-file.open` must not let generic `document.open`
 *   leak through.
 *
 * `unavailable` keeps the one-fact/one-reason contract of
 * `PresentationAction.disabledBecause`: present ⇔ unavailable, and the string
 * is why. An unavailable specific rule also suppresses generic fallback —
 * falling back to generic delete around a protected-file rule would bypass
 * the policy the reason states.
 */

export type Availability =
  | { kind: "available" }
  | { kind: "unavailable"; because: string; code?: string }
  | { kind: "inapplicable"; because: "not-relevant" | "not-applicable" }
  | { kind: "hidden"; because: "not-disclosed" | "policy" };

/** Every non-available state; the shape conditions fail with. */
export type Failure = Exclude<Availability, { kind: "available" }>;

const AVAILABLE: Availability = { kind: "available" };

export function available(): Availability {
  return AVAILABLE;
}

export function unavailable(because: string, code?: string): Failure {
  return code === undefined
    ? { kind: "unavailable", because }
    : { kind: "unavailable", because, code };
}

export function inapplicable(
  because: "not-relevant" | "not-applicable" = "not-relevant",
): Failure {
  return { kind: "inapplicable", because };
}

export function hidden(because: "not-disclosed" | "policy" = "not-disclosed"): Failure {
  return { kind: "hidden", because };
}
