// The data layer: RTK Query over the datadrop v1 API.
//
// The chart workbench reads and never writes. DATADROP-5 added exactly six
// mutations, none of them in the workbench: minting and revoking an API token,
// signing out, and the three-step dataset upload. That set is pinned by
// test/api-surface.test.ts — a change-detector by design, because this is a
// security boundary and the desired behaviour when someone adds a seventh is
// that a test fails and a human looks (DR-27).
//
// So a compromised bundle can read what the caller could already read, and can
// write only through those six. Everything about sources, tables, charts,
// pipelines and snapshots remains read-only.

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { fixtureBaseQuery } from "./fixtureBaseQuery";
import type { SourceRef, Table } from "../model/table";
import { request } from "./request";

/**
 * Where an optional user-owned ddp_ bearer token lives for a browser session.
 *
 * sessionStorage, not localStorage: a credential that outlives the tab is a
 * credential that outlives the user's attention. Normal UI sign-in uses the
 * HttpOnly session cookie created by the backend-for-frontend flow, so this
 * value is empty unless a user deliberately supplies their own API token.
 *
 * The cookie means an XSS bug can make requests while the page is open but
 * cannot exfiltrate the browser credential (DR-19).
 *
 * A cookie IS an ambient credential, so it does reintroduce the CSRF surface
 * this comment used to say we had eliminated. That is paid for on the server:
 * every unsafe method authenticated by cookie must carry an Origin matching the
 * configured external URL, checked inside authorizeDrop so it cannot be
 * forgotten on a new endpoint (DR-21).
 */
const TOKEN_KEY = "datadrop-token";

export function readToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    // Private browsing modes can throw on storage access. A workbench with no
    // token still works against a public-read drop.
    return "";
  }
}

export function writeToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore: see readToken */
  }
}

export interface DropSummary {
  name: string;
  created_at: string;
  public_read?: boolean;
  retention?: string;
  /** Empty for a drop that predates DATADROP-5 and has not been claimed. */
  owner_id?: string;
  /**
   * The caller's effective role, computed server-side.
   *
   * It exists so the UI can grey out an action it knows will 403 rather than
   * offering it and failing — the same principle as a disabled menu entry
   * showing the rule instead of hiding it.
   */
  your_role?: "reader" | "writer" | "admin" | "";
}

export interface StreamInfo {
  stream: string;
  sequence: number;
  event_count: number;
  last_received_at?: string;
}

export interface DatasetFile {
  path: string;
  digest: string;
  size_bytes: number;
  media_type?: string;
}

export interface DatasetVersion {
  drop: string;
  dataset: string;
  version: number;
  state: "draft" | "committed";
  file_count: number;
  total_bytes: number;
  created_at: string;
  committed_at?: string;
  files?: DatasetFile[];
}

export interface DatasetSummary {
  drop: string;
  name: string;
  created_at: string;
  versions?: DatasetVersion[];
}

export interface StreamTableArgs {
  drop: string;
  stream: string;
  limit: number;
  order?: "asc" | "desc";
  from?: string;
  to?: string;
}

export interface DatasetTableArgs {
  drop: string;
  dataset: string;
  version: number | "latest";
  path: string;
  limit: number;
  format?: string;
}

export interface MeUser {
  id: string;
  email?: string;
  name?: string;
  created_at: string;
}

export interface ProviderLinks {
  issuer: string;
  account_url: string;
  sign_in_url: string;
  sign_up_url: string;
}

/** What GET /v1/me answers. Never 401s: anonymous gets an anonymous answer. */
export interface Me {
  auth_mode: "oidc";
  authenticated: boolean;
  kind: "anonymous" | "session" | "token";
  user?: MeUser;
  scopes: string[];
  token_id?: string;
  signup_enabled: boolean;
  provider?: ProviderLinks;
  /**
   * The public dataset a signed-out visitor is shown, or absent (DATADROP-14).
   *
   * Reported by the server rather than hardcoded here, so an operator can put
   * their own data on the front door by editing the drop. Absent when the
   * deployment was started with `--seed-welcome=false`, and a client must treat
   * that as "there is nothing public here" rather than as an error.
   *
   * `version` is resolved server-side to the latest COMMITTED version. A
   * dataset source ref is incomplete without one, and the arrival rule points a
   * document straight at this rather than going through the source browser.
   *
   * ## What this field is actually for
   *
   * An earlier version of this comment said `SourceApp` needed no special case,
   * because its fallback already selects the first visible drop and for an
   * anonymous caller that IS the welcome drop. True of the source *browser*,
   * and the wrong conclusion: selecting a drop in the browser does not point
   * the chart DOCUMENT at it. A first-time visitor got a correctly-populated
   * sources tile beside an empty chart saying "no source — load one from the
   * sources tile", which is the exact opposite of what DATADROP-14 promised.
   *
   * `Workbench.tsx`'s arrival rule consumes this. Caught in review.
   */
  welcome?: {
    drop: string;
    dataset?: string;
    version?: number;
    path?: string;
    datasets?: Array<{ dataset: string; version: number; path: string }>;
  };
}

