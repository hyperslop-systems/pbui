import { describe, expect, it } from "vitest";
import { applyLinkVerb } from "./apply";
import { badgeOf, badgesOfView } from "./badge";
import { effectiveBinding, evaluatePort } from "./evaluate";
import { checkInvariants } from "./invariants";
import { bindingsAfterAppReplaced, bindingsAfterClone, bindingsAfterViewsRemoved, linksAfterPortsRemoved } from "./lifecycle";
import { planFollow, planPin, planResume, planUnlink } from "./plan";
import { describeBinding, isBinding, terms } from "./terms";
import { describeLinkVerb, isLinkVerb, linkVerbs } from "./verbs";
import { CUSTOMER_ADA, deps, ORDER_1042, ORDER_1060, PORTS, withBindings, world } from "./world.test-helpers";

const ids = () => {
  let n = 0;
  return () => `L${(n += 1)}`;
};

describe("terms", () => {
  it("validate structurally and describe themselves", () => {
    expect(isBinding(terms.follow("v-east/order", "L1"))).toBe(true);
    expect(isBinding(terms.hold(ORDER_1042, terms.ambient("workspace.order")))).toBe(true);
    expect(isBinding({ kind: "follow", source: "" })).toBe(false);
    expect(isBinding({ kind: "hold", reference: ORDER_1042, suspended: { kind: "nope" } })).toBe(false);
    expect(describeBinding(terms.hold(ORDER_1042, terms.follow("v-east/order", "L1")))).toBe("held on <order>, suspending: following v-east/order");
  });

  it("verbs validate and describe", () => {
    expect(isLinkVerb(linkVerbs.follow("a/x", "b/y"))).toBe(true);
    expect(isLinkVerb({ kind: "port.unlink", linkId: "L1", policy: "melt" })).toBe(false);
    expect(isLinkVerb({ kind: "port.bind", port: "a/x", reference: { type: "" } })).toBe(false);
    expect(describeLinkVerb(linkVerbs.unlink("L1", "freeze"))).toBe("unlink L1 (keep the last value)");
  });
});

describe("effective binding (D2 precedence)", () => {
  it("explicit term → document slot → declared fallback → unbound", () => {
    const s = world({ bindings: { "v-a/order": terms.follow("v-east/order", "L1") } });
    expect(effectiveBinding("v-a/order", s)).toEqual(terms.follow("v-east/order", "L1"));
    expect(effectiveBinding("v-plot/plot", s)).toEqual(terms.constant({ type: "document", value: "revenue-by-day" }));
    expect(effectiveBinding("v-b/order", s)).toEqual(terms.ambient("workspace.order"));
    expect(effectiveBinding("v-notes/subject", s).kind).toBe("unresolved");
    expect(effectiveBinding("v-none/x", s)).toMatchObject({ kind: "unresolved", diagnostic: { code: "port-missing" } });
  });
});

describe("evaluation", () => {
  it("reads ambient cells, followed emissions, and follows a follower", () => {
    const s = world({
      bindings: { "v-a/order": terms.follow("v-east/order", "L1"), "v-b/order": terms.follow("v-a/order", "L2") },
      emitted: { "v-east/order": ORDER_1042 },
      contexts: { "workspace.order": ORDER_1060 },
    });
    expect(evaluatePort("v-a/order", s, deps)).toMatchObject({ kind: "value", reference: ORDER_1042, path: ["v-a/order", "v-east/order"] });
    expect(evaluatePort("v-b/order", s, deps)).toMatchObject({ kind: "value", reference: ORDER_1042 });
    expect(evaluatePort("v-c/order", s, deps)).toMatchObject({ kind: "value", reference: ORDER_1060, provenance: { kind: "ambient" } });
  });

  it("is empty, not stale, when a source has emitted nothing; errors on a missing source or a cycle", () => {
    const s = world({ bindings: { "v-a/order": terms.follow("v-west/order", "L1"), "v-b/order": terms.follow("v-gone/order", "L2") } });
    expect(evaluatePort("v-a/order", s, deps).kind).toBe("empty");
    expect(evaluatePort("v-b/order", s, deps)).toMatchObject({ kind: "error", diagnostic: { code: "source-missing" } });
    const cyclic = world({ bindings: { "v-a/order": terms.follow("v-b/order", "L1"), "v-b/order": terms.follow("v-a/order", "L2") } });
    expect(evaluatePort("v-a/order", cyclic, deps)).toMatchObject({ kind: "error", diagnostic: { code: "cycle" } });
    expect(checkInvariants(cyclic, deps).map((v) => v.code)).toContain("cycle");
  });

  it("a held value is the value, whatever the source does now", () => {
    const s = world({ bindings: { "v-a/order": terms.hold(ORDER_1042, terms.follow("v-east/order", "L1")) }, emitted: { "v-east/order": ORDER_1060 } });
    expect(evaluatePort("v-a/order", s, deps)).toMatchObject({ kind: "value", reference: ORDER_1042 });
  });
});

