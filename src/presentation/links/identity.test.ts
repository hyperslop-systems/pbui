import { describe, expect, it } from "vitest";
import { applyLinkVerb } from "./apply";
import { badgeOf } from "./badge";
import { effectiveBinding, evaluatePort } from "./evaluate";
import { checkIdentityCompatibility, compileIdentity } from "./identity";
import { checkInvariants } from "./invariants";
import { identityAfterViewsRemoved } from "./lifecycle";
import { planFollow, planIdentityAdd, planIdentityRemove } from "./plan";
import { linkVerbs } from "./verbs";
import { deps, world, withState, type WorldOptions } from "./world.test-helpers";

/*
 * Identity classes (design D8, report §7.7, §8.4–8.6; P06's counterexamples):
 * strict contract compatibility with named mismatches, classes as connected
 * components within a fiber, persistent ids across recompiles with lineage,
 * merge policies on join, split policies on leave, and Alias as a derived
 * effective binding that the badge shows as ≡.
 */

const SEL_A = { type: "datum", value: [{ relation: "orders", identity: { id: "88213" } }] };
const SEL_B = { type: "datum", value: [{ relation: "orders", identity: { id: "88214" } }] };

const ids = () => {
  let n = 0;
  return () => `I${(n += 1)}`;
};

describe("compatibility", () => {
  it("names the field that differs, and passes when every field agrees", () => {
    const s = world();
    expect(checkIdentityCompatibility("v-east/selection", "v-plot/selection", s)).toMatchObject({ ok: true });
    expect(checkIdentityCompatibility("v-east/selection", "v-sales/selection", s)).toMatchObject({ ok: false, because: "different authority domain: orders vs daily_sales" });
    expect(checkIdentityCompatibility("v-east/selection", "v-a/order", s)).toMatchObject({ ok: false });
    const mismatch = checkIdentityCompatibility("v-east/selection", "v-a/order", s);
    expect(mismatch.ok === false && mismatch.mismatches.map((m) => m.field)).toEqual(["valueType", "semanticRole", "cardinality", "mode", "authorityDomain"]);
  });
});

describe("compileIdentity", () => {
  it("partitions by fiber, unions within it, drops classes of one, and diagnoses bad links", () => {
    const s = world();
    const compiled = compileIdentity(
      [
        { linkId: "I1", left: "v-east/selection", right: "v-plot/selection", mergePolicy: "prefer-left" },
        { linkId: "I2", left: "v-plot/selection", right: "v-west/selection", mergePolicy: "prefer-left" },
        { linkId: "I3", left: "v-east/selection", right: "v-sales/selection", mergePolicy: "prefer-left" },
        { linkId: "I4", left: "v-east/order", right: "v-a/order", mergePolicy: "prefer-left" },
        { linkId: "I5", left: "v-gone/x", right: "v-a/order", mergePolicy: "prefer-left" },
      ],
      s.ports,
    );
    expect(compiled.classes).toEqual([{ id: "σ1", members: ["v-east/selection", "v-plot/selection", "v-west/selection"], fingerprint: expect.stringContaining("authorityDomain=orders") }]);
    expect(compiled.diagnostics.map((d) => `${d.linkId}:${d.code}`)).toEqual(["I3:incompatible", "I4:direction", "I5:port-missing"]);
    expect(compiled.lineage.get("σ1")).toBe("new");
    expect(compiled.aliases.get("v-west/selection")).toBe("σ1");
  });

  it("keeps class ids across recompiles and reports lineage; registration order never renumbers", () => {
    const s = world();
    const first = compileIdentity([{ linkId: "I1", left: "v-east/selection", right: "v-plot/selection", mergePolicy: "prefer-left" }], s.ports);
    const grown = compileIdentity(
      [
        { linkId: "I1", left: "v-east/selection", right: "v-plot/selection", mergePolicy: "prefer-left" },
        { linkId: "I2", left: "v-west/selection", right: "v-plot/selection", mergePolicy: "prefer-left" },
      ],
      s.ports,
      first.classes,
    );
    expect(grown.classes[0]?.id).toBe("σ1");
    expect(grown.lineage.get("σ1")).toBe("expanded");
    const shrunk = compileIdentity([{ linkId: "I2", left: "v-west/selection", right: "v-plot/selection", mergePolicy: "prefer-left" }], s.ports, grown.classes);
    expect(shrunk.classes[0]).toMatchObject({ id: "σ1", members: ["v-plot/selection", "v-west/selection"] });
    expect(shrunk.lineage.get("σ1")).toBe("contracted");
    const reversed = compileIdentity([{ linkId: "I2", left: "v-plot/selection", right: "v-west/selection", mergePolicy: "prefer-left" }], new Map([...s.ports].reverse()), grown.classes);
    expect(reversed.classes).toEqual(shrunk.classes);
    const again = compileIdentity([], s.ports, shrunk.classes);
    expect(again.classes).toEqual([]);
    const fresh = compileIdentity([{ linkId: "I9", left: "v-east/selection", right: "v-west/selection", mergePolicy: "prefer-left" }], s.ports, shrunk.classes);
    // Overlaps σ1 on one member: keeps the id; a brand-new disjoint class would get σ2.
    expect(fresh.classes[0]?.id).toBe("σ1");
  });
});

