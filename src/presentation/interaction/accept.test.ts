import { describe, expect, it } from "vitest";
import type { AcceptanceOption, AcceptanceResolution } from "../acceptance/types";
import type { AcceptRequest, PresentationReference } from "../types";
import { acceptStep, chooserOptions, pendingRequest, type AcceptEffect, type AcceptEvent, type AcceptState, type AcceptStepResult } from "./accept";

type V = { order: { id: string }; customer: { id: string } };

const REQUEST: AcceptRequest<V> = { types: ["order"], prompt: "pick an order" };
const ORDER: PresentationReference<V> = { type: "order", value: { id: "1" } };
const CUSTOMER: PresentationReference<V> = { type: "customer", value: { id: "c" } };
const option = (result: PresentationReference<V>, relation: string | null = null): AcceptanceOption<V> => ({ relation, result, scopeIndex: 0 }) as unknown as AcceptanceOption<V>;

const accepted: AcceptanceResolution<V> = { kind: "accepted", option: option(ORDER) } as AcceptanceResolution<V>;
const ambiguous: AcceptanceResolution<V> = { kind: "ambiguous", options: [option(ORDER, "a"), option(CUSTOMER, "b")] } as AcceptanceResolution<V>;
const none: AcceptanceResolution<V> = { kind: "none" } as AcceptanceResolution<V>;

const run = (events: readonly AcceptEvent<V>[], from: AcceptState<V> = { kind: "idle" }) => {
  let state = from;
  const effects: AcceptEffect<V>[] = [];
  for (const event of events) {
    const step = acceptStep(state, event);
    state = step.state;
    effects.push(...step.effects);
  }
  return { state, effects };
};

describe("acceptStep transitions", () => {
  it("a request from idle goes pending and closes the menu", () => {
    const { state, effects } = run([{ type: "request", requestId: 1, request: REQUEST }]);
    expect(state).toEqual({ kind: "pending", requestId: 1, request: REQUEST });
    expect(effects).toEqual([{ kind: "close-menu" }]);
    expect(pendingRequest(state)).toBe(REQUEST);
  });

  it("a second request is refused for its own id and the first is untouched", () => {
    const { state, effects } = run([
      { type: "request", requestId: 1, request: REQUEST },
      { type: "request", requestId: 2, request: REQUEST },
    ]);
    expect(state).toMatchObject({ kind: "pending", requestId: 1 });
    expect(effects).toEqual([{ kind: "close-menu" }, { kind: "resolve-null", requestId: 2, reason: "refused" }]);
  });

  it("an accepted offer settles the pending request and returns to idle", () => {
    const { state, effects } = run([{ type: "request", requestId: 1, request: REQUEST }, { type: "offer", reference: ORDER, resolution: accepted }]);
    expect(state).toEqual({ kind: "idle" });
    expect(effects[1]).toEqual({ kind: "settle", requestId: 1, reference: ORDER });
  });

  it("an ambiguous offer opens the chooser under the same request; none leaves it pending", () => {
    const { state } = run([{ type: "request", requestId: 1, request: REQUEST }, { type: "offer", reference: ORDER, resolution: ambiguous }]);
    expect(state).toMatchObject({ kind: "choosing", requestId: 1 });
    expect(chooserOptions(state)).toHaveLength(2);
    expect(run([{ type: "request", requestId: 1, request: REQUEST }, { type: "offer", reference: CUSTOMER, resolution: none }]).state).toMatchObject({ kind: "pending", requestId: 1 });
  });

  it("choose settles with the option's result", () => {
    const { state, effects } = run([{ type: "request", requestId: 1, request: REQUEST }, { type: "offer", reference: ORDER, resolution: ambiguous }, { type: "choose", option: option(CUSTOMER, "b") }]);
    expect(state).toEqual({ kind: "idle" });
    expect(effects.at(-1)).toEqual({ kind: "settle", requestId: 1, reference: CUSTOMER });
  });

  it("Escape on the chooser keeps the request; Escape on a pending request aborts it", () => {
    const chooser = run([{ type: "request", requestId: 1, request: REQUEST }, { type: "offer", reference: ORDER, resolution: ambiguous }, { type: "escape" }]);
    expect(chooser.state).toEqual({ kind: "pending", requestId: 1, request: REQUEST });
    expect(chooser.effects).toEqual([{ kind: "close-menu" }]);
    const aborted = run([{ type: "escape" }], chooser.state);
    expect(aborted.state).toEqual({ kind: "idle" });
    expect(aborted.effects).toEqual([{ kind: "resolve-null", requestId: 1, reason: "aborted" }]);
  });

  it("dismiss-chooser is the chooser's Escape; abort is the pending Escape from any non-idle state", () => {
    const choosing = run([{ type: "request", requestId: 1, request: REQUEST }, { type: "offer", reference: ORDER, resolution: ambiguous }]).state;
    expect(run([{ type: "dismiss-chooser" }], choosing).state).toMatchObject({ kind: "pending", requestId: 1 });
    expect(run([{ type: "abort" }], choosing).effects).toEqual([{ kind: "resolve-null", requestId: 1, reason: "aborted" }]);
  });

  it("events that do not apply leave idle alone with no effects", () => {
    for (const event of [{ type: "offer", reference: ORDER, resolution: accepted }, { type: "choose", option: option(ORDER) }, { type: "escape" }, { type: "dismiss-chooser" }, { type: "abort" }] as AcceptEvent<V>[]) {
      expect(acceptStep<V>({ kind: "idle" }, event)).toEqual({ state: { kind: "idle" }, effects: [] });
    }
  });
});

