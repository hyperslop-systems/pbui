import type { ReactNode } from "react";
import styles from "./PanelApp.module.css";

/**
 * The frame the three side panels share when they become tiles: padding and
 * a scroll of their own. The panels themselves are unchanged — this is the
 * difference between "a panel in a fixed column" and "a panel in a tile".
 */
export function PanelApp({ children, part }: { children: ReactNode; part: string }) {
  return (
    <div data-part={part} className={styles.panel}>
      {children}
    </div>
  );
}
