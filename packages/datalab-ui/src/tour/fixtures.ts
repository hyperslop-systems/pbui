import { fixturesFrom, type FixtureData } from "../api/fixtures";
import { readings, census } from "../fixtures";
import { appendTransform, createDefaultGraphic, fieldRef } from "../model/graphicAuthoring";
import { datalabSingleStageSeed } from "../appkit/workbench";
import type { PreloadedState } from "../store";
import { split, tile, type DatalabSeed, type LayoutSpec } from "../store/seed";
import { newId } from "../store/world";

/**
 * The data and the starting states every tour section is seeded with.
 *
 * Two sources, both committed JSON, both deterministic — so every reader sees
 * the same numbers and ↺ really does restore. `readings` is an event stream
 * from four weather stations; `census` is a dataset of twenty-four stations
 * across three regions.
 *
 * **The dotted column names are the trap this file exists to avoid.**
 * `readings` is an event stream, so its payload columns are `data.temp_c` and
 * `data.station`, not `temp_c` and `station`. A lesson body that names the
 * wrong one reads as broken to the reader — the chart says "y ↦ temp_c is not
 * in the pipeline output", which looks like our defect rather than their typo.
 * `src/fixtures/charts.ts` was written for the same reason after it happened
 * once; naming them here, once, is what stops it happening again.
 */
export const COLUMNS = {
  station: "data.station",
  temp: "data.temp_c",
  humidity: "data.humidity",
  ok: "data.ok",
  time: "time",
  seq: "seq",
} as const;

export const CENSUS_COLUMNS = {
  region: "region",
  population: "population",
  area: "area_km2",
  station: "station_id",
} as const;

/** Both sources, answered from memory. Every section uses the same map. */
export const TOUR_FIXTURES: FixtureData = fixturesFrom(readings, census);

/**
 * A world holding one document already pointed at the stream.
 *
 * `defaultChart(readings)` is the same function `useDocTable` applies when a
 * table first arrives, so the encoding a section starts with is the encoding
 * the product would infer. Hand-writing one would be asserting what the engine
 * does rather than showing it, and the two drift the first time `defaultChart`
 * changes.
 */
export function seedStream(): NonNullable<PreloadedState["world"]> {
  const id = newId();
  return {
    docs: {
      [id]: createDefaultGraphic(id, "α", readings),
    },
    docOrder: [id],
    activeDocId: id,
  };
}

/** Two documents: the stream and the dataset. §B needs a second one to re-point to. */
export function seedTwo(): NonNullable<PreloadedState["world"]> {
  const a = newId();
  const b = newId();
  return {
    docs: {
      [a]: createDefaultGraphic(a, "α", readings),
      [b]: createDefaultGraphic(b, "β", census),
    },
    docOrder: [a, b],
    activeDocId: a,
  };
}

/**
 * One workspace on one stage, which is what every tour section wants.
 *
 * The stage is minted per section rather than reusing a pinned one (DATADROP-8
 * DR-59): a section's allow-list is already carried by `InstanceConfig.apps`,
 * and giving six embedded instances the *same* stage id would be harmless today
 * and confusing the moment a stage verb names one.
 */
const space = (name: string, spec: LayoutSpec): DatalabSeed => datalabSingleStageSeed(name, spec);

/** A tile, bound to a document when one is given. */
const leaf = (app: string, docId: string | null = null): LayoutSpec =>
  tile(app, docId ? { documents: { primary: docId } } : {});

/**
 * Each section seeds its world and its layout TOGETHER.
 *
 * They were separate functions until the anti-rot test failed on lesson B3.
 * `leaf("chart")` defaults `docId` to null, which means *follow the active
 * document* — so both tiles displayed α and §B's opening sentence ("both tiles
 * are pointed at document α — look at their DOC strips") was visually true and
 * structurally false. Re-pointing one then left the other still following the
 * active document, so "two different documents are visible" was never reached
 * and the lesson could not tick.
 *
 * A tile that is *supposed* to be bound must be bound explicitly, and that
 * needs the document id at layout-construction time. Hence one function per
 * section rather than two.
 */
export interface Seed {
  world: NonNullable<PreloadedState["world"]>;
  seed: DatalabSeed;
}

/**
 * The hero: the composition, and no teaching tiles at all.
 *
 * It borrowed §C's seed until the page was read end to end, at which point the
 * hero was rendering a `lessons` tile with no lessons in it — "No lessons here",
 * at the top of the page, as the first thing anyone sees. The empty state was
 * doing its job; the layout was asking a question it had no answer to.
 *
 * The document arrives with one filter step already in the pipeline. The hero
 * claims "visible pipeline steps" in the chips beside it, and an empty pipeline
 * tile would be the page contradicting itself in its first screen — the reader
 * should meet a step they can hover, disable and re-enable before they have
 * done anything at all. `data.ok = true` is honest housekeeping on the seeded
 * stream: `readings` carries a QC flag, and dropping failed readings is what a
 * real analysis of it starts with.
 */