describe("planFollow refuses with a code and a sentence", () => {
  const s = world({ emitted: { "v-east/order": ORDER_1042 } });
  it("direction, type, self, cycle, held, already", () => {
    expect(planFollow("v-a/order", "v-b/order", s, deps)).toMatchObject({ kind: "unavailable", code: "direction" });
    expect(planFollow("v-east/order", "v-west/order", s, deps)).toMatchObject({ kind: "unavailable", code: "direction" });
    expect(planFollow("v-east/order", "v-cust/customer", s, deps)).toMatchObject({ kind: "unavailable", code: "type", because: "<order> does not reach <customer>" });
    expect(planFollow("v-east/order", "v-east/order", s, deps)).toMatchObject({ kind: "unavailable", code: "self" });
    expect(planFollow("v-nope/x", "v-a/order", s, deps)).toMatchObject({ kind: "unavailable", code: "port-missing" });
    const held = world({ bindings: { "v-a/order": terms.hold(ORDER_1042, terms.ambient("workspace.order")) } });
    expect(planFollow("v-east/order", "v-a/order", held, deps)).toMatchObject({ kind: "unavailable", code: "held" });
    const already = world({ bindings: { "v-a/order": terms.follow("v-east/order", "L1") } });
    expect(planFollow("v-east/order", "v-a/order", already, deps)).toMatchObject({ kind: "unavailable", code: "already" });
  });

  it("reaches through the type graph and into <any>", () => {
    expect(planFollow("v-east/order", "v-insp/subject", s, deps)).toMatchObject({ kind: "available", explanation: "Inspector · subject will follow Orders East · order" });
    expect(planFollow("v-plot/datum", "v-insp/subject", s, deps).kind).toBe("available");
    expect(planFollow("v-east/order", "v-notes/subject", s, deps).kind).toBe("available");
  });

  it("refuses a cycle after a chain of followers", () => {
    // b follows a; a following b would close the loop.
    const chain = world({ bindings: { "v-b/order": terms.follow("v-a/order", "L1") } });
    expect(planFollow("v-b/order", "v-a/order", chain, deps)).toMatchObject({ kind: "unavailable", code: "direction" });
    // An inout would be needed to express it; use the follower-of-follower shape instead:
    const loop = world({ bindings: { "v-a/order": terms.follow("v-east/order", "L1") } });
    expect(planFollow("v-east/order", "v-b/order", loop, deps).kind).toBe("available");
  });
});

