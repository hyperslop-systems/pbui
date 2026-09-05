import { evaluatePort } from "./evaluate";
import { compileIdentity, type IdentityClass, type IdentityDeclaration } from "./identity";
import type { LinkDeps, LinkSnapshot } from "./snapshot";
import { sourcePortOf, terms, type Binding, type SerializableReference } from "./terms";
import { parsePortId, type PortId } from "./types";

/*
 * Lifecycle rules (design §6.9), as pure transitions on the bindings map so
 * the shell's `close`, `replace` and `clone` handlers stay one line each:
 *
 * - a view goes away: its own terms are dropped, and every follower applies
 *   its declared `onSourceClose` — freeze keeps the last value held with an
 *   `Unresolved` it can explain, clear empties, ambient falls back; reroute
 *   and prompt leave the port unresolved with a diagnostic the badge shows
 *   (Phase 4 and Phase 7 give them their instruments);
 * - a view's application changes: removed ports' own terms are dropped,
 *   dependents apply `onSourceClose`, and identities/history are repaired;
 * - a workspace is cloned: terms are re-keyed to the copies' view ids.
 */

function bindingsAfterPortsRemoved(removed: ReadonlySet<PortId>, s: LinkSnapshot, deps: LinkDeps): ReadonlyMap<PortId, Binding> {
  const next = new Map<PortId, Binding>();
  for (const [port, binding] of s.bindings) {
    if (removed.has(port)) continue;
    const source = sourcePortOf(binding);
    if (!source || !removed.has(source)) {
      next.set(port, binding);
      continue;
    }
    // A held port keeps its value; only what it would resume changes.
    if (binding.kind === "hold") {
      next.set(port, terms.hold(binding.reference, terms.unresolved("source-closed", "the source tile was closed")));
      continue;
    }
    const policy = s.ports.get(port)?.declaration.onSourceClose ?? "freeze";
    switch (policy) {
      case "freeze": {
        const evaluation = evaluatePort(port, s, deps);
        if (evaluation.kind === "value") {
          next.set(port, terms.hold(evaluation.reference, terms.unresolved("source-closed", "the source tile was closed")));
        } else {
          next.set(port, terms.unresolved("source-closed", "the source tile was closed before it showed anything"));
        }
        break;
      }
      case "clear":
        next.set(port, terms.unresolved("source-closed", "the source tile was closed"));
        break;
      case "ambient":
        // No term: the declared fallback applies.
        break;
      case "reroute":
        next.set(port, terms.unresolved("source-closed", "the source tile was closed; choose another source"));
        break;
      case "prompt":
        next.set(port, terms.unresolved("source-closed", "the source tile was closed; decide what this port should read"));
        break;
    }
  }
  return next;
}

export interface RemovedPortLifecycle {
  bindings: ReadonlyMap<PortId, Binding>;
  identity: IdentityDeclaration[];
  classes: IdentityClass[];
  history: ReadonlyMap<PortId, SerializableReference | null>;
}

/** Apply every durable consequence of removing ports, using the old snapshot so freeze can capture the last value. */
export function linksAfterPortsRemoved(removed: ReadonlySet<PortId>, s: LinkSnapshot, deps: LinkDeps): RemovedPortLifecycle {
  const bindings = bindingsAfterPortsRemoved(removed, s, deps);
  const identity = s.identity.filter((entry) => !removed.has(entry.left) && !removed.has(entry.right));
  const ports = new Map([...s.ports].filter(([port]) => !removed.has(port)));
  const classes = identity.length === s.identity.length ? [...s.classes.values()] : [...compileIdentity(identity, ports, [...s.classes.values()]).classes];
  const members = new Set(classes.flatMap((entry) => entry.members));
  const history = new Map([...s.history].filter(([port]) => members.has(port)));
  return { bindings, identity, classes, history };
}

export function bindingsAfterViewsRemoved(removed: ReadonlySet<string>, s: LinkSnapshot, deps: LinkDeps): ReadonlyMap<PortId, Binding> {
  const ports = new Set([...s.ports].filter(([, definition]) => removed.has(definition.viewId)).map(([port]) => port));
  return bindingsAfterPortsRemoved(ports, s, deps);
}

/** Identity declarations that touch a removed view are dropped; the classes are recompiled with their ids kept. */
export function identityAfterViewsRemoved(removed: ReadonlySet<string>, s: LinkSnapshot): { identity: IdentityDeclaration[]; classes: IdentityClass[] } {
  const ports = new Set([...s.ports].filter(([, definition]) => removed.has(definition.viewId)).map(([port]) => port));
  const identity = s.identity.filter((entry) => !ports.has(entry.left) && !ports.has(entry.right));
  if (identity.length === s.identity.length) return { identity: [...s.identity], classes: [...s.classes.values()] };
  const kept = new Map([...s.ports].filter(([port]) => !ports.has(port)));
  return { identity, classes: [...compileIdentity(identity, kept, [...s.classes.values()]).classes] };
}

/** Drop terms for ports the view's new application does not declare. */
export function bindingsAfterAppReplaced(viewId: string, keptPortNames: ReadonlySet<string>, bindings: ReadonlyMap<PortId, Binding>): ReadonlyMap<PortId, Binding> {
  const next = new Map<PortId, Binding>();
  for (const [port, binding] of bindings) {
    const parsed = parsePortId(port);
    if (parsed?.viewId === viewId && !keptPortNames.has(parsed.name)) continue;
    next.set(port, binding);
  }
  return next;
}

/** Copy every term of a cloned view onto its copy, re-keying sources that were cloned too. */
export function bindingsAfterClone(viewMap: ReadonlyMap<string, string>, bindings: ReadonlyMap<PortId, Binding>): ReadonlyMap<PortId, Binding> {
  const next = new Map(bindings);
  const rekey = (port: PortId): PortId => {
    const parsed = parsePortId(port);
    if (!parsed) return port;
    const copy = viewMap.get(parsed.viewId);
    return copy ? `${copy}/${parsed.name}` : port;
  };
  const rekeyBinding = (binding: Binding): Binding => {
    switch (binding.kind) {
      case "follow":
        return terms.follow(rekey(binding.source), `${binding.linkId}-copy`);
      case "derived":
        return terms.derived(rekeyBinding(binding.source), binding.relationId, `${binding.linkId}-copy`);
      case "hold":
        return terms.hold(binding.reference, rekeyBinding(binding.suspended));
      default:
        return binding;
    }
  };
  for (const [port, binding] of bindings) {
    const parsed = parsePortId(port);
    if (!parsed || !viewMap.has(parsed.viewId)) continue;
    next.set(rekey(port), rekeyBinding(binding));
  }
  return next;
}
