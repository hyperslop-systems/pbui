import { describe, expect, test } from "vitest";
import type { SelectionSnapshot } from "../actions/types";
import {
  helpSurfaceStep,
  initialHelpSurfaceState,
} from "./machine";
import type {
  HelpSurfaceDeps,
  HelpSurfaceEvent,
  HelpSurfaceState,
} from "./machine";
import type { HelpResolution } from "./types";

/**
 * PBUI-HELP-002: one focused test per non-trivial transition-table cell
 * (intern guide §4.5), then the fuzz harness (§7) — plausible event
 * sequences generated against a world model, invariants I1–I4 asserted
 * after every single step.
 */

type Values = { thing: { id: string } };
type Facts = { tag: string };

const reference = { type: "thing", value: { id: "t1" } } as const;

const resolution: HelpResolution = {
  items: [],
  diagnostics: [],
  snapshotRevision: 1,
  registryVersion: 1,
};

const snapshot: SelectionSnapshot<Facts> = {
  revision: 1,
  scopes: ["global"],
  modes: new Set(),
  capabilities: new Set(),
  product: { tag: "t" },
};

function anchor(): Element {
  return document.createElement("span");
}

const yes: HelpSurfaceDeps<Values, Facts> = {
  resolve: () => ({ resolution, snapshot }),
};
const no: HelpSurfaceDeps<Values, Facts> = { resolve: () => null };

type State = HelpSurfaceState<Values, Facts>;

function run(events: readonly HelpSurfaceEvent<Values>[], deps = yes): State {
  let state: State = initialHelpSurfaceState();
  for (const event of events) state = helpSurfaceStep(state, event, deps);
  return state;
}

const enter = (a: Element): HelpSurfaceEvent<Values> => ({
  type: "pointer-enter",
  anchor: a,
  reference,
});
const fire = (a: Element): HelpSurfaceEvent<Values> => ({ type: "timer-fired", anchor: a });
const kbdFocus = (a: Element): HelpSurfaceEvent<Values> => ({
  type: "focus",
  anchor: a,
  reference,
  keyboard: true,
  restoring: false,
});

