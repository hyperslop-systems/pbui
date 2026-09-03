import type { RuntimeTypeId } from "../actions/ids";
import { effectiveBinding } from "./evaluate";
import { planBind, planFollow } from "./plan";
import { labelOf, reaches, type LinkDeps, type LinkSnapshot, type PortDefinition } from "./snapshot";
import { canAccept } from "./compatibility";
import { sourcePortOf, type SerializableReference } from "./terms";
import type { PortId } from "./types";
import type { LinkVerb } from "./verbs";

/*
 * The target resolver (design §6.5, §6.8.4; report §7.10, §8.9–8.10):
 * "show this value" becomes a ranked set of CANDIDATES — existing compatible
 * input ports on screen, and (app, placement) pairs that could be spawned —
 * each with a status and an explanation. Ranking is a declared tuple; ties
 * among the best available candidates are an AMBIGUITY, never a winner
 * chosen by registration order; a stale candidate is never applied, it is
 * re-resolved by id on a fresh snapshot.
 *
 *   rank = (typeDistance, roleDistance, dispositionDistance, scopeIndex, sourceAffinity, -priority)
 */

export type ShowDisposition = "follow" | "hold" | "ambient";

export interface ShowQuery {
  readonly subject: SerializableReference;
  /** The semantic role the caller wants the value shown AS (`order.detail`); absent ⇒ any. */
  readonly role?: string;
  readonly disposition?: ShowDisposition;
  /** The out port the subject came from, when known; a follow is planned from it, else a bind. */
  readonly from?: PortId | null;
}

/** Somewhere a new tile could go, named by the shell ("split right of Orders East"). */
export interface PlacementCandidate {
  readonly id: string;
  readonly label: string;
  readonly placementId: string;
  readonly zone: "left" | "right" | "top" | "bottom" | "center" | "replace";
  /** The workspace the placement is in; 0 = current, for scopeIndex. */
  readonly scopeIndex?: number;
}

/** An application that could be opened to show the value, and the input port it would show it on. */
export interface SpawnableApp {
  readonly appId: string;
  readonly title: string;
  readonly portName: string;
  readonly valueType: RuntimeTypeId;
  readonly semanticRole: string;
}

/** (typeDistance, roleDistance, dispositionDistance, scopeIndex, sourceAffinity, placementIndex) — compared lexicographically. */
export type ShowRank = readonly [number, number, number, number, number, number];

export type ShowStatus = { readonly kind: "available" } | { readonly kind: "unavailable"; readonly because: string; readonly code: string } | { readonly kind: "inapplicable"; readonly because: string };

export type ShowCandidate =
  | {
      readonly candidateId: string;
      readonly kind: "existing-port";
      readonly port: PortId;
      readonly title: string;
      readonly status: ShowStatus;
      readonly rank: ShowRank;
      readonly verb?: LinkVerb;
      readonly explanation: string;
    }
  | {
      readonly candidateId: string;
      readonly kind: "spawn";
      readonly app: SpawnableApp;
      readonly placement: PlacementCandidate;
      readonly title: string;
      readonly status: ShowStatus;
      readonly rank: ShowRank;
      readonly explanation: string;
    };

export interface ShowResolution {
  readonly candidates: readonly ShowCandidate[];
  /** The best available candidates; more than one ⇒ ambiguous; none ⇒ nothing to do. */
  readonly winners: readonly ShowCandidate[];
  readonly ambiguous: boolean;
  readonly snapshotRevision: string;
}

export interface ResolveShowOptions {
  readonly placements?: readonly PlacementCandidate[];
  readonly spawnable?: readonly SpawnableApp[];
  /** Ports of the current workspace get scopeIndex 0; absent ⇒ every port is 0. */
  readonly inCurrentWorkspace?: (port: PortDefinition) => boolean;
}

export const existingCandidateId = (port: PortId) => `existing:${port}`;
export const spawnCandidateId = (appId: string, portName: string, placementId: string) => `spawn:${appId}:${portName}:${placementId}`;

function typeDistance(from: RuntimeTypeId, to: RuntimeTypeId, deps: LinkDeps): number {
  if (from === to) return 0;
  if (to === "any") return 50;
  const distance = deps.graph.distance(from, to);
  return Number.isFinite(distance) ? distance : Number.POSITIVE_INFINITY;
}

