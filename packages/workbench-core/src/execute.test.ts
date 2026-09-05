import { create } from "@bufbuild/protobuf";
import { MutationSchema } from "@hyperslop-systems/workbench-protocol";
import { describe, expect, it, vi } from "vitest";
import { createPresentationTypeGraph, linkVerbs } from "@hyperslop-systems/pbui/link-kernel";
import { defineAppManifest } from "./apps";
import { commands, type WorkbenchCommand } from "./commands";
import { createWorkbenchCore } from "./createWorkbenchCore";
import { layout, split, tile } from "./document";
import { createWorkbenchLinks } from "./links/collaborator";
import { bindingsOf } from "./links/document";
import { leavesOfWorkspace } from "./queries";
import { sequentialIds } from "./testing";

const graph = createPresentationTypeGraph([{ id: "datum" }, { id: "order" }]);
const selection = { name: "selection", direction: "inout" as const, contract: { valueType: "datum", semanticRole: "selection", cardinality: "many" as const, authorityDomain: "orders" }, doc: "the selection" };
const apps = [
  defineAppManifest({ id: "table", ports: [selection] }),
  defineAppManifest({ id: "plot", ports: [selection] }),
  defineAppManifest({ id: "orders", ports: [{ name: "order", direction: "out", contract: "order", doc: "the clicked order" }] }),
  defineAppManifest({ id: "detail", ports: [{ name: "order", direction: "in", contract: "order", doc: "the order shown" }] }),
  defineAppManifest({ id: "detail2", ports: [{ name: "order", direction: "in", contract: "order", doc: "another order shown" }] }),
  defineAppManifest({ id: "notes", viewCardinality: "one" }),
];

function twoTiles() {
  const ids = sequentialIds();
  const links = createWorkbenchLinks({ deps: { graph } });
  const core = createWorkbenchCore({ initial: layout(split("row", 0.5, tile("table"), tile("plot")), { ids }), apps, ids, links });
  const [left, right] = leavesOfWorkspace(core.getState().index, "main").map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
  return { core, links, left: left!, right: right! };
}

describe("application replacement lifecycle", () => {
  function sourceAndFollower() {
    const ids = sequentialIds();
    const links = createWorkbenchLinks({ deps: { graph } });
    const core = createWorkbenchCore({ initial: layout(split("row", 0.5, tile("orders"), tile("detail")), { ids }), apps, ids, links });
    const [sourcePlacement, followerPlacement] = leavesOfWorkspace(core.getState().index, "main");
    const source = sourcePlacement!.body.case === "leaf" ? sourcePlacement!.body.value.viewId : "";
    const follower = followerPlacement!.body.case === "leaf" ? followerPlacement!.body.value.viewId : "";
    expect(core.execute(linkVerbs.follow(`${source}/order`, `${follower}/order`) as WorkbenchCommand).ok).toBe(true);
    links.runtime.emit(`${source}/order`, { type: "order", value: { id: "1042" } });
    return { core, links, source, follower, sourcePlacement: sourcePlacement!.id };
  }

  it("applies a dependent follower's source-close policy and forgets the old app runtime", () => {
    const { core, links, source, follower, sourcePlacement } = sourceAndFollower();
    expect(core.execute(commands.replace(sourcePlacement, "notes")).ok).toBe(true);
    expect(bindingsOf(core.getState().document).get(`${follower}/order`)).toMatchObject({
      kind: "hold",
      reference: { type: "order", value: { id: "1042" } },
      suspended: { kind: "unresolved", diagnostic: { code: "source-closed" } },
    });
    expect(links.runtime.getState().emitted.has(`${source}/order`)).toBe(false);
  });

  it("gives a raw app-changing mutation the same durable and runtime maintenance", () => {
    const { core, links, source, follower } = sourceAndFollower();
    const result = core.apply([
      create(MutationSchema, { body: { case: "viewConfigure", value: { viewId: source, appId: "notes" } } }),
    ]);
    expect(result.ok).toBe(true);
    expect(bindingsOf(core.getState().document).get(`${follower}/order`)).toMatchObject({ kind: "hold" });
    expect(links.runtime.getState().emitted.has(`${source}/order`)).toBe(false);
  });
});

