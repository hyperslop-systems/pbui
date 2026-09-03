import { freshCandidate, linkVerbs, resolveShow, type PlacementCandidate, type ShowCandidate, type ShowQuery, type SpawnableApp } from "@hyperslop-systems/pbui";
import type { WorkbenchCommand, WorkbenchLinkCommand } from "../commands";
import { leavesOfWorkspace, placementCount } from "../queries";
import { prepared, refuse, unchanged, type Choice, type FragmentOutcome, type PlanWorld } from "./world";

/** A term-level link command: the kernel plans it on a fresh snapshot; the result is one `documentPut` plus effects, as data. */
export function planLinkCommand(world: PlanWorld, command: Exclude<WorkbenchLinkCommand, { kind: "show" }>): FragmentOutcome {
  if (!world.links) return refuse("no_links", "this workbench has no link support");
  const outcome = world.links.plan(command, world.document, world.ids);
  if (outcome.kind === "refused") return refuse(outcome.code, outcome.because);
  if (!outcome.mutation && outcome.effects.length === 0) return unchanged();
  return prepared({ mutations: outcome.mutation ? [outcome.mutation] : [], effects: outcome.effects, changed: true });
}

/** Where a new tile could go: beside the source's tile, else beside the active tile, else beside the first. */
function placementsFor(world: PlanWorld, from: string | null): PlacementCandidate[] {
  const { index, session, document: doc, links } = world;
  const all = leavesOfWorkspace(index, session.workspaceId);
  const fromView = from ? from.split("/")[0] : null;
  const leaf = (fromView ? all.find((node) => node.body.case === "leaf" && node.body.value.viewId === fromView) : undefined) ?? all.find((node) => node.id === session.activePlacementId) ?? all[0];
  if (!leaf || leaf.body.case !== "leaf") return [];
  const view = doc.views[leaf.body.value.viewId];
  const title = view ? links!.labels.view(view) : "that tile";
  return [
    { id: `${leaf.id}:right`, label: `split right of ${title}`, placementId: leaf.id, zone: "right", scopeIndex: 0 },
    { id: `${leaf.id}:bottom`, label: `split below ${title}`, placementId: leaf.id, zone: "bottom", scopeIndex: 0 },
  ];
}

/** Every (app, input port) that could be opened to show a value; placed singletons are already on screen. */
function spawnableFor(world: PlanWorld): SpawnableApp[] {
  const out: SpawnableApp[] = [];
  for (const app of world.apps.list()) {
    if (app.viewCardinality === "one" && (world.index.viewsByAppId.get(app.id)?.length ?? 0) > 0) continue;
    for (const port of app.ports ?? []) {
      if (port.direction === "out" || port.documentSlot) continue;
      out.push({ appId: app.id, title: world.links!.labels.app(app.id), portName: port.name, valueType: port.contract.valueType, semanticRole: port.contract.semanticRole });
    }
  }
  return out;
}

function choiceOf(candidate: ShowCandidate): Choice {
  const available = candidate.status.kind === "available";
  return {
    id: candidate.candidateId,
    label: candidate.title,
    explanation: candidate.explanation,
    available,
    ...(candidate.status.kind !== "available" ? { because: candidate.status.because } : {}),
  };
}

/**
 * "Show this value" (PBUI-LINK-1 Phase 4): resolve the best target on a
 * fresh snapshot. An existing port gets its verb; a spawn expands into a
 * `view.show` with a pre-minted view id plus the follow/bind on that view's
 * port, planned as ONE transition by the caller's loop. Several winners tie ⇒
 * ambiguous with the candidates as choices, never a guess.
 */
export function planShowValue(world: PlanWorld, command: Extract<WorkbenchLinkCommand, { kind: "show" }>, expand: (commands: readonly WorkbenchCommand[]) => FragmentOutcome): FragmentOutcome {
  if (!world.links) return refuse("no_links", "this workbench has no link support");
  const snapshot = world.links.snapshot(world.document);
  const query: ShowQuery = {
    subject: command.subject,
    ...(command.role ? { role: command.role } : {}),
    ...(command.disposition ? { disposition: command.disposition } : {}),
    from: command.from ?? world.links.sourceOf(command.subject),
  };
  const currentViews = new Set(leavesOfWorkspace(world.index, world.session.workspaceId).map((node) => (node.body.case === "leaf" ? node.body.value.viewId : "")));
  const resolution = resolveShow(query, snapshot, world.links.deps, {
    placements: placementsFor(world, query.from ?? null),
    spawnable: spawnableFor(world),
    inCurrentWorkspace: (port) => currentViews.has(port.viewId) && placementCount(world.index, port.viewId) > 0,
  });

  const apply = (candidate: ShowCandidate): FragmentOutcome => {
    if (candidate.kind === "existing-port") {
      // No verb ⇒ the target already shows the source (an available no-op).
      return candidate.verb ? expand([candidate.verb as WorkbenchCommand]) : unchanged();
    }
    const viewId = world.ids("v");
    const port = `${viewId}/${candidate.app.portName}`;
    const zone = candidate.placement.zone;
    const open: WorkbenchCommand = {
      kind: "view.show",
      view: { kind: "application", appId: candidate.app.appId, documents: {}, requestedViewId: viewId },
      placement: zone === "replace" ? { kind: "replace", target: candidate.placement.placementId } : zone === "center" ? { kind: "split", target: candidate.placement.placementId } : { kind: "split", target: candidate.placement.placementId, edge: zone },
    };
    const link = query.from ? linkVerbs.follow(query.from, port) : linkVerbs.bind(port, query.subject);
    return expand([open, link as WorkbenchCommand]);
  };

  if (command.candidateId) {
    const fresh = freshCandidate(command.candidateId, resolution);
    if (fresh.kind === "refused") return refuse(fresh.code, fresh.because);
    return apply(fresh.candidate);
  }
  if (resolution.winners.length === 1) return apply(resolution.winners[0]!);
  if (resolution.winners.length === 0) return refuse("no-target", "nothing on screen can show this, and nothing can be opened for it");
  return { kind: "ambiguous", because: "several tiles could show this", choices: resolution.candidates.map(choiceOf) };
}
