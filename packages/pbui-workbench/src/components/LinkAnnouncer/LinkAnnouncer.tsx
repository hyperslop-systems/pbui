import { badgesOfView, type Badge } from "@hyperslop-systems/pbui";
import { useEffect, useRef, useState } from "react";
import { useWorkbench } from "../../context";
import { useLinkSnapshot } from "../../links/hooks";
import styles from "./LinkAnnouncer.module.css";

/**
 * Coordination notifications (design §6.8.7, report §10.7): a live region
 * that announces what changed for a tile, coalesced per target — "Order
 * Detail → #1042 · from Orders East" — so a screen reader hears one line
 * per tile per burst rather than every intermediate emission. Rendered by
 * the Surface; visually hidden unless the product styles `[data-part=
 * "link-announcer"]`.
 */
export function LinkAnnouncer({ delayMs = 150 }: { delayMs?: number }) {
  const workbench = useWorkbench();
  const snapshot = useLinkSnapshot(workbench);
  const [message, setMessage] = useState("");
  const previous = useRef<Map<string, string>>(new Map());
  const pending = useRef<Map<string, string>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const views = [...new Set([...snapshot.ports.values()].map((port) => port.viewId))];
    const now = new Map<string, string>();
    const lines = new Map<string, string>();
    for (const viewId of views) {
      for (const badge of badgesOfView(viewId, snapshot, workbench.links.deps)) {
        const key = badge.port;
        const line = lineOf(badge, snapshot.ports.get(badge.port)?.tileTitle ?? viewId);
        now.set(key, line);
        if (previous.current.get(key) !== line) lines.set(key, line);
      }
    }
    previous.current = now;
    if (lines.size === 0) return;
    // Coalesce per target: the latest line per port wins within the window.
    for (const [key, line] of lines) pending.current.set(key, line);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setMessage([...pending.current.values()].join(". "));
      pending.current.clear();
      timer.current = null;
    }, delayMs);
  }, [snapshot, workbench, delayMs]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div data-part="link-announcer" className={styles.region} role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}

function lineOf(badge: Badge, tileTitle: string): string {
  switch (badge.state) {
    case "following":
      return `${tileTitle} → ${badge.evaluation.kind === "value" ? badge.explanation.replace(/^.*now /, "") : "nothing yet"} · from ${badge.text.replace(/ · none$/, "")}`;
    case "held":
      return `${tileTitle} held on ${badge.text}`;
    case "fixed":
      return `${tileTitle} fixed on ${badge.text}`;
    case "shared":
      return `${tileTitle} shares ${badge.text}`;
    case "derived":
      return `${tileTitle} ${badge.text}`;
    case "ambient":
      return `${tileTitle} reads ${badge.text}`;
    case "empty":
      return `${tileTitle} reads ${badge.text}`;
    case "unresolved":
      return `${tileTitle}: ${badge.explanation}`;
    default:
      return `${tileTitle}: ${badge.explanation}`;
  }
}
