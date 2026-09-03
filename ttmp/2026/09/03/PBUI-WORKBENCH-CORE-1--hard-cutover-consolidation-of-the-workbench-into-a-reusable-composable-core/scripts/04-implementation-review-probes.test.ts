import { describe, expect, it, vi } from "vitest";
import {
  commands,
  connectDocumentSource,
  createWorkbenchCore,
  createWorkbenchLinks,
  defineAppManifest,
  layout,
  sequentialIds,
  split,
  tile,
  type DocumentSource,
  type WorkbenchLinks,
} from "../../../../../../packages/workbench-core/src/index";
import { createWorkbenchSync } from "../../../../../../packages/workbench-core/src/sync/index";

const notes = defineAppManifest({ id: "notes" });
const chat = defineAppManifest({
  id: "chat",
  ports: [{ name: "conversation", direction: "in", contract: "conversation", doc: "the conversation", documentSlot: true }],
});

describe("PBUI-WORKBENCH-CORE-1 implementation-review probes", () => {
  it("shows that exposed protobuf state can be mutated without the gateway or a revision", () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps: [notes] });
    const exposed = core.getState();
    exposed.document.name = "mutated outside the gateway";
    expect(core.getState().document.name).toBe("mutated outside the gateway");
    expect(core.getState().revision).toBe(0);
    console.info("EXPOSED_STATE_MUTATION", JSON.stringify({ name: core.getState().document.name, revision: core.getState().revision }));
  });

  it("shows that advisory preview consumes the shared deterministic id stream", () => {
    const ids = sequentialIds();
    const core = createWorkbenchCore({
      initial: layout(split("row", 0.5, tile("notes"), tile("notes")), { ids }),
      apps: [notes],
      ids,
    });
    const placementId = [...core.getState().index.viewByPlacementId.keys()][0]!;

    const preview = core.preview(commands.duplicate(placementId, "row"));
    const executed = core.execute(commands.duplicate(placementId, "row"));

    expect(preview.ok).toBe(true);
    expect(executed.ok).toBe(true);
    if (!preview.ok || !executed.ok) return;
    expect(preview.placementId).not.toBe(executed.placementId);
    console.info("PREVIEW_ID_DRIFT", JSON.stringify({ previewPlacementId: preview.placementId, executePlacementId: executed.placementId }));
  });

  it("shows that a core subscriber exception escapes after install and suppresses the commit receipt", () => {
    const ids = sequentialIds();
    const onCommit = vi.fn();
    const core = createWorkbenchCore({
      initial: layout(split("row", 0.5, tile("notes"), tile("notes")), { ids }),
      apps: [notes],
      ids,
      onCommit,
    });
    const placementId = [...core.getState().index.viewByPlacementId.keys()][0]!;
    core.subscribe(() => {
      throw new Error("review probe: subscriber failure");
    });

    expect(() => core.execute(commands.close(placementId))).toThrow("review probe: subscriber failure");
    expect(core.getState().revision).toBe(1);
    expect(onCommit).not.toHaveBeenCalled();
    console.info("SUBSCRIBER_ESCAPE", JSON.stringify({ revisionAfterThrow: core.getState().revision, commitReceipts: onCommit.mock.calls.length }));
  });

  it("shows that a links post-commit exception escapes after durable state is visible", () => {
    const ids = sequentialIds();
    const links = createWorkbenchLinks() as WorkbenchLinks;
    const core = createWorkbenchCore({
      initial: layout(split("row", 0.5, tile("notes"), tile("notes")), { ids }),
      apps: [notes],
      ids,
      links,
    });
    const placementId = [...core.getState().index.viewByPlacementId.keys()][0]!;
    links.afterCommit = () => {
      throw new Error("review probe: post-commit failure");
    };

    expect(() => core.execute(commands.close(placementId))).toThrow("review probe: post-commit failure");
    expect(core.getState().revision).toBe(1);
    console.info("POST_COMMIT_ESCAPE", JSON.stringify({ revisionAfterThrow: core.getState().revision }));
  });

  it("shows document-source reentrancy delivering commit receipts out of revision order", () => {
    const ids = sequentialIds();
    const receipts: Array<{ revision: number; cases: string[] }> = [];
    const core = createWorkbenchCore({
      initial: layout(split("row", 0.5, tile("notes"), tile("notes")), { ids }),
      apps: [notes, chat],
      ids,
      onCommit: (receipt) => receipts.push({ revision: receipt.revision, cases: receipt.mutations.map((mutation) => mutation.body.case) }),
    });
    let resources = ["c-1"];
    const listeners = new Set<() => void>();
    const source: DocumentSource = {
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
    for (const listener of listeners) listener(); // bound stub remains
    receipts.length = 0;

    const closed = core.execute(commands.close(opened.placementId!));
    expect(closed.ok).toBe(true);
    expect(receipts.map((receipt) => receipt.revision)).toEqual([4, 3]);
    expect(receipts.map((receipt) => receipt.cases)).toEqual([["documentDelete"], ["placementClose", "viewDelete"]]);
    console.info("REENTRANT_RECEIPTS", JSON.stringify(receipts));
  });

  it("shows same-app replacement dropping an explicitly requested title", () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps: [notes] });
    const placementId = [...core.getState().index.viewByPlacementId.keys()][0]!;
    const result = core.execute({
      kind: "view.show",
      view: { kind: "application", appId: "notes", title: "Renamed" },
      placement: { kind: "replace", target: placementId },
    });
    expect(result).toEqual({ ok: true, changed: false, placementId, viewId: core.getState().document.viewOrder[0] });
    expect(core.getState().document.views[core.getState().document.viewOrder[0]!]!.title).toBeUndefined();
    console.info("DROPPED_REPLACE_TITLE", JSON.stringify(result));
  });

  it("shows bootstrap-create treating already-created local work as a dropped rebase", async () => {
    const ids = sequentialIds();
    let committed: readonly Parameters<ReturnType<typeof createWorkbenchSync>["enqueue"]>[0][number][] = [];
    const core = createWorkbenchCore({
      initial: layout(split("row", 0.5, tile("notes"), tile("notes")), { ids }),
      apps: [notes],
      ids,
      onCommit: (receipt) => {
        committed = receipt.mutations;
      },
    });
    const placementId = [...core.getState().index.viewByPlacementId.keys()][0]!;
    expect(core.execute(commands.duplicate(placementId, "row")).ok).toBe(true);

    const dropped = vi.fn();
    const mutate = vi.fn();
    const sync = createWorkbenchSync({
      flushDelayMs: 0,
      onDropped: dropped,
      client: {
        get: async () => null,
        create: async (document) => ({ document, revision: "created" }),
        mutate,
      },
    });
    sync.enqueue(committed);
    sync.attach(core);
    await sync.flush();

    expect(mutate).not.toHaveBeenCalled();
    expect(dropped).toHaveBeenCalledWith(expect.any(Array), "rebase");
    console.info("CREATE_BOOTSTRAP_DROP", JSON.stringify({ droppedCalls: dropped.mock.calls.length, status: sync.status() }));
    sync.dispose();
  });
});
