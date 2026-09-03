import { describe, expect, it, vi } from "vitest";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { MutationSchema } from "@hyperslop-systems/workbench-protocol";
import { closePlacement, leaves } from "@hyperslop-systems/workbench-protocol/client";
import { defineAppManifest } from "./apps";
import { createWorkbenchCore } from "./createWorkbenchCore";
import { layout, serializeDocument, split, tile, workspaces } from "./document";
import { sequentialIds } from "./testing";

const apps = [defineAppManifest({ id: "counter" }), defineAppManifest({ id: "notes", viewCardinality: "one" })];
const threeTiles = () => layout(split("row", 0.6, tile("counter"), split("col", 0.5, tile("notes"), tile("counter", { title: "second" }))), { ids: sequentialIds() });
const mutation = (body: MessageInitShape<typeof MutationSchema>["body"]) => create(MutationSchema, { body });

describe("createWorkbenchCore", () => {
  it("starts from a validated document with a repaired session and revision 0", () => {
    const core = createWorkbenchCore({ initial: threeTiles(), apps, initialSession: { workspaceId: "nope", activePlacementId: "nope" } });
    expect(core.getState().session).toEqual({ workspaceId: "main", activePlacementId: null });
    expect(core.getState().revision).toBe(0);
    expect(core.getState().index.viewByPlacementId.size).toBe(3);
  });

  it("refuses to construct over a document the catalog rejects", () => {
    expect(() => createWorkbenchCore({ initial: layout(tile("mystery"), { ids: sequentialIds() }), apps })).toThrow(/unknown_application/);
    expect(() => createWorkbenchCore({ initial: layout(split("row", 0.5, tile("notes"), tile("notes")), { ids: sequentialIds() }), apps })).toThrow(/duplicate_singleton/);
  });

  it("apply: a batch lands atomically, rebuilds the index, bumps the revision, notifies once, and reports once", () => {
    const onCommit = vi.fn();
    const core = createWorkbenchCore({ initial: threeTiles(), apps, onCommit });
    const listener = vi.fn();
    core.subscribe(listener);
    const [, , third] = leaves(core.getState().document.workspaces[0]!.tree).map((leaf) => leaf.id);
    const result = core.apply(closePlacement(core.getState().document, third!));
    expect(result).toEqual({ ok: true, changed: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0].revision).toBe(1);
    expect(core.getState().index.viewByPlacementId.size).toBe(2);
    expect(core.getState().document.viewOrder).toHaveLength(2);
    expect(core.apply([])).toEqual({ ok: true, changed: false });
  });

  it("apply: a refused batch leaves the state untouched and reports the applier's code, then validation's", () => {
    const onRejected = vi.fn();
    const core = createWorkbenchCore({ initial: threeTiles(), apps, onRejected });
    const before = core.getState();
    const bad = core.apply([mutation({ case: "viewDelete", value: { viewId: "v-nothing" } })]);
    expect(bad).toMatchObject({ ok: false, code: "unknown_view" });
    expect(core.getState()).toBe(before);
    // Structurally fine, semantically refused: a second notes view.
    const dup = core.apply([mutation({ case: "viewCreate", value: { view: { id: "v-dup", appId: "notes", documents: {} } } })]);
    expect(dup).toMatchObject({ ok: false, code: "duplicate_singleton" });
    expect(core.getState()).toBe(before);
    expect(onRejected).toHaveBeenCalledTimes(2);
  });

  it("apply: a throwing post-commit hook is reported separately and never undoes the commit", () => {
    const onPostCommitError = vi.fn();
    const core = createWorkbenchCore({
      initial: threeTiles(),
      apps,
      onCommit: () => {
        throw new Error("outbox is full");
      },
      onPostCommitError,
    });
    const [, , third] = leaves(core.getState().document.workspaces[0]!.tree).map((leaf) => leaf.id);
    expect(core.apply(closePlacement(core.getState().document, third!))).toEqual({ ok: true, changed: true });
    expect(core.getState().revision).toBe(1);
    expect(onPostCommitError).toHaveBeenCalledTimes(1);
  });

  it("replaceDocument validates, repairs the session, and never fires onCommit", () => {
    const onCommit = vi.fn();
    const core = createWorkbenchCore({ initial: workspaces([{ id: "one", name: "one", spec: tile("counter") }, { id: "two", name: "two", spec: tile("notes") }], { ids: sequentialIds() }), apps, onCommit, initialSession: { workspaceId: "two" } });
    const listener = vi.fn();
    core.subscribe(listener);
    const replaced = core.replaceDocument(threeTiles());
    expect(replaced).toEqual({ ok: true });
    expect(core.getState().session).toEqual({ workspaceId: "main", activePlacementId: null });
    expect(core.getState().revision).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
    const bad = core.replaceDocument(layout(tile("mystery"), { ids: sequentialIds() }));
    expect(bad.ok).toBe(false);
    expect(core.getState().revision).toBe(1);
  });

  it("serialize/restore round-trip, and reset(factory) returns to a FRESH layout", () => {
    const core = createWorkbenchCore({ initial: threeTiles(), apps });
    const json = core.serialize();
    const [, , third] = leaves(core.getState().document.workspaces[0]!.tree).map((leaf) => leaf.id);
    core.apply(closePlacement(core.getState().document, third!));
    expect(core.restore(json)).toEqual({ ok: true });
    expect(serializeDocument(core.getState().document)).toBe(json);
    expect(core.restore("{broken").ok).toBe(false);
    const fresh = layout(tile("notes"), { ids: sequentialIds(100) });
    expect(core.reset(() => fresh)).toEqual({ ok: true });
    expect(core.getState().document).toBe(fresh);
    expect(core.reset()).toEqual({ ok: true });
    expect(core.getState().document.viewOrder).toHaveLength(3);
  });
});