describe("planning purity (the Phase 0 probe, inverted)", () => {
  it("preview of an identity merge leaves the document, the session, the live link runtime, and every observer untouched", () => {
    const { core, links, left, right } = twoTiles();
    links.runtime.emit(`${left}/selection`, { type: "datum", value: [{ relation: "orders", identity: { id: "A" } }] });
    const listener = vi.fn();
    core.subscribe(listener);
    const runtimeListener = vi.fn();
    links.runtime.subscribe(runtimeListener);
    const stateBefore = core.getState();
    const runtimeBefore = links.runtime.getState();

    const previewed = core.preview(linkVerbs.identityAdd(`${left}/selection`, `${right}/selection`, "prefer-left") as WorkbenchCommand);
    expect(previewed.ok).toBe(true);
    expect(previewed.ok && previewed.mutations.map((m) => m.body.case)).toEqual(["documentPut"]);

    expect(core.getState()).toBe(stateBefore);
    expect(links.runtime.getState()).toBe(runtimeBefore);
    expect(links.runtime.getState().revision).toBe(runtimeBefore.revision);
    expect(links.runtime.getState().classes.size).toBe(0);
    expect(listener).not.toHaveBeenCalled();
    expect(runtimeListener).not.toHaveBeenCalled();
  });

  it("execute of the same merge installs the document and THEN applies the planned runtime effects, once", () => {
    const { core, links, left, right } = twoTiles();
    links.runtime.emit(`${left}/selection`, { type: "datum", value: [{ relation: "orders", identity: { id: "A" } }] });
    const before = links.runtime.getState().revision;
    const result = core.execute(linkVerbs.identityAdd(`${left}/selection`, `${right}/selection`, "prefer-left") as WorkbenchCommand);
    expect(result).toEqual({ ok: true, changed: true });
    expect(core.getState().revision).toBe(1);
    expect(links.runtime.getState().revision).toBe(before + 1);
    expect([...links.runtime.getState().classes.keys()]).toEqual(["σ1"]);
  });

  it("a refused command in a batch refuses the whole batch and installs nothing", () => {
    const { core } = twoTiles();
    const listener = vi.fn();
    core.subscribe(listener);
    const [a] = leavesOfWorkspace(core.getState().index, "main").map((leaf) => leaf.id);
    const result = core.execute([commands.duplicate(a!, "row"), commands.close("n-nothing")]);
    expect(result).toMatchObject({ ok: false, code: "unknown_placement" });
    expect(core.getState().revision).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it("a batch is one transition: two commands, one install, one notification, one receipt", () => {
    const ids = sequentialIds();
    const onCommit = vi.fn();
    const core = createWorkbenchCore({ initial: layout(split("row", 0.5, tile("table"), tile("plot")), { ids }), apps, ids, onCommit });
    const listener = vi.fn();
    core.subscribe(listener);
    const [a, b] = leavesOfWorkspace(core.getState().index, "main").map((leaf) => leaf.id);
    const result = core.execute([commands.duplicate(a!, "row"), commands.close(b!), commands.setTitle(core.getState().document.viewOrder[0]!, "left")]);
    expect(result).toMatchObject({ ok: true, changed: true, viewId: "v-00000001-0000" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    // The orphan sweep runs ONCE, after the last command (guide §9.3), so the
    // view the close orphaned is deleted at the end of the batch.
    expect(onCommit.mock.calls[0]![0].mutations.map((m: { body: { case: string } }) => m.body.case)).toEqual(["viewCreate", "placementSplit", "placementClose", "viewConfigure", "viewDelete"]);
  });

  it("a session-only command notifies but never commits a receipt", () => {
    const ids = sequentialIds();
    const onCommit = vi.fn();
    const core = createWorkbenchCore({ initial: layout(split("row", 0.5, tile("table"), tile("plot")), { ids }), apps, ids, onCommit });
    const [a] = leavesOfWorkspace(core.getState().index, "main").map((leaf) => leaf.id);
    expect(core.execute(commands.activate(a!))).toEqual({ ok: true, changed: true, placementId: a });
    expect(core.execute(commands.activate(a!))).toEqual({ ok: true, changed: false, placementId: a });
    expect(core.getState().revision).toBe(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("show with two equally good targets is ambiguous: choices, no change; a chosen candidate executes fresh", () => {
    const ids = sequentialIds();
    const links = createWorkbenchLinks({ deps: { graph } });
    const core = createWorkbenchCore({ initial: layout(split("row", 0.5, tile("orders"), split("col", 0.5, tile("detail"), tile("detail2"))), { ids }), apps, ids, links });
    const [orders] = core.getState().document.viewOrder;
    links.runtime.emit(`${orders}/order`, { type: "order", value: { id: "1042" } });
    const show: WorkbenchCommand = { kind: "show", subject: { type: "order", value: { id: "1042" } }, from: `${orders}/order` };
    const result = core.execute(show);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("ambiguous");
    // Every ranked candidate is offered — the two existing detail ports first,
    // then the spawns — so a chooser can explain the runners-up too.
    expect(result.choices?.length).toBe(6);
    expect(result.choices?.slice(0, 2).every((choice) => choice.available)).toBe(true);
    expect(core.getState().revision).toBe(0);
    const chosen = core.execute({ ...show, candidateId: result.choices![0]!.id });
    expect(chosen).toEqual({ ok: true, changed: true });
    expect(core.getState().document.documents["pbui.links"]).toBeDefined();
  });

  it("reports refusals through onRefused and never through onRejected", () => {
    const ids = sequentialIds();
    const onRefused = vi.fn();
    const onRejected = vi.fn();
    const core = createWorkbenchCore({ initial: layout(tile("notes"), { ids }), apps, ids, onRefused, onRejected });
    expect(core.execute(commands.close("n-00000002-0000"))).toEqual({ ok: false, code: "last_placement", because: "a workspace keeps at least one tile", index: 0, command: commands.close("n-00000002-0000") });
    expect(onRefused).toHaveBeenCalledWith(commands.close("n-00000002-0000"), "last_placement", "a workspace keeps at least one tile");
    expect(onRejected).not.toHaveBeenCalled();
  });
});
