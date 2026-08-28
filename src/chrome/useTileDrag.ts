/**
 * Drag a tile onto another to swap applications or dock beside it
 * (PBUI-UNIFY-001, DR-U3/DR-U4 — extracted from datalab-ui's
 * `organisms/Tile/useDrag.ts`, decoupled from any store: the hook owns the
 * registry, the hit test, and the zone classification, and reports outcomes
 * through callbacks).
 *
 * The registry of tile elements is module-level rather than React state: the
 * hit test runs on every pointer move and needs a synchronous read, and a
 * dragged tile must be able to see tiles it is not a descendant of.
 *
 * `isConnected` is checked at hit-test time because a closed tile leaves its
 * entry behind, and a phantom drop target is a memorably confusing bug —
 * pbui-gog.jsx:2530-2531 does the same for the same reason.
 *
 * A drag has exactly one exit (`finish`), and only a real `pointerup` commits
 * it. Pointer capture, `pointercancel`, window blur, and unmount all route to
 * the same teardown, because a drag that survives its release is worse than a
 * drag that ends early: the next click completes it.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type DockZone = "left" | "right" | "top" | "bottom";
/**
 * "replace" is the Alt-held drop (PBUI-REBALANCE-1): the dragged application
 * takes over the WHOLE target tile — the target's content is replaced and the
 * source tile closes. It covers the full rectangle regardless of where the
 * pointer sits, and only exists while the consumer supplies `onReplace`.
 */
export type DragZone = DockZone | "center" | "replace";

const TILES = new Map<string, HTMLElement>();

/**
 * The `from` id of a CARRY — placement mode (PBUI-REBALANCE-1): something not
 * yet on screen (a launcher choice) is being aimed at the tiles. It reuses
 * the drag state so every tile's overlay machinery works unchanged, and it
 * can never collide with a placement id (NUL is not valid in one).
 */
const CARRY_ID = "\u0000carry";

interface DragState {
  from: string;
  over: string | null;
  zone: DragZone | null;
}

let listeners: Array<(state: DragState | null) => void> = [];
let dragState: DragState | null = null;

function setDrag(next: DragState | null) {
  dragState = next;
  for (const listener of listeners) listener(next);
}

/**
 * Which part of a tile the pointer is over (DR-U4: the family unifies on this
 * banded geometry, replacing the fixed 25 % quarters two products carried).
 *
 * The band is 30 % of the smaller dimension, capped at 110px, so a large tile
 * still has a generous centre and a small one still has reachable edges.
 * Ported from pbui-gog.jsx:2523-2528.
 */
export function zoneFor(box: DOMRect, x: number, y: number): DragZone {
  const left = x - box.left;
  const right = box.right - x;
  const top = y - box.top;
  const bottom = box.bottom - y;
  const band = Math.min(Math.min(box.width, box.height) * 0.3, 110);
  const nearest = Math.min(left, right, top, bottom);
  if (nearest > band) return "center";
  if (nearest === left) return "left";
  if (nearest === right) return "right";
  if (nearest === top) return "top";
  return "bottom";
}

function hitTest(x: number, y: number): { id: string; zone: DragZone } | null {
  for (const [id, element] of TILES) {
    if (!element.isConnected) {
      TILES.delete(id);
      continue;
    }
    const box = element.getBoundingClientRect();
    if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
      return { id, zone: zoneFor(box, x, y) };
    }
  }
  return null;
}

/** Exposed for tests: the registry must not leak disconnected elements. */
export function registeredTileCount(): number {
  return TILES.size;
}

export interface TileCarryOptions {
  /** A click landed on a tile; `zone` is where (Alt held → "replace"). */
  onDrop(targetId: string, zone: DragZone): void;
  /** Escape, a click outside every tile, or a second carry starting. */
  onCancel(): void;
  /** Enter pressed: commit to the caller's default spot. Omit to make Enter inert. */
  onDefault?(): void;
  /** Offer the Alt = replace classification; default true. */
  allowReplace?: boolean;
}

let activeCarryCancel: (() => void) | null = null;

