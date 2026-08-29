/**
 * Help card placement (PBUI-HELP-002, intern guide §5). Pure geometry: the
 * component measures the rendered card and the anchor, this function returns
 * where the card goes and how tall it may be. It exists because two inline
 * clamps could not express the real constraint — the card must stay inside
 * the viewport with its content reachable (PR #20 round 4, finding 2) while
 * staying FLUSH against the anchor, because any gap belongs to neither
 * element and a slow pointer crossing it closes the card (round 3).
 */

export interface HelpAnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface HelpCardSize {
  width: number;
  height: number;
}

export interface HelpViewportSize {
  width: number;
  height: number;
}

export interface HelpPlacement {
  left: number;
  top: number;
  /** Height cap for THIS placement; the CSS max-height remains the outer bound. */
  maxHeight: number;
  side: "below" | "above";
}

/** Breathing room to the viewport edge — never to the anchor. */
export const HELP_VIEWPORT_MARGIN = 8;
/** Roughly one item row: the smallest card still worth showing. */
export const HELP_MIN_CARD = 48;

export function placeHelpCard(
  anchor: HelpAnchorRect,
  card: HelpCardSize,
  viewport: HelpViewportSize,
): HelpPlacement {
  const left = Math.max(0, Math.min(anchor.left, viewport.width - card.width));

  const spaceBelow = viewport.height - anchor.bottom - HELP_VIEWPORT_MARGIN;
  const spaceAbove = anchor.top - HELP_VIEWPORT_MARGIN;

  // Prefer below, flush against the anchor's bottom edge.
  if (card.height <= spaceBelow) {
    return { left, top: anchor.bottom, maxHeight: Math.max(spaceBelow, 0), side: "below" };
  }

  // Flip above only when above genuinely wins; bottom edge flush to anchor.top.
  if (spaceAbove > spaceBelow) {
    const maxHeight = Math.max(Math.min(card.height, spaceAbove), HELP_MIN_CARD);
    const height = Math.min(card.height, maxHeight);
    return { left, top: Math.max(anchor.top - height, 0), maxHeight, side: "above" };
  }

  // Neither side fits fully: stay below, capped to what exists, with a floor
  // so a usable sliver renders and SCROLLS rather than clipping into a void.
  const maxHeight = Math.max(spaceBelow, HELP_MIN_CARD);
  const top = Math.min(anchor.bottom, viewport.height - maxHeight);
  return { left, top: Math.max(top, 0), maxHeight, side: "below" };
}
