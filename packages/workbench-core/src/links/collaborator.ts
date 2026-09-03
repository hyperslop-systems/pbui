import {
  applyLinkVerb,
  bindingsAfterClone,
  createPresentationTypeGraph,
  linksAfterPortsRemoved,
  type Binding,
  type LinkDeps,
  type LinkSnapshot,
  type PortId,
  type SerializableReference,
} from "@hyperslop-systems/pbui/link-kernel";
import type { Mutation, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import type { IdGenerator } from "@hyperslop-systems/workbench-protocol/client";
import type { ManifestCatalog } from "../apps";
import type { WorkbenchLinkCommand } from "../commands";
import type { LocalEffect } from "../effects";
import { linksChange } from "./document";
import type { WorkbenchObserverError } from "../publication";
import { createLinkRuntime, forgetViewValues, reduceRuntimeEffects, type LinkRuntime, type LinkRuntimeState } from "./runtime";
import { buildLinkSnapshot, DEFAULT_LINK_LABELS, type LinkLabels } from "./snapshot";

/**
 * The one explicit links collaborator (guide §16.6, simplification S6): what
 * the core's planner and gateway call for link commands, the `pbui.links`
 * document, lifecycle maintenance, and the runtime values. Everything it
 * returns during planning is DATA — a mutation, effects — and nothing it does
 * during planning touches the live runtime (F1). Only the core writes
 * the runtime, and only `execute` calls it.
 */
export interface WorkbenchLinks {
  readonly runtime: LinkRuntime;
  /** Bound once by the core at construction; before that, `deps` and `snapshot` are unusable. */
  bind(apps: ManifestCatalog): void;
  readonly deps: LinkDeps;
  readonly labels: LinkLabels;
  /** The current facts for a document; cached per (document identity, runtime revision). */
  snapshot(doc: WorkbenchDocument): LinkSnapshot;
  /** Plan one term-level link command against a snapshot; the result is data. */
  plan(command: Exclude<WorkbenchLinkCommand, { kind: "show" }>, doc: WorkbenchDocument, ids: IdGenerator): LinkPlanOutcome;
  /**
   * The link maintenance a batch implies (design §6.9): views deleted →
   * followers apply `onSourceClose`; a view's app replaced → stale terms
   * dropped; views cloned → terms re-keyed. One extra mutation for the same
   * batch, or null when the batch touches no linked port.
   */
  maintenance(doc: WorkbenchDocument, mutations: readonly Mutation[]): Mutation | null;
  /**
   * The runtime state a transition's effects produce, as a VALUE (design doc
   * 04 §6.6): computed before anything is installed, installed beside the
   * core's document, published after both are current. Null when the
   * effects change nothing.
   */
  stage(effects: readonly LocalEffect[]): LinkRuntimeState | null;
  /** Set a staged state without notifying; the core calls this between installing its document and publishing. */
  install(next: LinkRuntimeState): void;
  /** Attempt every runtime subscriber once, recording failures for the core's report. */
  publish(revision: number, failures: WorkbenchObserverError[]): void;
  /** The out port whose attended or emitted value is this reference. */
  sourceOf(reference: SerializableReference): PortId | null;
}

export type LinkPlanOutcome =
  | { kind: "prepared"; mutation: Mutation | null; effects: readonly LocalEffect[]; explanation: string }
  | { kind: "refused"; code: string; because: string };

export interface CreateWorkbenchLinksOptions {
  /**
   * The link kernel's dependencies: the SAME type graph the product's menus
   * resolve on, its relations, its value labels. A product with a compiled
   * presentation obtains this from `presentation.linkDeps(...)`. Absent ⇒
   * the graph is the set of value types the manifests' ports declare, as
   * isolated nodes (equal ids and `<any>` reach; no subtyping).
   */
  deps?: LinkDeps;
  /** Titles for badges and show candidates; the shell passes presentation titles. */
  labels?: LinkLabels;
  runtime?: LinkRuntime;
}

function declaredPortGraph(apps: ManifestCatalog) {
  const ids = new Set<string>();
  for (const app of apps.list()) for (const port of app.ports ?? []) ids.add(port.contract.valueType);
  ids.delete("any");
  return createPresentationTypeGraph([...ids].map((id) => ({ id })));
}

export function createWorkbenchLinks(options: CreateWorkbenchLinksOptions = {}): WorkbenchLinks {
  const runtime = options.runtime ?? createLinkRuntime();
  const labels = options.labels ?? DEFAULT_LINK_LABELS;
  let apps: ManifestCatalog | null = null;
  let deps: LinkDeps | null = options.deps ?? null;
  const catalog = (): ManifestCatalog => {
    if (!apps) throw new Error("workbench-core: the links collaborator is not bound to a core yet");
    return apps;
  };

  let cached: { doc: WorkbenchDocument; runtimeRevision: number; snapshot: LinkSnapshot } | null = null;
  let documentRevision = 0;
  const snapshot = (doc: WorkbenchDocument): LinkSnapshot => {
    const state = runtime.getState();
    if (cached && cached.doc === doc && cached.runtimeRevision === state.revision) return cached.snapshot;
    if (!cached || cached.doc !== doc) documentRevision += 1;
    const built = buildLinkSnapshot(doc, catalog(), state, documentRevision, labels);
    cached = { doc, runtimeRevision: state.revision, snapshot: built };
    return built;
  };

  const links: WorkbenchLinks = {
    runtime,
    labels,
    bind(next) {
      apps = next;
      if (!deps) deps = { graph: declaredPortGraph(next) };
    },
    get deps() {
      if (!deps) throw new Error("workbench-core: the links collaborator is not bound to a core yet");
      return deps;
    },
    snapshot,
    plan(command, doc, ids) {
      const result = applyLinkVerb(command, snapshot(doc), links.deps, { newLinkId: () => ids("link") });
      if (result.kind === "refused") {
        const plan = result.plan;
        return plan.kind === "unavailable" ? { kind: "refused", code: plan.code, because: plan.because } : { kind: "refused", code: "ambiguous", because: "the choice is ambiguous" };
      }
      if (result.kind === "browser-local") return { kind: "prepared", mutation: null, effects: [], explanation: "" };
      const mutation = linksChange(doc, result.state);
      const effects: LocalEffect[] = result.effects.length > 0 ? [{ kind: "link-runtime", effects: result.effects }] : [];
      return { kind: "prepared", mutation, effects, explanation: result.explanation };
    },
    maintenance(doc, mutations) {
      const s = snapshot(doc);
      if (s.bindings.size === 0 && s.identity.length === 0) return null;
      const removedPorts = new Set<PortId>();
      const cloned = new Map<string, string>();
      for (const mutation of mutations) {
        const body = mutation.body;
        if (body.case === "viewDelete") {
          for (const [port, definition] of s.ports) if (definition.viewId === body.value.viewId) removedPorts.add(port);
        } else if (body.case === "viewConfigure" && body.value.appId && doc.views[body.value.viewId]?.appId !== body.value.appId) {
          const kept = new Set((catalog().get(body.value.appId)?.ports ?? []).map((port) => port.name));
          for (const [port, definition] of s.ports) if (definition.viewId === body.value.viewId && !kept.has(definition.declaration.name)) removedPorts.add(port);
        } else if (body.case === "viewClone") {
          cloned.set(body.value.sourceViewId, body.value.newViewId);
        }
      }
      if (removedPorts.size === 0 && cloned.size === 0) return null;
      const lifecycle = removedPorts.size > 0 ? linksAfterPortsRemoved(removedPorts, s, links.deps) : { bindings: s.bindings, identity: [...s.identity], classes: [...s.classes.values()], history: s.history };
      const bindings: ReadonlyMap<PortId, Binding> = cloned.size > 0 ? bindingsAfterClone(cloned, lifecycle.bindings) : lifecycle.bindings;
      return linksChange(doc, { ...lifecycle, bindings });
    },
    stage(effects) {
      const before = runtime.getState();
      let next = before;
      for (const effect of effects) {
        if (effect.kind === "link-runtime") next = reduceRuntimeEffects(next, effect.effects);
        else if (effect.kind === "forget-view-values") next = forgetViewValues(next, effect.viewId);
      }
      return next === before ? null : next;
    },
    install: (next) => runtime.install(next),
    publish: (revision, failures) => runtime.publish(revision, failures),
    sourceOf: (reference) => runtime.sourceOf(reference),
  };
  return links;
}