/**
 * Placement mode: aim something new at the existing tiles (PBUI-REBALANCE-1).
 *
 * Where a drag starts from a tile and follows a held pointer, a carry starts
 * from a CHOICE (the launcher's) and follows a free-moving pointer: tiles
 * show the same drop-zone overlays, Alt switches to replace exactly as in a
 * drag, and the next pointerdown commits. The pointerdown is intercepted in
 * the CAPTURE phase so the click never reaches the application under it —
 * the workspace is inert while a placement is being aimed.
 *
 * Returns a cancel function (idempotent); starting a second carry cancels the
 * first.
 */
export function startTileCarry(options: TileCarryOptions): () => void {
  activeCarryCancel?.();
  const allowReplace = options.allowReplace ?? true;
  let lastPoint: { x: number; y: number } | null = null;
  let altHeld = false;
  let finished = false;

  const classify = (): { id: string; zone: DragZone } | null => {
    const hit = lastPoint ? hitTest(lastPoint.x, lastPoint.y) : null;
    if (!hit) return null;
    return { id: hit.id, zone: altHeld && allowReplace ? "replace" : hit.zone };
  };
  const publish = () => {
    const hit = classify();
    setDrag({ from: CARRY_ID, over: hit?.id ?? null, zone: hit?.zone ?? null });
  };

  const finish = (outcome: { drop?: { id: string; zone: DragZone }; byDefault?: boolean } | null) => {
    if (finished) return;
    finished = true;
    if (activeCarryCancel === cancel) activeCarryCancel = null;
    setDrag(null);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerdown", down, true);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("keyup", key, true);
    window.removeEventListener("blur", onBlur);
    if (outcome?.drop) options.onDrop(outcome.drop.id, outcome.drop.zone);
    else if (outcome?.byDefault) options.onDefault?.();
    else options.onCancel();
  };
  const cancel = () => finish(null);

  const move = (event: PointerEvent) => {
    lastPoint = { x: event.clientX, y: event.clientY };
    altHeld = event.altKey;
    publish();
  };
  const down = (event: PointerEvent) => {
    // Capture phase: the aiming click must never reach the tile's content.
    event.preventDefault();
    event.stopPropagation();
    lastPoint = { x: event.clientX, y: event.clientY };
    altHeld = event.altKey;
    const hit = classify();
    finish(hit ? { drop: hit } : null); // clicking empty space cancels
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === "Alt") {
      event.preventDefault();
      altHeld = event.type === "keydown";
      publish();
      return;
    }
    if (event.type !== "keydown") return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    } else if (event.key === "Enter" && options.onDefault) {
      event.preventDefault();
      finish({ byDefault: true });
    }
  };
  const onBlur = () => cancel();

  setDrag({ from: CARRY_ID, over: null, zone: null });
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerdown", down, true);
  window.addEventListener("keydown", key, true);
  window.addEventListener("keyup", key, true);
  window.addEventListener("blur", onBlur);
  activeCarryCancel = cancel;
  return cancel;
}

export interface UseTileDragOptions {
  /** This tile's placement id; also the registry key. */
  id: string;
  /** The pointer released on another tile's centre. */
  onSwap(sourceId: string, targetId: string): void;
  /** The pointer released near another tile's edge. */
  onDock(sourceId: string, targetId: string, zone: DockZone): void;
  /**
   * The pointer released anywhere on another tile with Alt held: the source
   * fully replaces the target. Omitting it disables the Alt mode entirely —
   * Alt-drops then classify like plain drops.
   */
  onReplace?(sourceId: string, targetId: string): void;
}

