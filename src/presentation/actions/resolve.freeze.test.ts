import { describe, expect, test } from "vitest";
import { available, unavailable } from "./availability";
import { all, capability, definePredicate, modeOn, predicate } from "./conditions";
import type { Condition } from "./conditions";
import { defineActions } from "./define";
import { createActionRegistry } from "./registry";
import { createPresentationTypeGraph } from "./typeGraph";
import type { ActionQuery, SelectionSnapshot } from "./types";

/**
 * PBUI-HELP-001 Phase 1: freeze the FRONT HALF of `resolveActions` before the
 * shared contextual matcher is extracted (design doc §6, §17 Phase 1/2).
 *
 * These fixtures pin the behaviors the extraction must preserve byte-for-byte:
 * `when` conditions evaluated through full resolution, nearest-declared-scope
 * selection, the exact trace entries the front half emits, and the
 * condition-before-test evaluation order. `resolve.test.ts` already freezes
 * the back half (partitions, ladder, ambiguity, binding).
 */

type Values = {
  file: { id: string };
  "image-file": { id: string; format: string };
};
type Facts = { owner: string };
type Verb = { kind: string };

const graph = createPresentationTypeGraph([
  { id: "object", abstract: true },
  { id: "document", abstract: true, parents: ["object"] },
  { id: "file", parents: ["document"] },
  { id: "image-file", parents: ["file"] },
]);

const define = defineActions<Values, Facts, Verb>();

function snapshot(over: Partial<SelectionSnapshot<Facts>> = {}): SelectionSnapshot<Facts> {
  return {
    revision: 1,
    scopes: ["editor", "workbench", "global"],
    modes: new Set(),
    capabilities: new Set(),
    product: { owner: "me" },
    ...over,
  };
}

const file = { type: "file", value: { id: "f1" } } as const;

function query(invocation: ActionQuery<Values>["invocation"] = "menu"): ActionQuery<Values> {
  return { subject: file, invocation };
}

describe("when-conditions through full resolution", () => {
  const isOwner = definePredicate<Values, Facts>("product.is-owner", ({ snapshot: s }) =>
    s.product.owner === "me" ? available() : unavailable("not the owner"),
  );

  function registryWith(when: Condition) {
    return createActionRegistry<Values, Facts, Verb>({
      graph,
      scopes: ["editor", "workbench", "global"],
      predicates: [isOwner],
      contributions: [
        define.exact("file", {
          id: "files.edit",
          action: "file.edit",
          scopes: ["global"],
          when,
          metadata: { label: "Edit" },
          bind: () => ({ kind: "edit" }),
        }),
      ],
    });
  }

  test("a mode condition gates availability with its declared failure", () => {
    const registry = registryWith(modeOn("editing", unavailable("enable editing first")));
    const off = registry.resolve(query(), snapshot());
    expect(off.actions[0]?.status).toEqual({
      kind: "unavailable",
      because: "enable editing first",
    });
    expect(off.actions[0]?.verb).toBeUndefined();
    const on = registry.resolve(query(), snapshot({ modes: new Set(["editing"]) }));
    expect(on.actions[0]?.status).toEqual({ kind: "available" });
    expect(on.actions[0]?.verb).toEqual({ kind: "edit" });
  });

  test("`all` fails with the FIRST non-available child, and capability + predicate compose", () => {
    const registry = registryWith(
      all(capability("can-edit", unavailable("no edit capability")), predicate("product.is-owner")),
    );
    const neither = registry.resolve(query(), snapshot());
    expect(neither.actions[0]?.status).toEqual({
      kind: "unavailable",
      because: "no edit capability",
    });
    const capable = registry.resolve(
      query(),
      snapshot({ capabilities: new Set(["can-edit"]), product: { owner: "you" } }),
    );
    expect(capable.actions[0]?.status).toEqual({ kind: "unavailable", because: "not the owner" });
    const both = registry.resolve(query(), snapshot({ capabilities: new Set(["can-edit"]) }));
    expect(both.actions[0]?.status).toEqual({ kind: "available" });
  });

  test("a failing `when` short-circuits: test() never runs after a non-available condition", () => {
    const calls: string[] = [];
    const registry = createActionRegistry<Values, Facts, Verb>({
      graph,
      scopes: ["global"],
      contributions: [
        define.exact("file", {
          id: "files.gated",
          action: "file.gate",
          scopes: ["global"],
          when: modeOn("never-on", unavailable("mode is off")),
          test: () => {
            calls.push("test");
            return available();
          },
          metadata: { label: "Gated" },
          bind: () => ({ kind: "gated" }),
        }),
      ],
    });
    const result = registry.resolve(query(), snapshot({ scopes: ["global"] }));
    expect(result.actions[0]?.status).toEqual({ kind: "unavailable", because: "mode is off" });
    expect(calls).toEqual([]);
  });
});

describe("nearest declared scope", () => {
  test("a rule declaring several scopes matches at the NEAREST active one", () => {
    const registry = createActionRegistry<Values, Facts, Verb>({
      graph,
      scopes: ["editor", "workbench", "global"],
      contributions: [
        define.exact("file", {
          id: "files.inspect",
          action: "object.inspect",
          scopes: ["global", "workbench"],
          metadata: { label: "Inspect" },
          bind: () => ({ kind: "inspect" }),
        }),
      ],
    });
    const result = registry.resolve(query(), snapshot());
    expect(result.actions[0]?.provenance).toMatchObject({ scope: "workbench", scopeIndex: 1 });
  });
});

describe("front-half trace shape", () => {
  test("scope reject, invocation reject, and type pass entries keep their exact shape", () => {
    const registry = createActionRegistry<Values, Facts, Verb>({
      graph,
      scopes: ["editor", "global"],
      contributions: [
        define.exact("file", {
          id: "editor.only",
          action: "a.one",
          scopes: ["editor"],
          metadata: { label: "One" },
          bind: () => ({ kind: "one" }),
        }),
        define.exact("file", {
          id: "agent.only",
          action: "a.two",
          scopes: ["global"],
          invocations: ["agent"],
          metadata: { label: "Two" },
          bind: () => ({ kind: "two" }),
        }),
        define.inherited("document", {
          id: "docs.pass",
          action: "a.three",
          scopes: ["global"],
          metadata: { label: "Three" },
          bind: () => ({ kind: "three" }),
        }),
      ],
    });
    const trace = registry.resolve(query("menu"), snapshot({ scopes: ["global"] })).trace;
    expect(trace).toContainEqual({
      candidateId: "editor.only",
      contributionId: "editor.only",
      stage: "scope",
      result: "reject",
      reasonCode: "no-active-scope",
    });
    expect(trace).toContainEqual({
      candidateId: "agent.only",
      contributionId: "agent.only",
      stage: "scope",
      result: "reject",
      reasonCode: "invocation-not-allowed",
    });
    expect(trace).toContainEqual({
      candidateId: "docs.pass",
      contributionId: "docs.pass",
      stage: "type",
      result: "pass",
      distance: 1,
      scopeIndex: 0,
    });
  });

  test("a type-unreachable contribution emits NO trace entries at all", () => {
    const registry = createActionRegistry<Values, Facts, Verb>({
      graph,
      scopes: ["global"],
      contributions: [
        define.exact("image-file", {
          id: "images.only",
          action: "a.img",
          scopes: ["global"],
          metadata: { label: "Img" },
          bind: () => ({ kind: "img" }),
        }),
      ],
    });
    // The subject is a plain file; image-file is a SUBtype, not an ancestor.
    const trace = registry.resolve(query(), snapshot({ scopes: ["global"] })).trace;
    expect(trace).toEqual([]);
  });
});