describe("identity.add", () => {
  it("refuses incompatible, bound, output-only, self and already-shared pairs with a sentence", () => {
    const s = world({ bindings: { "v-west/selection": { kind: "constant", reference: SEL_A } } });
    expect(planIdentityAdd("v-east/selection", "v-sales/selection", "prefer-left", s, deps)).toMatchObject({ kind: "unavailable", code: "incompatible", because: expect.stringContaining("different authority domain") });
    expect(planIdentityAdd("v-east/selection", "v-west/selection", "prefer-left", s, deps)).toMatchObject({ kind: "unavailable", code: "bound" });
    expect(planIdentityAdd("v-east/order", "v-a/order", "prefer-left", s, deps)).toMatchObject({ kind: "unavailable", code: "direction" });
    expect(planIdentityAdd("v-east/selection", "v-east/selection", "prefer-left", s, deps)).toMatchObject({ kind: "unavailable", code: "self" });
  });

  it("merges two cells by policy, keeps each member's private history, and both then read the shared cell", () => {
    const base: WorldOptions = { emitted: { "v-east/selection": SEL_A, "v-plot/selection": SEL_B } };
    const s = world(base);
    const plan = planIdentityAdd("v-east/selection", "v-plot/selection", "require-equal", s, deps);
    expect(plan).toMatchObject({ kind: "unavailable", code: "cells-differ", cellsDiffer: true });
    const added = applyLinkVerb(linkVerbs.identityAdd("v-east/selection", "v-plot/selection", "prefer-right"), s, deps, { newLinkId: ids() });
    expect(added.kind).toBe("ok");
    if (added.kind !== "ok") return;
    expect(added.state.identity).toEqual([{ linkId: "I1", left: "v-east/selection", right: "v-plot/selection", mergePolicy: "prefer-right" }]);
    expect(added.state.classes).toEqual([{ id: "σ1", members: ["v-east/selection", "v-plot/selection"], fingerprint: expect.any(String) }]);
    expect(added.effects).toEqual([{ kind: "seed-class", classId: "σ1", reference: SEL_B }]);
    expect([...added.state.history.entries()]).toEqual([
      ["v-east/selection", SEL_A],
      ["v-plot/selection", SEL_B],
    ]);
    const after = withState(s, added);
    expect(effectiveBinding("v-east/selection", after)).toEqual({ kind: "alias", classId: "σ1" });
    expect(evaluatePort("v-east/selection", after, deps)).toMatchObject({ kind: "value", reference: SEL_B });
    expect(evaluatePort("v-plot/selection", after, deps)).toMatchObject({ kind: "value", reference: SEL_B });
    expect(badgeOf(after.ports.get("v-east/selection")!, after, deps)).toMatchObject({ state: "shared", glyph: "≡", text: "selection · σ1" });
    // A shared port can no longer be followed onto or bound: the class owns it.
    expect(planFollow("v-west/selection", "v-east/selection", after, deps)).toMatchObject({ kind: "unavailable", code: "shared" });
    expect(checkInvariants(after, deps)).toEqual([]);
  });
});

