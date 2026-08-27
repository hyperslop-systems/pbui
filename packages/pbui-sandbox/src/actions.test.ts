import { describe, expect, test } from "vitest";
import { createGeneratedActionsFamily, substituteRef } from "./actions";
import type { GeneratedActionFacts } from "./actions";
import type { ActionRecord } from "./library";

type Values = { product: { id: string; name: string }; metal: { id: string } };
type Verb = { kind: string } & Record<string, unknown>;

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

describe("createGeneratedActionsFamily (PBUI-ACTIONS-2 P4)", () => {
  const family = createGeneratedActionsFamily<Values, GeneratedActionFacts, Verb>({
    toVerb: (a, ref) => ({ kind: "action.run", actionId: a.id, ref: { type: ref.type, id: (ref.value as { id: string }).id } }),
  });

  function snapshot(records: ActionRecord[], programs: string[] = []) {
    return {
      revision: records.map((r) => r.id).join(","),
      scopes: ["global"],
      modes: new Set<string>(),
      capabilities: new Set<string>(),
      product: { generatedActions: records, generatedPrograms: new Set(programs) },
    };
  }
  const productRef = { type: "product", value: { id: "2049", name: "Eagle" } } as const;

  test("expands type-filtered instances with the library's stable identity", () => {
    const instances = family.expand({
      subject: productRef,
      snapshot: snapshot([action(), action({ id: "act-2", label: "Metal only", types: ["metal"] })], ["prg-7"]),
    });
    expect(instances.map((i) => [i.key, i.action])).toEqual([["act-1", "generated:act-1"]]);
    expect(instances[0]?.metadata).toMatchObject({ label: "Days of cover", group: "generated" });
    expect(instances[0]?.bind({ subject: productRef, snapshot: snapshot([action()]) })).toEqual({
      kind: "action.run",
      actionId: "act-1",
      ref: { type: "product", id: "2049" },
    });
  });

  test("a missing openProgram target is unavailable with the wrapper's exact reason", () => {
    const [instance] = family.expand({ subject: productRef, snapshot: snapshot([action()]) });
    expect(instance?.status).toEqual({
      kind: "unavailable",
      because: "program prg-7 is no longer in the library",
    });
  });
});
