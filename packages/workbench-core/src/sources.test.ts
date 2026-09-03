import { describe, expect, it } from "vitest";
import { defineAppManifest } from "./apps";
import { commands } from "./commands";
import { createWorkbenchCore } from "./createWorkbenchCore";
import { layout, split, tile } from "./document";
import { connectDocumentSource, documentSourceMutations, type DocumentSource } from "./sources";
import { documentSlotPort } from "@hyperslop-systems/pbui";

const apps = [defineAppManifest({ id: "chat", ports: [documentSlotPort("conversation")] }), defineAppManifest({ id: "notes" })];

function registry(initial: string[]) {
  let ids = [...initial];
  const listeners = new Set<() => void>();
  const source: DocumentSource = {
    format: "chat.conversation",
    list: () => ids.map((id) => ({ id })),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const set = (next: string[]) => {
    ids = next;
    for (const listener of listeners) listener();
  };
  return { source, set };
}

describe("document sources", () => {
  it("puts a stub for every listed resource and deletes unlisted, unbound stubs of its own format", () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps });
    const { source, set } = registry(["c-1", "c-2"]);
    connectDocumentSource(core, source);
    expect(Object.keys(core.getState().document.documents).sort()).toEqual(["c-1", "c-2"]);
    expect(core.getState().document.documents["c-1"]?.format).toBe("chat.conversation");
    set(["c-2", "c-3"]);
    expect(Object.keys(core.getState().document.documents).sort()).toEqual(["c-2", "c-3"]);
  });

  it("lets a view bind a mirrored resource, and keeps the stub while the view binds it", async () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps });
    const { source, set } = registry(["c-1"]);
    connectDocumentSource(core, source);
    const opened = core.execute(commands.open("chat", { conversation: "c-1" }));
    expect(opened.ok).toBe(true);
    set([]);
    // Bound: the applier would refuse the delete, so the stub stays…
    expect(core.getState().document.documents["c-1"]).toBeDefined();
    // …until the view goes: the source learns of the close from inside the
    // publication, and its delete is a transaction of its own, one microtask later.
    expect(core.execute(commands.close(opened.ok ? opened.placementId! : "")).ok).toBe(true);
    expect(core.getState().document.documents["c-1"]).toBeDefined();
    await Promise.resolve();
    expect(core.getState().document.documents["c-1"]).toBeUndefined();
  });

  it("re-syncs when the core's document is replaced under it", async () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps });
    const { source } = registry(["c-1"]);
    connectDocumentSource(core, source);
    expect(core.reset(() => layout(split("row", 0.5, tile("notes"), tile("notes")))).ok).toBe(true);
    await Promise.resolve();
    expect(core.getState().document.documents["c-1"]).toBeDefined();
  });

  it("touches nothing of another format, and applies nothing when in step", () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps });
    const other: DocumentSource = { format: "shop.product", list: () => [{ id: "2049", body: { name: "Eagle" } }] };
    connectDocumentSource(core, other);
    const { source } = registry([]);
    expect(documentSourceMutations(core.getState().document, source)).toEqual([]);
    const revision = core.getState().revision;
    connectDocumentSource(core, source);
    expect(core.getState().revision).toBe(revision);
    expect(core.getState().document.documents["2049"]?.body).toEqual({ name: "Eagle" });
  });

  it("an application with open bindings may bind slots its manifest does not declare", () => {
    const script = defineAppManifest({ id: "script", ports: [documentSlotPort("program")], openBindings: true });
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps: [...apps, script] });
    connectDocumentSource(core, { format: "sandbox.program", list: () => [{ id: "prg-1" }] });
    connectDocumentSource(core, { format: "shop.product", list: () => [{ id: "2049" }] });
    expect(core.execute(commands.open("script", { program: "prg-1", product: "2049" })).ok).toBe(true);
    const refused = core.execute(commands.open("script", { program: "prg-1", product: "nope" }));
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe("unknown_document");
    const closed = core.execute(commands.open("chat", { conversation: "prg-1", extra: "2049" }));
    expect(closed.ok).toBe(false);
    if (!closed.ok) expect(closed.code).toBe("unknown_binding");
  });
});

describe("source scheduling (design doc 04 §6.4, §12.3)", () => {
  it("a burst of source signals outside a publication reconciles once and applies once", () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps });
    const { source, set } = registry(["c-1"]);
    const commits: number[] = [];
    core.subscribe(() => commits.push(core.getState().revision));
    connectDocumentSource(core, source);
    set(["c-1", "c-2"]);
    set(["c-1", "c-2"]);
    set(["c-1", "c-2"]);
    expect(commits).toEqual([1, 2]); // the initial stub, then c-2 once
  });

  it("a source signalled from inside a publication reconciles after it, in one transaction", async () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps });
    const { source, set } = registry(["c-1"]);
    connectDocumentSource(core, source);
    const receipts: string[][] = [];
    core.subscribe(() => {
      // A product listener that adds a resource in reaction to a commit.
      if (core.getState().revision === 2) set(["c-1", "c-2", "c-3"]);
    });
    const onCommit = core.subscribe(() => receipts.push(Object.keys(core.getState().document.documents).sort()));
    expect(core.execute(commands.open("chat", { conversation: "c-1" })).ok).toBe(true);
    expect(core.getState().document.documents["c-2"]).toBeUndefined();
    await Promise.resolve();
    expect(Object.keys(core.getState().document.documents).sort()).toEqual(["c-1", "c-2", "c-3"]);
    expect(core.getState().revision).toBe(3); // one transaction for both stubs
    onCommit();
  });

  it("a disconnected source applies nothing from a deferred reconcile", async () => {
    const core = createWorkbenchCore({ initial: layout(tile("notes")), apps });
    const { source, set } = registry(["c-1"]);
    const disconnect = connectDocumentSource(core, source);
    core.subscribe(() => {
      if (core.getState().revision === 2) set([]);
    });
    expect(core.execute(commands.open("chat", { conversation: "c-1" })).ok).toBe(true);
    disconnect();
    await Promise.resolve();
    expect(core.getState().document.documents["c-1"]).toBeDefined();
  });
});
