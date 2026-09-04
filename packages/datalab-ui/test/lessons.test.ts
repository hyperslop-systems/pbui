import { sequentialIds } from "@hyperslop-systems/workbench-core";
import { describe, expect, test } from "vitest";
import "../src/apps/all";
import type { Lesson } from "../src/appkit/lessons";
import { datalabManifests } from "../src/appkit/workbenchApps";
import type { AcceptResult } from "../src/pbui";
import { createDatalabRuntime, type DatalabRuntime } from "../src/store/runtime";
import { singleStageSeed, tile } from "../src/store/seed";
import {
  TOUR_FIXTURES,
  objectsSeed,
  layoutSeed,
  grammarSeed,
  briefSeed,
  type Seed,
} from "../src/tour/fixtures";
import { objectsLessons } from "../src/tour/lessons/objects";
import { layoutLessons } from "../src/tour/lessons/layout";
import { grammarLessons } from "../src/tour/lessons/grammar";
import { briefGoals, briefHints } from "../src/tour/lessons/brief";

/**
 * **The anti-rot test.** This is the whole reason the tutorial is executable.
 *
 * For every lesson with a ▶ runner: run it against a real runtime, then ask
 * its own `done` predicate. If the two disagree, the lesson is broken — the ▶
 * button does something the step does not describe, or describes something it
 * does not do. Either way a reader presses ▶, watches the panel change, and
 * gets no tick.
 *
 * A screenshot walkthrough is wrong within a month and tells nobody. This
 * fails in CI the moment an action creator is renamed, a reducer's payload
 * shape changes, a controller method changes its contract, or a predicate is
 * written to a column that no longer exists. That property is why
 * `Tutorial.tsx`'s docstring calls the tutorials "the cheapest regression test
 * in the project", and this generalises it.
 *
 * Predicates are pure functions of `RootState` and the core's state (DR-49,
 * PBUI-DATALAB-WORKBENCH-1), so none of this needs a DOM, a Provider, or a
 * rendered component.
 */

const apps = datalabManifests();

/** A runtime seeded exactly as its tour section seeds it. */
function runtimeFor(seed: Seed): DatalabRuntime {
  return createDatalabRuntime({
    seed: seed.seed,
    world: seed.world,
    apps,
    ids: sequentialIds(),
    fixtures: TOUR_FIXTURES,
    seedDocuments: false,
    ownership: "trust",
  });
}

/**
 * Run one lesson's ▶ and report whether its predicate is then satisfied.
 *
 * `accept` resolves immediately with a plausible argument rather than hanging.
 * In the application it waits for a click; here the runner needs *an* answer,
 * and what it does with it is what is under test.
 */
async function runAndCheck(lesson: Lesson, rt: DatalabRuntime, acceptWith: unknown) {
  await lesson.run?.({
    dispatch: rt.store.dispatch,
    getState: () => rt.store.getState(),
    accept: async (request) =>
      ({
        type: typeof request.types === "string" ? request.types : request.types[0],
        value: acceptWith,
      }) as AcceptResult,
    workbench: rt.controller,
  });
  return lesson.done?.(rt.store.getState(), rt.core.getState()) ?? null;
}

const TRACKS: Array<[string, Lesson[], () => DatalabRuntime, unknown]> = [
  [
    "objects",
    objectsLessons,
    () => runtimeFor(objectsSeed()),
    { docId: null, name: "data.temp_c" },
  ],
  ["layout", layoutLessons, () => runtimeFor(layoutSeed()), null],
  [
    "grammar",
    grammarLessons,
    () => runtimeFor(grammarSeed()),
    { docId: null, name: "data.station" },
  ],
];

describe("every ▶ satisfies its own predicate", () => {
  for (const [track, lessons, build, acceptWith] of TRACKS) {
    for (const lesson of lessons.filter((l) => l.run && l.done)) {
      test(`${track}/${lesson.id} — ${lesson.title}`, async () => {
        // A fresh runtime per lesson: a step must work from the section's
        // starting state, not from whatever the previous step happened to
        // leave. A reader arriving at step 4 by their own route has not
        // necessarily performed steps 1 to 3 the way ▶ would.
        const rt = build();
        try {
          expect(await runAndCheck(lesson, rt, acceptWith)).toBe(true);
        } finally {
          rt.dispose();
        }
      });
    }
  }
});

describe("lessons are well-formed", () => {
  const ALL: Array<[string, Lesson[]]> = [
    ["objects", objectsLessons],
    ["layout", layoutLessons],
    ["grammar", grammarLessons],
  ];

  test("every lesson can be completed somehow", () => {
    // A lesson with neither a predicate nor `manual: true` can never tick, so
    // the rail's count is unreachable and the reader is stuck looking at it.
    const stuck: string[] = [];
    for (const [track, lessons] of ALL) {
      for (const lesson of lessons) {
        if (!lesson.done && !lesson.manual) stuck.push(`${track}/${lesson.id}`);
      }
    }
    expect(stuck).toEqual([]);
  });

  test("no lesson has both a runner and a got-it button", () => {
    // `manual` means "there is nothing in the store to observe". A lesson with
    // both is claiming that and also dispatching, which is a contradiction the
    // rail resolves by showing two buttons that mean different things.
    const both: string[] = [];
    for (const [track, lessons] of ALL) {
      for (const lesson of lessons) {
        if (lesson.run && lesson.manual) both.push(`${track}/${lesson.id}`);
      }
    }
    expect(both).toEqual([]);
  });

  test("ids are unique within a track", () => {
    for (const [track, lessons] of ALL) {
      const ids = lessons.map((l) => l.id);
      expect(new Set(ids).size, `${track} has duplicate ids`).toBe(ids.length);
    }
  });

  test("a prediction's answer indexes its own options", () => {
    const broken: string[] = [];
    for (const [track, lessons] of ALL) {
      for (const lesson of lessons) {
        const p = lesson.predict;
        if (!p) continue;
        if (p.answer < 0 || p.answer >= p.options.length) broken.push(`${track}/${lesson.id}`);
        if (p.options.length < 2) broken.push(`${track}/${lesson.id} has fewer than two options`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe("the brief", () => {
  test("nothing is satisfied by the starting state", () => {
    // The failure this catches is specific and has happened: a goal comparing
    // two tile docIds was true when both were null, so the brief opened at 1/5
    // before the reader had touched anything.
    const rt = runtimeFor(briefSeed());
    const met = briefGoals.filter((goal) => goal.done(rt.store.getState(), rt.core.getState()));
    expect(met.map((goal) => goal.id)).toEqual([]);
    rt.dispose();
  });

  test("a predicate that throws is not the reader's problem", () => {
    // Every goal runs against a world with no documents at all, which is a
    // state the reader can reach by deleting things. None may throw.
    const ids = sequentialIds();
    const empty = createDatalabRuntime({
      seed: singleStageSeed("empty", tile("brief"), { apps, ids }),
      apps,
      ids,
      fixtures: TOUR_FIXTURES,
      seedDocuments: false,
      ownership: "trust",
    });
    for (const goal of briefGoals) {
      expect(
        () => goal.done(empty.store.getState(), empty.core.getState()),
        `${goal.id} threw`,
      ).not.toThrow();
    }
    empty.dispose();
  });

  test("there are hints, and the last one is not the answer", () => {
    expect(briefHints.length).toBeGreaterThan(3);
    // The final hint should still leave work to do. Checked by hand, asserted
    // here only as a reminder that the list is ordered navigational →
    // conceptual → mechanical and the order is the design.
    expect(briefHints[briefHints.length - 1]).toContain("DOC strip");
  });
});
