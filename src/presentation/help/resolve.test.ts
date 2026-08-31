import { describe, expect, test } from "vitest";
import { available, hidden, unavailable } from "../actions/availability";
import { definePredicate, predicate } from "../actions/conditions";
import { createPresentationTypeGraph } from "../actions/typeGraph";
import type { SelectionSnapshot } from "../actions/types";
import { defineHelp } from "./define";
import { createHelpRegistry } from "./registry";
import type { HelpContribution, HelpItem } from "./types";

/** Design doc §18: additive resolution, ordering, duplicates, no-match. */

type Values = {
  file: { id: string; name: string };
  "image-file": { id: string; name: string; format: string };
};
type Facts = { owner: string };

const graph = createPresentationTypeGraph([
  { id: "object", abstract: true },
  { id: "document", abstract: true, parents: ["object"] },
  { id: "file", parents: ["document"] },
  { id: "image-file", parents: ["file"] },
]);

const define = defineHelp<Values, Facts>();

function snapshot(over: Partial<SelectionSnapshot<Facts>> = {}): SelectionSnapshot<Facts> {
  return {
    revision: 42,
    scopes: ["editor", "global"],
    modes: new Set(),
    capabilities: new Set(),
    product: { owner: "me" },
    ...over,
  };
}

const imageFile = {
  type: "image-file",
  value: { id: "i1", name: "cover.png", format: "png" },
} as const;

const item = (id: string, over: Partial<HelpItem> = {}): HelpItem => ({
  id,
  kind: "help.text",
  payload: { text: id },
  ...over,
});

function registryOf(contributions: readonly HelpContribution<Values, Facts>[]) {
  return createHelpRegistry<Values, Facts>({
    graph,
    scopes: ["editor", "global"],
    contributions,
    version: "h1",
  });
}

describe("additive resolution", () => {
  test("several matching rules ACCUMULATE — no shadowing by specificity", () => {
    const registry = registryOf([
      define.inherited("document", {
        id: "docs.help",
        scopes: ["global"],
        help: () => [item("doc.meaning")],
      }),
      define.exact("image-file", {
        id: "images.help",
        scopes: ["global"],
        help: () => [item("image.meaning")],
      }),
    ]);
    const result = registry.resolve(imageFile, snapshot());
    expect(result.items.map((i) => i.id)).toEqual(["image.meaning", "doc.meaning"]);
    expect(result.snapshotRevision).toBe(42);
    expect(result.registryVersion).toBe("h1");
  });

  test("no matching rule resolves to an empty item list, not an error", () => {
    const registry = registryOf([
      define.exact("file", {
        id: "files.help",
        scopes: ["global"],
        help: () => [item("file.meaning")],
      }),
    ]);
    // exact on "file" must not match the image-file subtype.
    const result = registry.resolve(imageFile, snapshot());
    expect(result.items).toEqual([]);
  });

  test("provenance records rule, types, distance, scope, and priority", () => {
    const registry = registryOf([
      define.inherited("file", {
        id: "files.help",
        scopes: ["global"],
        priority: 3,
        help: () => [item("file.meaning")],
      }),
    ]);
    const [resolved] = registry.resolve(imageFile, snapshot()).items;
    expect(resolved?.provenance).toEqual({
      ruleId: "files.help",
      declaredType: "file",
      concreteType: "image-file",
      typeDistance: 1,
      scope: "global",
      scopeIndex: 1,
      priority: 3,
    });
  });
});

describe("only available matches", () => {
  test("a non-available test() contributes nothing", () => {
    const statuses = [unavailable("locked"), hidden(), available()] as const;
    const registry = registryOf(
      statuses.map((status, index) =>
        define.exact("image-file", {
          id: `images.help-${index}`,
          scopes: ["global"],
          test: () => status,
          help: () => [item(`item-${index}`)],
        }),
      ),
    );
    const result = registry.resolve(imageFile, snapshot());
    expect(result.items.map((i) => i.id)).toEqual(["item-2"]);
  });

  test("a failing when-condition contributes nothing", () => {
    const isOwner = definePredicate<Values, Facts>("product.is-owner", ({ snapshot: s }) =>
      s.product.owner === "me" ? available() : unavailable("not yours"),
    );
    const registry = createHelpRegistry<Values, Facts>({
      graph,
      scopes: ["global"],
      predicates: [isOwner],
      contributions: [
        define.exact("image-file", {
          id: "images.help",
          scopes: ["global"],
          when: predicate("product.is-owner"),
          help: () => [item("owner.note")],
        }),
      ],
    });
    expect(registry.resolve(imageFile, snapshot()).items).toHaveLength(1);
    expect(
      registry.resolve(imageFile, snapshot({ product: { owner: "you" } })).items,
    ).toEqual([]);
  });
});

