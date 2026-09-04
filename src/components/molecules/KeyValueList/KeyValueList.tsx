import type { ReactNode } from "react";
import styles from "./KeyValueList.module.css";

export interface KeyValueItem {
  key: ReactNode;
  value: ReactNode;
}

export interface KeyValueListProps {
  items: KeyValueItem[];
  /** tiny keys and a 2px row gap, for facts inside a tile; the default is the small size. */
  dense?: boolean;
  className?: string;
}

/**
 * Facts about one thing: a two-column definition list, keys in the faint
 * tracked label voice, values in ink (PBUI-VISUAL-1 P6). Seven products drew
 * this grid by hand with seven gutters.
 */
export function KeyValueList({ items, dense = false, className }: KeyValueListProps) {
  return (
    <dl data-part="key-value-list" className={[styles.list, dense ? styles.dense : "", className ?? ""].filter(Boolean).join(" ")}>
      {items.map((item, index) => (
        <div key={index} className={styles.row} data-part="key-value">
          <dt className={styles.key}>{item.key}</dt>
          <dd className={styles.value}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
