import type { ReactNode } from "react";
import styles from "./Chip.module.css";

export interface ChipProps {
  label: string;
  /** A CSS variable reference — the 4px left edge that names the type. */
  tone?: string;
  /** Trailing badges: the type letter, a provenance dot, a distinct count. */
  badge?: ReactNode;
  strong?: boolean;
  state?: "active" | "stale" | "disabled";
  title?: string;
}

/**
 * The visual body of a presentation.
 *
 * Deliberately dumb: no click handling, no context, no knowledge of what it
 * depicts. Presentation wraps it to make it live. Keeping the two apart is what
 * lets a chip be rendered in a story with no provider, and what stops the
 * "acceptable" appearance from being reimplemented per chip.
 */
export function Chip({ label, tone, badge, strong = false, state, title }: ChipProps) {
  return (
    <span
      data-part="chip"
      data-state={state}
      className={[styles.chip, strong ? styles.strong : "", state ? styles[state] : ""]
        .filter(Boolean)
        .join(" ")}
      style={tone ? { borderLeftColor: tone } : undefined}
      /*
       * The label doubles as the native tooltip so a chip clipped by the
       * label's ellipsis stays recoverable by pointer — most call sites pass
       * no explicit title and rely on this (PR #20 review). A product whose
       * contextual help card covers the same chip silences the native
       * tooltip PER CALL SITE with `title=""` (datalab's FieldChip does);
       * dropping the default globally would strip truncated chips bare in
       * every product that never enables help.
       */
      title={title ?? label}
    >
      <span data-part="chip-label" className={styles.label}>
        {label}
      </span>
      {badge}
    </span>
  );
}