describe("payload narrowing", () => {
  test("an exact callback receives the narrowed concrete payload", () => {
    const registry = registryOf([
      define.exact("image-file", {
        id: "images.help",
        scopes: ["global"],
        help: ({ subject }) => [
          // subject.value is Values["image-file"]: format typechecks.
          item("image.format", { payload: { text: subject.value.format } }),
        ],
      }),
    ]);
    const [resolved] = registry.resolve(imageFile, snapshot()).items;
    expect(resolved?.payload).toEqual({ text: "png" });
  });

  test("an inherited callback retains the ORIGINAL concrete reference", () => {
    const seen: unknown[] = [];
    const registry = registryOf([
      define.inherited("document", {
        id: "docs.help",
        scopes: ["global"],
        help: ({ subject }) => {
          seen.push(subject);
          return [item("doc.meaning")];
        },
      }),
    ]);
    registry.resolve(imageFile, snapshot());
    expect(seen).toEqual([imageFile]);
  });
});

describe("ordering", () => {
  test("nearest type, then nearest scope, then priority, then item order, then id", () => {
    const registry = registryOf([
      define.inherited("document", {
        id: "docs.help",
        scopes: ["global"],
        help: () => [item("z.far")],
      }),
      define.inherited("file", {
        id: "files.global",
        scopes: ["global"],
        help: () => [item("file.global")],
      }),
      define.inherited("file", {
        id: "files.editor",
        scopes: ["editor"],
        help: () => [item("file.editor")],
      }),
      define.exact("image-file", {
        id: "images.low",
        scopes: ["global"],
        priority: 0,
        help: () => [item("image.low")],
      }),
      define.exact("image-file", {
        id: "images.high",
        scopes: ["global"],
        priority: 5,
        help: () => [item("b.second", { order: 10 }), item("a.first", { order: 0 })],
      }),
    ]);
    const ids = registry.resolve(imageFile, snapshot()).items.map((i) => i.id);
    expect(ids).toEqual([
      "a.first", // distance 0, priority 5, order 0
      "b.second", // distance 0, priority 5, order 10
      "image.low", // distance 0, priority 0
      "file.editor", // distance 1, scopeIndex 0
      "file.global", // distance 1, scopeIndex 1
      "z.far", // distance 2
    ]);
  });

  test("registration order never changes the result", () => {
    const contributions = [
      define.exact("image-file", {
        id: "images.a",
        scopes: ["global"],
        help: () => [item("same.order.b")],
      }),
      define.exact("image-file", {
        id: "images.b",
        scopes: ["global"],
        help: () => [item("same.order.a")],
      }),
    ];
    const forward = registryOf(contributions).resolve(imageFile, snapshot());
    const backward = registryOf([...contributions].reverse()).resolve(imageFile, snapshot());
    expect(forward.items).toEqual(backward.items);
    expect(forward.items.map((i) => i.id)).toEqual(["same.order.a", "same.order.b"]);
  });
});

describe("authoring defects fail loudly", () => {
  test("duplicate item ids across two rules throw with both rule ids", () => {
    const registry = registryOf([
      define.exact("image-file", {
        id: "images.help",
        scopes: ["global"],
        help: () => [item("shared.id")],
      }),
      define.inherited("file", {
        id: "files.help",
        scopes: ["global"],
        help: () => [item("shared.id")],
      }),
    ]);
    expect(() => registry.resolve(imageFile, snapshot())).toThrow(
      /help item id "shared\.id".*"images\.help".*"files\.help"/,
    );
  });

  test("empty ids, empty kinds, and non-finite orders throw at resolution", () => {
    const bad = (over: Partial<HelpItem>) =>
      registryOf([
        define.exact("image-file", {
          id: "images.help",
          scopes: ["global"],
          help: () => [{ ...item("ok"), ...over }],
        }),
      ]);
    expect(() => bad({ id: "" }).resolve(imageFile, snapshot())).toThrow(/empty id/);
    expect(() => bad({ kind: "" }).resolve(imageFile, snapshot())).toThrow(/empty kind/);
    expect(() => bad({ order: Number.POSITIVE_INFINITY }).resolve(imageFile, snapshot())).toThrow(
      /non-finite order/,
    );
  });
});