export function useTileDrag({ id, onSwap, onDock, onReplace }: UseTileDragOptions): {
  /** Attach to the tile's root element (ref callback). */
  register(element: HTMLElement | null): void;
  /** Attach to the grip's onPointerDown. */
  onGripPointerDown(event: React.PointerEvent): void;
  /** True on the tile being dragged. */
  dragging: boolean;
  /** Non-null on the tile currently targeted, naming the zone. */
  zone: DragZone | null;
  /** A CARRY (placement mode) is active — overlays mean "place", not "move". */
  carrying: boolean;
} {
  const [state, setState] = useState<DragState | null>(dragState);
  /** Set while a drag from THIS tile is live; called with commit=false to abandon. */
  const teardown = useRef<((commit: boolean) => void) | null>(null);

  useEffect(() => {
    const listener = (next: DragState | null) => setState(next);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((entry) => entry !== listener);
    };
  }, []);

  // A tile can be closed (or the whole workbench unmounted) mid-drag; the
  // window listeners and the userSelect override would outlive it.
  useEffect(() => () => teardown.current?.(false), []);

  const register = useCallback(
    (element: HTMLElement | null) => {
      if (element) TILES.set(id, element);
      else TILES.delete(id);
    },
    [id],
  );

  const onGripPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      // Only one drag at a time; a second grip press abandons the first rather
      // than leaving two sets of window listeners racing over `dragState`.
      teardown.current?.(false);

      const previous = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      setDrag({ from: id, over: null, zone: null });

      // Pointer capture is what makes a release OUTSIDE the browser window
      // still deliver `pointerup` here. Without it the drag stays armed, the
      // userSelect override sticks, and a later click completes a stale
      // swap/dock. Capture can throw for a stale pointerId and is absent under
      // jsdom, so it is best-effort — `pointercancel` and the window blur
      // below are the belt to its braces.
      const grip = event.currentTarget as HTMLElement | null;
      const pointerId = event.pointerId;
      try {
        grip?.setPointerCapture?.(pointerId);
      } catch {
        /* capture is an optimisation, not a precondition */
      }

      // Alt can change mid-drag without the pointer moving, so the last
      // position is kept and reclassified on both pointer moves and Alt
      // keydown/keyup. The pointer event's own altKey keeps the two sources
      // agreeing when a move and a key change race.
      let lastPoint: { x: number; y: number } | null = null;
      let altHeld = false;
      const classify = () => {
        const hit = lastPoint ? hitTest(lastPoint.x, lastPoint.y) : null;
        const over = hit && hit.id !== id ? hit.id : null;
        const zone: DragZone | null = over ? (altHeld && onReplace ? "replace" : (hit as { zone: DragZone }).zone) : null;
        setDrag({ from: id, over, zone });
      };
      const move = (moveEvent: PointerEvent) => {
        lastPoint = { x: moveEvent.clientX, y: moveEvent.clientY };
        altHeld = moveEvent.altKey;
        classify();
      };
      const altChange = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== "Alt") return;
        // Keep the browser from moving focus to its menu bar mid-drag.
        keyEvent.preventDefault();
        altHeld = keyEvent.type === "keydown";
        classify();
      };

      /**
       * The single exit. `commit` is true only for a real `pointerup`:
       * cancellation, window blur, and unmount all end the drag WITHOUT
       * performing a swap or a dock.
       */
      const finish = (commit: boolean) => {
        if (teardown.current !== finish) return;
        teardown.current = null;
        document.body.style.userSelect = previous;
        const current = dragState;
        setDrag(null);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("blur", cancel);
        window.removeEventListener("keydown", altChange);
        window.removeEventListener("keyup", altChange);
        try {
          grip?.releasePointerCapture?.(pointerId);
        } catch {
          /* already released with the capture */
        }

        if (!commit) return;
        if (!current?.over || !current.zone) return;
        if (current.zone === "replace") onReplace?.(current.from, current.over);
        else if (current.zone === "center") onSwap(current.from, current.over);
        else onDock(current.from, current.over, current.zone);
      };
      const up = () => finish(true);
      const cancel = () => finish(false);

      teardown.current = finish;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("blur", cancel);
      window.addEventListener("keydown", altChange);
      window.addEventListener("keyup", altChange);
    },
    [id, onSwap, onDock, onReplace],
  );

  return {
    register,
    onGripPointerDown,
    dragging: state?.from === id,
    zone: state?.over === id ? state.zone : null,
    carrying: state?.from === CARRY_ID,
  };
}
