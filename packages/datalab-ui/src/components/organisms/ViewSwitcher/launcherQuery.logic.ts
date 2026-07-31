/**
 * The launcher's query grammar, in full.
 *
 * Deliberately tiny (DATALAB-VIEW-001 design-doc/02 §6, Decision 3): plain
 * search text, a leading `+` meaning "only applications that can create a new
 * view", and a leading `wsN` meaning "only views placed in workspace N". There
 * is no quoting, negation, `type:`, `app:` or Boolean operator, and none should
 * be added until a real result set shows the need.
 *
 * The two prefixes are the ones that pay for themselves immediately, because
 * they answer the two questions a flat list cannot: *I want a new thing* and
 * *I know where it is*.
 */

export type LauncherQueryKind = "all" | "new" | "workspace";

export type LauncherQueryError = "workspace-and-new-are-incompatible";

export interface ParsedLauncherQuery {
  kind: LauncherQueryKind;
  /** The search text with any prefix removed. May be empty. */
  text: string;
  /** One-based, and only for `kind: "workspace"`. See `workspaceAlias`. */
  workspaceOrdinal?: number;
  error?: LauncherQueryError;
}

/**
 * A workspace token, anchored to the start of the query only.
 *
 * Anchored because a view may legitimately be *called* "ws8 report", and a user
 * who types its title should find it. Only the leading token is a scope; the
 * same characters later in the query are search text like any other.
 *
 * `\b` after the digits so `ws8x` is not read as workspace 8 followed by "x" —
 * that is a typo, and searching every workspace for "x" is a worse answer than
 * searching everything for "ws8x".
 */
const WORKSPACE_TOKEN = /^ws([1-9]\d*)\b\s*/i;

/**
 * Parse a raw input string into a scope and the text to search within it.
 *
 * Total: every input produces a query. An unparseable prefix combination
 * produces a `kind` that can still be rendered plus an `error` the modal
 * explains, rather than an exception or a silently-empty result — the user is
 * mid-typing and the interface has to say something useful about it.
 */
export function parseLauncherQuery(raw: string): ParsedLauncherQuery {
  let rest = raw.trimStart();
  let workspaceOrdinal: number | undefined;

  const workspace = WORKSPACE_TOKEN.exec(rest);
  if (workspace?.[1]) {
    workspaceOrdinal = Number(workspace[1]);
    rest = rest.slice(workspace[0].length);
  }

  let onlyNew = false;
  if (rest.startsWith("+")) {
    onlyNew = true;
    rest = rest.slice(1).trimStart();
  }

  const text = rest.trim();

  // `ws8 +chart` asks for a new view *inside workspace 8*, which the model
  // cannot express: a new view is created into a target placement, and in v1
  // that target is wherever the launcher was opened from, not wherever the
  // query points. Reporting it beats guessing which half of the query to obey.
  if (workspaceOrdinal !== undefined && onlyNew) {
    return {
      kind: "workspace",
      workspaceOrdinal,
      text,
      error: "workspace-and-new-are-incompatible",
    };
  }

  if (onlyNew) return { kind: "new", text };
  if (workspaceOrdinal !== undefined) return { kind: "workspace", workspaceOrdinal, text };
  return { kind: "all", text };
}

/** The transient alias shown beside a workspace, one-based. See §8.3. */
export function workspaceAlias(index: number): string {
  return `ws${index + 1}`;
}
