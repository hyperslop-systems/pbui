import { describe, expect, test } from "vitest";
import { withLimits } from "../limits";
import { validateDispatchIntent, validateDispatchIntents } from "./intents";

describe("validateDispatchIntents", () => {
  test("stamps the instance id on a plugin intent, ignoring what the program claimed", () => {
    expect(validateDispatchIntent({ scope: "plugin", actionType: "state/merge", payload: { a: 1 }, instanceId: "liar" }, "inst-1")).toEqual({
      scope: "plugin",
      instanceId: "inst-1",
      actionType: "state/merge",
      payload: { a: 1 },
    });
  });

  test("accepts a verb intent with a kind", () => {
    expect(validateDispatchIntent({ scope: "verb", verb: { kind: "watch", ref: { type: "product", id: "1" } } }, "inst-1")).toEqual({
      scope: "verb",
      instanceId: "inst-1",
      verb: { kind: "watch", ref: { type: "product", id: "1" } },
    });
  });

  test("rejects the shared scope and a verb without a kind", () => {
    expect(() => validateDispatchIntent({ scope: "shared", domain: "x", actionType: "y" }, "i")).toThrow("scope must be 'plugin' or 'verb'");
    expect(() => validateDispatchIntent({ scope: "verb", verb: { ref: 1 } }, "i")).toThrow("non-empty string kind");
  });

  test("refuses more intents than the limit", () => {
    const many = Array.from({ length: 3 }, () => ({ scope: "plugin", actionType: "state/merge" }));
    expect(() => validateDispatchIntents(many, "i", withLimits({ intentsPerEvent: 2 }))).toThrow("a handler emitted 3 intents, the limit is 2");
  });
});
