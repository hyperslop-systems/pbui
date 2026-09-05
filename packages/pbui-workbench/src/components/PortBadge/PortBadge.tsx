import { Chip, type Badge, type ChipState } from "@hyperslop-systems/pbui";

export interface PortBadgeProps {
  badge: Badge;
}

/**
 * Port state, after a tile's title: a tiny edgeless Chip whose border style
 * is the state (PBUI-VISUAL-1 P4). The glyph and the text come from the link
 * kernel's badge; `data-part`, `data-state` and `data-port` stay on the
 * element for products and tests that locate a port by them.
 */
export function PortBadge({ badge }: PortBadgeProps) {
  return (
    <Chip
      data-part="port-badge"
      data-state={badge.state}
      data-port={badge.port}
      size="tiny"
      edge={false}
      glyph={badge.glyph}
      label={badge.text}
      state={chipStateOf(badge.state)}
      title={badge.explanation}
      aria-label={badge.explanation}
    />
  );
}

function chipStateOf(state: Badge["state"]): ChipState | undefined {
  switch (state) {
    case "ambient":
    case "empty":
      return "empty";
    case "unresolved":
      return "unresolved";
    case "held":
      return "held";
    default:
      return undefined;
  }
}
