import { describe, expect, test } from "vitest";
import { available, hidden, inapplicable, unavailable } from "./availability";
import { defineActions } from "./define";
import { createActionRegistry } from "./registry";
import { createPresentationTypeGraph } from "./typeGraph";
import type { ActionContribution, ActionQuery, SelectionSnapshot } from "./types";

/**
 * The resolver table from the source guide §24.3, plus the invariants of
 * §24.9: permutation invariance, bind-only-selected, family participation.
 */

type Values = {
  file: { id: string; protected?: boolean; live?: boolean; secret?: boolean };
  "image-file": { id: string; format: string };
  note: { id: string };
};
type Facts = { tag: string };
type Verb = { kind: string } & Record<string, unknown>;

const graph = createPresentationTypeGraph([
  { id: "object", abstract: true },
  { id: "document", abstract: true, parents: ["object"] },
  { id: "file", parents: ["document"] },
  { id: "image-file", parents: ["file"] },
  { id: "note", parents: ["document"] },
]);

const define = defineActions<Values, Facts, Verb>();

function snapshot(over: Partial<SelectionSnapshot<Facts>> = {}): SelectionSnapshot<Facts> {
  return {
    revision: 7,
    scopes: ["editor", "workbench", "global"],
    modes: new Set(),
    capabilities: new Set(),
    product: { tag: "t" },
    ...over,
  };
}

function query(
  subject: ActionQuery<Values>["subject"],
  invocation: ActionQuery<Values>["invocation"] = "menu",
): ActionQuery<Values> {
  return { subject, invocation };
}

function registryOf(contributions: readonly ActionContribution<Values, Facts, Verb>[]) {
  return createActionRegistry<Values, Facts, Verb>({
    graph,
    scopes: ["editor", "workbench", "global"],
    contributions,
    version: "test-1",
  });
}

const imageFile = { type: "image-file", value: { id: "img-1", format: "png" } } as const;

describe("specificity", () => {
  const openRules = [
    define.inherited("document", {
      id: "docs.open-default",
      action: "presentation.open",
      scopes: ["global"],
      metadata: { label: "Open" },
      bind: ({ subject }) => ({ kind: "open.generic", ref: subject }),
    }),
    define.inherited("file", {
      id: "files.open-editor",
      action: "presentation.open",
      scopes: ["global"],
      metadata: { label: "Open in editor" },
      bind: () => ({ kind: "open.editor" }),
    }),
    define.exact("image-file", {
      id: "images.open-preview",
      action: "presentation.open",
      scopes: ["global"],
      metadata: { label: "Open preview" },
      bind: ({ subject }) => ({ kind: "open.preview", format: subject.value.format }),
    }),
  ];

  test("the most specific rule wins and the rest are shadowed in the trace", () => {
    const result = registryOf(openRules).resolve(query(imageFile), snapshot());
    expect(result.actions).toHaveLength(1);
    const [action] = result.actions;
    expect(action?.candidateId).toBe("images.open-preview");
    expect(action?.verb).toEqual({ kind: "open.preview", format: "png" });
    expect(action?.provenance).toMatchObject({
      declaredType: "image-file",
      concreteType: "image-file",
      typeDistance: 0,
    });
    const shadowed = result.trace
      .filter((entry) => entry.result === "shadowed")
      .map((entry) => entry.candidateId)
      .sort();
    expect(shadowed).toEqual(["docs.open-default", "files.open-editor"]);
  });

  test("an inherited rule receives the ORIGINAL concrete reference", () => {
    const result = registryOf([openRules[0] as (typeof openRules)[number]]).resolve(
      query(imageFile),
      snapshot(),
    );
    expect(result.actions[0]?.verb).toEqual({ kind: "open.generic", ref: imageFile });
    expect(result.actions[0]?.provenance).toMatchObject({
      declaredType: "document",
      typeDistance: 2,
    });
  });
});

