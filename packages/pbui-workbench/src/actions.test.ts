import { definePresentation } from "@hyperslop-systems/pbui";
import { describe, expect, test } from "vitest";
import { createWorkbenchPresentationFragment } from "./actions";
import type { TileRef } from "./tileDescriptor";
import { workbenchVerbs, type WorkbenchVerb } from "./verbs";

/**
 * PBUI-ACTIONS-2 — the standalone row spec for the shared tile menu.
 *
 * Through P3–P6 these tests compared the fragment against
 * `createTileDescriptor`'s rows; P7 made the descriptor representation-only,
 * so the expectations below are now the single written source of the shared
 * labels, reasons, verbs, and order.
 */

type Values = { tile: TileRef; workspace: { name: string } };
type Facts = Record<string, never>;

/** The fragment as a product includes it; the product describes `workspace`. */
function presentationWith(options: Parameters<typeof createWorkbenchPresentationFragment<Values, unknown, Facts>>[0] = {}) {
  return definePresentation<Values, unknown, Facts, WorkbenchVerb>().create({
    id: "test.workbench",
    include: [createWorkbenchPresentationFragment<Values, unknown, Facts>(options)],
    knownScopes: ["global"],
    descriptors: { workspace: { label: (workspace) => workspace.name } },
    defaultActiveScopes: ["workbench", "global"],
    revision: () => 0,
  });
}
const registry = presentationWith().actions;

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

describe("workbenchTileContributions — the shared tile menu, spelled out", () => {
  test("a plain tile", () => {
    expect(kernelRows(ref())).toEqual([
      { label: "Split beside", verb: workbenchVerbs.split("n-1", "row"), danger: undefined, disabledBecause: undefined },
      { label: "Split below", verb: workbenchVerbs.split("n-1", "col"), danger: undefined, disabledBecause: undefined },
      { label: "Show something else here…", verb: workbenchVerbs.openLauncher("n-1"), danger: undefined, disabledBecause: undefined },
      { label: "Duplicate", verb: workbenchVerbs.split("n-1", "row"), danger: undefined, disabledBecause: undefined },
      { label: "Name this tile…", verb: workbenchVerbs.setTitle("v-1", ""), danger: undefined, disabledBecause: undefined },
      { label: "Close tile", verb: workbenchVerbs.close("n-1"), danger: true, disabledBecause: undefined },
    ]);
  });

  test("a linked view gains the informational row, disabled with its reason", () => {
    const rows = kernelRows(ref({ placementCount: 3 }));
    expect(rows.find((row) => row.label === "Shown in 3 tiles")).toEqual({
      label: "Shown in 3 tiles",
      verb: undefined,
      danger: undefined,
      disabledBecause: "this is a description, not an action",
    });
  });

  test("the last tile cannot close, a non-duplicable app links, a named tile renames", () => {
    expect(
      kernelRows(ref({ canClose: false })).find((row) => row.label === "Close tile")
        ?.disabledBecause,
    ).toBe("a workspace keeps at least one tile");
    expect(
      kernelRows(ref({ duplicable: false })).find((row) => row.label === "Duplicate")
        ?.disabledBecause,
    ).toBe("this application shows one view; splitting links a second tile to it");
    expect(
      kernelRows(ref({ customTitle: "left", title: "left" })).map((row) => row.label),
    ).toContain("Rename…");
  });

  test("without the launcher, the replace row is absent", () => {
    const noLauncher = presentationWith({ tile: { launcher: false } }).actions;
    const result = noLauncher.resolve(
      { subject: { type: "tile", value: ref() }, invocation: "menu" },
      { revision: 0, scopes: ["workbench"], modes: new Set(), capabilities: new Set(), product: {} },
    );
    expect(result.actions.map((action) => action.label)).not.toContain(
      "Show something else here…",
    );
  });

  test("outside the workbench scope, tile rules are not candidates", () => {
    const result = registry.resolve(
      { subject: { type: "tile", value: ref() }, invocation: "menu" },
      { revision: 0, scopes: ["global"], modes: new Set(), capabilities: new Set(), product: {} },
    );
    expect(result.actions).toEqual([]);
  });
});
