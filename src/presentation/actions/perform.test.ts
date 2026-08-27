import { describe, expect, test } from "vitest";
import { available } from "./availability";
import { defineActions } from "./define";
import { evaluateFresh } from "./perform";
import { createActionRegistry } from "./registry";
import { createPresentationTypeGraph } from "./typeGraph";
import type { ActionContribution, ActionQuery, SelectionSnapshot } from "./types";

/**
 * Revalidation (source guide §24.6): the stale menu row never authorizes
 * anything — perform re-resolves and requires the SAME candidate to still
 * win, then delegates the FRESH verb.
 */

type Values = { file: { id: string } };
type Facts = { canOpen: boolean; version: number };
type Verb = { kind: string; version?: number };

const graph = createPresentationTypeGraph([
  { id: "file" },
  { id: "image-file", parents: ["file"] },
]);
const define = defineActions<Values, Facts, Verb>();

const baseRule = define.exact("file", {
  id: "files.open",
  action: "presentation.open",
  scopes: ["global"],
  test: ({ snapshot }) =>
    snapshot.product.canOpen ? available() : { kind: "unavailable", because: "locked now" },
  metadata: { label: "Open" },
  bind: ({ snapshot }) => ({ kind: "open", version: snapshot.product.version }),
});

function snapshot(facts: Partial<Facts> = {}): SelectionSnapshot<Facts> {
  return {
    revision: facts.version ?? 1,
    scopes: ["global"],
    modes: new Set(),
    capabilities: new Set(),
    product: { canOpen: true, version: 1, ...facts },
  };
}

const fileQuery: ActionQuery<Values> = {
  subject: { type: "file", value: { id: "f1" } },
  invocation: "menu",
};

function resolveWith(
  contributions: readonly ActionContribution<Values, Facts, Verb>[],
  facts: Partial<Facts> = {},
) {
  return createActionRegistry<Values, Facts, Verb>({
    graph,
    scopes: ["global"],
    contributions,
  }).resolve(fileQuery, snapshot(facts));
}

describe("evaluateFresh", () => {
  const stale = resolveWith([baseRule]).actions[0];
  if (!stale) throw new Error("fixture failed to resolve");

  test("unchanged state proceeds — with the FRESH verb, never the stale one", () => {
    const decision = evaluateFresh(stale, resolveWith([baseRule], { version: 2 }));
    expect(decision).toMatchObject({ kind: "proceed", verb: { kind: "open", version: 2 } });
    // The decision also carries the FRESH resolved action (PBUI-ACTIONS-3
    // B1) so the perform envelope is built from post-revalidation truth.
    expect(decision.kind === "proceed" && decision.action.candidateId).toBe("files.open");
    // The stale row still carries version 1; delegating it would replay old state.
    expect(stale.verb).toEqual({ kind: "open", version: 1 });
  });

  test("the action no longer resolving refuses", () => {
    expect(evaluateFresh(stale, resolveWith([]))).toEqual({
      kind: "refused",
      code: "action-no-longer-resolves",
    });
  });

  test("a different winner (new more-specific rule) refuses rather than swapping semantics", () => {
    const specific = define.exact("file", {
      id: "plugin.open-differently",
      action: "presentation.open",
      scopes: ["global"],
      priority: 10,
      metadata: { label: "Open (plugin)" },
      bind: () => ({ kind: "open.plugin" }),
    });
    expect(evaluateFresh(stale, resolveWith([baseRule, specific]))).toEqual({
      kind: "refused",
      code: "action-implementation-changed",
    });
  });

  test("the action becoming unavailable refuses with the current reason", () => {
    expect(evaluateFresh(stale, resolveWith([baseRule], { canOpen: false }))).toEqual({
      kind: "refused",
      code: "action-no-longer-available",
      because: "locked now",
    });
  });

  test("the action becoming ambiguous refuses", () => {
    const rival = define.exact("file", {
      id: "rival.open",
      action: "presentation.open",
      scopes: ["global"],
      test: () => available(),
      metadata: { label: "Open" },
      bind: () => ({ kind: "open.rival" }),
    });
    expect(evaluateFresh(stale, resolveWith([baseRule, rival]))).toEqual({
      kind: "refused",
      code: "action-became-ambiguous",
    });
  });
});