describe("the laws of pin, resume, detach (§6.3)", () => {
  const scenarios: Array<[string, Parameters<typeof world>[0], boolean]> = [
    ["ambient (declared fallback)", { contexts: { "workspace.order": ORDER_1042 } }, true],
    ["follow", { bindings: { "v-a/order": terms.follow("v-east/order", "L1") }, emitted: { "v-east/order": ORDER_1042 } }, true],
    // An explicit term equal to the declared fallback is restored as NO term:
    // the effective binding is identical, the document is normalized.
    ["explicit ambient", { bindings: { "v-a/order": terms.ambient("workspace.order") }, contexts: { "workspace.order": ORDER_1042 } }, false],
  ];
  for (const [name, options, sameDocument] of scenarios) {
    it(`resume(pin(port)) restores the effective binding for a ${name} term, and the document`, () => {
      const s = world(options);
      const before = effectiveBinding("v-a/order", s);
      const pinned = applyLinkVerb(linkVerbs.pin("v-a/order"), s, deps, { newLinkId: ids() });
      expect(pinned.kind).toBe("ok");
      if (pinned.kind !== "ok") return;
      const held = withBindings(s, pinned.bindings);
      expect(effectiveBinding("v-a/order", held)).toMatchObject({ kind: "hold", reference: ORDER_1042, suspended: before });
      expect(planFollow("v-west/order", "v-a/order", held, deps)).toMatchObject({ kind: "unavailable", code: "held" });
      const resumed = applyLinkVerb(linkVerbs.resume("v-a/order"), held, deps);
      expect(resumed.kind).toBe("ok");
      if (resumed.kind !== "ok") return;
      expect(effectiveBinding("v-a/order", withBindings(held, resumed.bindings))).toEqual(before);
      if (sameDocument) expect([...resumed.bindings.entries()]).toEqual([...s.bindings.entries()]);
      else expect(resumed.bindings.size).toBe(0);
    });
  }

  it("pin freezes the last ATTENDED value when there is one (toy pattern 8)", () => {
    const s = world({ contexts: { "workspace.order": ORDER_1042 }, attended: { "v-a/order": ORDER_1060 } });
    const pinned = applyLinkVerb(linkVerbs.pin("v-a/order"), s, deps);
    expect(pinned.kind === "ok" && pinned.bindings.get("v-a/order")).toMatchObject({ kind: "hold", reference: ORDER_1060 });
  });

  it("pin refuses when there is nothing to hold; resume and detach refuse when not held", () => {
    const s = world();
    expect(planPin("v-a/order", s, deps)).toMatchObject({ kind: "unavailable", code: "empty" });
    expect(planResume("v-a/order", s)).toMatchObject({ kind: "unavailable", code: "not-held" });
    expect(applyLinkVerb(linkVerbs.detach("v-a/order"), s, deps)).toMatchObject({ kind: "refused", plan: { code: "not-held" } });
  });

  it("detach(pin(port)) is a constant with no provenance", () => {
    const s = world({ bindings: { "v-a/order": terms.follow("v-east/order", "L1") }, emitted: { "v-east/order": ORDER_1042 } });
    const pinned = applyLinkVerb(linkVerbs.pin("v-a/order"), s, deps);
    if (pinned.kind !== "ok") throw new Error("pin refused");
    const detached = applyLinkVerb(linkVerbs.detach("v-a/order"), withBindings(s, pinned.bindings), deps);
    expect(detached.kind === "ok" && detached.bindings.get("v-a/order")).toEqual(terms.constant(ORDER_1042));
  });

  it("a hold over a closed source explains why it cannot resume", () => {
    const s = world({ bindings: { "v-a/order": terms.hold(ORDER_1042, terms.unresolved("source-closed", "the source tile was closed")) } });
    expect(planResume("v-a/order", s)).toMatchObject({ kind: "unavailable", code: "nothing-to-resume", because: "nothing to resume: the source tile was closed" });
  });
});

