import { useEffect, useId } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../store";
import { layoutActions, type SurfaceId, topSurface } from "../store/layout";

/**
 * Register an open transient surface, and answer whether it owns Escape.
 *
 * The workbench has several independent Escape handlers — the dialog, the
 * launcher modal, full-frame — and three of them are `window` listeners
 * registered from separate `useEffect`s. Propagation cannot order listeners on
 * one node: `stopPropagation` does not affect siblings on the same target, and
 * `stopImmediatePropagation` only suppresses those registered afterwards, which
 * makes correctness a mount-order race (DATALAB-VIEW-001 design-doc/02 §11.5).
 *
 * So each surface says it is open and asks one question. A handler that is not
 * on top does nothing for that key, and "topmost" has exactly one definition,
 * in `topSurface`.
 *
 * The id defaults to a `useId`, which is stable across the component's life and
 * unique per instance — a page with five embedded workbenches gets five
 * distinct full-frame surfaces rather than one that any of them can pop.
 *
 * @param open  false while the surface is closed, so a component may call this
 *              unconditionally and still register only when it is showing.
 * @returns whether this surface currently owns Escape.
 */
export function useTransientSurface(open: boolean, id?: SurfaceId): boolean {
  const generated = useId();
  const surfaceId = id ?? generated;
  const dispatch = useDispatch();
  const owns = useSelector((state: RootState) => topSurface(state.layout) === surfaceId);

  useEffect(() => {
    if (!open) return;
    dispatch(layoutActions.pushSurface(surfaceId));
    return () => {
      dispatch(layoutActions.popSurface(surfaceId));
    };
  }, [dispatch, open, surfaceId]);

  // While closed the surface is not on the stack, so it can never own Escape
  // even for the render before the effect runs.
  return open && owns;
}