describe("identity.remove", () => {
  const merged = () => {
    const s = world({ emitted: { "v-east/selection": SEL_A, "v-plot/selection": SEL_B } });
    const added = applyLinkVerb(linkVerbs.identityAdd("v-east/selection", "v-plot/selection", "prefer-left"), s, deps, { newLinkId: ids() });
    if (added.kind !== "ok") throw new Error("add refused");
    return withState(s, added);
  };

  it("copy: each keeps the shared value; history: each gets its private value back; reset: both cleared", () => {
    for (const [policy, east, plot] of [
      ["copy", SEL_A, SEL_A],
      ["history", SEL_A, SEL_B],
      ["reset", null, null],
    ] as const) {
      const s = merged();
      const removed = applyLinkVerb(linkVerbs.identityRemove("I1", policy), s, deps);
      expect(removed.kind).toBe("ok");
      if (removed.kind !== "ok") return;
      expect(removed.state.identity).toEqual([]);
      expect(removed.state.classes).toEqual([]);
      expect(removed.state.history.size).toBe(0);
      const after = withState(s, removed);
      expect(after.aliases.size).toBe(0);
      expect(effectiveBinding("v-east/selection", after).kind).toBe("unresolved");
      expect(after.values.emitted("v-east/selection") ?? null).toEqual(east);
      expect(after.values.emitted("v-plot/selection") ?? null).toEqual(plot);
      expect(removed.effects.some((e) => e.kind === "forget-class")).toBe(true);
    }
  });

  it("removing one link of a three-member class contracts the class and initialises only the leaver", () => {
    const s0 = world({ emitted: { "v-east/selection": SEL_A, "v-plot/selection": SEL_B } });
    const one = applyLinkVerb(linkVerbs.identityAdd("v-east/selection", "v-plot/selection", "prefer-left"), s0, deps, { newLinkId: ids() });
    if (one.kind !== "ok") throw new Error();
    const s1 = withState(s0, one);
    const two = applyLinkVerb(linkVerbs.identityAdd("v-west/selection", "v-plot/selection", "prefer-right"), s1, deps, { newLinkId: () => "I2" });
    if (two.kind !== "ok") throw new Error();
    const s2 = withState(s1, two);
    expect([...s2.classes.values()][0]).toMatchObject({ id: "σ1", members: ["v-east/selection", "v-plot/selection", "v-west/selection"] });
    expect(s2.values.classCell?.("σ1")).toEqual(SEL_A);
    const removed = applyLinkVerb(linkVerbs.identityRemove("I2", "history"), s2, deps);
    if (removed.kind !== "ok") throw new Error();
    const s3 = withState(s2, removed);
    expect([...s3.classes.values()][0]).toMatchObject({ id: "σ1", members: ["v-east/selection", "v-plot/selection"] });
    expect(s3.aliases.get("v-west/selection")).toBeUndefined();
    expect(s3.values.classCell?.("σ1")).toEqual(SEL_A);
    expect(removed.effects).toEqual([{ kind: "set-emitted", port: "v-west/selection", reference: null }]);
    expect(planIdentityRemove("I9", "copy", s3)).toMatchObject({ kind: "unavailable", code: "link-missing" });
  });

  it("closing a member's view drops its declarations and keeps the surviving class id", () => {
    const s = merged();
    const gone = identityAfterViewsRemoved(new Set(["v-plot"]), s);
    expect(gone.identity).toEqual([]);
    expect(gone.classes).toEqual([]);
    const kept = identityAfterViewsRemoved(new Set(["v-west"]), s);
    expect(kept.classes[0]?.id).toBe("σ1");
  });
});