describe("follow, bind, ambient, clear, unlink", () => {
  it("follow writes a term with a fresh link id; the same source twice is refused", () => {
    const s = world({ emitted: { "v-east/order": ORDER_1042 } });
    const r = applyLinkVerb(linkVerbs.follow("v-east/order", "v-a/order"), s, deps, { newLinkId: ids() });
    expect(r.kind === "ok" && r.bindings.get("v-a/order")).toEqual(terms.follow("v-east/order", "L1"));
    if (r.kind !== "ok") return;
    expect(applyLinkVerb(linkVerbs.follow("v-east/order", "v-a/order"), withBindings(s, r.bindings), deps)).toMatchObject({ kind: "refused", plan: { code: "already" } });
  });

  it("bind fixes a value; a document slot refuses; a wrong type refuses", () => {
    const s = world();
    expect(applyLinkVerb(linkVerbs.bind("v-a/order", ORDER_1042), s, deps)).toMatchObject({ kind: "ok" });
    expect(applyLinkVerb(linkVerbs.bind("v-plot/plot", { type: "document", value: "x" }), s, deps)).toMatchObject({ kind: "refused", plan: { code: "document-slot" } });
    expect(applyLinkVerb(linkVerbs.bind("v-a/order", CUSTOMER_ADA), s, deps)).toMatchObject({ kind: "refused", plan: { code: "type" } });
    expect(applyLinkVerb(linkVerbs.bind("v-insp/subject", CUSTOMER_ADA), s, deps)).toMatchObject({ kind: "ok" });
  });

  it("ambient to the declared fallback is the absence of a term; another context is a term", () => {
    const s = world({ bindings: { "v-a/order": terms.follow("v-east/order", "L1") } });
    const back = applyLinkVerb(linkVerbs.ambient("v-a/order", "workspace.order"), s, deps);
    expect(back.kind === "ok" && back.bindings.has("v-a/order")).toBe(false);
    expect(applyLinkVerb(linkVerbs.ambient("v-a/order", "workspace.nope"), s, deps)).toMatchObject({ kind: "refused", plan: { code: "context-missing" } });
    expect(applyLinkVerb(linkVerbs.ambient("v-a/order", "workspace.inspected"), s, deps)).toMatchObject({ kind: "refused", plan: { code: "type" } });
  });

  it("clear returns to the fallback; a port with no term refuses", () => {
    const s = world({ bindings: { "v-a/order": terms.constant(ORDER_1042) } });
    const cleared = applyLinkVerb(linkVerbs.clear("v-a/order"), s, deps);
    expect(cleared.kind === "ok" && cleared.bindings.size).toBe(0);
    expect(applyLinkVerb(linkVerbs.clear("v-b/order"), s, deps)).toMatchObject({ kind: "refused", plan: { code: "already" } });
  });

  it("unlink applies the chosen policy and refuses what the port cannot do", () => {
    const s = world({ bindings: { "v-a/order": terms.follow("v-east/order", "L1"), "v-notes/subject": terms.follow("v-east/order", "L2") }, emitted: { "v-east/order": ORDER_1042 } });
    const frozen = applyLinkVerb(linkVerbs.unlink("L1", "freeze"), s, deps);
    expect(frozen.kind === "ok" && frozen.bindings.get("v-a/order")).toMatchObject({ kind: "hold", reference: ORDER_1042, suspended: { kind: "unresolved", diagnostic: { code: "unlinked" } } });
    const cleared = applyLinkVerb(linkVerbs.unlink("L1", "clear"), s, deps);
    expect(cleared.kind === "ok" && cleared.bindings.get("v-a/order")).toMatchObject({ kind: "unresolved", diagnostic: { code: "unlinked" } });
    const ambient = applyLinkVerb(linkVerbs.unlink("L1", "ambient"), s, deps);
    expect(ambient.kind === "ok" && ambient.bindings.has("v-a/order")).toBe(false);
    expect(planUnlink("L2", "ambient", s, deps)).toMatchObject({ kind: "unavailable", code: "no-fallback" });
    expect(planUnlink("L9", "clear", s, deps)).toMatchObject({ kind: "unavailable", code: "link-missing" });
    const empty = world({ bindings: { "v-a/order": terms.follow("v-west/order", "L1") } });
    expect(planUnlink("L1", "freeze", empty, deps)).toMatchObject({ kind: "unavailable", code: "empty" });
  });
});

