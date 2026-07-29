import type { FetchArgs } from "@reduxjs/toolkit/query";
import type { SourceRef } from "../model/table";

/**
 * Fixture semantics carried beside a normal HTTP request.
 *
 * This is deliberately not an API-client abstraction. The URL remains the
 * server contract; this metadata only prevents the in-memory fixture transport
 * from reverse-engineering endpoint identity from that URL.
 */
export type FixtureRoute =
  | { kind: "me" }
  | { kind: "drops" }
  | { kind: "streams"; drop: string }
  | { kind: "datasets"; drop: string }
  | { kind: "table"; source: SourceRef; limit: number };

export interface ApiRequest extends FetchArgs {
  fixture?: FixtureRoute;
}

export function request(
  url: string,
  fixture?: FixtureRoute,
  params?: FetchArgs["params"],
): ApiRequest {
  return {
    url,
    ...(params ? { params } : {}),
    ...(fixture ? { fixture } : {}),
  };
}

export function fixtureRouteOf(args: string | FetchArgs): FixtureRoute | null {
  return typeof args === "string" ? null : ((args as ApiRequest).fixture ?? null);
}
