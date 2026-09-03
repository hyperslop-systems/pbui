import { describe, expect, it, vi } from "vitest";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { MutationSchema } from "@hyperslop-systems/workbench-protocol";
import { closePlacement, leaves } from "@hyperslop-systems/workbench-protocol/client";
import { defineAppManifest } from "./apps";
import { commands } from "./commands";
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
    const onObserverError = vi.fn();
    const core = createWorkbenchCore({
      initial: threeTiles(),
      apps,
      onCommit: () => {
        throw new Error("outbox is full");
      },
      onObserverError,
    });
    const [, , third] = leaves(core.getState().document.workspaces[0]!.tree).map((leaf) => leaf.id);
    expect(core.apply(closePlacement(core.getState().document, third!))).toEqual({ ok: true, changed: true });
    expect(core.getState().revision).toBe(1);
    expect(onObserverError).toHaveBeenCalledTimes(1);
    expect(onObserverError).toHaveBeenCalledWith(expect.objectContaining({ stage: "commit-receipt", revision: 1 }));
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
    expect(core.getState().document).toEqual(fresh); // a clone since design doc 04 §6.5: equal, not identical
    expect(core.reset()).toEqual({ ok: true });
    expect(core.getState().document.viewOrder).toHaveLength(3);
  });
});

describe("publication (design doc 04 §5.1–5.3, §12.1)", () => {
  it("a subscriber that executes a command during publication is refused, and the outer receipt is the only one", () => {
    const receipts: number[] = [];
    const core = createWorkbenchCore({ initial: threeTiles(), apps, onCommit: (receipt) => receipts.push(receipt.revision) });
    const [first, second] = leaves(core.getState().document.workspaces[0]!.tree).map((leaf) => leaf.id);
    let nested: ReturnType<typeof core.execute> | null = null;
    core.subscribe(() => {
      if (!nested) nested = core.execute(commands.close(second!));
    });
    expect(core.execute(commands.close(first!)).ok).toBe(true);
    expect(nested).toMatchObject({ ok: false, code: "reentrant_execution" });
    expect(receipts).toEqual([1]);
    // Refused, not queued: the second tile is still there, and the core is idle again.
    expect(leaves(core.getState().document.workspaces[0]!.tree)).toHaveLength(2);
    expect(core.execute(commands.close(second!)).ok).toBe(true);
  });

  it("apply and replaceDocument are refused during publication too", () => {
    const core = createWorkbenchCore({ initial: threeTiles(), apps });
    const seen: string[] = [];
    core.subscribe(() => {
      const applied = core.apply(closePlacement(core.getState().document, leaves(core.getState().document.workspaces[0]!.tree)[0]!.id));
      if (!applied.ok) seen.push(applied.code);
      const replaced = core.replaceDocument(threeTiles());
      if (!replaced.ok) seen.push(replaced.diagnostics[0]!.code);
    });
    core.execute(commands.close(leaves(core.getState().document.workspaces[0]!.tree)[2]!.id));
    expect(seen).toEqual(["reentrant_execution", "reentrant_execution"]);
  });

  it("every observer is attempted and every failure is reported after all attempts, in publication order", () => {
    const order: string[] = [];
    const findings: string[] = [];
    const core = createWorkbenchCore({
      initial: threeTiles(),
      apps,
      onCommit: () => {
        order.push("receipt");
        throw new Error("receipt failed");
      },
      onObserverError: (finding) => findings.push(`${finding.stage}@${finding.revision}`),
    });
    core.subscribe(() => {
      order.push("a");
      throw new Error("a failed");
    });
    core.subscribe(() => order.push("b"));
    expect(core.execute(commands.close(leaves(core.getState().document.workspaces[0]!.tree)[2]!.id)).ok).toBe(true);
    expect(order).toEqual(["receipt", "a", "b"]);
    expect(findings).toEqual(["commit-receipt@1", "core-subscriber@1"]);
  });
});
