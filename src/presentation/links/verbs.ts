import { isSerializableReference, type SerializableReference } from "./terms";
import type { PortId } from "./types";

/*
 * The link verbs AS DATA. They join the workbench's `WorkbenchVerb` union
 * (Phase 2), so validation, description, plan/applyPlan and the agent tools
 * carry them unchanged. Every instrument — badge menu, "Link to…", accept
 * mode, connect-mode drag, agent — emits exactly these; nothing mutates the
 * link document directly.
 */

/** What a follower does when its wire is cut. `freeze` keeps the last value held; `clear` empties; `ambient` falls back. */
export type UnlinkPolicy = "freeze" | "clear" | "ambient";

export type LinkVerb =
  | { kind: "port.follow"; source: PortId; destination: PortId; linkId?: string }
  | { kind: "port.bind"; port: PortId; reference: SerializableReference }
  | { kind: "port.ambient"; port: PortId; context: string }
  | { kind: "port.pin"; port: PortId }
  | { kind: "port.resume"; port: PortId }
  | { kind: "port.detach"; port: PortId }
  | { kind: "port.unlink"; linkId: string; policy: UnlinkPolicy }
  | { kind: "port.clear"; port: PortId }
  | { kind: "link.mode.open" }
  | { kind: "link.mode.close" }
  /**
   * "Show this value": resolved by the target resolver into an existing port,
   * a context, or a spawned tile (Phase 4). With `candidateId` the caller has
   * chosen a candidate; it is re-resolved on a fresh snapshot, never replayed.
   */
  | { kind: "show"; subject: SerializableReference; role?: string; disposition?: "follow" | "hold" | "ambient"; from?: PortId; candidateId?: string };

export type LinkVerbKind = LinkVerb["kind"];

export const linkVerbs = {
  follow: (source: PortId, destination: PortId, linkId?: string): LinkVerb => ({ kind: "port.follow", source, destination, ...(linkId ? { linkId } : {}) }),
  bind: (port: PortId, reference: SerializableReference): LinkVerb => ({ kind: "port.bind", port, reference }),
  ambient: (port: PortId, context: string): LinkVerb => ({ kind: "port.ambient", port, context }),
  pin: (port: PortId): LinkVerb => ({ kind: "port.pin", port }),
  resume: (port: PortId): LinkVerb => ({ kind: "port.resume", port }),
  detach: (port: PortId): LinkVerb => ({ kind: "port.detach", port }),
  unlink: (linkId: string, policy: UnlinkPolicy): LinkVerb => ({ kind: "port.unlink", linkId, policy }),
  clear: (port: PortId): LinkVerb => ({ kind: "port.clear", port }),
  openMode: (): LinkVerb => ({ kind: "link.mode.open" }),
  closeMode: (): LinkVerb => ({ kind: "link.mode.close" }),
  show: (subject: SerializableReference, options: { role?: string; disposition?: "follow" | "hold" | "ambient"; from?: PortId | null; candidateId?: string } = {}): LinkVerb => ({
    kind: "show",
    subject,
    ...(options.role ? { role: options.role } : {}),
    ...(options.disposition ? { disposition: options.disposition } : {}),
    ...(options.from ? { from: options.from } : {}),
    ...(options.candidateId ? { candidateId: options.candidateId } : {}),
  }),
};

export const LINK_VERB_KINDS: readonly LinkVerbKind[] = [
  "port.follow",
  "port.bind",
  "port.ambient",
  "port.pin",
  "port.resume",
  "port.detach",
  "port.unlink",
  "port.clear",
  "link.mode.open",
  "link.mode.close",
  "show",
];

export function isLinkVerb(value: unknown): value is LinkVerb {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const verb = value as Record<string, unknown>;
  const string = (key: string) => typeof verb[key] === "string" && (verb[key] as string).length > 0;
  const optionalString = (key: string) => verb[key] === undefined || (typeof verb[key] === "string" && (verb[key] as string).length > 0);
  switch (verb.kind) {
    case "port.follow":
      return string("source") && string("destination") && optionalString("linkId");
    case "port.bind":
      return string("port") && isSerializableReference(verb.reference);
    case "port.ambient":
      return string("port") && string("context");
    case "port.pin":
    case "port.resume":
    case "port.detach":
    case "port.clear":
      return string("port");
    case "port.unlink":
      return string("linkId") && ["freeze", "clear", "ambient"].includes(String(verb.policy));
    case "link.mode.open":
    case "link.mode.close":
      return true;
    case "show":
      return (
        isSerializableReference(verb.subject) &&
        optionalString("role") &&
        optionalString("from") &&
        optionalString("candidateId") &&
        (verb.disposition === undefined || ["follow", "hold", "ambient"].includes(String(verb.disposition)))
      );
    default:
      return false;
  }
}

export function describeLinkVerb(verb: LinkVerb): string {
  switch (verb.kind) {
    case "port.follow":
      return `make ${verb.destination} follow ${verb.source}`;
    case "port.bind":
      return `fix ${verb.port} on a <${verb.reference.type}>`;
    case "port.ambient":
      return `let ${verb.port} read the ${verb.context} context`;
    case "port.pin":
      return `pin ${verb.port} on its current value`;
    case "port.resume":
      return `resume ${verb.port}'s suspended source`;
    case "port.detach":
      return `detach ${verb.port} as a fixed value`;
    case "port.unlink":
      return `unlink ${verb.linkId} (${verb.policy === "freeze" ? "keep the last value" : verb.policy === "clear" ? "clear" : "fall back to ambient"})`;
    case "port.clear":
      return `return ${verb.port} to its declared fallback`;
    case "link.mode.open":
      return "open connect mode";
    case "link.mode.close":
      return "close connect mode";
    case "show":
      return verb.candidateId ? `show the <${verb.subject.type}> in ${verb.candidateId.replace(/^(existing|spawn):/, "")}` : `show the <${verb.subject.type}>${verb.role ? ` as ${verb.role}` : ""}`;
  }
}
