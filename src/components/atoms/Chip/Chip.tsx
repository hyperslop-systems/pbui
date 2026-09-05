import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Chip.module.css";

export type ChipState = "active" | "stale" | "disabled" | "empty" | "unresolved" | "held" | "revoked";
export type ChipSize = "small" | "tiny" | "micro";
export type ChipFill = "none" | "wash" | "tone";

export interface ChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, "title"> {
  label: string;
  /** A CSS variable reference — the 4px left edge that names the type, or the fill when `fill="tone"`. */
  tone?: string;
  /** Trailing badges: the type letter, a provenance dot, a distinct count. */
  badge?: ReactNode;
  /** A leading glyph in the chip's own weight: a port arrow, a state mark. */
  glyph?: ReactNode;
  strong?: boolean;
  /**
   * Border style is the chip's state language; colour only reinforces it.
   * active: selected fill · stale: dashed, danger · disabled: faded on the
   * alt surface · empty: dashed, faint · unresolved: dotted, bold · held:
   * double · revoked: dashed, faint, struck through.
   */
  state?: ChipState;
  /** small (10.5px) is the default; tiny for bars and badges; micro for type letters. */
  size?: ChipSize;
  /** none: pane · wash: the stateless tag wash · tone: the tone at full strength. */
  fill?: ChipFill;
  /** The 4px tone edge. Off for a badge that names a state rather than a type. */
  edge?: boolean;
  title?: string;
}

/**
 * The visual body of a presentation, and the one small labelled box in the
 * family (PBUI-VISUAL-1 P4): port badges, status pills, role and scope
 * badges, type letters, kind tags are all this component with a different
 * size, fill, edge and state.
 *
 * Deliberately dumb: no click handling, no context, no knowledge of what it
 * depicts. Presentation wraps it to make it live. An interactive small box is
 * a `Button[variant="framed" size="tiny"]`, never a Chip.
 */
export function Chip({
  label,
  tone,
  badge,
  glyph,
  strong = false,
  state,
  size = "small",
  fill = "none",
  edge = true,
  title,
  className,
  style,
  ...rest
}: ChipProps) {
  return (
    <span
      data-part="chip"
      /* Stable even when a wrapper renames data-part (the port badge does):
       * the parts sheet uses it to let a chip BE its presentation's box. */
      data-chip=""
      data-state={state}
      data-size={size === "small" ? undefined : size}
      className={[
        styles.chip,
        edge ? styles.edge : "",
        size === "tiny" ? styles.tiny : size === "micro" ? styles.micro : "",
        fill === "wash" ? styles.fillWash : fill === "tone" ? styles.fillTone : "",
        strong ? styles.strong : "",
        state ? styles[state] : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={tone ? ({ ...style, "--chip-tone": tone } as React.CSSProperties) : style}
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
      {...rest}
    >
      {glyph !== undefined && glyph !== null ? (
        <span data-part="chip-glyph" className={styles.glyph} aria-hidden="true">
          {glyph}
        </span>
      ) : null}
      <span data-part="chip-label" className={styles.label}>
        {label}
      </span>
      {badge}
    </span>
  );
}
