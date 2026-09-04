import { sequentialIds } from "@hyperslop-systems/workbench-core";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { describe, expect, test } from "vitest";
import "../src/apps/all";
import { datalabManifests } from "../src/appkit/workbenchApps";
import { parseBundle } from "../src/model/portable";
import type { PbuiEnvironment } from "../src/pbui/types";
import type { AppThunk } from "../src/store";
import { actionsForVerb } from "../src/store/applyVerb";
import type { ClipboardPort } from "../src/store/clipboard";
import { commitImport } from "../src/store/effects";
import { navigationActions } from "../src/store/navigation";
import { save } from "../src/store/persist";
import { createDatalabRuntime, type DatalabRuntime } from "../src/store/runtime";
import { singleStageSeed, split, tile } from "../src/store/seed";

/**
 * The widened verb seam, end to end, with no DOM and no browser.
 *
 * This is what DR-66 buys. The clipboard is a parameter on the store's thunk
 * extra argument, so a test hands the runtime a fake that records what it was
 * given, dispatches the thunk `actionsForVerb` returned, and asserts on the
 * JSON. Nothing mocks `navigator`; there is no `navigator` here at all.
 *
 * It is also the test that shows "returns a thunk" is not a loophole in the
 * purity claim: `actionsForVerb` is called for its return value, and nothing
 * happens until the test dispatches it.
 */

const apps = datalabManifests();

const env = {
  fieldsFor: () => [],
  tableFor: () => null,
  activeDocId: null,
  nameOf: () => "α",
} satisfies PbuiEnvironment;

/** A clipboard that records, so a test can read what would have been copied. */
function fakeClipboard(readValue: string | null = null): ClipboardPort & { written: string[] } {
  const written: string[] = [];
  return {
    written,
    async write(text) {
      written.push(text);
    },
    async read() {
      return readValue;
    },
  };
}

/**
 * A runtime whose one workspace is a chart tile beside a table tile.
 *
 * ONE id generator for the seed and the runtime, so the ids the core mints
 * later never collide with the seeded ones.
 */
function oneChartTile(options: { clipboard?: ClipboardPort; seedDocuments?: boolean } = {}): {
  rt: DatalabRuntime;
  nodeId: string;
  workspaceId: string;
} {
  const ids = sequentialIds();
  const seed = singleStageSeed("build", split("row", 0.5, tile("chart"), tile("table")), {
    apps,
    ids,
  });
  const rt = createDatalabRuntime({
    seed,
    apps,
    ids,
    ownership: "trust",
    seedDocuments: options.seedDocuments ?? false,
    ...(options.clipboard ? { clipboard: options.clipboard } : {}),
  });
  const tree = rt.core.getState().index.workspaceById.get(seed.workspaceId)?.tree;
  return { rt, nodeId: leaves(tree)[0]?.id as string, workspaceId: seed.workspaceId };
}

const viewIdAt = (rt: DatalabRuntime, nodeId: string): string =>
  rt.core.getState().index.viewByPlacementId.get(nodeId) as string;

function perform(rt: DatalabRuntime, verb: Parameters<typeof actionsForVerb>[0]) {
  return actionsForVerb(verb, { world: rt.store.getState().world }, env);
}

describe("exporting is testable with no DOM", () => {
  test("exporting a tile writes a bundle to the clipboard and nothing else", async () => {
    const clipboard = fakeClipboard();
    const { rt, nodeId } = oneChartTile({ clipboard });

    const [effect] = perform(rt, { kind: "exportTile", nodeId });
    // Nothing has happened yet: actionsForVerb RETURNED a thunk, it did not run
    // one. That is the whole of the purity claim in one assertion.
    expect(clipboard.written).toEqual([]);

    const outcome = await rt.store.dispatch(effect as AppThunk<Promise<{ ok: boolean }>>);
    expect(outcome.ok).toBe(true);

    const text = clipboard.written[0] as string;
    const parsed = parseBundle(text, "tile");
    expect(parsed.ok).toBe(true);
    expect(JSON.parse(text).payload.view.app).toBe("chart");
    // DR-64, asserted at the seam rather than only in portable.test.ts.
    expect(text).not.toContain(nodeId);
  });

  test("exporting a workspace names it and carries its tiles", async () => {
    const clipboard = fakeClipboard();
    const { rt, workspaceId } = oneChartTile({ clipboard });

    const [effect] = perform(rt, { kind: "exportWorkspace", spaceId: workspaceId });
    await rt.store.dispatch(effect as AppThunk<Promise<unknown>>);

    const bundle = JSON.parse(clipboard.written[0] as string);
    expect(bundle.kind).toBe("workspace");
    expect(bundle.name).toBe("build");
  });

  test("a clipboard that refuses produces a reason, not a silent success", async () => {
    // The failure the design cares about: `navigator.clipboard?.writeText(x)`
    // with an optional chain reports nothing at all, so a user is told the copy
    // worked and pastes an empty clipboard into a chat message.
    const { rt, nodeId } = oneChartTile({
      clipboard: {
        async write() {
          throw new Error("denied by the platform");
        },
        async read() {
          return null;
        },
      },
    });

    const [effect] = perform(rt, { kind: "exportTile", nodeId });
    const outcome = (await rt.store.dispatch(
      effect as AppThunk<Promise<{ ok: boolean; reason?: string }>>,
    )) as { ok: boolean; reason?: string };
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toContain("the copy did not happen");
  });

  test("the trace records the kind and the name, never the payload", () => {
    // A bundle names the sources these tiles read and the filters the user set.
    // The trace is a teaching surface people screenshot, so it says what was
    // shared and not what was in it.
    const { rt, nodeId } = oneChartTile({ clipboard: fakeClipboard() });
    const [effect] = perform(rt, { kind: "exportTile", nodeId });
    return rt.store.dispatch(effect as AppThunk<Promise<unknown>>).then(() => {
      const entry = rt.store.getState().world.trace.at(-1);
      expect(entry?.type).toBe("exported");
      expect(entry?.detail).toContain("tile");
      expect(JSON.stringify(rt.store.getState().world.trace)).not.toContain("datadrop.layout");
    });
  });
});

