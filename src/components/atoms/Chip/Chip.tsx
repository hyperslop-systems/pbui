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
       * Only an EXPLICIT title renders. The old `title ?? label` default gave
       * every chip a native browser tooltip mirroring its visible label,
       * which stacked on top of the contextual help card (PBUI-HELP-001) the
       * moment products enabled help. A caller with a genuinely truncated
       * value passes the full value as `title` deliberately.
       */
      title={title}
    >
      <span data-part="chip-label" className={styles.label}>
        {label}
      </span>
      {badge}
    </span>
  );
}
