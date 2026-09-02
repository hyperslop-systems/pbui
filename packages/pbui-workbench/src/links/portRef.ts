import type { Badge, BadgeState, PortDirection, PortId, PresentationDescriptor } from "@hyperslop-systems/pbui";
import { parsePortId, linkIdOf } from "@hyperslop-systems/pbui";
import type { LinkSnapshot } from "@hyperslop-systems/pbui";

/**
 * The value a `<port>` presentation carries: what its menu needs to DECIDE
 * (the `TileRef` rule). Derived by the shell on every render from the
 * badge, so nothing about a verb's availability is ever stored.
 */
export interface PortRef {
  port: PortId;
  viewId: string;
  name: string;
  direction: PortDirection;
  valueType: string;
  role: string;
  tileTitle: string;
  doc: string;
  state: BadgeState;
  glyph: string;
  text: string;
  explanation: string;
  /** The port this one reads, when it follows or holds a follow. */
  sourcePort?: PortId;
  /** The wire's id, when the term is a follow or a derivation (also under a hold). */
  linkId?: string;
}

export function portRefOf(badge: Badge, snapshot: LinkSnapshot): PortRef | null {
  const definition = snapshot.ports.get(badge.port);
  const parsed = parsePortId(badge.port);
  if (!definition || !parsed) return null;
  const linkId = linkIdOf(badge.binding);
  return {
    port: badge.port,
    viewId: parsed.viewId,
    name: parsed.name,
    direction: definition.declaration.direction,
    valueType: definition.declaration.contract.valueType,
    role: definition.declaration.contract.semanticRole,
    tileTitle: definition.tileTitle,
    doc: definition.declaration.doc,
    state: badge.state,
    glyph: badge.glyph,
    text: badge.text,
    explanation: badge.explanation,
    ...(badge.sourcePort ? { sourcePort: badge.sourcePort } : {}),
    ...(linkId ? { linkId } : {}),
  };
}

/** The `<port>` descriptor — representation only; the verbs live in `workbenchLinkContributions()`. */
export function createPortDescriptor(): PresentationDescriptor<PortRef, unknown> {
  return {
    label: (port) => (port.glyph ? `${port.glyph} ${port.text}` : port.name),
    describe: (port) => port.explanation,
    tone: "neutral",
  };
}
