import type { ReactNode } from "react";
import { Text } from "../../foundation";
import { Toolbar } from "../../layout";
import styles from "./TileHeader.module.css";

export interface TileHeaderProps {
  /** The application's own name for what it shows: "orders", "inspector · v3". */
  title: ReactNode;
  /** Chips beside the title: a filter in force, a bound port, a version. */
  children?: ReactNode;
  /** Faint, right-aligned: counts, totals, a timestamp. */
  status?: ReactNode;
  /** Controls at the far right. */
  actions?: ReactNode;
}

/**
 * The first row inside a tile body (PBUI-VISUAL-1 P6): a tight, bordered
 * toolbar with the title strong at the tiny size, chips after it, the status
 * faint at the right. Every ecommerce, sandbox and plotscript tile hand-wrote
 * this row with the same three parts and slightly different spacing.
 */
export function TileHeader({ title, children, status, actions }: TileHeaderProps) {
  return (
    <Toolbar as="header" tight bordered className={styles.header}>
      <Text size="tiny" strong>
        {title}
      </Text>
      {children}
      <span className={styles.spacer} />
      {status ? (
        <Text size="tiny" tone="faint">
          {status}
        </Text>
      ) : null}
      {actions}
    </Toolbar>
  );
}
