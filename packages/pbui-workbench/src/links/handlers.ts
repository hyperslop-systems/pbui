import {
  applyLinkVerb,
  bindingsAfterAppReplaced,
  bindingsAfterClone,
  bindingsAfterViewsRemoved,
  createPresentationTypeGraph,
  type Binding,
  type LinkDeps,
  type LinkSnapshot,
  type LinkVerb,
  type PortId,
  type PresentationTypeGraph,
  type SerializableReference,
} from "@hyperslop-systems/pbui";
import type { Mutation, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { newId } from "@hyperslop-systems/workbench-protocol/client";
import type { AppRegistry } from "../apps";
import type { WorkbenchStore } from "../store";
import { linksChange } from "./document";
import type { LinkRuntime } from "./runtime";
import { buildLinkSnapshot } from "./snapshot";

/**
 * What a product hands the workbench for linking (design §6.6): the type
 * graph its ports are typed against, how a value is named in a badge, and
 * (Phase 6) the relation registry. Absent ⇒ a graph with no types, where
 * only equal type ids and `<any>` reach each other.
 */
export interface LinkEnvironment {
  graph?: PresentationTypeGraph;
  label?(reference: SerializableReference): string;
  relation?: LinkDeps["relation"];
}

/** The link facilities a workbench exposes (`workbench.links`). */
export interface WorkbenchLinks {
  runtime: LinkRuntime;
  deps: LinkDeps;
  /** The current facts; cached per (document, runtime state) so every reader in one render shares one object. */
  snapshot(): LinkSnapshot;
  /** The out port whose attended or emitted value is this reference — the provenance of what the user is pointing at. */
  sourceOf(reference: SerializableReference): PortId | null;
}

export interface LinkHandlers extends WorkbenchLinks {
  /** Apply one link verb: fresh snapshot → kernel → one `documentPut`; false with `onRejected` on refusal. */
  perform(verb: LinkVerb): boolean;
  /**
   * The link maintenance a batch implies (design §6.9): views deleted →
   * followers apply `onSourceClose`; a view's app replaced → stale terms
   * dropped; views cloned → terms re-keyed. One extra mutation, appended to
   * the same batch, or null when the batch touches no linked port.
   */
  maintenance(current: WorkbenchDocument, mutations: readonly Mutation[]): Mutation | null;
  /** After a committed batch: forget runtime values of deleted views. */
  afterCommit(mutations: readonly Mutation[]): void;
}

export interface CreateLinkHandlersOptions {
  store: WorkbenchStore;
  apps: AppRegistry;
  runtime: LinkRuntime;
  environment?: LinkEnvironment;
  onRefused?(verb: LinkVerb, because: string, code: string): void;
}

export function createLinkHandlers({ store, apps, runtime, environment = {}, onRefused }: CreateLinkHandlersOptions): LinkHandlers {
  const deps: LinkDeps = {
    graph: environment.graph ?? createPresentationTypeGraph([]),
    ...(environment.label ? { label: environment.label } : {}),
    ...(environment.relation ? { relation: environment.relation } : {}),
  };

  let cached: { document: WorkbenchDocument; runtimeRevision: number; snapshot: LinkSnapshot } | null = null;
  let documentRevision = 0;
  const snapshotOf = (document: WorkbenchDocument): LinkSnapshot => {
    const state = runtime.getState();
    if (cached && cached.document === document && cached.runtimeRevision === state.revision) return cached.snapshot;
    if (!cached || cached.document !== document) documentRevision += 1;
    const snapshot = buildLinkSnapshot(document, apps, state, documentRevision);
    cached = { document, runtimeRevision: state.revision, snapshot };
    return snapshot;
  };

  const perform = (verb: LinkVerb): boolean => {
    if (verb.kind === "link.mode.open") {
      store.setState({ linkModeOpen: true });
      return true;
    }
    if (verb.kind === "link.mode.close") {
      store.setState({ linkModeOpen: false });
      return true;
    }
    const current = store.getState().document;
    const result = applyLinkVerb(verb, snapshotOf(current), deps, { newLinkId: () => newId("link") });
    if (result.kind === "refused") {
      const plan = result.plan;
      onRefused?.(verb, plan.kind === "unavailable" ? plan.because : "the choice is ambiguous", plan.kind === "unavailable" ? plan.code : "ambiguous");
      return false;
    }
    if (result.kind === "browser-local") return true;
    const change = linksChange(current, result.bindings);
    return change ? store.mutate([change]) : true;
  };

  const maintenance: LinkHandlers["maintenance"] = (current, mutations) => {
    const snapshot = snapshotOf(current);
    if (snapshot.bindings.size === 0) return null;
    const removed = new Set<string>();
    const replaced: Array<{ viewId: string; appId: string }> = [];
    const cloned = new Map<string, string>();
    for (const mutation of mutations) {
      const body = mutation.body;
      if (body.case === "viewDelete") removed.add(body.value.viewId);
      else if (body.case === "viewConfigure" && body.value.appId) replaced.push({ viewId: body.value.viewId, appId: body.value.appId });
      else if (body.case === "viewClone") cloned.set(body.value.sourceViewId, body.value.newViewId);
    }
    if (removed.size === 0 && replaced.length === 0 && cloned.size === 0) return null;
    let next: ReadonlyMap<PortId, Binding> = removed.size > 0 ? bindingsAfterViewsRemoved(removed, snapshot, deps) : snapshot.bindings;
    for (const { viewId, appId } of replaced) {
      const before = current.views[viewId]?.appId;
      if (before === appId) continue;
      const kept = new Set((apps.get(appId)?.ports ?? []).map((port) => port.name));
      next = bindingsAfterAppReplaced(viewId, kept, next);
    }
    if (cloned.size > 0) next = bindingsAfterClone(cloned, next);
    return linksChange(current, next);
  };

  return {
    runtime,
    deps,
    snapshot: () => snapshotOf(store.getState().document),
    sourceOf: (reference) => runtime.sourceOf(reference),
    perform,
    maintenance,
    afterCommit(mutations) {
      for (const mutation of mutations) {
        if (mutation.body.case === "viewDelete") runtime.forgetView(mutation.body.value.viewId);
      }
    },
  };
}
