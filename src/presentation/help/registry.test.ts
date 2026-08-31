import { describe, expect, test } from "vitest";
import { available, unavailable } from "../actions/availability";
import { definePredicate, predicate } from "../actions/conditions";
import { createPresentationTypeGraph } from "../actions/typeGraph";
import { defineHelp } from "./define";
import { createHelpRegistry } from "./registry";
import type { HelpItem } from "./types";

/** Design doc §18 "help registry tests": fail-fast construction. */

type Values = {
  file: { id: string };
  "image-file": { id: string; format: string };
};
type Facts = { owner: string };

const graph = createPresentationTypeGraph([
  { id: "document", abstract: true },
  { id: "file", parents: ["document"] },
  { id: "image-file", parents: ["file"] },
]);

const define = defineHelp<Values, Facts>();

const item = (id: string): HelpItem => ({ id, kind: "help.text", payload: { text: "t" } });

function baseRule(id: string) {
  return define.exact("file", {
    id,
    scopes: ["global"],
    help: () => [item(`${id}.item`)],
  });
}

describe("createHelpRegistry validation", () => {
  test("duplicate rule ids fail construction", () => {
    expect(() =>
      createHelpRegistry({
        graph,
        scopes: ["global"],
        contributions: [baseRule("a.help"), baseRule("a.help")],
      }),
    ).toThrow(/duplicate help rule id "a\.help"/);
  });

  test("an unknown subject type fails construction", () => {
    expect(() =>
      createHelpRegistry<Values, Facts>({
        graph,
        scopes: ["global"],
        contributions: [
          define.inherited("spreadsheet", {
            id: "sheets.help",
            scopes: ["global"],
            help: () => [],
          }),
        ],
      }),
    ).toThrow(/targets type "spreadsheet" which is not in the type graph/);
  });

  test("empty and unknown scopes fail construction", () => {
    expect(() =>
      createHelpRegistry<Values, Facts>({
        graph,
        scopes: ["global"],
        contributions: [
          define.exact("file", { id: "files.help", scopes: [], help: () => [] }),
        ],
      }),
    ).toThrow(/declares no scopes/);
    expect(() =>
      createHelpRegistry<Values, Facts>({
        graph,
        scopes: ["global"],
        contributions: [
          define.exact("file", { id: "files.help", scopes: ["sidebar"], help: () => [] }),
        ],
      }),
    ).toThrow(/unknown scope "sidebar"/);
  });

  test("an unknown predicate reference fails construction", () => {
    expect(() =>
      createHelpRegistry<Values, Facts>({
        graph,
        scopes: ["global"],
        contributions: [
          define.exact("file", {
            id: "files.help",
            scopes: ["global"],
            when: predicate("product.missing"),
            help: () => [],
          }),
        ],
      }),
    ).toThrow(/unknown predicate "product\.missing"/);
  });

  test("a non-finite priority fails construction", () => {
    expect(() =>
      createHelpRegistry<Values, Facts>({
        graph,
        scopes: ["global"],
        contributions: [
          define.exact("file", {
            id: "files.help",
            scopes: ["global"],
            priority: Number.NaN,
            help: () => [],
          }),
        ],
      }),
    ).toThrow(/non-finite priority/);
  });

  test("duplicate predicate ids fail construction", () => {
    const p = definePredicate<Values, Facts>("product.is-owner", () => available());
    const q = definePredicate<Values, Facts>("product.is-owner", () =>
      unavailable("never"),
    );
    expect(() =>
      createHelpRegistry<Values, Facts>({
        graph,
        scopes: ["global"],
        predicates: [p, q],
        contributions: [],
      }),
    ).toThrow(/duplicate predicate id/);
  });

  test("a valid registry constructs with version and empty diagnostics", () => {
    const registry = createHelpRegistry<Values, Facts>({
      graph,
      scopes: ["global"],
      contributions: [baseRule("a.help")],
      version: "help-7",
    });
    expect(registry.version).toBe("help-7");
    expect(registry.diagnostics()).toEqual([]);
  });
});
