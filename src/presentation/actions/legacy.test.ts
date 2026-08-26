import { describe, expect, test } from "vitest";
import { createPresentationRegistry } from "../registry";
import { defineActions } from "./define";
import { legacyDescriptorFamily } from "./legacy";
import type { LegacyFacts } from "./legacy";
import { createActionRegistry } from "./registry";
import { createPresentationTypeGraph } from "./typeGraph";
import type { SelectionSnapshot } from "./types";

/**
 * The migration adapter (Amendment B): existing descriptor actions() routed
 * through the kernel, byte-identical rows, one migration window only.
 */

type Values = { product: { id: string; name: string; locked?: boolean } };
type Environment = { suffix: string };
type Verb = { kind: string } & Record<string, unknown>;

const descriptors = createPresentationRegistry<Values, Environment, Verb>({
  product: {
    label: (value) => value.name,
    actions: (value, environment) => [
      {
        id: "product.inspect",
        label: `Inspect ${environment.suffix}`,
        verb: { kind: "inspect", id: value.id },
      },
      {
        id: "product.reorder",
        label: "Draft a reorder",
        verb: { kind: "reorder", id: value.id },
        danger: true,
        disabledBecause: value.locked ? "needs approver role" : undefined,
      },
    ],
  },
});

const family = legacyDescriptorFamily<Values, Environment, Verb>({
  id: "legacy.descriptor-actions",
  descriptors,
});

const registry = createActionRegistry<Values, LegacyFacts<Environment>, Verb>({
  graph: createPresentationTypeGraph([]),
  scopes: ["global"],
  contributions: [family],
});

function snapshot(environment: Environment): SelectionSnapshot<LegacyFacts<Environment>> {
  return {
    revision: 0,
    scopes: ["global"],
    modes: new Set(),
    capabilities: new Set(),
    product: { environment },
  };
}

const subject = { type: "product", value: { id: "2049", name: "Eagle" } } as const;

describe("legacyDescriptorFamily", () => {
  test("routes current descriptor rows: order, danger, and reasons preserved", () => {
    const result = registry.resolve(
      { subject, invocation: "menu" },
      snapshot({ suffix: "(α)" }),
    );
    expect(
      result.actions.map((action) => ({
        candidateId: action.candidateId,
        action: action.action,
        label: action.label,
        danger: action.danger,
        status: action.status.kind,
        verb: action.verb,
      })),
    ).toEqual([
      {
        candidateId: "legacy.descriptor-actions/product.inspect",
        action: "legacy.product.product.inspect",
        label: "Inspect (α)",
        danger: false,
        status: "available",
        verb: { kind: "inspect", id: "2049" },
      },
      {
        candidateId: "legacy.descriptor-actions/product.reorder",
        action: "legacy.product.product.reorder",
        label: "Draft a reorder",
        danger: true,
        status: "available",
        verb: { kind: "reorder", id: "2049" },
      },
    ]);
  });

  test("disabledBecause maps to unavailable with no verb", () => {
    const result = registry.resolve(
      {
        subject: { type: "product", value: { id: "1", name: "x", locked: true } },
        invocation: "menu",
      },
      snapshot({ suffix: "" }),
    );
    const reorder = result.actions.find((action) => action.candidateId.endsWith("product.reorder"));
    expect(reorder?.status).toEqual({ kind: "unavailable", because: "needs approver role" });
    expect(reorder?.verb).toBeUndefined();
  });

  test("re-resolution reads the CURRENT environment — the stale-verb fix for free", () => {
    const result = registry.resolve(
      { subject, invocation: "menu" },
      snapshot({ suffix: "(β)" }),
    );
    expect(result.actions[0]?.label).toBe("Inspect (β)");
  });

  test("legacy action ids are namespaced so they never compete with real rules", () => {
    const define = defineActions<Values, LegacyFacts<Environment>, Verb>();
    const real = define.exact("product", {
      id: "shop.inspect",
      action: "object.inspect",
      scopes: ["global"],
      metadata: { label: "Inspect (kernel)" },
      bind: () => ({ kind: "inspect.kernel" }),
    });
    const mixed = createActionRegistry<Values, LegacyFacts<Environment>, Verb>({
      graph: createPresentationTypeGraph([{ id: "product" }]),
      scopes: ["global"],
      contributions: [family, real],
    });
    const result = mixed.resolve({ subject, invocation: "menu" }, snapshot({ suffix: "" }));
    // Three rows: the two legacy ones and the real one — no override between
    // namespaces, no ambiguity.
    expect(result.actions).toHaveLength(3);
    expect(result.ambiguities).toEqual([]);
  });
});
