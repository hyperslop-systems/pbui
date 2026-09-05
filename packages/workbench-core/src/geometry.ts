import type { LayoutSpec } from "./document";
import type { Axis, PaneConstraints } from "./policy";

/**
 * Geometry as a VALUE (guide §11, simplification S10): the shell measures the
 * DOM into this immediately before a geometry-dependent command and hands it
 * to `execute`. The engine never discovers a DOM; a headless caller passes
 * nothing and gets the deterministic policy fallbacks.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GeometrySnapshot {
  /** The Surface root's box, for whole-layout feasibility. */
  readonly viewport?: Rect;
  /** The divider track thickness along each axis, in px. */
  readonly divider: { readonly inline: number; readonly block: number };
  readonly placements: ReadonlyMap<string, Rect>;
  readonly splits: ReadonlyMap<string, Rect>;
}

/** Fallback for headless geometry; the rendered token is measured when available. */
export const DEFAULT_DIVIDER_PX = 10;

export interface SplitRatioBounds {
  min: number;
  max: number;
}

/** Bounds over the DISTRIBUTABLE pane axis, excluding the divider track. */
export function paneRatioBounds(size: number | null, minPx: number, minFraction: number): SplitRatioBounds | null {
  const floor = Math.max(0, Math.min(0.5, minFraction));
  if (size === null) return { min: floor, max: 1 - floor };
  if (!Number.isFinite(size) || size <= 0) return null;
  const renderedFloor = Math.max(floor, minPx / size);
  if (renderedFloor > 0.5) return null;
  return { min: renderedFloor, max: 1 - renderedFloor };
}

function distributable(rect: Rect | undefined, axis: Axis, geometry: GeometrySnapshot): number | null {
  if (!rect) return null;
  const total = axis === "row" ? rect.width : rect.height;
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, total - (axis === "row" ? geometry.divider.inline : geometry.divider.block));
}

/** Can this placement be split along `axis` and leave both rendered panes usable? Unmeasured ⇒ yes (the headless floor applies). */
export function canSplitPlacement(geometry: GeometrySnapshot | null, placementId: string, axis: Axis, constraints: PaneConstraints): boolean {
  const rect = geometry?.placements.get(placementId);
  if (!geometry || !rect) return true;
  const minimum = axis === "row" ? constraints.minInlinePx : constraints.minBlockPx;
  return paneRatioBounds(distributable(rect, axis, geometry), minimum, constraints.minFraction) !== null;
}

/** The ratio range a divider may take while both panes keep their minima; null when the split cannot host two panes at all. */
export function splitRatioBounds(geometry: GeometrySnapshot | null, splitId: string, axis: Axis, constraints: PaneConstraints): SplitRatioBounds | null {
  const rect = geometry?.splits.get(splitId);
  const size = geometry && rect ? distributable(rect, axis, geometry) : null;
  const minimum = axis === "row" ? constraints.minInlinePx : constraints.minBlockPx;
  return paneRatioBounds(size, minimum, constraints.minFraction);
}

/** The axis whose rendered side is longer; the policy fallback when unmeasured. */
export function longerAxis(geometry: GeometrySnapshot | null, placementId: string, fallback: Axis): Axis {
  const rect = geometry?.placements.get(placementId);
  if (!rect) return fallback;
  return rect.width >= rect.height ? "row" : "col";
}

/** Would a whole layout fit in the viewport with every pane above its minimum? Unmeasured ⇒ relative floors only. */
export function layoutFits(spec: LayoutSpec, geometry: GeometrySnapshot | null, constraints: PaneConstraints): boolean {
  const inlineDivider = geometry?.divider.inline ?? DEFAULT_DIVIDER_PX;
  const blockDivider = geometry?.divider.block ?? DEFAULT_DIVIDER_PX;
  const fits = (node: LayoutSpec, width: number | null, height: number | null): boolean => {
    if (node.kind === "tile") return true;
    const row = node.direction === "row";
    const total = row ? width : height;
    const size = total === null ? null : Math.max(0, total - (row ? inlineDivider : blockDivider));
    const minimum = row ? constraints.minInlinePx : constraints.minBlockPx;
    const bounds = paneRatioBounds(size, minimum, constraints.minFraction);
    if (!bounds || node.ratio < bounds.min || node.ratio > bounds.max) return false;
    const aWidth = row && size !== null ? size * node.ratio : width;
    const bWidth = row && size !== null ? size * (1 - node.ratio) : width;
    const aHeight = !row && size !== null ? size * node.ratio : height;
    const bHeight = !row && size !== null ? size * (1 - node.ratio) : height;
    return fits(node.a, aWidth, aHeight) && fits(node.b, bWidth, bHeight);
  };
  const viewport = geometry?.viewport;
  return fits(spec, viewport?.width || null, viewport?.height || null);
}
