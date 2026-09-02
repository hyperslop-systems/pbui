import { useSyncExternalStore } from "react";

/**
 * Port-to-port drag for connect-management mode (PBUI-LINK-1 Phase 3).
 *
 * The lifecycle is the tile carry's (`startTileCarry`): one exit (`finish`),
 * Escape, window blur and a second carry all cancel, and the modifier is read
 * LIVE from every pointer and key event — never only at the start — so a
 * Shift released mid-drag switches the cursor badge from Hold to Follow
 * before the release (audit §10.2). What differs is the target: a registry
 * of PORT elements rather than tiles, hit-tested by the element under the
 * pointer (`event.target`, or `elementFromPoint` when the pointer is over
 * the wire overlay), so the same code runs under jsdom.
 *
 * Document-model-agnostic like the rest of the chrome: it knows port ids
 * and elements, never what a port is bound to. Acceptability is the caller's
 * predicate — the workbench answers it with the link kernel's `planFollow`.
 */

export interface PortCarryState {
  from: string;
  over: string | null;
  acceptable: boolean;
  x: number;
  y: number;
  shift: boolean;
}

const PORTS = new Map<string, HTMLElement>();
let state: PortCarryState | null = null;
const listeners = new Set<() => void>();

function setState(next: PortCarryState | null): void {
  state = next;
  for (const listener of listeners) listener();
}

/** Register a rail's port element; a ref callback. */
export function registerPort(id: string, element: HTMLElement | null): void {
  if (element) PORTS.set(id, element);
  else PORTS.delete(id);
}

export function portElement(id: string): HTMLElement | null {
  return PORTS.get(id) ?? null;
}

export function registeredPorts(): readonly string[] {
  return [...PORTS.keys()];
}

/** The port id under an element, if it is (inside) a registered port. */
export function portIdOf(target: EventTarget | null): string | null {
  const element = target instanceof Element ? target.closest<HTMLElement>("[data-port-id]") : null;
  return element?.dataset["portId"] ?? null;
}

function hitTest(target: EventTarget | null, x: number, y: number): string | null {
  const direct = portIdOf(target);
  if (direct) return direct;
  if (typeof document !== "undefined" && typeof document.elementFromPoint === "function") {
    return portIdOf(document.elementFromPoint(x, y));
  }
  return null;
}

export interface PortCarryOptions {
  from: string;
  origin: { x: number; y: number };
  /** May `from` be dropped on this port? Re-asked on every move; the answer is shown, not assumed. */
  acceptable(target: string): boolean;
  onDrop(target: string, modifiers: { shift: boolean }): void;
  onCancel(): void;
}

let activeCancel: (() => void) | null = null;

export function startPortCarry(options: PortCarryOptions): () => void {
  activeCancel?.();
  let finished = false;
  let last: PortCarryState = { from: options.from, over: null, acceptable: false, x: options.origin.x, y: options.origin.y, shift: false };

  const publish = (patch: Partial<PortCarryState>) => {
    last = { ...last, ...patch };
    setState(last);
  };

  const finish = (drop: string | null) => {
    if (finished) return;
    finished = true;
    if (activeCancel === cancel) activeCancel = null;
    setState(null);
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", onCancelEvent, true);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("keyup", key, true);
    window.removeEventListener("blur", onBlur);
    if (drop) options.onDrop(drop, { shift: last.shift });
    else options.onCancel();
  };
  const cancel = () => finish(null);

  // Pointer events report the modifier live; an event without one (a synthetic
  // Event under jsdom) leaves the keyboard's last word standing.
  const shiftOf = (event: PointerEvent) => (typeof event.shiftKey === "boolean" ? event.shiftKey : last.shift);
  const move = (event: PointerEvent) => {
    const over = hitTest(event.target, event.clientX, event.clientY);
    const acceptable = over !== null && over !== options.from && options.acceptable(over);
    publish({ over, acceptable, x: event.clientX, y: event.clientY, shift: shiftOf(event) });
  };
  const up = (event: PointerEvent) => {
    const over = hitTest(event.target, event.clientX, event.clientY) ?? last.over;
    publish({ shift: shiftOf(event) });
    finish(over && over !== options.from && options.acceptable(over) ? over : null);
  };
  const onCancelEvent = () => cancel();
  const key = (event: KeyboardEvent) => {
    if (event.key === "Shift") {
      publish({ shift: event.type === "keydown" });
      return;
    }
    if (event.type === "keydown" && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
  };
  const onBlur = () => cancel();

  setState(last);
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", onCancelEvent, true);
  window.addEventListener("keydown", key, true);
  window.addEventListener("keyup", key, true);
  window.addEventListener("blur", onBlur);
  activeCancel = cancel;
  return cancel;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getState = () => state;
const getServerState = () => null;

/** The carry in flight, or null. */
export function usePortCarry(): PortCarryState | null {
  return useSyncExternalStore(subscribe, getState, getServerState);
}

/** Test seam. */
export function resetPortCarry(): void {
  activeCancel?.();
  PORTS.clear();
  setState(null);
}
