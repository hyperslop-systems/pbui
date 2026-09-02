import type { Badge } from "@hyperslop-systems/pbui";
import styles from "./PortBadge.module.css";

export interface PortBadgeProps {
  badge: Badge;
}

/**
 * The binding badge (design §6.8.1): one glyph and a few words in the tile
 * header per bound port. This is the PLAIN rendering — a product wraps it
 * in its `<port>` presentation through `renderBadges` so the badge gets the
 * object menu; the plain badge still explains itself through its title.
 */
export function PortBadge({ badge }: PortBadgeProps) {
  return (
    <span data-part="port-badge" data-state={badge.state} data-port={badge.port} className={styles.badge} title={badge.explanation} aria-label={badge.explanation}>
      <span className={styles.glyph} aria-hidden="true">
        {badge.glyph}
      </span>
      <span className={styles.text}>{badge.text}</span>
    </span>
  );
}