describe("the availability quartet drives override", () => {
  const generic = define.inherited("document", {
    id: "docs.delete",
    action: "file.delete",
    scopes: ["global"],
    metadata: { label: "Delete" },
    bind: () => ({ kind: "delete.generic" }),
  });

  test("a specific UNAVAILABLE rule wins, is visible with its reason, and has no verb", () => {
    const specific = define.exact("file", {
      id: "files.delete-protected",
      action: "file.delete",
      scopes: ["global"],
      test: ({ subject }) =>
        subject.value.protected ? unavailable("this file is protected") : available(),
      metadata: { label: "Delete" },
      bind: () => ({ kind: "delete.specific" }),
    });
    const result = registryOf([generic, specific]).resolve(
      query({ type: "file", value: { id: "f1", protected: true } }),
      snapshot(),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      candidateId: "files.delete-protected",
      status: { kind: "unavailable", because: "this file is protected" },
    });
    expect(result.actions[0]?.verb).toBeUndefined();
  });

  test("an INAPPLICABLE specific rule leaves the competition and the generic applies", () => {
    const restore = define.exact("file", {
      id: "files.delete-via-restore",
      action: "file.delete",
      scopes: ["global"],
      test: ({ subject }) => (subject.value.live ? inapplicable() : available()),
      metadata: { label: "Restore then delete" },
      bind: () => ({ kind: "delete.restore" }),
    });
    const result = registryOf([generic, restore]).resolve(
      query({ type: "file", value: { id: "f1", live: true } }),
      snapshot(),
    );
    expect(result.actions.map((action) => action.candidateId)).toEqual(["docs.delete"]);
  });

  test("a HIDDEN specific rule emits no row AND suppresses the generic fallback", () => {
    const secret = define.exact("file", {
      id: "files.delete-secret",
      action: "file.delete",
      scopes: ["global"],
      test: ({ subject }) => (subject.value.secret ? hidden() : available()),
      metadata: { label: "Delete" },
      bind: () => ({ kind: "delete.secret" }),
    });
    const result = registryOf([generic, secret]).resolve(
      query({ type: "file", value: { id: "f1", secret: true } }),
      snapshot(),
    );
    expect(result.actions).toEqual([]);
    // The suppression is visible to tooling through the trace.
    expect(
      result.trace.find(
        (entry) => entry.candidateId === "files.delete-secret" && entry.stage === "condition",
      )?.result,
    ).toBe("hidden");
    expect(
      result.trace.find(
        (entry) => entry.candidateId === "files.delete-secret" && entry.stage === "selected",
      )?.result,
    ).toBe("hidden");
  });
});

describe("scope, priority, ambiguity", () => {
  function inspect(id: string, scopes: string[], priority?: number) {
    return define.exact("file", {
      id,
      action: "object.inspect",
      scopes,
      ...(priority !== undefined ? { priority } : {}),
      metadata: { label: "Inspect" },
      bind: () => ({ kind: "inspect", by: id }),
    });
  }
  const file = { type: "file", value: { id: "f1" } } as const;

  test("the nearer active scope wins at equal specificity", () => {
    const result = registryOf([
      inspect("global.inspect", ["global"], 0),
      inspect("editor.inspect", ["editor"], 0),
    ]).resolve(query(file), snapshot());
    expect(result.actions[0]?.candidateId).toBe("editor.inspect");
    expect(result.actions[0]?.provenance.scope).toBe("editor");
  });

  test("explicit priority breaks a same-scope tie", () => {
    const result = registryOf([
      inspect("plugin.inspect", ["global"], 10),
      inspect("core.inspect", ["global"], 0),
    ]).resolve(query(file), snapshot());
    expect(result.actions[0]?.candidateId).toBe("plugin.inspect");
  });

  test("a full tie is AMBIGUITY: data, no selection, never a guess", () => {
    // Conditions keep construction from rejecting the pair as guaranteed.
    const contested = (id: string) =>
      define.exact("file", {
        id,
        action: "object.inspect",
        scopes: ["global"],
        test: () => available(),
        metadata: { label: "Inspect" },
        bind: () => ({ kind: "inspect", by: id }),
      });
    const result = registryOf([contested("plugin-a.inspect"), contested("plugin-b.inspect")]).resolve(
      query(file),
      snapshot(),
    );
    expect(result.actions).toEqual([]);
    expect(result.ambiguities).toEqual([
      {
        action: "object.inspect",
        candidates: ["plugin-a.inspect", "plugin-b.inspect"],
        because: "equal-priority",
      },
    ]);
  });

  test("a contribution with no active scope is not a candidate", () => {
    const result = registryOf([inspect("editor.inspect", ["editor"])]).resolve(
      query(file),
      snapshot({ scopes: ["global"] }),
    );
    expect(result.actions).toEqual([]);
    expect(result.trace[0]).toMatchObject({ stage: "scope", result: "reject" });
  });

  test("invocation filters discovery", () => {
    const agentOnly = define.exact("file", {
      id: "agent.describe",
      action: "object.describe",
      scopes: ["global"],
      invocations: ["agent"],
      metadata: { label: "Describe" },
      bind: () => ({ kind: "describe" }),
    });
    expect(registryOf([agentOnly]).resolve(query(file, "menu"), snapshot()).actions).toEqual([]);
    expect(registryOf([agentOnly]).resolve(query(file, "agent"), snapshot()).actions).toHaveLength(1);
  });
});

