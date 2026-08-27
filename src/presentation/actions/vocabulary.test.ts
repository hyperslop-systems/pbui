import { describe, expect, test } from "vitest";
import {
  available,
  createActionRegistry,
  createPresentationTypeGraph,
  defineActions,
} from "./index";

/**
 * PBUI-ACTIONS-3 B2 — the vocabulary is GENERATED from the registry, so an
 * agent's picture of "what exists" and the menu's cannot disagree. The
 * suite pins the serialized shape the way products will (golden JSON), and
 * the properties that make the export trustworthy: static labels only,
 * families without instances, JSON round-trip identity.
 */

type Values = { file: { id: string }; folder: { id: string }; node: never };
type Facts = { open: boolean };
type Verb = { kind: string };

const define = defineActions<Values, Facts, Verb>();

const graph = createPresentationTypeGraph([
  { id: "node", abstract: true },
  { id: "file", parents: ["node"] },
  { id: "folder", parents: ["node"] },
]);

const contributions = [
  define.exact("file", {
    id: "files.open",
    action: "presentation.open",
    scopes: ["global"],
    test: () => available(),
    metadata: { label: "Open", primary: true, group: "NAVIGATE", order: 5 },
    bind: () => ({ kind: "open" }),
  }),
  define.exact("file", {
    id: "files.delete",
    action: "files.destroy",
    scopes: ["global"],
    test: () => available(),
    metadata: { label: "Delete", danger: true, description: "removes the file" },
    bind: () => ({ kind: "delete" }),
  }),
  define.inherited("node", {
    id: "nodes.inspect",
    action: "presentation.inspect",
    scopes: ["global"],
    invocations: ["menu"],
    test: () => available(),
    metadata: { label: ({ subject }) => `Inspect ${subject.reference.type}` },
    bind: () => ({ kind: "inspect" }),
  }),
  define.family("folder", {
    id: "folders.recent",
    match: "exact",
    scopes: ["global"],
    expand: () => [],
  }),
];

const registry = createActionRegistry<Values, Facts, Verb>({
  graph,
  scopes: ["global"],
  contributions,
  version: "vocab-test-1",
});

describe("the generated vocabulary", () => {
  test("matches the golden shape, byte for byte through JSON", () => {
    expect(JSON.parse(JSON.stringify(registry.vocabulary()))).toEqual({
      version: "vocab-test-1",
      types: [
        { type: "node", abstract: true, parents: [] },
        { type: "file", abstract: false, parents: ["node"] },
        { type: "folder", abstract: false, parents: ["node"] },
      ],
      actions: [
        {
          id: "files.open",
          kind: "exact",
          action: "presentation.open",
          subject: "file",
          scopes: ["global"],
          label: "Open",
          group: "NAVIGATE",
          order: 5,
          danger: false,
          primary: true,
        },
        {
          id: "files.delete",
          kind: "exact",
          action: "files.destroy",
          subject: "file",
          scopes: ["global"],
          label: "Delete",
          description: "removes the file",
          danger: true,
          primary: false,
        },
        {
          id: "nodes.inspect",
          kind: "inherited",
          action: "presentation.inspect",
          subject: "node",
          scopes: ["global"],
          invocations: ["menu"],
          danger: false,
          primary: false,
        },
        {
          id: "folders.recent",
          kind: "family",
          subject: "folder",
          scopes: ["global"],
          danger: false,
          primary: false,
        },
      ],
    });
  });

  test("a dynamic label yields NO label — the entry never lies", () => {
    const inspect = registry.vocabulary().actions.find((entry) => entry.id === "nodes.inspect")!;
    expect("label" in inspect).toBe(false);
  });

  test("renaming a rule IS the vocabulary bump", () => {
    const renamed = createActionRegistry<Values, Facts, Verb>({
      graph,
      scopes: ["global"],
      contributions: [
        define.exact("file", {
          id: "files.open-renamed",
          action: "presentation.open",
          scopes: ["global"],
          test: () => available(),
          metadata: { label: "Open" },
          bind: () => ({ kind: "open" }),
        }),
      ],
      version: "vocab-test-2",
    });
    expect(renamed.vocabulary().actions.map((entry) => entry.id)).toEqual(["files.open-renamed"]);
  });

  test("every declared rule appears; the vocabulary and listReachable agree", () => {
    const vocabularyIds = registry.vocabulary().actions.map((entry) => entry.id).sort();
    const reachableIds = [
      ...new Set(
        graph
          .types()
          .flatMap((type) => registry.listReachable(type, ["global"]))
          .map((entry) => entry.contributionId),
      ),
    ].sort();
    expect(vocabularyIds).toEqual(reachableIds);
  });
});