export function heroSeed(): Seed {
  const world = seedStream();
  const doc = world.docOrder?.[0] ?? null;
  const document = doc ? world.docs?.[doc] : undefined;
  if (document) {
    const sourceId = Object.keys(document.sources)[0];
    if (sourceId) {
      appendTransform(document, {
        id: "hero-filter-ok",
        kind: "core:filter",
        input: { kind: "source", sourceId },
        enabled: true,
        state: "complete",
        // Compared through a string cast for the same reason demo/welcome.ts
        // does: the field's physical type is boolean once rows are on screen
        // and string before they arrive, and the cast form types in both.
        predicate: {
          kind: "call",
          function: "eq",
          arguments: [
            {
              kind: "cast",
              expression: { kind: "field", field: fieldRef(sourceId, COLUMNS.ok) },
              to: { kind: "string" },
              onFailure: "null",
            },
            { kind: "literal", value: "true" },
          ],
        },
      });
    }
  }
  return {
    world,
    seed: space("start", split("row", 0.44, leaf("pipeline", doc), leaf("chart", doc))),
  };
}

/**
 * §A: the rail with its vocabulary beneath it, the sources, and somewhere for
 * Inspect to land.
 *
 * The lesson rail is a TILE now rather than a panel bolted to the side. That
 * costs a third of the width and buys the thing the section is about: a reader
 * who wants more room can close it, split it, or swap it for the trace — and
 * the lessons are demonstrating tiling rather than describing it from outside.
 */
export function objectsSeed(): Seed {
  return {
    world: seedStream(),
    seed: space(
      "objects",
      split(
        "row",
        0.34,
        // The cheat sheet sits UNDER the rail, in the same column: the
        // vocabulary of a section belongs beneath the lessons that teach it,
        // and a reader who wants the room can close either.
        split("col", 0.72, leaf("lessons"), leaf("cheat")),
        split("col", 0.42, leaf("sources"), split("col", 0.55, leaf("inspector"), leaf("watch"))),
      ),
    ),
  };
}

/** §B: the rail, and two views of ONE document, both explicitly bound to it. */
export function layoutSeed(): Seed {
  const world = seedTwo();
  const first = world.docOrder?.[0] ?? null;
  return {
    world,
    seed: space(
      "two views",
      split(
        "row",
        0.34,
        split("col", 0.72, leaf("lessons"), leaf("cheat")),
        split("col", 0.55, leaf("chart", first), leaf("table", first)),
      ),
    ),
  };
}

/**
 * §C: the rail plus the whole composition — pipeline, encoding, chart, table.
 *
 * Five tiles is the most crowded layout in the tour, which is exactly why the
 * section carries a taller frame and why the full-frame control matters most
 * here.
 */
export function grammarSeed(): Seed {
  const world = seedStream();
  const doc = world.docOrder?.[0] ?? null;
  return {
    world,
    seed: space(
      "build",
      split(
        "row",
        0.3,
        split("col", 0.74, leaf("lessons"), leaf("cheat")),
        split(
          "row",
          0.44,
          split("col", 0.54, leaf("pipeline", doc), leaf("encode", doc)),
          split("col", 0.62, leaf("chart", doc), leaf("table", doc)),
        ),
      ),
    ),
  };
}

/** §D: the rack, and the chart tile it re-points. */
export function rackSeed(): Seed {
  const world = seedStream();
  const doc = world.docOrder?.[0] ?? null;
  return {
    world,
    seed: space(
      "rack",
      split("row", 0.36, leaf("modules"), split("col", 0.62, leaf("chart", doc), leaf("cheat"))),
    ),
  };
}

/**
 * The brief: the checklist, a pipeline and a chart — and no table.
 *
 * Deliberately no table tile: goal E5 asks the reader to put one beside the
 * chart on the same document, and a layout that already satisfies a goal is a
 * goal that teaches nothing.
 */
export function briefSeed(): Seed {
  const world = seedStream();
  const doc = world.docOrder?.[0] ?? null;
  return {
    world,
    seed: space(
      "build",
      split(
        "row",
        0.32,
        leaf("brief"),
        split("col", 0.45, leaf("pipeline", doc), leaf("chart", doc)),
      ),
    ),
  };
}
