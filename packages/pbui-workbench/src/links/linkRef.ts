import { sourcePortOf, type LinkSnapshot, type PortId, type PresentationDescriptor } from "@hyperslop-systems/pbui";

/**
 * The value a `<link>` presentation carries — a WIRE in connect mode: the
 * two ports, the term kind, and what the menu needs to decide. Derived from
 * the snapshot on every render, like `PortRef`.
 */
export interface LinkRef {
  linkId: string;
  source: PortId;
  destination: PortId;
  sourceTitle: string;
  destinationTitle: string;
  /** `follow` or `derived` as declared; `held` when a hold suspends the wire. */
  kind: "follow" | "derived" | "held";
  relationId?: string;
  /** The destination's declared ambient fallback, when it has one (what "fall back" would do). */
  fallbackContext?: string;
}

/** Every wire the snapshot declares: explicit follow/derived terms, including those suspended under a hold. */
export function linkRefsOf(snapshot: LinkSnapshot): LinkRef[] {
  const out: LinkRef[] = [];
  for (const [port, binding] of snapshot.bindings) {
    const inner = binding.kind === "hold" ? binding.suspended : binding;
    if (inner.kind !== "follow" && inner.kind !== "derived") continue;
    const source = sourcePortOf(inner);
    if (!source) continue;
    const destination = snapshot.ports.get(port);
    const sourceDefinition = snapshot.ports.get(source);
    out.push({
      linkId: inner.linkId,
      source,
      destination: port,
      sourceTitle: sourceDefinition ? `${sourceDefinition.tileTitle} · ${sourceDefinition.declaration.name}` : source,
      destinationTitle: destination ? `${destination.tileTitle} · ${destination.declaration.name}` : port,
      kind: binding.kind === "hold" ? "held" : inner.kind,
      ...(inner.kind === "derived" ? { relationId: inner.relationId } : {}),
      ...(destination?.declaration.fallbackContext ? { fallbackContext: destination.declaration.fallbackContext } : {}),
    });
  }
  return out;
}

export function createLinkDescriptor(): PresentationDescriptor<LinkRef, unknown> {
  return {
    label: (link) => `${link.destinationTitle} ${link.kind === "derived" ? "←" : "→"} ${link.sourceTitle}`,
    describe: (link) => `${link.destinationTitle} ${link.kind === "held" ? "is held; its suspended source is" : link.kind === "derived" ? `derives through ${link.relationId ?? "a relation"} from` : "follows"} ${link.sourceTitle}`,
    tone: "neutral",
  };
}