describe("families", () => {
  const filters = define.family("file", {
    id: "demo.filters",
    scopes: ["global"],
    expand: ({ subject }) => {
      const value = subject.value as Values["file"];
      return ["region", "metal"].map((field, index) => ({
        key: `keep:${field}`,
        action: `datum.keep.${field}`,
        metadata: { label: `Keep only ${field}`, order: index },
        bind: () => ({ kind: "addFilter", field, id: value.id }),
      }));
    },
  });
  const file = { type: "file", value: { id: "f9" } } as const;

  test("instances get stable candidate ids and full resolution", () => {
    const result = registryOf([filters]).resolve(query(file), snapshot());
    expect(result.actions.map((action) => action.candidateId)).toEqual([
      "demo.filters/keep:region",
      "demo.filters/keep:metal",
    ]);
    expect(result.actions[0]?.verb).toEqual({ kind: "addFilter", field: "region", id: "f9" });
  });

  test("a family instance competes with a static rule under the normal ladder", () => {
    const staticRule = define.exact("image-file", {
      id: "images.keep-region",
      action: "datum.keep.region",
      scopes: ["global"],
      metadata: { label: "Keep region (image)" },
      bind: () => ({ kind: "addFilter.image" }),
    });
    const inheritedFamily = define.family("file", {
      id: "demo.inherited-filters",
      match: "subtypes",
      scopes: ["global"],
      expand: () => [
        {
          key: "keep:region",
          action: "datum.keep.region",
          metadata: { label: "Keep region" },
          bind: () => ({ kind: "addFilter.generic" }),
        },
      ],
    });
    // On an image-file, the exact static rule (distance 0) beats the family
    // declared at file (distance 1).
    const result = registryOf([inheritedFamily, staticRule]).resolve(query(imageFile), snapshot());
    expect(result.actions.map((action) => action.candidateId)).toEqual(["images.keep-region"]);
  });

  test("duplicate instance keys throw at expansion", () => {
    const broken = define.family("file", {
      id: "demo.broken",
      scopes: ["global"],
      expand: () => [
        { key: "same", action: "a.b", metadata: { label: "1" }, bind: () => ({ kind: "x" }) },
        { key: "same", action: "a.c", metadata: { label: "2" }, bind: () => ({ kind: "y" }) },
      ],
    });
    expect(() => registryOf([broken]).resolve(query(file), snapshot())).toThrow(
      /duplicate key "same"/,
    );
  });

  test("an instance status of unavailable renders the row without a verb", () => {
    const gated = define.family("file", {
      id: "demo.gated",
      scopes: ["global"],
      expand: () => [
        {
          key: "gone",
          action: "program.open.gone",
          status: unavailable("program prg-7 is no longer in the library"),
          metadata: { label: "Days of cover" },
          bind: () => ({ kind: "action.run" }),
        },
      ],
    });
    const [action] = registryOf([gated]).resolve(query(file), snapshot()).actions;
    expect(action?.status).toEqual({
      kind: "unavailable",
      because: "program prg-7 is no longer in the library",
    });
    expect(action?.verb).toBeUndefined();
  });
});

