import type { AcceptanceOption, AcceptanceResolution } from "../acceptance/types";
import type { AcceptRequest, PresentationReference, PresentationValues } from "../types";

/*
 * The accept flow as a pure state machine (PBUI-KERNEL-4 P2; KERNEL-1 guide
 * §14.5). Before: a `useState` for the request, a `useState` for the
 * chooser's options, and a `useRef` holding the promise's resolver, with
 * the policy spread over four callbacks. Now: one state value carrying the
 * REQUEST ID, one step function, and effects the Provider executes. The
 * promise the product awaits is settled by an effect that names the
 * request it settles, so a stale settle cannot resolve the wrong promise.
 *
 * Invariants (fuzzed in accept.test.ts):
 *   - at most one request is pending; a second is refused with
 *     `resolve-null` for ITS id and the first is untouched;
 *   - the chooser exists only under a pending request;
 *   - each accepted request emits exactly one terminal effect (`settle` or
 *     `resolve-null`), and the machine is idle afterwards;
 *   - Escape on the chooser dismisses the choices and keeps the request;
 *     Escape on a pending request aborts it.
 *
 * Components dispatch events and execute effects; no policy lives in them.
 */

export type AcceptState<Values extends PresentationValues> =
  | { readonly kind: "idle" }
  | { readonly kind: "pending"; readonly requestId: number; readonly request: AcceptRequest<Values> }
  | {
      readonly kind: "choosing";
      readonly requestId: number;
      readonly request: AcceptRequest<Values>;
      readonly options: readonly AcceptanceOption<Values>[];
    };

export type AcceptEvent<Values extends PresentationValues> =
  /** A product asked for an object. The id is minted by the caller (the promise is keyed by it). */
  | { readonly type: "request"; readonly requestId: number; readonly request: AcceptRequest<Values> }
  /** The user clicked a reference; the caller resolved it against the pending request. */
  | { readonly type: "offer"; readonly reference: PresentationReference<Values>; readonly resolution: AcceptanceResolution<Values> }
  /** The user picked one of the chooser's options. */
  | { readonly type: "choose"; readonly option: AcceptanceOption<Values> }
  /** Escape, routed by whichever surface owns it: the chooser or the banner. */
  | { readonly type: "escape" }
  /** The chooser's dismiss (click-away, close button). */
  | { readonly type: "dismiss-chooser" }
  /** An explicit abort (`pbui.abortAccept()`). */
  | { readonly type: "abort" };

export type AcceptEffect<Values extends PresentationValues> =
  | { readonly kind: "close-menu" }
  | { readonly kind: "settle"; readonly requestId: number; readonly reference: PresentationReference<Values> }
  /** `refused`: a second request while one is pending (the product's `onAccept` is not told); `aborted`: the pending request ended without an object. */
  | { readonly kind: "resolve-null"; readonly requestId: number; readonly reason: "refused" | "aborted" };

export interface AcceptStepResult<Values extends PresentationValues> {
  readonly state: AcceptState<Values>;
  readonly effects: readonly AcceptEffect<Values>[];
}

export const IDLE: AcceptState<never> = { kind: "idle" };

const same = <Values extends PresentationValues>(state: AcceptState<Values>): AcceptStepResult<Values> => ({ state, effects: [] });

export function acceptStep<Values extends PresentationValues>(
  state: AcceptState<Values>,
  event: AcceptEvent<Values>,
): AcceptStepResult<Values> {
  switch (event.type) {
    case "request":
      if (state.kind !== "idle") {
        // A second request is refused for ITS id; the first is not disturbed.
        return { state, effects: [{ kind: "resolve-null", requestId: event.requestId, reason: "refused" }] };
      }
      return { state: { kind: "pending", requestId: event.requestId, request: event.request }, effects: [{ kind: "close-menu" }] };

    case "offer": {
      if (state.kind === "idle") return same(state);
      const { requestId, request } = state;
      switch (event.resolution.kind) {
        case "accepted":
          return { state: { kind: "idle" }, effects: [{ kind: "settle", requestId, reference: event.resolution.option.result }] };
        case "ambiguous":
          // A tie is the user's choice, never registration order: the request stays pending until they pick or abort.
          return same({ kind: "choosing", requestId, request, options: event.resolution.options });
        case "none":
          return same(state);
      }
      return same(state);
    }

    case "choose":
      if (state.kind !== "choosing") return same(state);
      return { state: { kind: "idle" }, effects: [{ kind: "settle", requestId: state.requestId, reference: event.option.result }] };

    case "dismiss-chooser":
      if (state.kind !== "choosing") return same(state);
      return same({ kind: "pending", requestId: state.requestId, request: state.request });

    case "escape":
      if (state.kind === "choosing") return same({ kind: "pending", requestId: state.requestId, request: state.request });
      if (state.kind === "pending") return { state: { kind: "idle" }, effects: [{ kind: "resolve-null", requestId: state.requestId, reason: "aborted" }] };
      return same(state);

    case "abort":
      if (state.kind === "idle") return same(state);
      return { state: { kind: "idle" }, effects: [{ kind: "resolve-null", requestId: state.requestId, reason: "aborted" }] };
  }
}

/** The request a state carries, for the banner and for `isAcceptable`. */
export function pendingRequest<Values extends PresentationValues>(state: AcceptState<Values>): AcceptRequest<Values> | null {
  return state.kind === "idle" ? null : state.request;
}

/** The chooser's options, when open. */
export function chooserOptions<Values extends PresentationValues>(state: AcceptState<Values>): readonly AcceptanceOption<Values>[] | null {
  return state.kind === "choosing" ? state.options : null;
}