/** mulberry32, so a failing sequence is reproducible from its seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomEvent(random: () => number, nextId: () => number): AcceptEvent<V> {
  const r = random();
  if (r < 0.2) return { type: "request", requestId: nextId(), request: REQUEST };
  if (r < 0.45) return { type: "offer", reference: ORDER, resolution: random() < 0.4 ? accepted : random() < 0.7 ? ambiguous : none };
  if (r < 0.6) return { type: "choose", option: option(random() < 0.5 ? ORDER : CUSTOMER, "x") };
  if (r < 0.75) return { type: "escape" };
  if (r < 0.9) return { type: "dismiss-chooser" };
  return { type: "abort" };
}

describe("§14.5 invariants under generated event sequences", () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    it(`seed ${seed}`, () => {
      const random = rng(seed * 7919);
      let id = 0;
      const nextId = () => (id += 1);
      let state: AcceptState<V> = { kind: "idle" };
      const admitted = new Set<number>(); // requests that became pending
      const refused = new Set<number>(); // requests refused on arrival
      const terminals = new Map<number, number>(); // requestId → count of settle/resolve-null
      for (let i = 0; i < 40; i += 1) {
        const event = randomEvent(random, nextId);
        const before = state;
        const { state: after, effects }: AcceptStepResult<V> = acceptStep(state, event);

        // The state is one value: at most one pending request, and a chooser only under a pending request.
        if (after.kind === "choosing") expect(after.options.length).toBeGreaterThan(0);

        if (event.type === "request") {
          if (before.kind === "idle") {
            admitted.add(event.requestId);
            expect(after).toMatchObject({ kind: "pending", requestId: event.requestId });
          } else {
            refused.add(event.requestId);
            // The first request is untouched by a second.
            expect(after).toBe(before);
            expect(effects).toEqual([{ kind: "resolve-null", requestId: event.requestId, reason: "refused" }]);
          }
        }
        for (const effect of effects) {
          if (effect.kind === "settle" || effect.kind === "resolve-null") {
            terminals.set(effect.requestId, (terminals.get(effect.requestId) ?? 0) + 1);
            // A terminal effect names a request that exists.
            expect(admitted.has(effect.requestId) || refused.has(effect.requestId)).toBe(true);
          }
        }
        // A terminal for the CURRENT request leaves the machine idle.
        if (before.kind !== "idle" && effects.some((e) => (e.kind === "settle" || e.kind === "resolve-null") && e.requestId === before.requestId)) {
          expect(after.kind).toBe("idle");
        }
        // Chooser Escape keeps the request id; pending Escape ends it.
        if (event.type === "escape" && before.kind === "choosing") expect(after).toMatchObject({ kind: "pending", requestId: before.requestId });
        if (event.type === "escape" && before.kind === "pending") expect(after.kind).toBe("idle");
        state = after;
      }
      // Drain: abort whatever is left so every admitted request has its terminal.
      const drained = acceptStep(state, { type: "abort" });
      for (const effect of drained.effects) if (effect.kind === "resolve-null") terminals.set(effect.requestId, (terminals.get(effect.requestId) ?? 0) + 1);
      for (const requestId of admitted) expect(terminals.get(requestId)).toBe(1);
      for (const requestId of refused) expect(terminals.get(requestId)).toBe(1);
      expect(drained.state).toEqual({ kind: "idle" });
    });
  }
});
