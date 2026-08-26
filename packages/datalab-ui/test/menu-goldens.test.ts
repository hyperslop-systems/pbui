import { describe, expect, test } from "vitest";
import { census, readings } from "../src/fixtures";
import { datadropRegistry } from "../src/pbui/registry";
import { catToField, datadropConversions } from "../src/pbui/runtime";
import type { DatadropPresentationReference } from "../src/pbui/runtime";
import type { PbuiEnvironment, PresentationType } from "../src/pbui/types";
import type { Table } from "../src/model/table";

/**
 * PBUI-ACTIONS-2 P0 — the migration fence.
 *
 * These snapshots freeze the full object menus (id, label, verb,
 * disabledBecause) for representative references, so every later kernel PR is
 * reviewed as *equivalence against these files* rather than intuition. A
 * golden change inside a migration PR is a finding, not a fixup.
 *
 * The behavioral rules live in descriptors.test.ts; this file is deliberately
 * assertion-free prose-free freezing. Do not fold the two together — goldens
 * get regenerated wholesale, behavior tests must never be.
 */

function env(overrides: Partial<PbuiEnvironment> = {}): PbuiEnvironment {
  const tables: Record<string, Table> = { d1: readings, d2: census };
  return {
    fieldsFor: (docId) => (docId === null ? readings : (tables[docId] ?? null))?.fields ?? [],
    tableFor: (docId) => (docId === null ? readings : (tables[docId] ?? null)),
    activeDocId: "d1",
    nameOf: (docId) => (docId === "d2" ? "β" : "α"),
    ...overrides,
  };
}

const reference = (type: PresentationType, value: unknown) =>
  ({ type, value }) as DatadropPresentationReference;

function menuOf(type: PresentationType, value: unknown, environment = env()) {
  return datadropRegistry.actionsFor(reference(type, value), environment).map((action) => ({
    id: action.id,
    label: action.label,
    verb: action.verb,
    ...(action.disabledBecause !== undefined ? { disabledBecause: action.disabledBecause } : {}),
  }));
}

const TILE = {
  placementId: "n1",
  viewId: "v1",
  app: "chart",
  title: "chart · α",
  customTitle: undefined,
  docId: "d1",
  duplicable: true,
  canClose: true,
  placementCount: 1,
};

describe("golden menus (PBUI-ACTIONS-2 P0)", () => {
  test("<field> owned by another document", () => {
    expect(menuOf("field", { docId: "d2", name: "population" })).toMatchSnapshot();
  });

  test("<field> nominal column, impossible mappings disabled with reasons", () => {
    expect(menuOf("field", { docId: null, name: "data.station" })).toMatchSnapshot();
  });

  test("<datum> keep/exclude family over categorical columns", () => {
    const row = readings.rows[0];
    expect(row).toBeDefined();
    expect(menuOf("datum", { docId: "d1", row })).toMatchSnapshot();
  });

  test("<doc> active and inactive", () => {
    expect(menuOf("doc", "d1")).toMatchSnapshot();
    expect(menuOf("doc", "d2")).toMatchSnapshot();
  });

  test("<source>", () => {
    expect(menuOf("source", census.source)).toMatchSnapshot();
  });

  test("<tile> with every verb live, and the linked-view variant", () => {
    expect(menuOf("tile", TILE)).toMatchSnapshot();
    expect(menuOf("tile", { ...TILE, placementCount: 3 })).toMatchSnapshot();
  });

  test("<workspace> pinned", () => {
    expect(
      menuOf("workspace", {
        spaceId: "ws-account",
        name: "profile",
        stageId: "stage-account",
        pinned: true,
        canDelete: true,
      }),
    ).toMatchSnapshot();
  });

  test("<stage> not current", () => {
    expect(
      menuOf("stage", { stageId: "s1", name: "work", pinned: true, current: false }),
    ).toMatchSnapshot();
  });
});

describe("action identity is semantic, not positional (PBUI-ACTIONS-2 P0)", () => {
  test("ids derive from verb content and are unique within a menu", () => {
    for (const [type, value] of [
      ["field", { docId: "d2", name: "population" }],
      ["datum", { docId: "d1", row: readings.rows[0] }],
      ["tile", TILE],
    ] as const) {
      const ids = menuOf(type, value).map((row) => row.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(id).toMatch(new RegExp(`^${type}\\.`));
        expect(id).not.toMatch(/:\d+:/);
      }
    }
  });

  test("a label is not identity: mapping ids name the channel", () => {
    const ids = menuOf("field", { docId: "d2", name: "population" }).map((row) => row.id);
    expect(ids).toContain("field.setMapping.x");
    expect(ids).toContain("field.setMapping.y");
  });
});

describe("current conversions, frozen before typed translators (PBUI-ACTIONS-2 P0)", () => {
  test("the array holds exactly the cat → field conversion, in order", () => {
    expect(datadropConversions).toEqual([catToField]);
  });

  test("a categorical value stands in for its field", () => {
    expect(
      catToField(reference("cat", { docId: "d2", field: "region", value: "north" })),
    ).toEqual({ type: "field", value: { docId: "d2", name: "region" } });
  });

  test("a cat with no field converts to nothing, and other types pass through untouched", () => {
    expect(catToField(reference("cat", { docId: "d2", field: "", value: "x" }))).toBeUndefined();
    expect(catToField(reference("doc", "d1"))).toBeUndefined();
  });
});
