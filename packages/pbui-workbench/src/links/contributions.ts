import {
  available,
  defineActions,
  inapplicable,
  planBind,
  planClear,
  planDetach,
  planFollow,
  planPin,
  planResume,
  planUnlink,
  reaches,
  parsePortId,
  unavailable,
  type ActionContribution,
  type Availability,
  type LinkDeps,
  type LinkPlan,
  type LinkSnapshot,
  type PortId,
  type PresentationReference,
  type PresentationTypeDefinition,
  type RuntimeTypeId,
  type ScopeId,
  type SelectionSnapshot,
  type SerializableReference,
  type UnlinkPolicy,
} from "@hyperslop-systems/pbui";
import { workbenchScopes } from "../actions";
import { workbenchVerbs, type WorkbenchVerb } from "../verbs";
import type { LinkRef } from "./linkRef";
import type { PortRef } from "./portRef";

/*
 * The link menus (design §6.8.1–6.8.2), as kernel contributions a product
 * spreads into its registry beside `workbenchTileContributions()`:
 *
 * - rules for subject `"port"` — Pin, Resume, Detach, Unlink (one row per
 *   policy), Fall back, Go to source — each planned against the link
 *   snapshot in the facts, so an unavailable row stays visible with its
 *   reason;
 * - the "Link to…" family for the product's linkable subject types: one
 *   row per compatible input port on screen, binding `port.follow` from the
 *   subject's source port when the runtime knows one, else `port.bind` on
 *   the value itself.
 *
 * The facts are read through `links(snapshot)`, which the product's
 * `snapshotFor` fills from `workbench.links`. Nothing here reads a store.
 */

export const linkTypeDefinitions: readonly PresentationTypeDefinition[] = [{ id: "port" }, { id: "link" }, { id: "context" }];

export interface LinkFacts {
  snapshot: LinkSnapshot;
  deps: LinkDeps;
  /** The out port a presentation was last presented from, if the runtime knows. */
  sourceOf?(reference: SerializableReference): PortId | null;
}

export interface WorkbenchLinkContributionOptions<ProductFacts> {
  /** Where the link facts live in the product's snapshot; null when the product has no workbench yet. */
  links(snapshot: SelectionSnapshot<ProductFacts>): LinkFacts | null;
  /** The presentation types "Link to…" is offered on, matched by subtype. Absent ⇒ no family. */
  subjects?: readonly RuntimeTypeId[];
  /** Scopes the rules and the family are declared in. Default: the workbench scope. */
  scopes?: readonly ScopeId[];
}

const statusOf = (plan: LinkPlan): Availability => (plan.kind === "available" ? available() : plan.kind === "unavailable" ? unavailable(plan.because, plan.code) : unavailable("the choice is ambiguous", "ambiguous"));

