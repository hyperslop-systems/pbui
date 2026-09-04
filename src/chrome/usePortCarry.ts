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
  /** Control (or Meta on Apple): the toy's "Alias" modifier — identity instead of follow. */
  ctrl: boolean;
}

export type PortAnchorSide = "in" | "out";

/*
 * Every mounted element per port and side. A view shown in two tiles mounts
 * its ports twice; keeping one element per port meant the last registration
 * won and a wire could anchor to whichever tile registered last — or to an
 * element that had since unmounted (PBUI-WIRING-1 P1).
 */
type PortAnchors = Partial<Record<PortAnchorSide, Set<HTMLElement>>>;
const PORTS = new Map<string, PortAnchors>();
let state: PortCarryState | null = null;
const listeners = new Set<() => void>();

function setState(next: PortCarryState | null): void {
  state = next;
  for (const listener of listeners) listener();
}

/** Register one visual side of a rail port; an inout port owns two independent anchors. */
export function registerPort(id: string, side: PortAnchorSide, element: HTMLElement | null): void {
  const anchors = PORTS.get(id) ?? {};
  if (element) {
    (anchors[side] ??= new Set()).add(element);
    PORTS.set(id, anchors);
    return;
  }
  // A ref callback with null carries no element: drop whatever left the
  // document on this side; if nothing did, the side is gone as a whole.
  const set = anchors[side];
  if (set) {
    let pruned = false;
    for (const candidate of set) {
      if (candidate.isConnected) continue;
      set.delete(candidate);
      pruned = true;
    }
    if (!pruned) set.clear();
    if (set.size === 0) delete anchors[side];
  }
  if (anchors.in?.size || anchors.out?.size) PORTS.set(id, anchors);
  else PORTS.delete(id);
}

/** Every mounted element for a port and side, in registration order. */
export function portElements(id: string, side: PortAnchorSide): readonly HTMLElement[] {
  const set = PORTS.get(id)?.[side];
  return set ? [...set] : [];
}

/** The first mounted element for a port and side, or null. */
export function portElement(id: string, side: PortAnchorSide): HTMLElement | null {
  return portElements(id, side)[0] ?? null;
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
  /** May `from` be dropped on this port with these modifiers? Re-asked on every move; the answer is shown, not assumed. */
  acceptable(target: string, modifiers: { shift: boolean; ctrl: boolean }): boolean;
  onDrop(target: string, modifiers: { shift: boolean; ctrl: boolean }): void;
  onCancel(): void;
}

let activeCancel: (() => void) | null = null;

export function startPortCarry(options: PortCarryOptions): () => void {
  activeCancel?.();
  let finished = false;
  let last: PortCarryState = { from: options.from, over: null, acceptable: false, x: options.origin.x, y: options.origin.y, shift: false, ctrl: false };

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
    if (drop) options.onDrop(drop, { shift: last.shift, ctrl: last.ctrl });
    else options.onCancel();
  };
  const cancel = () => finish(null);

  // Pointer events report the modifier live; an event without one (a synthetic
  // Event under jsdom) leaves the keyboard's last word standing.
  const shiftOf = (event: PointerEvent) => (typeof event.shiftKey === "boolean" ? event.shiftKey : last.shift);
  const ctrlOf = (event: PointerEvent) => (typeof event.ctrlKey === "boolean" ? event.ctrlKey || event.metaKey : last.ctrl);
  const move = (event: PointerEvent) => {
    publish({ shift: shiftOf(event), ctrl: ctrlOf(event) });
    const over = hitTest(event.target, event.clientX, event.clientY);
    const acceptable = over !== null && over !== options.from && options.acceptable(over, { shift: last.shift, ctrl: last.ctrl });
    publish({ over, acceptable, x: event.clientX, y: event.clientY });
  };
  const up = (event: PointerEvent) => {
    const over = hitTest(event.target, event.clientX, event.clientY) ?? last.over;
    publish({ shift: shiftOf(event), ctrl: ctrlOf(event) });
    finish(over && over !== options.from && options.acceptable(over, { shift: last.shift, ctrl: last.ctrl }) ? over : null);
  };
  const onCancelEvent = () => cancel();
  const key = (event: KeyboardEvent) => {
    if (event.key === "Shift") {
      publish({ shift: event.type === "keydown" });
      return;
    }
    if (event.key === "Control" || event.key === "Meta") {
      publish({ ctrl: event.type === "keydown" });
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
