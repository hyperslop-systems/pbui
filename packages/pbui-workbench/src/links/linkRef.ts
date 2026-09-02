import { sourcePortOf, type LinkSnapshot, type PortId, type PresentationDescriptor } from "@hyperslop-systems/pbui";

/**
 * The value a `<link>` presentation carries — a WIRE in connect mode: the
 * two ports, the term kind, and what the menu needs to decide. Derived from
 * the snapshot on every render, like `PortRef`. An identity link (Phase 5)
 * is a wire too: symmetric, with its class id.
 */
export interface LinkRef {
  linkId: string;
  source: PortId;
  destination: PortId;
  sourceTitle: string;
  destinationTitle: string;
  /** `follow` or `derived` as declared; `held` when a hold suspends the wire; `identity` for a shared cell. */
  kind: "follow" | "derived" | "held" | "identity";
  relationId?: string;
  /** The destination's declared ambient fallback, when it has one (what "fall back" would do). */
  fallbackContext?: string;
  /** For identity links: the compiled class, when the link compiled into one. */
  classId?: string;
}

/** Every wire the snapshot declares: explicit follow/derived terms (including those suspended under a hold) and identity links. */
export function linkRefsOf(snapshot: LinkSnapshot): LinkRef[] {
  const out: LinkRef[] = [];
  const title = (port: PortId) => {
    const definition = snapshot.ports.get(port);
    return definition ? `${definition.tileTitle} · ${definition.declaration.name}` : port;
  };
  for (const [port, binding] of snapshot.bindings) {
    const inner = binding.kind === "hold" ? binding.suspended : binding;
    if (inner.kind !== "follow" && inner.kind !== "derived") continue;
    const source = sourcePortOf(inner);
    if (!source) continue;
    const destination = snapshot.ports.get(port);
    out.push({
      linkId: inner.linkId,
      source,
      destination: port,
      sourceTitle: title(source),
      destinationTitle: title(port),
      kind: binding.kind === "hold" ? "held" : inner.kind,
      ...(inner.kind === "derived" ? { relationId: inner.relationId } : {}),
      ...(destination?.declaration.fallbackContext ? { fallbackContext: destination.declaration.fallbackContext } : {}),
    });
  }
  for (const declaration of snapshot.identity) {
    const classId = snapshot.aliases.get(declaration.left);
    out.push({
      linkId: declaration.linkId,
      source: declaration.left,
      destination: declaration.right,
      sourceTitle: title(declaration.left),
      destinationTitle: title(declaration.right),
      kind: "identity",
      ...(classId && classId === snapshot.aliases.get(declaration.right) ? { classId } : {}),
    });
  }
  return out;
}

export function createLinkDescriptor(): PresentationDescriptor<LinkRef, unknown> {
  return {
    label: (link) => (link.kind === "identity" ? `${link.sourceTitle} ≡ ${link.destinationTitle}` : `${link.destinationTitle} ${link.kind === "derived" ? "←" : "→"} ${link.sourceTitle}`),
    describe: (link) =>
      link.kind === "identity"
        ? `${link.sourceTitle} and ${link.destinationTitle} share ${link.classId ? `the ${link.classId} cell` : "one cell"}`
        : `${link.destinationTitle} ${link.kind === "held" ? "is held; its suspended source is" : link.kind === "derived" ? `derives through ${link.relationId ?? "a relation"} from` : "follows"} ${link.sourceTitle}`,
    tone: "neutral",
  };
}