describe("resolver invariants", () => {
  test("binders run ONLY for the selected available candidate", () => {
    const calls: string[] = [];
    const rule = (id: string, subjectType: "file" | "image-file") =>
      define.exact(subjectType, {
        id,
        action: "presentation.open",
        scopes: ["global"],
        metadata: { label: "Open" },
        bind: () => {
          calls.push(id);
          return { kind: "open", by: id };
        },
      });
    registryOf([rule("shadowed.open", "file"), rule("winner.open", "image-file")]).resolve(
      query(imageFile),
      snapshot(),
    );
    expect(calls).toEqual(["winner.open"]);
  });

  test("permuting registration order changes nothing semantic", () => {
    const contributions: ActionContribution<Values, Facts, Verb>[] = [
      define.inherited("document", {
        id: "docs.open-default",
        action: "presentation.open",
        scopes: ["global"],
        metadata: { label: "Open" },
        bind: () => ({ kind: "open.generic" }),
      }),
      define.exact("image-file", {
        id: "images.open-preview",
        action: "presentation.open",
        scopes: ["global"],
        metadata: { label: "Open preview" },
        bind: () => ({ kind: "open.preview" }),
      }),
      define.exact("image-file", {
        id: "images.annotate",
        action: "image.annotate",
        scopes: ["editor"],
        metadata: { label: "Annotate", order: 5 },
        bind: () => ({ kind: "annotate" }),
      }),
      define.family("file", {
        id: "demo.filters",
        match: "subtypes",
        scopes: ["global"],
        expand: () => [
          {
            key: "keep:region",
            action: "datum.keep.region",
            metadata: { label: "Keep only region", order: 9 },
            bind: () => ({ kind: "addFilter" }),
          },
        ],
      }),
    ];
    const forward = registryOf(contributions).resolve(query(imageFile), snapshot());
    const backward = registryOf([...contributions].reverse()).resolve(query(imageFile), snapshot());
    const strip = (result: typeof forward) => ({
      actions: result.actions.map((action) => ({
        candidateId: action.candidateId,
        action: action.action,
        status: action.status,
        verb: action.verb,
      })),
      ambiguities: result.ambiguities,
    });
    expect(strip(backward)).toEqual(strip(forward));
  });

  test("adding an unrelated action id does not change existing winners", () => {
    const base = [
      define.exact("file", {
        id: "files.open",
        action: "presentation.open",
        scopes: ["global"],
        metadata: { label: "Open" },
        bind: () => ({ kind: "open" }),
      }),
    ];
    const extended = [
      ...base,
      define.exact("file", {
        id: "files.watch",
        action: "object.watch",
        scopes: ["global"],
        metadata: { label: "Watch" },
        bind: () => ({ kind: "watch" }),
      }),
    ];
    const file = { type: "file", value: { id: "f1" } } as const;
    const before = registryOf(base).resolve(query(file), snapshot());
    const after = registryOf(extended).resolve(query(file), snapshot());
    expect(
      after.actions.find((action) => action.action === "presentation.open")?.candidateId,
    ).toBe(before.actions[0]?.candidateId);
  });

  test("menu order metadata never changes which rule wins", () => {
    const first = define.exact("file", {
      id: "a.open",
      action: "presentation.open",
      scopes: ["editor"],
      metadata: { label: "Open", order: 99 },
      bind: () => ({ kind: "a" }),
    });
    const second = define.exact("file", {
      id: "b.open",
      action: "presentation.open",
      scopes: ["global"],
      metadata: { label: "Open", order: 1 },
      bind: () => ({ kind: "b" }),
    });
    const result = registryOf([first, second]).resolve(
      query({ type: "file", value: { id: "f1" } }),
      snapshot(),
    );
    // editor is nearer than global; order 99 vs 1 is irrelevant to selection.
    expect(result.actions[0]?.candidateId).toBe("a.open");
  });

  test("a label function materializes with the subject and snapshot", () => {
    const labeled = define.exact("file", {
      id: "files.map",
      action: "chart.mapping.x",
      scopes: ["global"],
      metadata: {
        label: ({ subject, snapshot: s }) =>
          `Map ${(subject.value as Values["file"]).id} (${s.product.tag})`,
      },
      bind: () => ({ kind: "setMapping" }),
    });
    const result = registryOf([labeled]).resolve(
      query({ type: "file", value: { id: "f1" } }),
      snapshot(),
    );
    expect(result.actions[0]?.label).toBe("Map f1 (t)");
  });
});
