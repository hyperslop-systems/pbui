import {
  createActionRegistry,
  createPresentationTypeGraph,
} from "@hyperslop-systems/pbui";
import { describe, expect, test } from "vitest";
import {
  workbenchScopes,
  workbenchTileContributions,
  workbenchTypeDefinitions,
} from "./actions";
import { createTileDescriptor, type TileRef } from "./tileDescriptor";
import type { WorkbenchVerb } from "./verbs";

/**
 * PBUI-ACTIONS-2 P3 — the contribution fragment must reproduce
 * `createTileDescriptor`'s rows exactly: same labels, same reasons, same
 * verbs, same order. The descriptor is the golden here; when it is deleted
 * in the final cleanup, these expectations become the standalone spec.
 */

type Values = { tile: TileRef };
type Facts = Record<string, never>;

const registry = createActionRegistry<Values, Facts, WorkbenchVerb>({
  graph: createPresentationTypeGraph(workbenchTypeDefinitions),
  scopes: [...workbenchScopes, "global"],
  contributions: workbenchTileContributions<Values, Facts>(),
});

function ref(over: Partial<TileRef> = {}): TileRef {
  return {
    placementId: "n-1",
    viewId: "v-1",
    appId: "counter",
    title: "counter",
    placementCount: 1,
    canClose: true,
    duplicable: true,
    ...over,
  };
}

function kernelRows(value: TileRef) {
  const result = registry.resolve(
    { subject: { type: "tile", value }, invocation: "menu" },
    {
      revision: 0,
      scopes: ["workbench", "global"],
      modes: new Set(),
      capabilities: new Set(),
      product: {},
    },
  );
  expect(result.ambiguities).toEqual([]);
  return result.actions.map((action) => ({
    label: action.label,
    verb: action.verb,
    danger: action.danger || undefined,
    disabledBecause: action.status.kind === "unavailable" ? action.status.because : undefined,
  }));
}

function descriptorRows(value: TileRef) {
  const descriptor = createTileDescriptor();
  return (descriptor.actions?.(value, undefined) ?? []).map((action) => ({
    label: action.label,
    // Unavailable kernel rows carry no verb by contract; align the comparison.
    verb: action.disabledBecause === undefined ? action.verb : undefined,
    danger: action.danger || undefined,
    disabledBecause: action.disabledBecause,
  }));
}

describe("workbenchTileContributions reproduces createTileDescriptor", () => {
  for (const [name, value] of [
    ["a plain tile", ref()],
    ["a linked view", ref({ placementCount: 3 })],
    ["the last tile", ref({ canClose: false })],
    ["a non-duplicable app", ref({ duplicable: false })],
    ["a custom title", ref({ customTitle: "my tile", title: "my tile" })],
  ] as const) {
    test(name, () => {
      expect(kernelRows(value)).toEqual(descriptorRows(value));
    });
  }

  test("without the launcher, the replace row is absent in both", () => {
    const noLauncher = createActionRegistry<Values, Facts, WorkbenchVerb>({
      graph: createPresentationTypeGraph(workbenchTypeDefinitions),
      scopes: [...workbenchScopes, "global"],
      contributions: workbenchTileContributions<Values, Facts>({ launcher: false }),
    });
    const result = noLauncher.resolve(
      { subject: { type: "tile", value: ref() }, invocation: "menu" },
      { revision: 0, scopes: ["workbench"], modes: new Set(), capabilities: new Set(), product: {} },
    );
    expect(result.actions.map((action) => action.label)).not.toContain(
      "Show something else here…",
    );
    expect(
      createTileDescriptor({ launcher: false })
        .actions?.(ref(), undefined)
        ?.map((action) => action.label),
    ).not.toContain("Show something else here…");
  });

  test("outside the workbench scope, tile rules are not candidates", () => {
    const result = registry.resolve(
      { subject: { type: "tile", value: ref() }, invocation: "menu" },
      { revision: 0, scopes: ["global"], modes: new Set(), capabilities: new Set(), product: {} },
    );
    expect(result.actions).toEqual([]);
  });
});
