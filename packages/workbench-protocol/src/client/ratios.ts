/**
 * SNAP_RATIOS are the shares a divider settles on; snapRatio keeps the same
 * contract the products' layout stores had, because two workspaces should
 * line up when the user aims for the same fraction.
 */
export const SNAP_RATIOS: readonly number[] = [0.25, 1 / 3, 0.5, 2 / 3, 0.75];

/** SNAP_TOLERANCE is how close a drag must land to a ratio to snap onto it. */
export const SNAP_TOLERANCE = 0.022;

export function snapRatio(value: number): { ratio: number; snapped: boolean } {
  for (const candidate of SNAP_RATIOS) {
    if (Math.abs(value - candidate) < SNAP_TOLERANCE) return { ratio: candidate, snapped: true };
  }
  return { ratio: value, snapped: false };
}
