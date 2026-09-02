import type { SelectionSnapshot } from "../actions/types";
import type { PresentationReference, PresentationValues } from "../types";
import type { HelpResolution } from "./types";

/**
 * The help surface state machine (PBUI-HELP-002).
 *
 * Four review rounds on PR #20 found the same defect five times: the card's
 * open/close/arm lifecycle lived implicitly across six event handlers, and
 * every unconsidered event interleaving was a bug. This module is that
 * lifecycle written down ONCE — the whole policy is `helpSurfaceStep`, a pure
 * transition function over a three-state surface plus one `menuOpen` input.
 * The React layer translates DOM facts into events and syncs effects to
 * state; it contains no policy (see the PBUI-HELP-002 intern guide §4 for
 * the transition table and §7 for the fuzz harness that holds the
 * invariants).
 *
 * Invariants (fuzz-tested in machine.test.ts):
 *   I1  menuOpen ⟹ surface is idle — the menu and the card never coexist,
 *       and an armed timer never survives a menu opening.
 *   I2  an open card's anchor is mounted and still attended (pointer on the
 *       anchor or the card; keyboard focus on the anchor).
 *   I3  armed ⟹ the pointer is resting on the anchor and no menu is open.
 *   I4  deps.resolve runs only inside `timer-fired` and keyboard `focus`
 *       transitions — laziness is structural, not a convention.
 *
 * Anchors are DOM elements used as OPAQUE IDENTITIES: the machine compares
 * them with `===` and never reads them. Platform quirks stay at the adapter
 * edge — a focus event arrives already stamped with `keyboard` (input
 * modality) and `restoring` (focus.ts's return mark), so the machine is
 * deterministic on its inputs.
 */

/* ------------------------------------------------------------------ state -- */

export interface HelpSurfaceOpenPayload<ProductFacts> {
  resolution: HelpResolution;
  snapshot: SelectionSnapshot<ProductFacts>;
}

export type HelpSurface<Values extends PresentationValues, ProductFacts> =
  | { kind: "idle" }
  | { kind: "armed"; anchor: Element; reference: PresentationReference<Values> }
  | {
      kind: "open";
      anchor: Element;
      reference: PresentationReference<Values>;
      trigger: "pointer" | "focus";
      resolution: HelpResolution;
      snapshot: SelectionSnapshot<ProductFacts>;
    };

export interface HelpSurfaceState<Values extends PresentationValues, ProductFacts> {
  /** Mirrors the object menu; the provider syncs it from `menu !== null`. */
  menuOpen: boolean;
  surface: HelpSurface<Values, ProductFacts>;
}

const IDLE = { kind: "idle" } as const;

export function initialHelpSurfaceState<
  Values extends PresentationValues,
  ProductFacts,
>(): HelpSurfaceState<Values, ProductFacts> {
  return { menuOpen: false, surface: IDLE };
}

/* ----------------------------------------------------------------- events -- */

export type HelpSurfaceEvent<Values extends PresentationValues> =
  | { type: "pointer-enter"; anchor: Element; reference: PresentationReference<Values> }
  | { type: "pointer-leave"; anchor: Element; into: "card" | "elsewhere" }
  | { type: "timer-fired"; anchor: Element }
  | {
      type: "focus";
      anchor: Element;
      reference: PresentationReference<Values>;
      keyboard: boolean;
      restoring: boolean;
    }
  | { type: "blur"; anchor: Element }
  | { type: "card-leave"; into: "anchor" | "elsewhere" }
  | { type: "menu-opened" }
  | { type: "menu-closed" }
  | { type: "unmounted"; anchor: Element }
  | { type: "escape" };

/* ------------------------------------------------------------------- deps -- */

export interface HelpSurfaceDeps<Values extends PresentationValues, ProductFacts> {
  /**
   * Lazy resolution, pure (registry + snapshot in, data out) — injected the
   * way `matchSelector` receives its predicate map. `null` means no rule
   * contributed: nothing opens.
   */
  resolve(
    reference: PresentationReference<Values>,
  ): HelpSurfaceOpenPayload<ProductFacts> | null;
}

