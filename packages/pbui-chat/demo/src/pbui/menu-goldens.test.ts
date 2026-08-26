import { describe, expect, test } from "vitest";
import { demoActionRegistry, snapshotForDemo } from "./actions";
import { demoConversions, rowToProduct } from "./runtime";
import type { Environment, PresentationType, Values } from "./types";
import { DEFAULT_ENVIRONMENT } from "./types";
import { library } from "../sandbox";
import type { PresentationReference } from "@hyperslop-systems/pbui";

/**
 * PBUI-ACTIONS-2 P0 — golden menus for the chat demo, the migration fence
 * for PR 4. Freezes id, label, verb, danger, description, disabledBecause per
 * representative reference, plus the generated-action liveness through the
 * real registry, plus the current conversion behavior.
 */

const reference = <T extends PresentationType>(type: T, value: Values[T]) =>
  ({ type, value }) as PresentationReference<Values>;

function menuOf<T extends PresentationType>(
  type: T,
  value: Values[T],
  environment: Environment = DEFAULT_ENVIRONMENT,
) {
  // PBUI-ACTIONS-2 P4: every type resolves through the kernel now.
  const query = { subject: reference(type, value), invocation: "menu" } as const;
  const result = demoActionRegistry.resolve(query, snapshotForDemo(query, environment));
  expect(result.ambiguities).toEqual([]);
  return result.actions.map((action) => ({
    id: action.candidateId,
    label: String(action.label),
    verb: action.verb,
    ...(action.danger ? { danger: true } : {}),
    ...(action.description !== undefined ? { description: action.description } : {}),
    ...(action.status.kind === "unavailable" ? { disabledBecause: action.status.because } : {}),
  }));
}

const EAGLE = {
  id: "2049",
  value: { name: "1oz American Gold Eagle 2024", stock: 3, reorderPoint: 5, sku: "AGE-2024" },
} as Values["product"];

describe("golden menus (PBUI-ACTIONS-2 P0)", () => {
  test("<product> without approver role", () => {
    expect(menuOf("product", EAGLE)).toMatchSnapshot();
  });

  test("<product> with approver role", () => {
    expect(menuOf("product", EAGLE, { ...DEFAULT_ENVIRONMENT, canApprove: true })).toMatchSnapshot();
  });

  test("<proposal> undecided, approver", () => {
    expect(
      menuOf(
        "proposal",
        { id: "p-1", value: { title: "Reorder 20 Eagles" } } as Values["proposal"],
        { ...DEFAULT_ENVIRONMENT, canApprove: true },
      ),
    ).toMatchSnapshot();
  });

  test("<field> sort pair distinguished by direction", () => {
    const rows = menuOf("field", { id: "orders.total", value: { tableId: "orders", name: "total" } } as Values["field"]);
    expect(rows).toMatchSnapshot();
    const ids = rows.map((row) => row.id);
    expect(ids).toContain("demo.field.sort-asc");
    expect(ids).toContain("demo.field.sort-desc");
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("generated actions stay live through the real registry (PBUI-ACTIONS-2 P0)", () => {
  test("a library action defined now is in the next product menu, and gone when removed", () => {
    const before = menuOf("product", EAGLE).map((row) => row.id);
    const record = library.putAction({
      label: "Days of cover",
      types: ["product"],
      behaviour: { kind: "openProgram", programId: "prg-missing" },
      by: "agent",
    });
    try {
      const after = menuOf("product", EAGLE);
      expect(after.map((row) => row.id)).toEqual([
        ...before,
        `sandbox.generated-actions/${record.id}`,
      ]);
      // The program it opens does not exist, and the row says so.
      expect(after.at(-1)?.disabledBecause).toContain(record.behaviour.kind === "openProgram" ? record.behaviour.programId : "");
    } finally {
      library.removeAction(record.id);
    }
    expect(menuOf("product", EAGLE).map((row) => row.id)).toEqual(before);
  });
});

describe("current conversions, frozen before typed translators (PBUI-ACTIONS-2 P0)", () => {
  test("the array holds exactly row → product, in order", () => {
    expect(demoConversions).toEqual([rowToProduct]);
  });

  test("a row carrying a product id stands in for the product", () => {
    const row = reference("row", {
      id: "r-1",
      value: { cells: { productId: "2049", name: "Eagle", sku: "AGE-2024" } },
      provenance: { toolCallId: "tc-1" },
    } as unknown as Values["row"]);
    expect(rowToProduct(row)).toEqual({
      type: "product",
      value: {
        type: "product",
        id: "2049",
        value: { name: "Eagle", sku: "AGE-2024" },
        provenance: { toolCallId: "tc-1" },
      },
    });
  });

  test("a row without a product id converts to nothing; other types pass through", () => {
    expect(
      rowToProduct(
        reference("row", { id: "r-2", value: { cells: { name: "no id" } } } as unknown as Values["row"]),
      ),
    ).toBeUndefined();
    expect(rowToProduct(reference("product", EAGLE))).toBeUndefined();
  });
});
