import type { ReactNode } from "react";
import { IconButton } from "../../atoms/IconButton";
import { Text } from "../../foundation";
import { Stack, Toolbar } from "../../layout";
import styles from "./Callout.module.css";

export type CalloutVariant = "info" | "ok" | "warning" | "danger";

export interface CalloutProps {
  /** Severity, carried by the 4px left edge: neutral, ok green, warning gold, danger red. */
  variant?: CalloutVariant;
  title?: string;
  children: ReactNode;
  /** A faint line under the body: what to do about it. */
  hint?: ReactNode;
  actions?: ReactNode;
  /** Shows a dismiss control at the top right. */
  onDismiss?(): void;
  dismissLabel?: string;
}

/**
 * The one notice in the family (PBUI-VISUAL-1 P5): a paper box with a
 * hairline and a 4px tone edge that names the severity — the Chip's edge at
 * paragraph size. Every "something to know" surface renders through it: a
 * published version, an unfinished upload, an invalid document, a program
 * error, a refusal (the kernel's RefusalNotice draws the same recipe).
 *
 * `danger` announces as an alert; the other three as status. That split is
 * what an earlier version used to justify having no danger variant at all —
 * failures then grew four unrelated looks across the products.
 */
export function Callout({ variant = "info", title, children, hint, actions, onDismiss, dismissLabel = "dismiss" }: CalloutProps) {
  return (
    <div
      data-part="callout"
      data-variant={variant}
      role={variant === "danger" ? "alert" : "status"}
      className={[styles.callout, styles[variant]].join(" ")}
    >
      <Stack gap={2}>
        {title || onDismiss ? (
          <div className={styles.head}>
            {title ? (
              <Text size="small" strong>
                {variant === "ok" ? "✓ " : variant === "warning" ? "⚠ " : variant === "danger" ? "✕ " : ""}
                {title}
              </Text>
            ) : null}
            {onDismiss ? (
              <span className={styles.dismiss}>
                <IconButton variant="bare" size="tiny" glyph="✕" accessibleName={dismissLabel} onClick={onDismiss} />
              </span>
            ) : null}
          </div>
        ) : null}
        {children}
        {hint ? (
          <Text size="tiny" tone="faint">
            {hint}
          </Text>
        ) : null}
        {actions && <Toolbar tight>{actions}</Toolbar>}
      </Stack>
    </div>
  );
}