/* ------------------------------------------------------------------- step -- */

export function helpSurfaceStep<Values extends PresentationValues, ProductFacts>(
  state: HelpSurfaceState<Values, ProductFacts>,
  event: HelpSurfaceEvent<Values>,
  deps: HelpSurfaceDeps<Values, ProductFacts>,
): HelpSurfaceState<Values, ProductFacts> {
  const { surface } = state;

  switch (event.type) {
    case "pointer-enter": {
      if (state.menuOpen) return state;
      // Returning from the card to its own anchor must not re-arm: the card
      // would close and flicker back after the delay.
      if (surface.kind === "open" && surface.anchor === event.anchor) return state;
      return {
        ...state,
        surface: { kind: "armed", anchor: event.anchor, reference: event.reference },
      };
    }

    case "pointer-leave": {
      if (surface.kind === "armed" && surface.anchor === event.anchor) {
        return { ...state, surface: IDLE };
      }
      if (
        surface.kind === "open" &&
        surface.anchor === event.anchor &&
        surface.trigger === "pointer" &&
        event.into === "elsewhere"
      ) {
        return { ...state, surface: IDLE };
      }
      return state;
    }

    case "timer-fired": {
      // menu-opened already disarmed; this guard is defense in depth so a
      // stray timeout can never violate I1.
      if (state.menuOpen) return surface.kind === "idle" ? state : { ...state, surface: IDLE };
      if (surface.kind !== "armed" || surface.anchor !== event.anchor) return state;
      const payload = deps.resolve(surface.reference);
      if (payload === null) return { ...state, surface: IDLE };
      return {
        ...state,
        surface: {
          kind: "open",
          anchor: surface.anchor,
          reference: surface.reference,
          trigger: "pointer",
          resolution: payload.resolution,
          snapshot: payload.snapshot,
        },
      };
    }

    case "focus": {
      // Only KEYBOARD focus that was ASKED FOR opens help: pointer-borne
      // focus has the hover path, and a restored focus (the menu handing
      // focus back on close) asked for nothing — both were review findings.
      if (state.menuOpen || !event.keyboard || event.restoring) return state;
      const payload = deps.resolve(event.reference);
      if (payload === null) {
        return surface.kind === "idle" ? state : { ...state, surface: IDLE };
      }
      return {
        ...state,
        surface: {
          kind: "open",
          anchor: event.anchor,
          reference: event.reference,
          trigger: "focus",
          resolution: payload.resolution,
          snapshot: payload.snapshot,
        },
      };
    }

    case "blur": {
      // A pointer arm survives blur: the pointer is still resting there.
      if (surface.kind === "open" && surface.anchor === event.anchor) {
        return { ...state, surface: IDLE };
      }
      return state;
    }

    case "card-leave": {
      if (surface.kind !== "open") return state;
      if (event.into === "anchor") return state;
      return { ...state, surface: IDLE };
    }

    case "menu-opened": {
      if (state.menuOpen && surface.kind === "idle") return state;
      // I1: the menu supersedes the card AND any pending arm — a timer that
      // outlived the menu opening was PR #20 round 4, finding 1.
      return { menuOpen: true, surface: IDLE };
    }

    case "menu-closed": {
      // I1 says the surface is already idle here; keep whatever it is
      // rather than asserting, so a hand-built state cannot corrupt further.
      if (!state.menuOpen) return state;
      return { ...state, menuOpen: false };
    }

    case "unmounted": {
      // A virtualized row drops with no leave and no blur; the card must
      // not linger anchored to a detached element (round 3, finding 3).
      if (surface.kind !== "idle" && surface.anchor === event.anchor) {
        return { ...state, surface: IDLE };
      }
      return state;
    }

    case "escape": {
      if (surface.kind === "idle") return state;
      return { ...state, surface: IDLE };
    }
  }
}
