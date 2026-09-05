import type { HTMLAttributes, ReactNode } from "react";
import styles from "./AppBody.module.css";

export interface AppBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** No padding: for a table or an editor that draws to the frame's edge. */
  flush?: boolean;
}

/**
 * The scrolling body of a tile application: fills the frame, scrolls on its
 * own, and pads its content so text never sits on the tile's border. Every
 * application renders through this (or `flush`) rather than hand-copying
 * `flex: 1; min-height: 0; overflow: auto` (PBUI-VISUAL-1 P3).
 */
export function AppBody({ children, flush = false, className, ...rest }: AppBodyProps) {
  return (
    <div className={[styles.body, flush ? styles.flush : "", className ?? ""].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}
