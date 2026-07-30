import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { api } from "../src/api/client";

/**
 * The read-only boundary, pinned (DR-27).
 *
 * `ui/src/api/client.ts` used to be able to say "every endpoint here is a GET".
 * DATADROP-5 spent that property on reviewed account mutations. DATADROP-18
 * adds two scoped workbench authoring mutations: complete conditional replace
 * and typed conditional mutation.
 *
 * A change-detector test is normally a smell. On a security boundary it is the
 * mechanism: the desired behaviour when someone adds a seventh mutation is that
 * a test fails and a human looks at it. So this asserts the exact set rather
 * than a count or a pattern.
 */

/** Endpoint definitions RTK Query classified as mutations. */
function mutationNames(): string[] {
  const definitions = (
    api as unknown as {
      endpoints: Record<string, unknown>;
      util: { getRunningQueriesThunk?: unknown };
    }
  ).endpoints;

  // RTK Query hangs a `useMutation` hook on a mutation endpoint and a
  // `useQuery` hook on a query one, which is the cheapest honest way to tell
  // them apart without reaching into internals that may be renamed.
  return Object.entries(definitions)
    .filter(
      ([, endpoint]) => typeof (endpoint as { useMutation?: unknown }).useMutation === "function",
    )
    .map(([name]) => name)
    .sort();
}

describe("the API surface", () => {
  test("the set of mutating endpoints is exactly the reviewed set", () => {
    // Every entry is an account/membership operation or one of the two reviewed
    // workbench authoring boundaries.
    //
    // Note what is absent: the dataset upload triad. The uploader uses `fetch`
    // rather than RTK Query, because its payload is a File, its response is
    // discarded, and caching a 400 MB upload would be actively harmful. The
    // account mutation count therefore differs from the upload workflow count.
    expect(mutationNames()).toEqual(
      [
        "claimDrop",
        "createToken",
        "removeMember",
        "replaceWorkbench",
        "revokeToken",
        "setMember",
        "signOut",
        "mutateWorkbench",
      ].sort(),
    );
  });

  test("data execution endpoints remain read-only", () => {
    // Workbench mutations persist authoring documents and layout. They do not
    // mutate source drops, streams, datasets, materialized tables, or data.
    const chartish = ["Drops", "Streams", "Datasets", "Table", "Dataset"];
    for (const name of mutationNames()) {
      for (const fragment of chartish) {
        expect(name.includes(fragment)).toBe(false);
      }
    }
  });

  test("cookies are same-origin, never include", () => {
    // `credentials: "same-origin"` is what attaches the session cookie to our
    // own requests. It must never be "include": that would send the cookie to a
    // cross-origin baseUrl, which is the mistake the server's CSRF check exists
    // to survive rather than to permit.
    //
    // Asserted against the source because the option is swallowed by
    // fetchBaseQuery's closure and is not reachable from the built api object —
    // and an unreachable security-relevant setting is exactly the kind that
    // gets changed without anyone noticing.
    const source = readFileSync(new URL("../src/api/client.ts", import.meta.url), "utf8");
    expect(source).toContain('credentials: "same-origin"');
    expect(source).not.toContain('credentials: "include"');
  });
});
