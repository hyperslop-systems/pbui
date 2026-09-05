import { describe, expect, it } from "vitest";
import { freshCandidate, resolveShow, type PlacementCandidate, type SpawnableApp } from "./resolveShow";
import { terms } from "./terms";
import { isLinkVerb, linkVerbs } from "./verbs";
import { CUSTOMER_ADA, deps, ORDER_1042, world } from "./world.test-helpers";

/*
 * The target resolver's invariants (report §7.10, §8.9–8.10; design §12.1):
 * ranking is a declared tuple, ties are ambiguity, a held port is
 * inapplicable to a generic route, registration order never decides, and a
 * stale candidate is refused on a fresh resolution.
 */

const PLACEMENTS: PlacementCandidate[] = [
  { id: "right", label: "split right of Orders East", placementId: "n-east", zone: "right" },
  { id: "below", label: "split below Orders East", placementId: "n-east", zone: "bottom" },
];
const DETAIL: SpawnableApp = { appId: "order-detail", title: "order detail", portName: "order", valueType: "order", semanticRole: "order.detail" };
const INSPECTOR: SpawnableApp = { appId: "inspector", title: "inspector", portName: "subject", valueType: "inspectable", semanticRole: "subject" };

describe("resolveShow", () => {
  it("prefers the exact type over a supertype, and a matching role over a free port", () => {
    const s = world();
    const r = resolveShow({ subject: ORDER_1042, from: "v-east/order" }, s, deps);
    const ids = r.candidates.filter((c) => c.status.kind === "available").map((c) => c.candidateId);
    expect(ids).toContain("existing:v-a/order");
    expect(ids).toContain("existing:v-insp/subject");
    // Three free order details tie at the same rank: an ambiguity, never a winner by order.
    expect(r.winners.map((w) => w.candidateId).sort()).toEqual(["existing:v-a/order", "existing:v-b/order", "existing:v-c/order"]);
    expect(r.ambiguous).toBe(true);
    const insp = r.candidates.find((c) => c.candidateId === "existing:v-insp/subject")!;
    const detail = r.candidates.find((c) => c.candidateId === "existing:v-a/order")!;
    expect(insp.rank[0]).toBeGreaterThan(detail.rank[0]);
  });

  it("a held port is inapplicable to a generic route; a port already following the source ranks first by affinity", () => {
    const s = world({ bindings: { "v-a/order": terms.hold(ORDER_1042, terms.ambient("workspace.order")), "v-b/order": terms.follow("v-east/order", "L1") } });
    const r = resolveShow({ subject: ORDER_1042, from: "v-east/order" }, s, deps);
    const held = r.candidates.find((c) => c.candidateId === "existing:v-a/order")!;
    expect(held.status.kind).toBe("inapplicable");
    expect(r.winners.map((w) => w.candidateId)).toEqual(["existing:v-b/order"]);
    // Already following the source: available, and a no-op (no verb to perform).
    expect(r.winners[0]?.kind === "existing-port" && r.winners[0].verb).toBeUndefined();
    expect(r.ambiguous).toBe(false);
  });

  it("with no source port the candidates bind the value itself", () => {
    const s = world({ without: ["v-b", "v-c"] });
    const r = resolveShow({ subject: CUSTOMER_ADA }, s, deps);
    expect(r.winners.map((w) => w.candidateId)).toEqual(["existing:v-cust/customer"]);
    expect(r.winners[0]?.kind === "existing-port" && r.winners[0].verb).toEqual(linkVerbs.bind("v-cust/customer", CUSTOMER_ADA));
  });

  it("spawns rank after every free existing port and prefers the first placement for one target", () => {
    const s = world({ without: ["v-a", "v-b", "v-c"] });
    const r = resolveShow({ subject: ORDER_1042, from: "v-east/order", role: "order.detail" }, s, deps, { placements: PLACEMENTS, spawnable: [DETAIL, INSPECTOR] });
    // Type distance is the FIRST rank key (report §7.10): a spawned detail (exact type, matching role) beats
    // the inspector on screen, which reaches <order> only through <inspectable> and has the wrong role.
    expect(r.winners.map((w) => w.candidateId)).toEqual(["spawn:order-detail:order:right"]);
    const insp = r.candidates.find((c) => c.candidateId === "existing:v-insp/subject")!;
    expect(insp.status.kind).toBe("available");
    expect(insp.rank[0]).toBeGreaterThan(0);
    const spawnIds = r.candidates.filter((c) => c.kind === "spawn").map((c) => c.candidateId);
    expect(spawnIds).toEqual(["spawn:order-detail:order:right", "spawn:order-detail:order:below", "spawn:inspector:subject:right", "spawn:inspector:subject:below"]);
    const empty = world({ without: ["v-a", "v-b", "v-c", "v-insp", "v-notes"] });
    const r2 = resolveShow({ subject: ORDER_1042, from: "v-east/order" }, empty, deps, { placements: PLACEMENTS, spawnable: [DETAIL, INSPECTOR] });
    expect(r2.winners.map((w) => w.candidateId)).toEqual(["spawn:order-detail:order:right"]);
    expect(r2.ambiguous).toBe(false);
  });

  it("keeps equally ranked distinct app ports ambiguous while discarding their alternate placements", () => {
    const empty = world({ without: ["v-a", "v-b", "v-c", "v-insp", "v-notes"] });
    const alternate: SpawnableApp = { appId: "order-card", title: "order card", portName: "subject", valueType: "order", semanticRole: "order.detail" };
    const secondPort: SpawnableApp = { ...DETAIL, portName: "comparison" };
    const r = resolveShow({ subject: ORDER_1042, role: "order.detail" }, empty, deps, { placements: PLACEMENTS, spawnable: [DETAIL, alternate, secondPort] });
    expect(r.winners.map((winner) => winner.candidateId)).toEqual(["spawn:order-detail:order:right", "spawn:order-card:subject:right", "spawn:order-detail:comparison:right"]);
    expect(r.ambiguous).toBe(true);
  });

  it("ranking is independent of port registration order", () => {
    const s = world();
    const reversed = { ...s, ports: new Map([...s.ports.entries()].reverse()) };
    const a = resolveShow({ subject: ORDER_1042, from: "v-east/order" }, s, deps);
    const b = resolveShow({ subject: ORDER_1042, from: "v-east/order" }, reversed, deps);
    expect(a.winners.map((w) => w.candidateId).sort()).toEqual(b.winners.map((w) => w.candidateId).sort());
    expect(a.ambiguous).toBe(b.ambiguous);
  });

  it("refuses a stale candidate on a fresh resolution rather than replaying it", () => {
    const before = resolveShow({ subject: ORDER_1042, from: "v-east/order" }, world(), deps);
    const stale = before.candidates.find((c) => c.candidateId === "existing:v-a/order")!;
    const later = world({ bindings: { "v-a/order": terms.hold(ORDER_1042, terms.ambient("workspace.order")) } });
    const fresh = resolveShow({ subject: ORDER_1042, from: "v-east/order" }, later, deps);
    expect(freshCandidate(stale.candidateId, fresh)).toMatchObject({ kind: "refused", code: "target-no-longer-available" });
    expect(freshCandidate("existing:v-gone/x", fresh)).toMatchObject({ kind: "refused", code: "target-no-longer-resolves" });
    expect(freshCandidate("existing:v-b/order", fresh)).toMatchObject({ kind: "proceed" });
  });

  it("the show verb validates and describes", () => {
    expect(isLinkVerb(linkVerbs.show(ORDER_1042, { from: "v-east/order", role: "order.detail" }))).toBe(true);
    expect(isLinkVerb({ kind: "show", subject: ORDER_1042, disposition: "sideways" })).toBe(false);
    expect(isLinkVerb({ kind: "show", subject: { type: "" } })).toBe(false);
  });
});
