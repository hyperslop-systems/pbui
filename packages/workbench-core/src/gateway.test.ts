import { describe, expect, it, vi } from "vitest";
import { createPresentationTypeGraph, linkVerbs } from "@hyperslop-systems/pbui/link-kernel";
import { toJson } from "@bufbuild/protobuf";
import { MutationSchema } from "@hyperslop-systems/workbench-protocol";
import { closePlacement } from "@hyperslop-systems/workbench-protocol/client";
import { defineAppManifest } from "./apps";
import { commands, type WorkbenchCommand } from "./commands";
import { createWorkbenchCore } from "./createWorkbenchCore";
import { layout, split, tile } from "./document";
import { createWorkbenchLinks } from "./links/collaborator";
import { LINKS_DOC_ID, readLinks } from "./links/document";
import { leavesOfWorkspace } from "./queries";
import { sequentialIds } from "./testing";

/*
 * Guide §17 Phase 4 exit gate: every durable public operation uses one
 * gateway, and equivalent view lifecycle changes maintain links identically
 * whichever door they came through.
 */

const graph = createPresentationTypeGraph([{ id: "order" }]);
const apps = [
  defineAppManifest({ id: "orders", ports: [{ name: "order", direction: "out", contract: "order", doc: "the clicked order" }] }),
  defineAppManifest({ id: "detail", ports: [{ name: "order", direction: "in", contract: "order", doc: "the order shown" }] }),
];

function linked() {
  const ids = sequentialIds();
  const links = createWorkbenchLinks({ deps: { graph } });
  const onCommit = vi.fn();
  const core = createWorkbenchCore({ initial: layout(split("row", 0.5, tile("orders"), tile("detail")), { ids }), apps, ids, links, onCommit });
  const [orders, detail] = core.getState().document.viewOrder;
  core.execute(linkVerbs.follow(`${orders}/order`, `${detail}/order`) as WorkbenchCommand);
  onCommit.mockClear();
  const [ordersPlacement] = leavesOfWorkspace(core.getState().index, "main").map((leaf) => leaf.id);
  return { core, links, onCommit, orders: orders!, detail: detail!, ordersPlacement: ordersPlacement! };
}

describe("one execution gateway", () => {
  it("a raw batch that deletes the followed source gets the same links maintenance as the close command", () => {
    const viaCommand = linked();
    viaCommand.links.runtime.emit(`${viaCommand.orders}/order`, { type: "order", value: { id: "7" } });
    viaCommand.core.execute(commands.close(viaCommand.ordersPlacement));
    const viaRaw = linked();
    viaRaw.links.runtime.emit(`${viaRaw.orders}/order`, { type: "order", value: { id: "7" } });
    const result = viaRaw.core.apply(closePlacement(viaRaw.core.getState().document, viaRaw.ordersPlacement));
    expect(result).toEqual({ ok: true, changed: true });

    const batchOf = (spy: ReturnType<typeof vi.fn>) => (spy.mock.calls[0]![0].mutations as { body: unknown }[]).map((m) => toJson(MutationSchema, m as never));
    expect(batchOf(viaRaw.onCommit)).toEqual(batchOf(viaCommand.onCommit));
    expect(readLinks(viaRaw.core.getState().document)).toEqual(readLinks(viaCommand.core.getState().document));
    // The follower's term became a hold on the last value; the deleted view's runtime values are forgotten.
    expect(viaRaw.core.getState().document.documents[LINKS_DOC_ID]).toBeDefined();
    expect(viaRaw.links.runtime.getState().emitted.has(`${viaRaw.orders}/order`)).toBe(false);
  });

  it("a raw batch is refused as a whole when its maintenance would make the document invalid, and reports through onRejected", () => {
    const ids = sequentialIds();
    const onRejected = vi.fn();
    const core = createWorkbenchCore({ initial: layout(split("row", 0.5, tile("orders"), tile("detail")), { ids }), apps, ids, onRejected });
    const before = core.getState();
    expect(core.apply([...closePlacement(core.getState().document, "n-00000002-0000"), ...closePlacement(core.getState().document, "n-00000002-0000")])).toMatchObject({ ok: false, code: "unknown_placement" });
    expect(core.getState()).toBe(before);
    expect(onRejected).toHaveBeenCalledTimes(1);
  });

  it("replacement forgets runtime values of views the new document does not have, and keeps the rest", () => {
    const { core, links, orders, detail } = linked();
    links.runtime.emit(`${orders}/order`, { type: "order", value: { id: "7" } });
    links.runtime.emit(`${detail}/order`, { type: "order", value: { id: "8" } });
    const only = layout(tile("orders"), { ids: sequentialIds(50) });
    // Keep the orders view id alive by naming it in the replacement.
    only.views[orders] = { ...only.views["v-00000050-0000"]!, id: orders };
    delete only.views["v-00000050-0000"];
    only.viewOrder = [orders];
    if (only.workspaces[0]!.tree!.body.case === "leaf") only.workspaces[0]!.tree!.body.value.viewId = orders;
    expect(core.replaceDocument(only)).toEqual({ ok: true });
    expect(links.runtime.getState().emitted.has(`${orders}/order`)).toBe(true);
    expect(links.runtime.getState().emitted.has(`${detail}/order`)).toBe(false);
    expect(links.runtime.getState().attended.has(`${detail}/order`)).toBe(false);
  });

  it("restore and reset go through the same validated door", () => {
    const { core } = linked();
    const json = core.serialize();
    expect(core.restore(json.replace('"appId":"detail"', '"appId":"mystery"')).ok).toBe(false);
    expect(core.getState().revision).toBe(1);
    expect(core.restore(json)).toEqual({ ok: true });
    expect(core.getState().revision).toBe(2);
    expect(core.reset()).toEqual({ ok: true });
    expect(core.getState().document.documents[LINKS_DOC_ID]).toBeUndefined();
  });
});