function compareRank(a: ShowRank, b: ShowRank): number {
  for (let index = 0; index < a.length; index += 1) {
    const d = (a[index] ?? 0) - (b[index] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function resolveShow(query: ShowQuery, s: LinkSnapshot, deps: LinkDeps, options: ResolveShowOptions = {}): ShowResolution {
  const candidates: ShowCandidate[] = [];
  const disposition = query.disposition ?? "follow";
  const from = query.from ?? null;
  const fromView = from ? from.split("/")[0] : null;
  const subjectLabel = labelOf(query.subject, deps);

  for (const port of s.ports.values()) {
    const declaration = port.declaration;
    if (declaration.direction === "out" || declaration.documentSlot) continue;
    if (port.viewId === fromView) continue;
    const distance = typeDistance(query.subject.type, declaration.contract.valueType, deps);
    // The ACCEPTANCE question (PBUI-KERNEL-3): may the subject be written into this port?
    if (!Number.isFinite(distance) || !canAccept(query.subject, declaration.contract, deps.graph).ok) continue;
    const title = `${port.tileTitle} · ${declaration.name}`;
    const current = s.bindings.get(port.id);
    const effective = effectiveBinding(port.id, s);
    const roleDistance = query.role ? (declaration.contract.semanticRole === query.role ? 0 : 1) : 0;
    const scopeIndex = options.inCurrentWorkspace ? (options.inCurrentWorkspace(port) ? 0 : 1) : 0;
    const currentSource = current ? sourcePortOf(current) : null;
    const sourceAffinity = from && currentSource === from ? 0 : 1;

    // A held port is INAPPLICABLE to a generic route (report §10.5): it was
    // pinned to be left alone. Only an explicit "hold" disposition or a
    // caller naming it by id may touch it — and even then through Resume.
    if (effective.kind === "hold" && disposition !== "hold") {
      candidates.push({
        candidateId: existingCandidateId(port.id),
        kind: "existing-port",
        port: port.id,
        title,
        status: { kind: "inapplicable", because: `${title} is held on ${labelOf(effective.reference, deps)}; resume it first` },
        rank: [distance, roleDistance, 3, scopeIndex, sourceAffinity, 0],
        explanation: `${title} is held; a generic show leaves it alone`,
      });
      continue;
    }
    const dispositionDistance = disposition === "follow" && effective.kind === "follow" ? 0 : 1;
    const plan = from ? planFollow(from, port.id, s, deps) : planBind(port.id, query.subject, s, deps);
    const status: ShowStatus =
      plan.kind === "available"
        ? { kind: "available" }
        : plan.kind === "unavailable"
          ? plan.code === "already"
            ? { kind: "available" }
            : { kind: "unavailable", because: plan.because, code: plan.code }
          : { kind: "unavailable", because: "the choice is ambiguous", code: "ambiguous" };
    // "Already follows that source" is available with NO verb: showing there is a no-op, not a change.
    const verb: LinkVerb | undefined = plan.kind === "available" ? plan.verb : undefined;
    candidates.push({
      candidateId: existingCandidateId(port.id),
      kind: "existing-port",
      port: port.id,
      title,
      status,
      rank: [distance, roleDistance, dispositionDistance, scopeIndex, sourceAffinity, 0],
      ...(verb ? { verb } : {}),
      explanation:
        plan.kind === "available"
          ? from
            ? `${title} follows ${s.ports.get(from)?.tileTitle ?? from}, showing ${subjectLabel} now`
            : `${title} shows ${subjectLabel}`
          : plan.kind === "unavailable" && plan.code === "already"
            ? `${title} already follows that source`
            : plan.kind === "unavailable"
              ? plan.because
              : "ambiguous",
    });
  }

  for (const app of options.spawnable ?? []) {
    const distance = typeDistance(query.subject.type, app.valueType, deps);
    if (!Number.isFinite(distance) || !reaches(query.subject.type, app.valueType, deps.graph)) continue;
    const roleDistance = query.role ? (app.semanticRole === query.role ? 0 : 1) : 0;
    for (const placement of options.placements ?? []) {
      candidates.push({
        candidateId: spawnCandidateId(app.appId, app.portName, placement.id),
        kind: "spawn",
        app,
        placement,
        title: `${app.title} · ${placement.label}`,
        status: { kind: "available" },
        // A spawn is farther than any free existing port (dispositionDistance 2) and prefers the first placement offered.
        rank: [distance, roleDistance, 2, placement.scopeIndex ?? 0, 1, options.placements?.indexOf(placement) ?? 0],
        explanation: `open ${app.title} ${placement.label}, ${from ? "following the source" : `showing ${subjectLabel}`}`,
      });
    }
  }

  const available = candidates.filter((candidate) => candidate.status.kind === "available");
  available.sort((a, b) => compareRank(a.rank, b.rank));
  const best = available[0];
  // Placement index is the final rank component, so alternate placements
  // for one target lose to its preferred placement. Equal-ranked distinct
  // (app, port) targets remain an ambiguity; registration order never wins.
  const winners = best ? available.filter((candidate) => compareRank(candidate.rank, best.rank) === 0) : [];

  return {
    candidates,
    winners,
    ambiguous: winners.length > 1,
    snapshotRevision: `${s.documentRevision}:${s.runtimeRevision}`,
  };
}

/** Find a candidate by id on a FRESH resolution; the stale row's verb is never replayed. */
export function freshCandidate(candidateId: string, fresh: ShowResolution): { kind: "proceed"; candidate: ShowCandidate } | { kind: "refused"; code: string; because: string } {
  const candidate = fresh.candidates.find((entry) => entry.candidateId === candidateId);
  if (!candidate) return { kind: "refused", code: "target-no-longer-resolves", because: "that target is no longer on screen" };
  if (candidate.status.kind !== "available") {
    return { kind: "refused", code: "target-no-longer-available", because: candidate.status.kind === "unavailable" ? candidate.status.because : candidate.status.because };
  }
  return { kind: "proceed", candidate };
}
