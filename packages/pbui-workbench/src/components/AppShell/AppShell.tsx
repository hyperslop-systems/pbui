import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { Surface, Text, Toolbar } from "@hyperslop-systems/pbui";
import styles from "./AppShell.module.css";

export interface AppShellProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The product name in the masthead; rendered uppercase and banner-tracked. */
  wordmark: ReactNode;
  /** A faint line after the wordmark: a tagline, a mode, a session id. */
  tagline?: ReactNode;
  /** Right-aligned controls in the masthead. */
  mastheadActions?: ReactNode;
  /** Set false for an embedded workbench that lives inside another page's chrome. */
  masthead?: boolean;
  /** A full-width row under the masthead: the accept banner, a notice. */
  banner?: ReactNode;
  /** The workspace strip (or anything that names where you are). */
  strip?: ReactNode;
  /** Right-aligned controls beside the strip. */
  stripActions?: ReactNode;
  /** The status row, normally the pbui MouseDocLine. */
  status?: ReactNode;
  children: ReactNode;
}

/**
 * The one page shell for a workbench product (PBUI-VISUAL-1 P3): a dark
 * masthead with the wordmark, a strip row, the canvas on the wash, and a
 * status row. Every demo and datalab-ui hand-rolled this grid with its own
 * paddings and borders; the four shells looked like four products.
 *
 * The shell owns layout only. What goes in each slot, and whether the strip
 * or status exists, is the product's.
 */
export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(function AppShell(
  { wordmark, tagline, mastheadActions, masthead = true, banner, strip, stripActions, status, children, className, ...rest },
  ref,
) {
  return (
    <div ref={ref} data-part="app-shell" className={[styles.shell, className ?? ""].filter(Boolean).join(" ")} {...rest}>
      {masthead ? (
        <Surface as="section" tone="inverted" border="none" className={styles.masthead} data-part="app-shell-masthead">
          <Toolbar tight>
            <Text size="title" strong>
              <span className={styles.wordmark}>{wordmark}</span>
            </Text>
            {tagline ? (
              <Text size="tiny" tone="faint">
                <span className={styles.tagline}>{tagline}</span>
              </Text>
            ) : null}
            <span className={styles.spacer} />
            {mastheadActions}
          </Toolbar>
        </Surface>
      ) : null}
      {banner}
      {strip || stripActions ? (
        <div className={styles.strip} data-part="app-shell-strip">
          {strip}
          <span className={styles.spacer} />
          {stripActions}
        </div>
      ) : null}
      <div className={styles.canvas} data-part="app-shell-canvas">
        {children}
      </div>
      {status ? (
        <div className={styles.status} data-part="app-shell-status">
          {status}
        </div>
      ) : null}
    </div>
  );
});
