import { createPresentationRegistry } from "@hyperslop-systems/pbui";
import { describe, expect, test } from "vitest";
import { substituteRef, withGeneratedActions } from "./actions";
import type { ActionRecord } from "./library";

type Values = { product: { id: string; name: string }; metal: { id: string } };
type Verb = { kind: string } & Record<string, unknown>;

const base = createPresentationRegistry<Values, object, Verb>({
  product: { label: (v) => v.name, actions: (v) => [{ id: "own", label: "Inspect", verb: { kind: "inspect", id: v.id } }] },
});

function action(overrides: Partial<ActionRecord> = {}): ActionRecord {
  return {
    id: "act-1",
    label: "Days of cover",
    types: ["product"],
    behaviour: { kind: "openProgram", programId: "prg-7" },
    by: "agent",
    pinned: false,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("withGeneratedActions", () => {
  test("appends actions for the reference's type only, after the product's own", () => {
    const registry = withGeneratedActions(base, {
      getActions: () => [action(), action({ id: "act-2", label: "Metal only", types: ["metal"] })],
      toVerb: (a, ref) => ({ kind: "action.run", actionId: a.id, ref: { type: ref.type, id: (ref.value as { id: string }).id } }),
    });
    const actions = registry.actionsFor({ type: "product", value: { id: "2049", name: "Eagle" } }, {});
    expect(actions.map((a) => a.id)).toEqual(["own", "generated:act-1"]);
    expect(actions[1]).toMatchObject({ label: "Days of cover", group: "generated", verb: { kind: "action.run", actionId: "act-1", ref: { type: "product", id: "2049" } } });
    expect(registry.actionsFor({ type: "metal", value: { id: "gold" } }, {}).map((a) => a.label)).toEqual(["Metal only"]);
  });

  test("disables an openProgram action whose program is gone, and forwards the rest of the registry", () => {
    const registry = withGeneratedActions(base, {
      getActions: () => [action()],
      toVerb: () => ({ kind: "action.run" }),
      programExists: () => false,
    });
    const [, generated] = registry.actionsFor({ type: "product", value: { id: "1", name: "x" } }, {});
    expect(generated?.disabledBecause).toBe("program prg-7 is no longer in the library");
    expect(registry.labelFor({ type: "product", value: { id: "1", name: "x" } }, {})).toBe("x");
    expect(registry.has("product")).toBe(true);
  });
});

describe("substituteRef", () => {
  test("replaces the three placeholders anywhere in a verb", () => {
    const ref = { type: "product", id: "2049", value: { name: "Eagle" } };
    expect(substituteRef({ kind: "watch", ref: "$ref", ids: ["$ref.id"], meta: { t: "$ref.type", keep: 1 } }, ref)).toEqual({
      kind: "watch",
      ref,
      ids: ["2049"],
      meta: { t: "product", keep: 1 },
    });
  });
});
