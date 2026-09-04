import { describe, expect, it, vi } from "vitest";
import { defineAppManifest } from "./apps";
import { commands } from "./commands";
import { createWorkbenchCore } from "./createWorkbenchCore";
import { layout, split, tile } from "./document";
import { serverRevision } from "./identity";
import { createWorkbenchLinks } from "./links/collaborator";
import { connectDocumentSource, type DocumentSource } from "./sources";
import { createWorkbenchSync } from "./sync/index";
import { sequentialIds } from "./testing";

/**
 * The seven implementation-review probes (design doc 04 §4), each asserting
 * the behaviour the stabilization program REQUIRES. In Phase S0 every case
 * is marked `fails`: the suite is green while the defect stands and turns
 * red — "expected to fail" — the moment a phase fixes it, at which point the
 * marker comes off. The probe script under the ticket records the defect;
 * this file records the requirement.
 */

const notes = defineAppManifest({ id: "notes" });
const chat = defineAppManifest({ id: "chat", ports: [{ name: "conversation", direction: "in", contract: "conversation", doc: "the conversation", documentSlot: true }] });

const twoNotes = (ids = sequentialIds()) => ({ ids, initial: layout(split("row", 0.5, tile("notes"), tile("notes")), { ids }) });
const firstPlacement = (core: ReturnType<typeof createWorkbenchCore>) => [...core.getState().index.viewByPlacementId.keys()][0]!;

describe("stabilization probes (design doc 04 §4, §12)", () => {
  it("EXPOSED_STATE_MUTATION: the document handed out by getState cannot be changed under its revision", () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps: [notes] });
    const exposed = core.getState();
    expect(() => {
      exposed.document.name = "mutated outside the gateway";
    }).toThrow();
    expect(core.getState().document.name).not.toBe("mutated outside the gateway");
  });

  it("PREVIEW_ID_DRIFT: execute after preview mints the ids the preview reported", () => {
    const { ids, initial } = twoNotes();
    const core = createWorkbenchCore({ initial, apps: [notes], ids });
    const placementId = firstPlacement(core);
    const preview = core.preview(commands.duplicate(placementId, "row"));
    const executed = core.execute(commands.duplicate(placementId, "row"));
    expect(preview.ok && executed.ok).toBe(true);
    if (!preview.ok || !executed.ok) return;
    expect(executed.placementId).toBe(preview.placementId);
  });

  it("SUBSCRIBER_ESCAPE: a throwing core subscriber neither escapes nor suppresses the receipt", () => {
    const { ids, initial } = twoNotes();
    const onCommit = vi.fn();
    const onObserverError = vi.fn();
    const core = createWorkbenchCore({ initial, apps: [notes], ids, onCommit, onObserverError });
    const placementId = firstPlacement(core);
    core.subscribe(() => {
      throw new Error("probe: subscriber failure");
    });
    const other = vi.fn();
    core.subscribe(other);
    expect(core.execute(commands.close(placementId)).ok).toBe(true);
    expect(core.getState().revision).toBe(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
    expect(onObserverError).toHaveBeenCalledWith(expect.objectContaining({ stage: "core-subscriber", revision: 1 }));
  });

  it("POST_COMMIT_ESCAPE: a throwing link observer does not escape after durable state is visible", () => {
    const { ids, initial } = twoNotes();
    const links = createWorkbenchLinks();
    const onObserverError = vi.fn();
    const core = createWorkbenchCore({ initial, apps: [notes], ids, links, onObserverError });
    const placementId = firstPlacement(core);
    // The closed view holds a runtime value, so the close carries a
    // forget-view-values effect and the runtime is published with the commit.
    links.runtime.emit(`${core.getState().index.viewByPlacementId.get(placementId)}/out`, { type: "thing", value: { id: "1" } });
    links.runtime.subscribe(() => {
      throw new Error("probe: link subscriber failure");
    });
    expect(core.execute(commands.close(placementId)).ok).toBe(true);
    expect(core.getState().revision).toBe(1);
    expect(onObserverError).toHaveBeenCalledWith(expect.objectContaining({ stage: "link-subscriber" }));
  });

  it("REENTRANT_RECEIPTS: a document source's delete lands after the lifecycle receipt that made it legal", async () => {
    const { ids, initial } = twoNotes();
    const receipts: Array<{ revision: number; cases: string[] }> = [];
    const core = createWorkbenchCore({
      initial,
      apps: [notes, chat],
      ids,
      onCommit: (receipt) => receipts.push({ revision: receipt.revision, cases: receipt.mutations.map((mutation) => mutation.body.case ?? "") }),
    });
    let resources = ["c-1"];
    const listeners = new Set<() => void>();
    const source: DocumentSource = {
      id: "chat.conversations",
      format: "chat.conversation",
      list: () => resources.map((id) => ({ id })),
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    connectDocumentSource(core, source);
    const opened = core.execute(commands.open("chat", { conversation: "c-1" }));
    if (!opened.ok) throw new Error(opened.because);
    resources = [];
    for (const listener of listeners) listener();
    await Promise.resolve();
    receipts.length = 0;
    expect(core.execute(commands.close(opened.placementId!)).ok).toBe(true);
    await Promise.resolve();
    expect(receipts.map((receipt) => receipt.revision)).toEqual([3, 4]);
    expect(receipts.map((receipt) => receipt.cases)).toEqual([["placementClose", "viewDelete"], ["documentDelete"]]);
  });

  it("DROPPED_REPLACE_TITLE: same-app replacement keeps an explicitly requested title", () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps: [notes] });
    const placementId = firstPlacement(core);
    const result = core.execute({ kind: "view.show", view: { kind: "application", appId: "notes", title: "Renamed" }, placement: { kind: "replace", target: placementId } });
    expect(result.ok && result.changed).toBe(true);
    expect(core.getState().document.views[core.getState().document.viewOrder[0]!]!.title).toBe("Renamed");
  });

  it("CREATE_BOOTSTRAP_DROP: creating the server row from the optimistic document acknowledges what it already contains", async () => {
    const { ids, initial } = twoNotes();
    let committed: Parameters<ReturnType<typeof createWorkbenchSync>["enqueue"]>[0] = [];
    const core = createWorkbenchCore({ initial, apps: [notes], ids, onCommit: (receipt) => (committed = receipt.mutations) });
    expect(core.execute(commands.duplicate(firstPlacement(core), "row")).ok).toBe(true);
    const dropped = vi.fn();
    const mutate = vi.fn();
    const sync = createWorkbenchSync({ flushDelayMs: 0, onDropped: dropped, client: { get: async () => null, create: async (document) => ({ document, revision: serverRevision("created") }), mutate } });
    sync.enqueue(committed);
    sync.attach(core);
    await sync.flush();
    expect(mutate).not.toHaveBeenCalled();
    expect(dropped).not.toHaveBeenCalled();
    expect(sync.status()).toMatchObject({ phase: "synced", revision: "created", queued: 0, inFlight: 0 });
    sync.dispose();
  });
});
