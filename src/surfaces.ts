import { useEffect, useId, useSyncExternalStore } from "react";

/**
 * Which transient surface owns Escape.
 *
 * A dialog, an object menu, a pending accept and an expanded panel all want to
 * close on Escape, and every one of them ends up listening on `window` because
 * that is the only node guaranteed to see the key. Propagation cannot order
 * them: `stopPropagation` does not affect listeners on the node that calls it,
 * and `stopImmediatePropagation` suppresses only those registered afterwards,
 * which makes correctness a mount-order race between independent effects.
 *
 * So the order is stated explicitly. Surfaces push as they open, pop as they
 * close, and each one asks a single question — *am I on top?* A surface that is
 * not on top does nothing for that key press.
 *
 * ## Why this is module state and not a context
 *
 * Escape is delivered to the document, not to a subtree, and "topmost" is a
 * property of the whole page. A page holding two independent PBUI roots — the
 * case this library exists to support — can have a dialog open in one and an
 * expanded panel in the other, and the dialog must win because it is the thing
 * on top. A per-root context cannot see far enough to answer that; it would
 * give each root its own idea of "topmost" and both would act on one key.
 *
 * The cost is that this is global mutable state, which is why the whole surface
 * is four functions and a hook, and why it holds ids rather than elements or
 * callbacks: nothing here can retain a component or leak a closure.
 *
 * It is deliberately NOT a keyboard routing system, and must not grow into one.
 * It answers one question that four independent handlers are otherwise
 * answering by guessing.
 *
 * ## Two constraints, both tested in `surfaces.test.tsx`
 *
 * **One surface, one registration.** `Dialog` registers for itself; a component
 * that wraps a `Dialog` must not register again. Two entries for one surface
 * means the wrapper's lands above the Dialog's — child effects run before
 * parent effects — and the Dialog then believes it is not topmost and stops
 * closing on Escape.
 *
 * **Order is registration order, not DOM nesting.** For surfaces opened over
 * time by a click, which is every real case, those agree. Two surfaces mounted
 * in the SAME commit, one inside the other, do not: they register bottom-up, so
 * the outer one ends up on top. Ordering by DOM containment would fix it and is
 * a materially bigger mechanism than this is meant to be.
 */

let stack: string[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Mark a surface open. Idempotent.
 *
 * Idempotent because StrictMode double-invokes effects in development: a naive
 * push would seat one dialog twice, and the matching single pop would leave a
 * closed surface owning Escape for the rest of the session.
 */
export function pushEscapeSurface(id: string): void {
  if (stack.includes(id)) return;
  stack = [...stack, id];
  emit();
}

export function popEscapeSurface(id: string): void {
  if (!stack.includes(id)) return;
  stack = stack.filter((entry) => entry !== id);
  emit();
}

/** The surface that owns Escape, or null when none is open. */
export function topEscapeSurface(): string | null {
  return stack.length > 0 ? (stack[stack.length - 1] as string) : null;
}

/** How many surfaces are open. For "is anything modal on screen?" checks. */
export function escapeSurfaceCount(): number {
  return stack.length;
}

export function subscribeEscapeSurfaces(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Server rendering has no surfaces, and `useSyncExternalStore` requires a
// snapshot that does not allocate — both of these return primitives.
const serverTop = () => null;
const serverCount = () => 0;

/**
 * Register a surface while it is open, and report whether it owns Escape.
 *
 * @param open false while the surface is closed, so a component may call this
 *             unconditionally and register only while it is showing.
 * @param id   defaults to a `useId`, unique per component instance — so five
 *             embedded panels get five distinct surfaces rather than one that
 *             any of them can pop.
 */
export function useEscapeSurface(open: boolean, id?: string): boolean {
  const generated = useId();
  const surfaceId = id ?? generated;
  const top = useSyncExternalStore(subscribeEscapeSurfaces, topEscapeSurface, serverTop);

  useEffect(() => {
    if (!open) return;
    pushEscapeSurface(surfaceId);
    return () => popEscapeSurface(surfaceId);
  }, [open, surfaceId]);

  // While closed the surface is not on the stack, so it cannot own Escape even
  // for the one render before its effect runs.
  return open && top === surfaceId;
}

/** Whether any transient surface is open anywhere on the page. */
export function useAnyEscapeSurface(): boolean {
  return useSyncExternalStore(subscribeEscapeSurfaces, escapeSurfaceCount, serverCount) > 0;
}

/** Test seam: drop every registration. Never call this from application code. */
export function resetEscapeSurfaces(): void {
  stack = [];
  emit();
}
