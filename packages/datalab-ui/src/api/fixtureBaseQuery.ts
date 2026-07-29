import type { BaseQueryFn, FetchArgs } from "@reduxjs/toolkit/query";
import type { SourceRef } from "../model/table";
import {
  applyBudget,
  fixtureDatasets,
  fixtureDrops,
  fixtureMe,
  fixtureStreams,
  sameSource,
  type FixtureData,
} from "./fixtures";
import { fixtureRouteOf } from "./request";

/**
 * A base query that answers from a fixture map, or falls through to the real
 * one when there is no map (DATADROP-7 DR-48).
 *
 * The map arrives on the store's thunk extra argument, which RTK Query hands to
 * every base query as `api.extra`. That is the whole trick, and it is why this
 * mechanism was chosen over three tidier-looking ones: the extra argument is
 * configured per store, so the fixture map's scope is exactly the workbench
 * instance's scope, and not one call site above here has to know.
 *
 * Fixture-capable endpoint builders attach a discriminated `FixtureRoute` to
 * their normal FetchArgs. The real transport ignores that extra property; this
 * transport switches on it. Route paths therefore have one owner.
 */

interface Extra {
  fixtures?: FixtureData;
}

/** The path and params of a request, whichever form the endpoint used. */
function partsOf(args: string | FetchArgs): { url: string; params: Record<string, unknown> } {
  if (typeof args === "string") return { url: args, params: {} };
  return { url: args.url, params: (args.params ?? {}) as Record<string, unknown> };
}

export function fixtureBaseQuery(real: BaseQueryFn): BaseQueryFn {
  return async (args, api, extraOptions) => {
    const fixtures = (api.extra as Extra | undefined)?.fixtures;
    if (!fixtures) return real(args, api, extraOptions);

    const typed = args as string | FetchArgs;
    const { url } = partsOf(typed);
    const route = fixtureRouteOf(typed);

    if (route?.kind === "table") {
      const hit = fixtures.sources.find((entry) => sameSource(entry.source, route.source));
      if (hit) return { data: applyBudget(hit.table, route.limit) };
      // Deliberately a 404 rather than an empty table. An unknown source is a
      // bug in the tour content, and a panel reading "no such source" says so
      // where an empty chart would look like the reader's mistake.
      return { error: { status: 404, data: `no fixture for ${describe(route.source)}` } };
    }

    if (route?.kind === "me") return { data: fixtureMe(fixtures) };
    if (route?.kind === "drops") return { data: fixtureDrops(fixtures) };
    if (route?.kind === "streams") return { data: fixtureStreams(fixtures, route.drop) };
    if (route?.kind === "datasets") return { data: fixtureDatasets(fixtures, route.drop) };

    /**
     * Everything else is refused, and the refusal is the design.
     *
     * A fixture-backed instance NEVER reaches the network. Falling through here
     * would mean a tour panel on a machine with a dev server running behaves
     * differently from the same panel on a laptop with no server — which is the
     * class of difference that makes a bug report unreproducible.
     *
     * The account endpoints land here, which is correct: an embedded workbench
     * has no session to list and no token to mint, and a 501 in the console is
     * a better answer than a real mutation aimed at a real server.
     */
    return { error: { status: 501, data: `${url} is not available in a fixture workbench` } };
  };
}

function describe(source: SourceRef): string {
  return source.kind === "stream"
    ? `stream ${source.drop}/${source.stream}`
    : `dataset ${source.drop}/${source.dataset}${source.path ? `/${source.path}` : ""}`;
}
