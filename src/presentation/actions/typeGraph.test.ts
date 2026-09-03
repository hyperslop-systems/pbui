import { describe, expect, test } from "vitest";
import { createPresentationTypeGraph } from "./typeGraph";

const graph = createPresentationTypeGraph([
  { id: "object", abstract: true },
  { id: "document", abstract: true, parents: ["object"] },
  { id: "selectable", abstract: true, parents: ["object"] },
  { id: "file", parents: ["document", "selectable"] },
  { id: "image-file", parents: ["file"] },
]);

describe("createPresentationTypeGraph", () => {
  test("subtyping is reflexive, direct, and transitive", () => {
    expect(graph.isSubtype("image-file", "image-file")).toBe(true);
    expect(graph.isSubtype("image-file", "file")).toBe(true);
    expect(graph.isSubtype("image-file", "object")).toBe(true);
    expect(graph.isSubtype("file", "image-file")).toBe(false);
    expect(graph.isSubtype("document", "selectable")).toBe(false);
  });

  test("distance is the shortest path, through diamonds", () => {
    expect(graph.distance("image-file", "image-file")).toBe(0);
    expect(graph.distance("image-file", "file")).toBe(1);
    expect(graph.distance("image-file", "document")).toBe(2);
    expect(graph.distance("image-file", "object")).toBe(3);
    // file reaches object through document AND selectable; shortest is 2.
    expect(graph.distance("file", "object")).toBe(2);
    expect(graph.distance("file", "image-file")).toBe(Number.POSITIVE_INFINITY);
  });

  test("ancestors are deterministic breadth-first, parents in declaration order", () => {
    expect(graph.ancestors("file")).toEqual([
      { type: "file", distance: 0 },
      { type: "document", distance: 1 },
      { type: "selectable", distance: 1 },
      { type: "object", distance: 2 },
    ]);
  });

  test("an undeclared type is an error, never an isolated node (closed world, KERNEL-1 C9)", () => {
    expect(graph.has("mystery")).toBe(false);
    expect(() => graph.ancestors("mystery")).toThrow(/"mystery" is not declared/);
    expect(() => graph.isSubtype("mystery", "object")).toThrow(/closed world/);
    expect(() => graph.distance("mystery", "object")).toThrow(/closed world/);
    // An undeclared SUPERTYPE is merely unrelated: the subject is still valid.
    expect(graph.isSubtype("file", "mystery")).toBe(false);
    expect(graph.distance("file", "mystery")).toBe(Number.POSITIVE_INFINITY);
  });

  test("abstract and concrete nodes coexist", () => {
    expect(graph.isAbstract("object")).toBe(true);
    expect(graph.isAbstract("file")).toBe(false);
    expect(graph.types()).toEqual(["object", "document", "selectable", "file", "image-file"]);
  });

  test("duplicate ids, unknown parents, and cycles fail construction", () => {
    expect(() =>
      createPresentationTypeGraph([{ id: "a" }, { id: "a" }]),
    ).toThrow(/duplicate runtime type id "a"/);
    expect(() =>
      createPresentationTypeGraph([{ id: "a", parents: ["ghost"] }]),
    ).toThrow(/unknown parent "ghost"/);
    expect(() =>
      createPresentationTypeGraph([
        { id: "a", parents: ["b"] },
        { id: "b", parents: ["a"] },
      ]),
    ).toThrow(/cycle/);
  });
});
