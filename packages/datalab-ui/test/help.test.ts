import { describe, expect, test } from "vitest";
import { census, readings } from "../src/fixtures";
import { datadropActionRegistry, snapshotForDatalab } from "../src/pbui/presentation";
import { datalabHelpRegistry } from "../src/pbui/presentation";
import type { DatadropPresentationReference } from "../src/pbui/runtime";
import type { PbuiEnvironment, PresentationType } from "../src/pbui/types";
import type { Table } from "../src/model/table";

/**
 * PBUI-HELP-001 P6 — the product proof, at the resolution level.
 *
 * Datalab's field help must compose authored Markdown, a CUSTOM typed
 * summary derived from the same snapshot facts the action rules read, and an
 * actions item whose rows come from the real action resolution — never from
 * re-derived applicability.
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

function helpFor(type: PresentationType, value: unknown, environment = env()) {
  const subject = reference(type, value);
  const snapshot = snapshotForDatalab({ subject, invocation: "introspection" }, environment);
  return { resolution: datalabHelpRegistry.resolve(subject, snapshot), subject, snapshot };
}

describe("datalab field help", () => {
  test("composes markdown, the custom summary, and actions — in declared order", () => {
    const { resolution } = helpFor("field", { docId: "d1", name: "seq" });
    expect(resolution.items.map((item) => item.id)).toEqual([
      "field.meaning",
      "field.summary",
      "field.actions",
    ]);
    expect(resolution.items.map((item) => item.kind)).toEqual([
      "help.markdown",
      "datalab.field-summary",
      "help.actions",
    ]);
  });

  test("the custom summary reads the same snapshot facts as action rules", () => {
    const { resolution } = helpFor("field", { docId: "d1", name: "seq" });
    const summary = resolution.items.find((item) => item.id === "field.summary");
    expect(summary?.payload).toEqual({
      name: "seq",
      type: "q", // derived from the readings fixture schema
      targetName: "α",
    });
    const missing = helpFor("field", { docId: "d1", name: "not-a-column" });
    const gone = missing.resolution.items.find((item) => item.id === "field.summary");
    expect(gone?.payload).toMatchObject({ type: null });
  });

  test("action rows come FROM the action resolution, unavailable reasons included", () => {
    const { resolution, subject, snapshot } = helpFor("field", { docId: "d1", name: "seq" });
    const actionsItem = resolution.items.find((item) => item.id === "field.actions");
    if (!actionsItem) throw new Error("expected field actions help item");
    const shown = (actionsItem.payload as { actions: readonly { action: string }[] }).actions;
    const resolved = datadropActionRegistry.resolve(
      { subject, invocation: "menu" },
      snapshot,
    ).actions;
    // Not similar — the same rows: labels, statuses, and reasons byte-equal.
    expect(shown).toEqual(resolved);
    expect(shown.length).toBeGreaterThan(0);
  });

  test("types without help rules resolve to no items", () => {
    const { resolution } = helpFor("doc", { docId: "d1" });
    expect(resolution.items).toEqual([]);
  });
});
