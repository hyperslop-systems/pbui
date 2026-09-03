import { sum } from "./trace";

/**
 * Euclidean projection onto the constraint set { Σw = 1, wᵢ ≥ lᵢ }
 * (textbook §5; design-doc/01 §2.5 PROJECT).
 *
 * The KKT conditions give a one-parameter solution family
 * `w′ᵢ = max(lᵢ, wᵢ + θ)`: the equality constraint contributes one Lagrange
 * multiplier shared by every coordinate, and an inequality activates only
 * where that uniform shift would cross a floor — there the weight pins to the
 * floor exactly. `Σ max(lᵢ, wᵢ + θ)` is continuous and non-decreasing in θ,
 * so θ is found by bisection: 80 branch-free steps reach machine precision,
 * and the final renormalisation absorbs the residual.
 *
 * When `Σ lᵢ ≥ 1` no feasible point exists; the function returns the floors
 * proportionally scaled — every child equally short rather than a few
 * catastrophically so, the best available answer when the answer must be
 * something.
 */
export function projectLower(w: readonly number[], l: readonly number[]): number[] {
  const floorSum = sum(l);
  if (floorSum >= 1 - 1e-9) return l.map((x) => x / floorSum);
  let lo = -1;
  let hi = 1;
  const overshoot = (theta: number) => sum(w.map((x, i) => Math.max(l[i] ?? 0, x + theta))) - 1;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (overshoot(mid) > 0) hi = mid;
    else lo = mid;
  }
  const theta = (lo + hi) / 2;
  const out = w.map((x, i) => Math.max(l[i] ?? 0, x + theta));
  const s = sum(out);
  return out.map((x) => x / s);
}
