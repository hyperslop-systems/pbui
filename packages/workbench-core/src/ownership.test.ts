import { describe, expect, it } from "vitest";
import { defineAppManifest } from "./apps";
import { commands } from "./commands";
import { createWorkbenchCore } from "./createWorkbenchCore";
import { layout, split, tile } from "./document";
import { sequentialIds } from "./testing";

const apps = [defineAppManifest({ id: "notes" })];

describe("owned state (design doc 04 §6.5, §12.2)", () => {
  it("mutating the document passed as initial after construction changes nothing in the core", () => {
    const initial = layout(tile("notes"), { id: "w", name: "before" });
    const core = createWorkbenchCore({ initial, apps, ownership: "trust" });
    initial.name = "after";
    initial.workspaces[0]!.name = "after";
    expect(core.getState().document.name).not.toBe("after");
    expect(core.getState().document.workspaces[0]!.name).not.toBe("after");
  });

  it("mutating a replacement after it was accepted changes nothing in the core", () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps, ownership: "trust" });
    const replacement = layout(split("row", 0.5, tile("notes"), tile("notes")), { id: "w", name: "replacement" });
    expect(core.replaceDocument(replacement).ok).toBe(true);
    replacement.name = "tampered";
    expect(core.getState().document.name).toBe("replacement");
  });

  it("in freeze mode the exposed document, session and index refuse writes", () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps, ownership: "freeze" });
    const state = core.getState();
    expect(() => {
      state.document.name = "x";
    }).toThrow(TypeError);
    expect(() => {
      (state.session as { workspaceId: string }).workspaceId = "x";
    }).toThrow(TypeError);
    expect(() => (state.index.viewByPlacementId as Map<string, string>).set("n", "v")).toThrow(/read-only/);
    expect(() => (state.index.viewByPlacementId as Map<string, string>).clear()).toThrow(/read-only/);
    // Reads are unaffected.
    expect([...state.index.viewByPlacementId.keys()]).toHaveLength(1);
  });

  it("snapshot() is a clone the caller may write on", () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes"), { id: "w", name: "mine" }), apps, ownership: "freeze" });
    const snapshot = core.snapshot();
    snapshot.name = "theirs";
    expect(core.getState().document.name).toBe("mine");
  });

  it("the same revision always means the same document and a matching index", () => {
    const ids = sequentialIds();
    const core = createWorkbenchCore({ initial: layout(split("row", 0.5, tile("notes"), tile("notes")), { ids }), apps, ids });
    const before = core.getState();
    expect(core.execute(commands.close([...before.index.viewByPlacementId.keys()][0]!)).ok).toBe(true);
    // The old snapshot is untouched: same document, same index, same revision.
    expect(before.revision).toBe(0);
    expect([...before.index.viewByPlacementId.keys()]).toHaveLength(2);
    expect(before.document.viewOrder).toHaveLength(2);
    expect(core.getState().revision).toBe(1);
  });
});

describe("no-op detection (design doc 04 §6.8)", () => {
  it("a command that reproduces the current document installs nothing", () => {
    const receipts: number[] = [];
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps, onCommit: (receipt) => receipts.push(receipt.revision) });
    const viewId = core.getState().document.viewOrder[0]!;
    expect(core.execute(commands.setTitle(viewId, "same"))).toMatchObject({ ok: true, changed: true });
    expect(core.execute(commands.setTitle(viewId, "same"))).toMatchObject({ ok: true, changed: false });
    expect(core.getState().revision).toBe(1);
    expect(receipts).toEqual([1]);
  });

  it("a raw batch that reproduces the current document installs nothing", () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps });
    const viewId = core.getState().document.viewOrder[0]!;
    const previewed = core.preview(commands.setTitle(viewId, "same"));
    if (!previewed.ok) throw new Error(previewed.because);
    expect(core.apply(previewed.mutations)).toEqual({ ok: true, changed: true });
    expect(core.apply(previewed.mutations)).toEqual({ ok: true, changed: false });
    expect(core.getState().revision).toBe(1);
  });
});

describe("preview purity (design doc 04 §5.5)", () => {
  it("a refused execution consumes no ids either", () => {
    const ids = sequentialIds();
    const core = createWorkbenchCore({ initial: layout(split("row", 0.5, tile("notes"), tile("notes")), { ids }), apps, ids });
    const placementId = [...core.getState().index.viewByPlacementId.keys()][0]!;
    const preview = core.preview(commands.duplicate(placementId, "row"));
    // A refused command in the same batch: nothing lands, nothing is consumed.
    expect(core.execute([commands.duplicate(placementId, "row"), commands.close("n-nope")]).ok).toBe(false);
    const executed = core.execute(commands.duplicate(placementId, "row"));
    expect(preview.ok && executed.ok && executed.placementId === preview.placementId).toBe(true);
  });
});
