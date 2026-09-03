import { describe, expect, it, vi } from "vitest";
import type { ResolvedAction } from "../actions/types";
import { activationOutcome, stopsPropagation } from "./activation";

const PRIMARY = { action: "open", candidateId: "c1" } as unknown as ResolvedAction<never, string>;

/**
 * The whole ladder as a table (guide §14.4): every combination of the three
 * inputs, the one outcome each yields, and whether the gesture stops. The
 * thunk column records whether the primary resolution ran at all.
 */
const TABLE: Array<{
  acceptable: boolean;
  activate: { run?: () => void } | null;
  primary: ResolvedAction<never, string> | null;
  outcome: string;
  stops: boolean;
  resolvesPrimary: boolean;
}> = [
  { acceptable: true, activate: { run: () => undefined }, primary: PRIMARY, outcome: "attempt-accept", stops: true, resolvesPrimary: false },
  { acceptable: true, activate: null, primary: PRIMARY, outcome: "attempt-accept", stops: true, resolvesPrimary: false },
  { acceptable: true, activate: null, primary: null, outcome: "attempt-accept", stops: true, resolvesPrimary: false },
  { acceptable: false, activate: { run: () => undefined }, primary: PRIMARY, outcome: "activate-host", stops: false, resolvesPrimary: false },
  { acceptable: false, activate: {}, primary: PRIMARY, outcome: "activate-host", stops: false, resolvesPrimary: false },
  { acceptable: false, activate: null, primary: PRIMARY, outcome: "perform-primary", stops: true, resolvesPrimary: true },
  { acceptable: false, activate: null, primary: null, outcome: "open-menu", stops: true, resolvesPrimary: true },
  { acceptable: false, activate: undefined as unknown as null, primary: null, outcome: "open-menu", stops: true, resolvesPrimary: true },
];

describe("activationOutcome", () => {
  for (const row of TABLE) {
    it(`acceptable=${row.acceptable} activate=${row.activate === null ? "none" : row.activate === undefined ? "undefined" : row.activate.run ? "run" : "host-only"} primary=${row.primary ? "one" : "none"} → ${row.outcome}`, () => {
      const primary = vi.fn(() => row.primary);
      const outcome = activationOutcome({ acceptable: row.acceptable, activate: row.activate, primary });
      expect(outcome.kind).toBe(row.outcome);
      expect(stopsPropagation(outcome)).toBe(row.stops);
      expect(primary.mock.calls.length > 0).toBe(row.resolvesPrimary);
    });
  }

  it("activate-host carries the run (or its absence) and always bubbles", () => {
    const run = () => undefined;
    expect(activationOutcome({ acceptable: false, activate: { run }, primary: () => null })).toEqual({ kind: "activate-host", bubble: true, run });
    expect(activationOutcome({ acceptable: false, activate: {}, primary: () => null })).toEqual({ kind: "activate-host", bubble: true, run: undefined });
  });

  it("perform-primary carries the resolved action", () => {
    expect(activationOutcome({ acceptable: false, activate: null, primary: () => PRIMARY })).toEqual({ kind: "perform-primary", action: PRIMARY });
  });
});
