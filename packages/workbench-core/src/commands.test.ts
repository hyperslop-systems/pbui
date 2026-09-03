import { describe, expect, it } from "vitest";
import { linkVerbs } from "@hyperslop-systems/pbui";
import { commands, describeWorkbenchCommand, isWorkbenchCommand } from "./commands";

describe("command validation", () => {
  it("requires the complete shape rather than accepting a kind prefix", () => {
    expect(isWorkbenchCommand({ kind: "placement.close" })).toBe(false);
    expect(isWorkbenchCommand({ kind: "placement.close", placementId: "" })).toBe(false);
    expect(isWorkbenchCommand(commands.close("n-1"))).toBe(true);
    expect(isWorkbenchCommand({ kind: "placement.dock", source: "a", target: "b", edge: "middle" })).toBe(false);
    expect(isWorkbenchCommand({ kind: "view.show", view: { kind: "application", appId: "x" }, placement: { kind: "split", edge: "left" } })).toBe(true);
    expect(isWorkbenchCommand({ kind: "view.show", view: { kind: "application", appId: "x", reuse: "sometimes" }, placement: { kind: "auto" } })).toBe(false);
    expect(isWorkbenchCommand({ kind: "view.configure", viewId: "v" })).toBe(false);
    expect(isWorkbenchCommand(commands.rebind("v", { a: "1" }))).toBe(true);
    expect(isWorkbenchCommand({ kind: "session.activatePlacement", placementId: null })).toBe(true);
    expect(isWorkbenchCommand({ kind: "tile.close", placementId: "n-1" })).toBe(false);
  });

  it("accepts link verbs except the shell-local ones", () => {
    expect(isWorkbenchCommand(linkVerbs.follow("a/x", "b/y"))).toBe(true);
    expect(isWorkbenchCommand(linkVerbs.openMode())).toBe(false);
    expect(isWorkbenchCommand(linkVerbs.openPalette("b/y"))).toBe(false);
    expect(isWorkbenchCommand(linkVerbs.show({ type: "order", value: { id: 1 } }))).toBe(true);
  });

  it("builders compile to the normal form and describe themselves", () => {
    expect(commands.split("n-1", "row", "chat")).toEqual({ kind: "view.show", view: { kind: "application", appId: "chat" }, placement: { kind: "split", target: "n-1", axis: "row" } });
    expect(commands.split("n-1", "row")).toEqual({ kind: "placement.duplicate", placementId: "n-1", axis: "row" });
    expect(commands.placeAt("chat", "n-1", "replace")).toEqual({ kind: "view.show", view: { kind: "application", appId: "chat" }, placement: { kind: "replace", target: "n-1" } });
    expect(describeWorkbenchCommand(commands.placeAt("chat", "n-1", "left"))).toBe("open chat at that tile's left edge");
    expect(describeWorkbenchCommand(commands.goTo("v-1"))).toBe("go to that view");
    expect(describeWorkbenchCommand(commands.setTitle("v-1", ""))).toBe("clear the tile's name");
    expect(describeWorkbenchCommand(linkVerbs.follow("a/x", "b/y") as never)).toContain("follow");
  });
});