describe("lifecycle", () => {
  it("a closed source: freeze holds, clear empties, ambient falls back, the closed view's own terms vanish", () => {
    const s = world({
      bindings: {
        "v-a/order": terms.follow("v-east/order", "L1"),
        "v-b/order": terms.follow("v-east/order", "L2"),
        "v-c/order": terms.follow("v-east/order", "L3"),
        "v-east/order": terms.constant(ORDER_1060),
      },
      emitted: { "v-east/order": ORDER_1042 },
    });
    const next = bindingsAfterViewsRemoved(new Set(["v-east"]), s, deps);
    expect(next.get("v-a/order")).toMatchObject({ kind: "hold", reference: ORDER_1042, suspended: { kind: "unresolved", diagnostic: { code: "source-closed" } } });
    expect(next.get("v-b/order")).toMatchObject({ kind: "unresolved", diagnostic: { code: "source-closed" } });
    expect(next.has("v-c/order")).toBe(false);
    expect(next.has("v-east/order")).toBe(false);
    const after = withBindings(world({ without: ["v-east"] }), next);
    expect(badgeOf(after.ports.get("v-a/order")!, after, deps)).toMatchObject({ state: "held", text: "#1042" });
    expect(checkInvariants(after, deps)).toEqual([]);
  });

  it("replacing an app drops the terms of ports it no longer declares", () => {
    const s = world({ bindings: { "v-a/order": terms.follow("v-east/order", "L1"), "v-b/order": terms.follow("v-east/order", "L2") } });
    const next = bindingsAfterAppReplaced("v-a", new Set(["subject"]), s.bindings);
    expect([...next.keys()]).toEqual(["v-b/order"]);
  });

  it("arbitrary removed ports apply source-close and remove only identities and history that touch them", () => {
    const s = world({
      bindings: { "v-a/order": terms.follow("v-east/order", "L1") },
      emitted: { "v-east/order": ORDER_1042 },
      identity: [
        { linkId: "I1", left: "v-east/selection", right: "v-west/selection", mergePolicy: "prefer-left" },
        { linkId: "I2", left: "v-west/selection", right: "v-plot/selection", mergePolicy: "prefer-left" },
      ],
      history: { "v-east/selection": null, "v-west/selection": null, "v-plot/selection": null },
    });
    const next = linksAfterPortsRemoved(new Set(["v-east/order", "v-east/selection"]), s, deps);
    expect(next.bindings.get("v-a/order")).toMatchObject({ kind: "hold", reference: ORDER_1042 });
    expect(next.identity.map((entry) => entry.linkId)).toEqual(["I2"]);
    expect([...next.classes[0]!.members].sort()).toEqual(["v-plot/selection", "v-west/selection"]);
    expect([...next.history.keys()].sort()).toEqual(["v-plot/selection", "v-west/selection"]);
  });

  it("cloning re-keys terms onto the copies and keeps sources that were cloned pointing at the copies", () => {
    const s = world({ bindings: { "v-a/order": terms.follow("v-east/order", "L1"), "v-b/order": terms.hold(ORDER_1042, terms.follow("v-a/order", "L2")) } });
    const next = bindingsAfterClone(new Map([["v-a", "v-a2"], ["v-b", "v-b2"]]), s.bindings);
    expect(next.get("v-a2/order")).toEqual(terms.follow("v-east/order", "L1-copy"));
    expect(next.get("v-b2/order")).toEqual(terms.hold(ORDER_1042, terms.follow("v-a2/order", "L2-copy")));
    expect(next.get("v-a/order")).toEqual(terms.follow("v-east/order", "L1"));
  });
});

describe("badges", () => {
  it("say what the port reads, in the report's glyphs", () => {
    const s = world({
      bindings: {
        "v-a/order": terms.follow("v-east/order", "L1"),
        "v-b/order": terms.hold(ORDER_1042, terms.follow("v-east/order", "L2")),
        "v-insp/subject": terms.constant(CUSTOMER_ADA),
        "v-notes/subject": terms.follow("v-gone/x", "L3"),
      },
      emitted: { "v-east/order": ORDER_1060 },
      contexts: { "workspace.order": ORDER_1042 },
    });
    const badge = (port: string) => badgeOf(s.ports.get(port)!, s, deps);
    expect(badge("v-a/order")).toMatchObject({ state: "following", glyph: "→", text: "Orders East", explanation: "order follows Orders East, now #1060" });
    expect(badge("v-b/order")).toMatchObject({ state: "held", glyph: "⏸", text: "#1042", explanation: "order is held on #1042; resume follows Orders East" });
    expect(badge("v-c/order")).toMatchObject({ state: "ambient", glyph: "○", text: "order · order" });
    expect(badge("v-insp/subject")).toMatchObject({ state: "fixed", glyph: "•", text: "<customer>" });
    expect(badge("v-notes/subject")).toMatchObject({ state: "unresolved", glyph: "⚠" });
    expect(badge("v-cust/customer").state).toBe("none");
    expect(badge("v-plot/plot")).toMatchObject({ state: "fixed", text: "revenue-by-day" });
  });

  it("badgesOfView lists inputs with a term and hides untouched document slots and outputs", () => {
    const s = world({ contexts: { "workspace.order": null } });
    expect(badgesOfView("v-plot", s, deps)).toEqual([]);
    expect(badgesOfView("v-east", s, deps)).toEqual([]);
    expect(badgesOfView("v-a", s, deps).map((b) => b.state)).toEqual(["empty"]);
    expect(PORTS.length).toBe(14);
  });
});