describe("importing never depends on reading the clipboard", () => {
  test("a clipboard that cannot be read opens the dialog empty", async () => {
    // Firefox does not implement readText for web content at all. This is the
    // path, not a degraded version of one.
    const { rt, nodeId } = oneChartTile({ clipboard: fakeClipboard(null) });

    const [effect] = perform(rt, { kind: "importIntoTile", nodeId });
    await rt.store.dispatch(effect as AppThunk<Promise<void>>);

    const pending = rt.store.getState().navigation.pendingImport;
    expect(pending?.target).toEqual({ kind: "tile", nodeId });
    expect(pending?.prefill).toBe("");
    expect(pending?.from).toBeNull();
  });

  test("a clipboard holding prose opens the dialog empty, not prefilled with prose", () => {
    const { rt, nodeId } = oneChartTile({
      clipboard: fakeClipboard("Hi — could you take a look at the sensor numbers?"),
    });
    const [effect] = perform(rt, { kind: "importIntoTile", nodeId });
    return rt.store.dispatch(effect as AppThunk<Promise<void>>).then(() => {
      expect(rt.store.getState().navigation.pendingImport?.prefill).toBe("");
    });
  });

  test("a clipboard holding a bundle of the WRONG kind does not prefill either", async () => {
    // A relevance check, not only a validity one.
    const written = fakeClipboard();
    const source = oneChartTile({ clipboard: written });
    const [exportEffect] = perform(source.rt, {
      kind: "exportWorkspace",
      spaceId: source.workspaceId,
    });
    await source.rt.store.dispatch(exportEffect as AppThunk<Promise<unknown>>);
    const workspaceBundle = written.written[0] as string;

    const { rt, nodeId } = oneChartTile({ clipboard: fakeClipboard(workspaceBundle) });
    const [effect] = perform(rt, { kind: "importIntoTile", nodeId });
    await rt.store.dispatch(effect as AppThunk<Promise<void>>);
    expect(rt.store.getState().navigation.pendingImport?.prefill).toBe("");
  });

  test("a clipboard holding a tile bundle prefills, and says where it came from", async () => {
    const clipboard = fakeClipboard();
    const source = oneChartTile({ clipboard });
    const [exportEffect] = perform(source.rt, { kind: "exportTile", nodeId: source.nodeId });
    await source.rt.store.dispatch(exportEffect as AppThunk<Promise<unknown>>);
    const tileBundle = clipboard.written[0] as string;

    const { rt, nodeId } = oneChartTile({ clipboard: fakeClipboard(tileBundle) });
    const [effect] = perform(rt, { kind: "importIntoTile", nodeId });
    await rt.store.dispatch(effect as AppThunk<Promise<void>>);

    expect(rt.store.getState().navigation.pendingImport?.prefill).toBe(tileBundle);
    expect(rt.store.getState().navigation.pendingImport?.from).toBe("clipboard");
  });

  test("committing an import replaces the tile and mints its document", async () => {
    const clipboard = fakeClipboard();
    // Export a tile out of a runtime that HAS a document, so the bundle carries
    // one and the import has something to mint.
    const source = oneChartTile({ clipboard, seedDocuments: true });
    const doc = source.rt.store.getState().world.docOrder[0] as string;
    expect(source.rt.controller.rebindView(viewIdAt(source.rt, source.nodeId), doc).ok).toBe(true);
    const [exportEffect] = perform(source.rt, { kind: "exportTile", nodeId: source.nodeId });
    await source.rt.store.dispatch(exportEffect as AppThunk<Promise<unknown>>);
    const text = clipboard.written[0] as string;

    const target = oneChartTile();
    const targetNode = target.nodeId;
    const shownBefore = viewIdAt(target.rt, targetNode);
    target.rt.store.dispatch(
      navigationActions.openImport({
        target: { kind: "tile", nodeId: targetNode },
        prefill: "",
        from: null,
      }),
    );

    const result = target.rt.store.dispatch(commitImport(text) as AppThunk<{ ok: boolean }>);
    expect(result.ok).toBe(true);

    // The TARGET's placement id is kept: the tile is re-pointed, not replaced —
    // and it now shows a NEW logical view.
    const shownAfter = viewIdAt(target.rt, targetNode);
    expect(shownAfter).toBeDefined();
    expect(shownAfter).not.toBe(shownBefore);
    const importedView = target.rt.core.getState().document.views[shownAfter]!;
    expect(importedView.appId).toBe("chart");
    expect(importedView.documents.primary).toBeDefined();
    // A fresh document, not the exporting runtime's id.
    expect(importedView.documents.primary).not.toBe(doc);
    expect(Object.keys(target.rt.store.getState().world.docs)).toContain(
      importedView.documents.primary,
    );
    // The view the tile used to show was placed nowhere else, so it is gone
    // rather than left as an unplaced orphan.
    expect(target.rt.core.getState().document.views[shownBefore]).toBeUndefined();
    // And the dialog is closed.
    expect(target.rt.store.getState().navigation.pendingImport).toBeNull();
  });

  test("committing text that does not parse reports the reason and changes nothing", () => {
    const { rt, nodeId } = oneChartTile();
    rt.store.dispatch(
      navigationActions.openImport({ target: { kind: "tile", nodeId }, prefill: "", from: null }),
    );
    const revision = rt.core.getState().revision;
    const result = rt.store.dispatch(
      commitImport("site,mean_temp\nnorth,21.4") as AppThunk<{
        ok: boolean;
        reason?: string;
      }>,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("that is not a DATALAB layout");
    expect(rt.core.getState().revision).toBe(revision);
    // The dialog stays open, because the user has to be able to fix the text.
    expect(rt.store.getState().navigation.pendingImport).not.toBeNull();
  });
});

describe("a dialog is never persisted (DR-69)", () => {
  /** A localStorage stand-in, because the test runner has no DOM. */
  function fakeStorage() {
    const map = new Map<string, string>();
    return {
      map,
      install() {
        (globalThis as { localStorage?: unknown }).localStorage = {
          getItem: (k: string) => map.get(k) ?? null,
          setItem: (k: string, v: string) => void map.set(k, v),
          removeItem: (k: string) => void map.delete(k),
        };
      },
    };
  }

  test("save() writes no pendingImport, renamingId or launcher, however open they are", () => {
    const storage = fakeStorage();
    storage.install();

    const { rt, nodeId } = oneChartTile();
    rt.store.dispatch(
      navigationActions.openImport({
        target: { kind: "tile", nodeId },
        prefill: '{"format":"datadrop.layout"}',
        from: "clipboard",
      }),
    );
    rt.store.dispatch(navigationActions.beginRename(nodeId));
    rt.store.dispatch(navigationActions.openLauncher({ kind: "replace", placementId: nodeId }));

    const { world, navigation } = rt.store.getState();
    expect(navigation.pendingImport).not.toBeNull();
    expect(navigation.renamingId).toBe(nodeId);
    expect(navigation.launcher).not.toBeNull();

    const { document, session } = rt.core.getState();
    save("k", world, { document, workspaceId: session.workspaceId }, navigation);
    const written = storage.map.get("k") as string;
    // Enumerated rather than spread, so the next transient field added to the
    // slice has to make a decision here rather than relying on someone
    // remembering. Without it the 500 ms debounce persists an open dialog and a
    // reload reopens it over a tile that may be gone.
    const stored = JSON.parse(written);
    expect(Object.keys(stored.navigation)).not.toContain("pendingImport");
    expect(Object.keys(stored.navigation)).not.toContain("renamingId");
    expect(Object.keys(stored.navigation)).not.toContain("launcher");
    expect(written).not.toContain("datadrop.layout");
    // And the durable fields ARE there.
    expect(stored.navigation.stages).toHaveLength(1);
    expect(Object.keys(stored.navigation.workspace)).toHaveLength(1);
    expect(stored.workbench.workspaces).toHaveLength(1);
    expect(stored.workspaceId).toBe(session.workspaceId);
  });
});
