import { startTileCarry } from "@hyperslop-systems/pbui";
import type { PlaceZone } from "./verbs";

/** Where the user aimed: a tile, and which part of it. */
export interface PlacementAim {
  placementId: string;
  zone: PlaceZone;
}

/**
 * How an aiming session ended. Three outcomes rather than a nullable aim,
 * because "the user pressed Enter" and "the user pressed Escape" are
 * different answers and a caller that conflates them either places nothing
 * when asked to, or places something when told not to.
 */
export type PlacementOutcome =
  | ({ kind: "aimed" } & PlacementAim)
  | { kind: "default" }
  | { kind: "cancelled" };

export interface PlacementRequest {
  /** The banner line: what is being placed, in the product's own words. */
  prompt: string;
  /**
   * What Enter would do, named for the banner ("beside “goals”"). Omitted,
   * Enter is inert and the outcome can only be `aimed` or `cancelled`.
   */
  defaultLabel?: string;
  /**
   * The overlay wording for ONE tile and ONE zone, replacing the shell's
   * generic "place beside · splits the longer side". turboproof's labels are
   * the model: "open Basic.lean in this editor" reads differently on the
   * editor pane and on the goals pane, and the difference is the point of
   * naming the outcome before the click.
   */
  labelFor?(placementId: string, zone: PlaceZone): string | undefined;
  /** Offer Alt = replace; default true. */
  allowReplace?: boolean;
  /**
   * Vet an aim before the session ends. Returning false REFUSES it and
   * re-arms, so a target that cannot take the tile (a sliver, a pane the
   * product protects) leaves the user still aiming rather than dropped back
   * into a workspace with nothing placed.
   */
  accept?(aim: PlacementAim): boolean;
}

/** What a renderer needs to draw the banner; null when nothing is being placed. */
export type ActivePlacement = Pick<PlacementRequest, "prompt" | "defaultLabel" | "labelFor"> | null;

export interface PlacementController {
  /**
   * Arm placement mode and resolve where the user aimed. The controller
   * performs NOTHING: the caller decides what an aim means, which is what
   * lets one mode serve "place this application", "open this document here"
   * and any product gesture that needs a pane.
   */
  begin(request: PlacementRequest): Promise<PlacementOutcome>;
  /** End any active session as `cancelled`. Idempotent. */
  cancel(): void;
  current(): ActivePlacement;
  subscribe(listener: () => void): () => void;
}

/**
 * Placement mode (PBUI-WORKBENCH-2 §5.E), generalised out of the launcher.
 *
 * The mechanics live in pbui's `startTileCarry` — the capture-phase pointer
 * interception, the hit test, Alt, Escape, the overlays it paints through the
 * shared drag store. What this adds is the part a product needs: a promise it
 * can await, a banner it can word, per-tile labels, and the right to refuse
 * an aim without ending the mode.
 */
export function createPlacementController(): PlacementController {
  let active: ActivePlacement = null;
  let resolveCurrent: ((outcome: PlacementOutcome) => void) | null = null;
  let stopCarry: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  const finish = (outcome: PlacementOutcome) => {
    const resolve = resolveCurrent;
    if (!resolve) return;
    resolveCurrent = null;
    stopCarry = null;
    active = null;
    emit();
    resolve(outcome);
  };

  const cancel = () => {
    if (!resolveCurrent) return;
    const stop = stopCarry;
    stopCarry = null;
    // The carry's own cancel path removes its listeners and calls back into
    // `finish`; calling `finish` again below is then a no-op, and covers the
    // case of a carry already torn down (a blur, an unmount) whose promise
    // would otherwise never settle.
    stop?.();
    finish({ kind: "cancelled" });
  };

  const arm = (request: PlacementRequest) => {
    stopCarry = startTileCarry({
      allowReplace: request.allowReplace ?? true,
      onDrop: (placementId, zone) => {
        const aim: PlacementAim = { placementId, zone };
        // Refused: the mode survives so the user can aim elsewhere, rather
        // than being dropped back into a workspace with nothing placed.
        if (request.accept && !request.accept(aim)) {
          arm(request);
          return;
        }
        finish({ kind: "aimed", ...aim });
      },
      ...(request.defaultLabel !== undefined ? { onDefault: () => finish({ kind: "default" }) } : {}),
      onCancel: () => finish({ kind: "cancelled" }),
    });
  };

  return {
    begin(request) {
      // Two things aimed at once has no coherent meaning on one pointer, so
      // a second begin cancels the first — the rule startTileCarry follows.
      cancel();
      active = {
        prompt: request.prompt,
        ...(request.defaultLabel !== undefined ? { defaultLabel: request.defaultLabel } : {}),
        ...(request.labelFor ? { labelFor: request.labelFor } : {}),
      };
      const promise = new Promise<PlacementOutcome>((resolve) => {
        resolveCurrent = resolve;
      });
      emit();
      arm(request);
      return promise;
    },
    cancel,
    current: () => active,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