export function workbenchLinkContributions<Values extends { port: unknown; link?: unknown; tile?: unknown }, ProductFacts>(
  options: WorkbenchLinkContributionOptions<ProductFacts>,
): readonly ActionContribution<Values, ProductFacts, WorkbenchVerb>[] {
  type PortValues = { port: PortRef };
  const define = defineActions<PortValues, ProductFacts, WorkbenchVerb>();
  const scopes = [...(options.scopes ?? workbenchScopes)];
  const facts = (snapshot: SelectionSnapshot<ProductFacts>) => options.links(snapshot);
  const NO_LINKS = unavailable("this product has no link facts in its snapshot", "no-links");

  const planned = (plan: (port: PortRef, links: LinkFacts) => LinkPlan) => ({
    test: ({ subject, snapshot }: { subject: { value: PortRef }; snapshot: SelectionSnapshot<ProductFacts> }) => {
      const links = facts(snapshot);
      return links ? statusOf(plan(subject.value, links)) : NO_LINKS;
    },
    bind: ({ subject, snapshot }: { subject: { value: PortRef }; snapshot: SelectionSnapshot<ProductFacts> }): WorkbenchVerb => {
      const links = facts(snapshot);
      const result = links ? plan(subject.value, links) : null;
      if (result?.kind === "available") return result.verb;
      // Unreachable for a selected available candidate; a no-op verb keeps the type honest.
      return { kind: "link.mode.close" };
    },
  });

  const contributions: ActionContribution<PortValues, ProductFacts, WorkbenchVerb>[] = [
    define.exact("port", {
      id: "workbench.port.pin",
      action: "port.pin",
      scopes,
      metadata: { label: "Pin", description: "keep the value it shows now; the source can be resumed later", order: 10 },
      ...planned((port, { snapshot, deps }) => planPin(port.port, snapshot, deps)),
    }),
    define.exact("port", {
      id: "workbench.port.resume",
      action: "port.resume",
      scopes,
      metadata: { label: "Resume", description: "follow the suspended source again, catching up to its current value", order: 11 },
      ...planned((port, { snapshot }) => planResume(port.port, snapshot)),
    }),
    define.exact("port", {
      id: "workbench.port.detach",
      action: "port.detach",
      scopes,
      metadata: { label: "Detach as a fixed value", description: "keep the value and forget where it came from", order: 12 },
      ...planned((port, { snapshot, deps }) => planDetach(port.port, snapshot, deps)),
    }),
    ...(["freeze", "clear", "ambient"] as const).map((policy: UnlinkPolicy, index) =>
      define.exact("port", {
        id: `workbench.port.unlink.${policy}`,
        action: `port.unlink.${policy}`,
        scopes,
        test: ({ subject, snapshot }) => {
          if (!subject.value.linkId) return inapplicable();
          const links = facts(snapshot);
          return links ? statusOf(planUnlink(subject.value.linkId, policy, links.snapshot, links.deps)) : NO_LINKS;
        },
        metadata: {
          label: policy === "freeze" ? "Unlink · keep the last value" : policy === "clear" ? "Unlink · clear" : "Unlink · fall back to ambient",
          description: policy === "freeze" ? "cut the wire; the tile holds what it shows now" : policy === "clear" ? "cut the wire; the tile shows nothing" : "cut the wire; the tile reads its ambient context again",
          order: 20 + index,
          danger: policy === "clear",
        },
        bind: ({ subject }) => ({ kind: "port.unlink", linkId: subject.value.linkId ?? "", policy }),
      }),
    ),
    define.exact("port", {
      id: "workbench.port.clear",
      action: "port.clear",
      scopes,
      metadata: { label: ({ subject }) => (subject.value.state === "fixed" ? "Unfix" : "Return to its fallback"), description: "forget the explicit binding; the declared fallback applies", order: 30 },
      ...planned((port, { snapshot }) => planClear(port.port, snapshot)),
    }),
    define.exact("port", {
      id: "workbench.port.go-to-source",
      action: "port.go-to-source",
      scopes,
      test: ({ subject }) => (subject.value.sourcePort ? available() : inapplicable()),
      metadata: { label: ({ subject }) => `Go to ${subject.value.sourcePort ? (parsePortId(subject.value.sourcePort)?.viewId ?? "source") : "source"}`, description: "the tile this port reads from", order: 40 },
      bind: ({ subject }) => workbenchVerbs.goTo(parsePortId(subject.value.sourcePort ?? "")?.viewId ?? ""),
    }),
  ];

  // Wires (connect mode, Phase 3): the same unlink policies, plus a way back to either end.
  type LinkValues = { link: LinkRef };
  const defineLink = defineActions<LinkValues, ProductFacts, WorkbenchVerb>();
  const linkContributions: ActionContribution<LinkValues, ProductFacts, WorkbenchVerb>[] = [
    ...(["freeze", "clear", "ambient"] as const).map((policy: UnlinkPolicy, index) =>
      defineLink.exact("link", {
        id: `workbench.link.unlink.${policy}`,
        action: `link.unlink.${policy}`,
        scopes,
        test: ({ subject, snapshot }) => {
          const links = facts(snapshot);
          return links ? statusOf(planUnlink(subject.value.linkId, policy, links.snapshot, links.deps)) : NO_LINKS;
        },
        metadata: {
          label: policy === "freeze" ? "Unlink · keep the last value" : policy === "clear" ? "Unlink · clear" : "Unlink · fall back to ambient",
          description: policy === "freeze" ? "cut the wire; the destination holds what it shows now" : policy === "clear" ? "cut the wire; the destination shows nothing" : "cut the wire; the destination reads its ambient context again",
          order: 10 + index,
          danger: policy === "clear",
        },
        bind: ({ subject }) => ({ kind: "port.unlink", linkId: subject.value.linkId, policy }),
      }),
    ),
    defineLink.exact("link", {
      id: "workbench.link.go-to-source",
      action: "link.go-to-source",
      scopes,
      metadata: { label: ({ subject }) => `Go to ${subject.value.sourceTitle}`, order: 20 },
      bind: ({ subject }) => workbenchVerbs.goTo(parsePortId(subject.value.source)?.viewId ?? ""),
    }),
    defineLink.exact("link", {
      id: "workbench.link.go-to-destination",
      action: "link.go-to-destination",
      scopes,
      metadata: { label: ({ subject }) => `Go to ${subject.value.destinationTitle}`, order: 21 },
      bind: ({ subject }) => workbenchVerbs.goTo(parsePortId(subject.value.destination)?.viewId ?? ""),
    }),
  ];
  contributions.push(...(linkContributions as unknown as ActionContribution<PortValues, ProductFacts, WorkbenchVerb>[]));

  // Doors into connect mode: from any badge, and from any tile.
  contributions.push(
    define.exact("port", {
      id: "workbench.port.show-wiring",
      action: "link.mode.open",
      scopes,
      metadata: { label: "Show wiring", description: "connect mode: every tile shows its ports, every link its wire (Mod+Shift+L)", order: 50 },
      bind: () => ({ kind: "link.mode.open" }),
    }),
  );
  type TileValues = { tile: unknown };
  const defineTile = defineActions<TileValues, ProductFacts, WorkbenchVerb>();
  contributions.push(
    defineTile.exact("tile", {
      id: "workbench.tile.connect",
      action: "link.mode.open",
      scopes,
      metadata: { label: "Connect…", description: "connect mode: every tile shows its ports, every link its wire (Mod+Shift+L)", order: 25 },
      bind: () => ({ kind: "link.mode.open" }),
    }) as unknown as ActionContribution<PortValues, ProductFacts, WorkbenchVerb>,
  );

  if (options.subjects && options.subjects.length > 0) {
    const familyDefine = defineActions<Values, ProductFacts, WorkbenchVerb>();
    for (const subject of options.subjects) {
      contributions.push(
        familyDefine.family(subject, {
          id: `workbench.link-to.${subject}`,
          match: "subtypes",
          scopes,
          expand: ({ subject: reference, snapshot }) => {
            const links = facts(snapshot);
            if (!links) return [];
            const value = reference as PresentationReference<Values> as unknown as SerializableReference;
            const from = links.sourceOf?.(value) ?? null;
            const fromView = from ? parsePortId(from)?.viewId : null;
            const targets = [...links.snapshot.ports.values()].filter(
              (port) => port.declaration.direction !== "out" && !port.declaration.documentSlot && port.viewId !== fromView && reaches(value.type, port.declaration.contract.valueType, links.deps.graph),
            );
            return targets.map((target) => {
              const plan = from ? planFollow(from, target.id, links.snapshot, links.deps) : planBind(target.id, value, links.snapshot, links.deps);
              return {
                key: `link-to:${target.id}`,
                action: `link.to.${target.id}`,
                status: statusOf(plan),
                metadata: {
                  label: `Link to ${target.tileTitle} · ${target.declaration.name}`,
                  description: from ? `${target.declaration.doc} — follows ${links.snapshot.ports.get(from)?.tileTitle ?? from}` : `${target.declaration.doc} — fixed on this value`,
                  group: "link",
                  order: 100,
                },
                bind: () => (plan.kind === "available" ? plan.verb : { kind: "link.mode.close" }),
              };
            });
          },
        }) as unknown as ActionContribution<PortValues, ProductFacts, WorkbenchVerb>,
      );
    }
  }

  return contributions as unknown as readonly ActionContribution<Values, ProductFacts, WorkbenchVerb>[];
}