describe("transition table", () => {
  test("pointer-enter arms; timer-fired with content opens as pointer help", () => {
    const a = anchor();
    const armed = run([enter(a)]);
    expect(armed.surface).toMatchObject({ kind: "armed", anchor: a });
    const open = run([enter(a), fire(a)]);
    expect(open.surface).toMatchObject({ kind: "open", anchor: a, trigger: "pointer" });
  });

  test("timer-fired with an empty resolution goes idle, not open", () => {
    const a = anchor();
    expect(run([enter(a), fire(a)], no).surface.kind).toBe("idle");
  });

  test("pointer-leave cancels an arm and closes pointer help, except into the card", () => {
    const a = anchor();
    expect(
      run([enter(a), { type: "pointer-leave", anchor: a, into: "elsewhere" }]).surface.kind,
    ).toBe("idle");
    expect(
      run([enter(a), fire(a), { type: "pointer-leave", anchor: a, into: "elsewhere" }]).surface
        .kind,
    ).toBe("idle");
    expect(
      run([enter(a), fire(a), { type: "pointer-leave", anchor: a, into: "card" }]).surface.kind,
    ).toBe("open");
  });

  test("re-entering the OPEN anchor from the card does not re-arm (no flicker)", () => {
    const a = anchor();
    const state = run([
      enter(a),
      fire(a),
      { type: "pointer-leave", anchor: a, into: "card" },
      enter(a),
    ]);
    expect(state.surface.kind).toBe("open");
  });

  test("entering a different anchor re-targets the arm and drops the old card", () => {
    const a = anchor();
    const b = anchor();
    const state = run([enter(a), fire(a), enter(b)]);
    expect(state.surface).toMatchObject({ kind: "armed", anchor: b });
  });

  test("keyboard focus opens immediately; pointer-modality and restored focus do not", () => {
    const a = anchor();
    expect(run([kbdFocus(a)]).surface).toMatchObject({ kind: "open", trigger: "focus" });
    expect(
      run([{ type: "focus", anchor: a, reference, keyboard: false, restoring: false }]).surface
        .kind,
    ).toBe("idle");
    expect(
      run([{ type: "focus", anchor: a, reference, keyboard: true, restoring: true }]).surface
        .kind,
    ).toBe("idle");
  });

  test("blur closes open help but a pointer arm survives it", () => {
    const a = anchor();
    expect(run([kbdFocus(a), { type: "blur", anchor: a }]).surface.kind).toBe("idle");
    expect(run([enter(a), { type: "blur", anchor: a }]).surface.kind).toBe("armed");
  });

  test("card-leave to elsewhere closes; back to the anchor keeps the card", () => {
    const a = anchor();
    const open = [enter(a), fire(a), { type: "pointer-leave", anchor: a, into: "card" }] as const;
    expect(run([...open, { type: "card-leave", into: "elsewhere" }]).surface.kind).toBe("idle");
    expect(run([...open, { type: "card-leave", into: "anchor" }]).surface.kind).toBe("open");
  });

  test("menu-opened closes the card AND disarms a pending timer (PR #20 r4f1)", () => {
    const a = anchor();
    expect(run([enter(a), fire(a), { type: "menu-opened" }]).surface.kind).toBe("idle");
    // The round-4 finding: armed, menu opens, stray timeout fires anyway.
    const state = run([enter(a), { type: "menu-opened" }, fire(a)]);
    expect(state.surface.kind).toBe("idle");
    expect(state.menuOpen).toBe(true);
  });

  test("while the menu is open, enter and focus are inert; menu-closed re-enables them", () => {
    const a = anchor();
    expect(run([{ type: "menu-opened" }, enter(a)]).surface.kind).toBe("idle");
    expect(run([{ type: "menu-opened" }, kbdFocus(a)]).surface.kind).toBe("idle");
    const after = run([{ type: "menu-opened" }, { type: "menu-closed" }, kbdFocus(a)]);
    expect(after.surface.kind).toBe("open");
  });

  test("unmounting the anchored element clears an arm or an open card", () => {
    const a = anchor();
    expect(run([enter(a), { type: "unmounted", anchor: a }]).surface.kind).toBe("idle");
    expect(run([enter(a), fire(a), { type: "unmounted", anchor: a }]).surface.kind).toBe("idle");
    // Unmounting an unrelated element changes nothing.
    expect(run([enter(a), fire(a), { type: "unmounted", anchor: anchor() }]).surface.kind).toBe(
      "open",
    );
  });

  test("escape closes whatever the surface holds", () => {
    const a = anchor();
    expect(run([enter(a), fire(a), { type: "escape" }]).surface.kind).toBe("idle");
    expect(run([enter(a), { type: "escape" }]).surface.kind).toBe("idle");
  });

  test("no-op events return the SAME state object (render-skip contract)", () => {
    const a = anchor();
    const state = run([enter(a), fire(a)]);
    expect(helpSurfaceStep(state, enter(a), yes)).toBe(state);
    expect(helpSurfaceStep(state, { type: "blur", anchor: anchor() }, yes)).toBe(state);
    expect(
      helpSurfaceStep(state, { type: "pointer-leave", anchor: anchor(), into: "elsewhere" }, yes),
    ).toBe(state);
  });
});

/* --------------------------------------------------------- the fuzz harness -- */

/** Deterministic PRNG (mulberry32) so every failure is reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface World {
  anchors: Element[];
  mounted: Set<Element>;
  /** Where the pointer physically is. */
  pointerAt: Element | "card" | "nowhere";
  /** Which anchor holds keyboard focus, if any. */
  focusAt: Element | "nowhere";
  menuOpen: boolean;
}

