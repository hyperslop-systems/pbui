/**
 * Trace records the repair generators yield (PBUI-REBALANCE-1, design-doc/01
 * §2.4). One implementation serves every execution mode: the slate runs a
 * generator to completion and keeps the lines; the modal's trace panel shows
 * them; a future step-mode can pull one line at a time.
 */
export interface TraceLine {
  /** blu = detection/navigation, grn = weight moves, red = structural/refusal, k = neutral. */
  c: "blu" | "grn" | "red" | "k";
  t: string;
  /** Marks the start of an operation (rendered with a separator). */
  op?: boolean;
}

export const R0 = (x: number) => Math.round(x);
export const pct = (x: number) => `${(100 * x).toFixed(1).replace(/\.0$/, "")}%`;
export const vec = (w: readonly number[]) => `[${w.map((x) => x.toFixed(2).replace(/^0/, "")).join(" ")}]`;
export const sum = (values: readonly number[]) => values.reduce((s, v) => s + v, 0);
