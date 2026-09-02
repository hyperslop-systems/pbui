import {
  applyLinkVerb,
  bindingsAfterAppReplaced,
  bindingsAfterClone,
  bindingsAfterViewsRemoved,
  createPresentationTypeGraph,
  freshCandidate,
  identityAfterViewsRemoved,
  linkVerbs,
  resolveShow,
  type Binding,
  type LinkDeps,
  type LinkSnapshot,
  type LinkVerb,
  type PlacementCandidate,
  type PortId,
  type SerializableReference,
  type ShowCandidate,
  type ShowQuery,
  type SpawnableApp,
} from "@hyperslop-systems/pbui";
import type { Mutation, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { leaves, newId, viewsOfApp, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import type { AppRegistry } from "../apps";
import type { WorkbenchStore } from "../store";
import type { WorkbenchPlan, WorkbenchPlanResult } from "../types";
import type { PlaceZone, WorkbenchVerb } from "../verbs";
import { linksChange } from "./document";
import type { LinkRuntime } from "./runtime";
import { buildLinkSnapshot } from "./snapshot";

/**
 * What a product hands the workbench for linking (design §6.6, revised by
 * PBUI-KERNEL-1 §11.5): the narrow link-kernel dependencies — the SAME type
 * graph its menus resolve on, how a value is named in a badge, and the
 * derivation-exposed relations with their evaluator. A product with a
 * compiled presentation obtains this from `presentation.linkDeps(...)`.
 *
 * Required whenever any application declares ports: the old default of an
 * empty graph (where only equal type ids and `<any>` reached) let a product
 * ship a workbench whose links and menus disagreed about types (C10).
 */
export type LinkEnvironment = LinkDeps;

/** The link facilities a workbench exposes (`workbench.links`). */
export interface WorkbenchLinks {
  runtime: LinkRuntime;
  deps: LinkDeps;
  /** The current facts; cached per (document, runtime state) so every reader in one render shares one object. */
  snapshot(): LinkSnapshot;
  /** The out port whose attended or emitted value is this reference — the provenance of what the user is pointing at. */
  sourceOf(reference: SerializableReference): PortId | null;
}

/** What the show handler borrows from the shell: an atomic planner, and the aimed open for when there is none. */
export interface LinkShellHooks {
  planner?: { plan(verbs: readonly WorkbenchVerb[]): WorkbenchPlanResult; applyPlan(plan: WorkbenchPlan): boolean };
  openView?(appId: string, documents: Record<string, string>, options: { at: { placementId: string; zone: PlaceZone }; viewId: string }): string | null;
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
  /** The shell wires its planner and aimed open in after construction (Phase 4 spawn). */
  attach(hooks: LinkShellHooks): void;
}

export interface CreateLinkHandlersOptions {
  store: WorkbenchStore;
  apps: AppRegistry;
  runtime: LinkRuntime;
  environment?: LinkEnvironment;
  onRefused?(verb: LinkVerb, because: string, code: string): void;
}

/**
 * Without a product projection, the graph is the set of value types the
 * applications' ports DECLARE, as isolated nodes: only equal type ids (and
 * `<any>`) reach, no relation exists, and no type is invented. This is not
 * the pre-KERNEL-1 EMPTY graph — every declared port type is a real node, so
 * the closed world (C9) holds — but it cannot express subtyping. A product
 * whose ports rely on inheritance (an `<inspectable>` subject accepting an
 * order) passes `presentation.linkDeps(...)`, the same graph its menus use.
 */
function declaredPortGraph(apps: AppRegistry) {
  const ids = new Set<string>();
  for (const app of apps.list()) for (const port of app.ports ?? []) ids.add(port.contract.valueType);
  ids.delete("any");
  return createPresentationTypeGraph([...ids].map((id) => ({ id })));
}

export function createLinkHandlers({ store, apps, runtime, environment, onRefused }: CreateLinkHandlersOptions): LinkHandlers {
  const deps: LinkDeps = environment ?? { graph: declaredPortGraph(apps) };
  const hooks: LinkShellHooks = {};

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

  const refuse = (verb: LinkVerb, because: string, code: string): false => {
    onRefused?.(verb, because, code);
    return false;
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
    if (verb.kind === "relation.palette.open") {
      store.setState({ relationPalette: { destination: verb.destination, ...(verb.source ? { source: verb.source } : {}) } });
      return true;
    }
    if (verb.kind === "relation.palette.close") {
      store.setState({ relationPalette: null });
      return true;
    }
    if (verb.kind === "show") return performShow(verb);
    const current = store.getState().document;
    const result = applyLinkVerb(verb, snapshotOf(current), deps, { newLinkId: () => newId("link") });
    if (result.kind === "refused") {
      const plan = result.plan;
      return refuse(verb, plan.kind === "unavailable" ? plan.because : "the choice is ambiguous", plan.kind === "unavailable" ? plan.code : "ambiguous");
    }
    if (result.kind === "browser-local") return true;
    const change = linksChange(current, result.state);
    if (change && !store.mutate([change])) return false;
    // Runtime effects (class cells seeded on merge, private values restored on split) follow the document write.
    runtime.apply(result.effects);
    return true;
  };

  /* ---- show: the target resolver (Phase 4) ------------------------------- */

  /** Where a new tile could go: beside the source's tile, else beside the active tile, else beside the first. */
  const placementsFor = (current: WorkbenchDocument, from: PortId | null): PlacementCandidate[] => {
    const state = store.getState();
    const tree = workspaceTree(current, state.workspaceId);
    const all = leaves(tree);
    const fromView = from ? from.split("/")[0] : null;
    const leaf = (fromView ? all.find((node) => node.body.case === "leaf" && node.body.value.viewId === fromView) : undefined) ?? all.find((node) => node.id === state.activePlacementId) ?? all[0];
    if (!leaf || leaf.body.case !== "leaf") return [];
    const view = current.views[leaf.body.value.viewId];
    const app = view ? apps.get(view.appId) : null;
    const title = view ? view.title || app?.titleFor?.(view) || app?.title || view.appId : "that tile";
    return [
      { id: `${leaf.id}:right`, label: `split right of ${title}`, placementId: leaf.id, zone: "right", scopeIndex: 0 },
      { id: `${leaf.id}:bottom`, label: `split below ${title}`, placementId: leaf.id, zone: "bottom", scopeIndex: 0 },
    ];
  };

  /** Every (app, input port) that could be opened to show a value; placed singletons are already on screen. */
  const spawnableFor = (current: WorkbenchDocument): SpawnableApp[] => {
    const out: SpawnableApp[] = [];
    for (const app of apps.list()) {
      if (app.singleton && viewsOfApp(current, app.id).length > 0) continue;
      for (const port of app.ports ?? []) {
        if (port.direction === "out" || port.documentSlot) continue;
        out.push({ appId: app.id, title: app.title, portName: port.name, valueType: port.contract.valueType, semanticRole: port.contract.semanticRole });
      }
    }
    return out;
  };

  const resolve = (verb: Extract<LinkVerb, { kind: "show" }>) => {
    const current = store.getState().document;
    const snapshot = snapshotOf(current);
    const query: ShowQuery = {
      subject: verb.subject,
      ...(verb.role ? { role: verb.role } : {}),
      ...(verb.disposition ? { disposition: verb.disposition } : {}),
      from: verb.from ?? runtime.sourceOf(verb.subject),
    };
    const state = store.getState();
    const currentViews = new Set(leaves(workspaceTree(current, state.workspaceId)).map((node) => (node.body.case === "leaf" ? node.body.value.viewId : "")));
    const resolution = resolveShow(query, snapshot, deps, {
      placements: placementsFor(current, query.from ?? null),
      spawnable: spawnableFor(current),
      inCurrentWorkspace: (port) => currentViews.has(port.viewId),
    });
    return { query, resolution };
  };

  const applyCandidate = (verb: LinkVerb, candidate: ShowCandidate, query: ShowQuery): boolean => {
    if (candidate.kind === "existing-port") {
      // No verb ⇒ the target already shows the source (an available no-op).
      return candidate.verb ? perform(candidate.verb) : true;
    }
    // A spawn: open the tile under a pre-minted view id and link its port, in ONE plan
    // when the shell lent its planner; else two batches (a shadow store inside a plan).
    const viewId = newId("v");
    const port = `${viewId}/${candidate.app.portName}`;
    const open: WorkbenchVerb = { kind: "view.open", appId: candidate.app.appId, documents: {}, at: { placementId: candidate.placement.placementId, zone: candidate.placement.zone }, viewId };
    const link: LinkVerb = query.from ? linkVerbs.follow(query.from, port) : linkVerbs.bind(port, query.subject);
    if (hooks.planner) {
      const planned = hooks.planner.plan([open, link]);
      if (!planned.ok) return refuse(verb, planned.error, "spawn-refused");
      return hooks.planner.applyPlan(planned.plan);
    }
    if (!hooks.openView) return refuse(verb, "this workbench cannot open tiles from a show", "no-shell");
    const placed = hooks.openView(candidate.app.appId, {}, { at: { placementId: candidate.placement.placementId, zone: candidate.placement.zone }, viewId });
    if (!placed) return refuse(verb, "the tile could not be opened", "spawn-refused");
    return perform(link);
  };

  const performShow = (verb: Extract<LinkVerb, { kind: "show" }>): boolean => {
    const { query, resolution } = resolve(verb);
    if (verb.candidateId) {
      const fresh = freshCandidate(verb.candidateId, resolution);
      if (fresh.kind === "refused") return refuse(verb, fresh.because, fresh.code);
      store.setState({ showChooser: null });
      return applyCandidate(verb, fresh.candidate, query);
    }
    if (resolution.winners.length === 1) return applyCandidate(verb, resolution.winners[0]!, query);
    if (resolution.winners.length === 0) return refuse(verb, "nothing on screen can show this, and nothing can be opened for it", "no-target");
    // Several targets tie: the chooser, never a guess (report §8.9).
    store.setState({ showChooser: { query, resolution } });
    return true;
  };

  const maintenance: LinkHandlers["maintenance"] = (current, mutations) => {
    const snapshot = snapshotOf(current);
    if (snapshot.bindings.size === 0 && snapshot.identity.length === 0) return null;
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
    const identity = removed.size > 0 ? identityAfterViewsRemoved(removed, snapshot) : { identity: [...snapshot.identity], classes: [...snapshot.classes.values()] };
    const history = new Map([...snapshot.history].filter(([port]) => identity.classes.some((cls) => cls.members.includes(port))));
    return linksChange(current, { bindings: next, identity: identity.identity, classes: identity.classes, history });
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
    attach(extra) {
      Object.assign(hooks, extra);
    },
  };
}