describe("fuzzed invariants (intern guide §6)", () => {
  test("I1–I4 hold over seeded plausible event sequences", () => {
    const SEQUENCES = 400;
    const MAX_STEPS = 60;

    for (let seq = 0; seq < SEQUENCES; seq += 1) {
      const random = rng(0xbead + seq);
      const pick = <T>(items: readonly T[]): T =>
        items[Math.floor(random() * items.length)] as T;

      const anchors = [anchor(), anchor(), anchor(), anchor()];
      const world: World = {
        anchors,
        mounted: new Set(anchors),
        pointerAt: "nowhere",
        focusAt: "nowhere",
        menuOpen: false,
      };

      let resolveCalls = 0;
      const deps: HelpSurfaceDeps<Values, Facts> = {
        resolve: () => {
          resolveCalls += 1;
          return random() < 0.7 ? { resolution, snapshot } : null;
        },
      };

      let state: State = initialHelpSurfaceState();
      const trail: string[] = [];

      const dispatch = (event: HelpSurfaceEvent<Values>) => {
        const before = resolveCalls;
        state = helpSurfaceStep(state, event, deps);
        trail.push(event.type);
        const context = `seq ${seq} after [${trail.join(" → ")}]`;

        // I4 — laziness: resolution happens only in the two lazy transitions.
        if (resolveCalls > before) {
          expect(["timer-fired", "focus"], `I4 violated: ${context}`).toContain(event.type);
        }
        // I1 — mutual exclusion.
        if (state.menuOpen) {
          expect(state.surface.kind, `I1 violated: ${context}`).toBe("idle");
        }
        expect(state.menuOpen, `menu mirror diverged: ${context}`).toBe(world.menuOpen);
        // I3 — armed is attended.
        if (state.surface.kind === "armed") {
          expect(world.pointerAt, `I3 violated: ${context}`).toBe(state.surface.anchor);
          expect(world.menuOpen, `I3 violated (menu): ${context}`).toBe(false);
        }
        // I2 — no orphan card.
        if (state.surface.kind === "open") {
          expect(
            world.mounted.has(state.surface.anchor),
            `I2 violated (unmounted anchor): ${context}`,
          ).toBe(true);
          if (state.surface.trigger === "pointer") {
            expect(
              world.pointerAt === state.surface.anchor || world.pointerAt === "card",
              `I2 violated (pointer left): ${context}`,
            ).toBe(true);
          } else {
            expect(world.focusAt, `I2 violated (focus left): ${context}`).toBe(
              state.surface.anchor,
            );
          }
        }
      };

      /* Faithful compound gestures: the world only emits what a browser can. */

      const movePointer = (to: Element | "card" | "nowhere") => {
        const from = world.pointerAt;
        if (from === to) return;
        if (from instanceof Element) {
          dispatch({
            type: "pointer-leave",
            anchor: from,
            into: to === "card" ? "card" : "elsewhere",
          });
        } else if (from === "card") {
          dispatch({
            type: "card-leave",
            into:
              to instanceof Element &&
              state.surface.kind === "open" &&
              state.surface.anchor === to
                ? "anchor"
                : "elsewhere",
          });
        }
        world.pointerAt = to;
        if (to instanceof Element) dispatch(enter(to));
      };

      const moveFocus = (to: Element | "nowhere", restoring: boolean) => {
        const from = world.focusAt;
        if (from === to) return;
        if (from instanceof Element) dispatch({ type: "blur", anchor: from });
        world.focusAt = to;
        if (to instanceof Element) {
          dispatch({
            type: "focus",
            anchor: to,
            reference,
            keyboard: random() < 0.5,
            restoring,
          });
        }
      };

      for (let stepIndex = 0; stepIndex < MAX_STEPS; stepIndex += 1) {
        const moves: (() => void)[] = [];
        const mounted = anchors.filter((a) => world.mounted.has(a));

        if (mounted.length > 0) {
          moves.push(() => movePointer(pick(mounted)));
          moves.push(() => moveFocus(pick(mounted), false));
        }
        moves.push(() => movePointer("nowhere"));
        moves.push(() => moveFocus("nowhere", false));
        if (state.surface.kind === "open" && world.pointerAt === state.surface.anchor) {
          moves.push(() => movePointer("card"));
        }
        if (state.surface.kind === "armed") {
          const armedAnchor = state.surface.anchor;
          moves.push(() => dispatch({ type: "timer-fired", anchor: armedAnchor }));
        }
        if (state.surface.kind === "open") {
          moves.push(() => dispatch({ type: "escape" }));
        }
        if (world.menuOpen) {
          moves.push(() => {
            world.menuOpen = false;
            dispatch({ type: "menu-closed" });
            // The menu returns focus to an invoker: a RESTORED focus event.
            const target = mounted.length > 0 ? pick(mounted) : null;
            if (target) moveFocus(target, true);
          });
        } else {
          moves.push(() => {
            world.menuOpen = true;
            dispatch({ type: "menu-opened" });
            // Opening the menu moves focus into it (no anchor holds focus).
            moveFocus("nowhere", false);
          });
        }
        if (mounted.length > 1) {
          moves.push(() => {
            const victim = pick(mounted);
            world.mounted.delete(victim);
            // Removal fires neither leave nor blur — the round-3 bug shape.
            if (world.pointerAt === victim) world.pointerAt = "nowhere";
            if (world.focusAt === victim) world.focusAt = "nowhere";
            dispatch({ type: "unmounted", anchor: victim });
          });
        } else {
          // Remount everything so sequences do not starve of anchors.
          moves.push(() => {
            for (const a of anchors) world.mounted.add(a);
          });
        }

        pick(moves)();
      }
    }
  });
});
