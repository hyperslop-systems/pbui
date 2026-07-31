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
 */
import { useCallback, useEffect, useState } from "react";

export type DockZone = "left" | "right" | "top" | "bottom";
export type DragZone = DockZone | "center";

const TILES = new Map<string, HTMLElement>();

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

export interface UseTileDragOptions {
  /** This tile's placement id; also the registry key. */
  id: string;
  /** The pointer released on another tile's centre. */
  onSwap(sourceId: string, targetId: string): void;
  /** The pointer released near another tile's edge. */
  onDock(sourceId: string, targetId: string, zone: DockZone): void;
}

export function useTileDrag({ id, onSwap, onDock }: UseTileDragOptions): {
  /** Attach to the tile's root element (ref callback). */
  register(element: HTMLElement | null): void;
  /** Attach to the grip's onPointerDown. */
  onGripPointerDown(event: React.PointerEvent): void;
  /** True on the tile being dragged. */
  dragging: boolean;
  /** Non-null on the tile currently targeted, naming the zone. */
  zone: DragZone | null;
} {
  const [state, setState] = useState<DragState | null>(dragState);

  useEffect(() => {
    const listener = (next: DragState | null) => setState(next);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((entry) => entry !== listener);
    };
  }, []);

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
      const previous = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      setDrag({ from: id, over: null, zone: null });

      const move = (moveEvent: PointerEvent) => {
        const hit = hitTest(moveEvent.clientX, moveEvent.clientY);
        setDrag({
          from: id,
          over: hit && hit.id !== id ? hit.id : null,
          zone: hit && hit.id !== id ? hit.zone : null,
        });
      };

      const up = () => {
        document.body.style.userSelect = previous;
        const current = dragState;
        setDrag(null);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);

        if (!current?.over || !current.zone) return;
        if (current.zone === "center") onSwap(current.from, current.over);
        else onDock(current.from, current.over, current.zone);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [id, onSwap, onDock],
  );

  return {
    register,
    onGripPointerDown,
    dragging: state?.from === id,
    zone: state?.over === id ? state.zone : null,
  };
}