/** An API token as the API reports it. Structurally cannot carry a secret. */
export interface ApiToken {
  id: string;
  user_id: string;
  name: string;
  scopes: string[];
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
  revoked_at?: string;
}

/** The ONE response in the whole API that carries a secret (DR-28). */
export interface CreatedToken extends ApiToken {
  token: string;
}

export interface MemberInfo {
  drop: string;
  user_id: string;
  role: "reader" | "writer" | "admin";
  added_at: string;
  user?: { id: string; name?: string; email?: string };
}

export interface SessionInfo {
  id: string;
  current: boolean;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  user_agent?: string;
  ip?: string;
}

/**
 * The real transport.
 *
 * Split out so `fixtureBaseQuery` can wrap it (DATADROP-7 DR-48). A store with
 * no fixture map on its thunk extra argument reaches this and behaves exactly
 * as it always has; a store with one never gets here at all.
 */
const httpBaseQuery = fetchBaseQuery({
  baseUrl: "/v1",
  // "same-origin", never "include". The SPA is served from the same origin as
  // the API (pkg/webui mounts at /ui on the API server), so this attaches the
  // session cookie to our own requests and to nothing else.
  credentials: "same-origin",
  prepareHeaders: (headers) => {
    // A user may deliberately supply a local ddp_ token. A bearer beats a
    // cookie server-side, so presenting both is well defined.
    const token = readToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

/**
 * The request each endpoint builds, as named functions.
 *
 * Extracted from the `query` fields below so that something other than RTK can
 * call them (DATADROP-7 phase 3).
 *
 * Fixture-capable reads carry typed metadata beside the FetchArgs. The HTTP
 * transport ignores it; the fixture transport consumes it without parsing a
 * URL back into endpoint semantics.
 */
export const PATHS = {
  me: () => request("/me", { kind: "me" }),
  drops: () => request("/drops", { kind: "drops" }),
  streams: (drop: string) =>
    request(`/drops/${encodeURIComponent(drop)}/streams`, { kind: "streams", drop }),
  datasets: (drop: string) =>
    request(`/drops/${encodeURIComponent(drop)}/datasets`, { kind: "datasets", drop }),
  dataset: ({ drop, dataset }: { drop: string; dataset: string }) =>
    `/drops/${encodeURIComponent(drop)}/datasets/${encodeURIComponent(dataset)}`,
  datasetVersion: ({
    drop,
    dataset,
    version,
  }: {
    drop: string;
    dataset: string;
    version: number | "latest";
  }) =>
    `/drops/${encodeURIComponent(drop)}/datasets/${encodeURIComponent(dataset)}/versions/${version}`,
  streamTable: ({ drop, ...params }: StreamTableArgs) =>
    request(
      `/drops/${encodeURIComponent(drop)}/table`,
      {
        kind: "table",
        source: { kind: "stream", drop, stream: params.stream ?? "events" },
        limit: params.limit,
      },
      params,
    ),
  datasetTable: ({ drop, dataset, version, ...params }: DatasetTableArgs) =>
    request(
      `/drops/${encodeURIComponent(drop)}/datasets/${encodeURIComponent(dataset)}/versions/${version}/table`,
      {
        kind: "table",
        source: {
          kind: "dataset",
          drop,
          dataset,
          ...(version === "latest" ? {} : { version }),
          path: params.path,
        },
        limit: params.limit,
      },
      params,
    ),
  tokens: (includeRevoked?: boolean | void) =>
    includeRevoked ? "/me/tokens?include_revoked=true" : "/me/tokens",
  sessions: () => "/me/sessions",
} as const;

export const api = createApi({
  reducerPath: "datadrop",
  baseQuery: fixtureBaseQuery(httpBaseQuery),
  tagTypes: ["Me", "Tokens", "Sessions", "Members", "Drops"],
  endpoints: (build) => ({
    listDrops: build.query<{ drops: DropSummary[] }, void>({
      query: PATHS.drops,
      providesTags: ["Drops"],
    }),

    // ── accounts (DATADROP-5) ───────────────────────────────────────────────
    me: build.query<Me, void>({
      query: PATHS.me,
      providesTags: ["Me"],
    }),
    listTokens: build.query<{ tokens: ApiToken[] }, boolean | void>({
      query: PATHS.tokens,
      providesTags: ["Tokens"],
    }),
    createToken: build.mutation<
      CreatedToken,
      { name: string; scopes: string[]; expires_in?: string }
    >({
      query: (body) => ({ url: "/me/tokens", method: "POST", body }),
      // Deliberately no cache entry for the response: it carries the only copy
      // of the secret, and a cached secret is a secret in the Redux store,
      // which is a secret in localStorage the moment anyone persists it.
      invalidatesTags: ["Tokens"],
    }),
    revokeToken: build.mutation<void, string>({
      query: (id) => ({ url: `/me/tokens/${encodeURIComponent(id)}`, method: "DELETE" }),
      invalidatesTags: ["Tokens"],
    }),
    listMembers: build.query<{ drop: string; owner: string; members: MemberInfo[] }, string>({
      query: (drop) => `/drops/${encodeURIComponent(drop)}/members`,
      providesTags: (_result, _error, drop) => [{ type: "Members", id: drop }],
    }),
    setMember: build.mutation<
      void,
      { drop: string; userId: string; role: "reader" | "writer" | "admin" }
    >({
      query: ({ drop, userId, role }) => ({
        url: `/drops/${encodeURIComponent(drop)}/members/${encodeURIComponent(userId)}`,
        method: "PUT",
        body: { role },
      }),
      invalidatesTags: (_r, _e, { drop }) => [{ type: "Members", id: drop }],
    }),
    removeMember: build.mutation<void, { drop: string; userId: string }>({
      query: ({ drop, userId }) => ({
        url: `/drops/${encodeURIComponent(drop)}/members/${encodeURIComponent(userId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { drop }) => [{ type: "Members", id: drop }],
    }),
    lookupUser: build.query<{ id: string; name: string }, string>({
      query: (email) => `/users/lookup?email=${encodeURIComponent(email)}`,
    }),
    claimDrop: build.mutation<DropSummary, string>({
      query: (drop) => ({ url: `/drops/${encodeURIComponent(drop)}/claim`, method: "POST" }),
      invalidatesTags: ["Drops"],
    }),
    listSessions: build.query<{ sessions: SessionInfo[] }, void>({
      query: PATHS.sessions,
      providesTags: ["Sessions"],
    }),
    signOut: build.mutation<void, { global?: boolean } | void>({
      query: (args) => ({
        url: args?.global ? "/auth/logout?global=1" : "/auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["Me", "Tokens", "Sessions"],
    }),
    listStreams: build.query<{ streams: StreamInfo[] }, string>({
      query: PATHS.streams,
    }),
    listDatasets: build.query<{ datasets: DatasetSummary[] }, string>({
      query: PATHS.datasets,
    }),
    getDataset: build.query<DatasetSummary, { drop: string; dataset: string }>({
      query: PATHS.dataset,
    }),
    getDatasetVersion: build.query<
      DatasetVersion,
      { drop: string; dataset: string; version: number | "latest" }
    >({
      query: PATHS.datasetVersion,
    }),
    streamTable: build.query<Table, StreamTableArgs>({
      query: PATHS.streamTable,
    }),
    datasetTable: build.query<Table, DatasetTableArgs>({
      query: PATHS.datasetTable,
    }),
  }),
});

export const {
  useMeQuery,
  useListMembersQuery,
  useSetMemberMutation,
  useRemoveMemberMutation,
  useLazyLookupUserQuery,
  useClaimDropMutation,
  useListTokensQuery,
  useCreateTokenMutation,
  useRevokeTokenMutation,
  useListSessionsQuery,
  useSignOutMutation,
  useListDropsQuery,
  useListStreamsQuery,
  useListDatasetsQuery,
  useGetDatasetQuery,
  useGetDatasetVersionQuery,
  useStreamTableQuery,
  useDatasetTableQuery,
} = api;

/** The SSE URL a live tail subscribes to. */
export function streamURL(source: SourceRef, after: number): string {
  const params = new URLSearchParams({
    stream: source.stream ?? "events",
    after: String(after),
  });
  return `/v1/drops/${encodeURIComponent(source.drop)}/events/stream?${params}`;
}
