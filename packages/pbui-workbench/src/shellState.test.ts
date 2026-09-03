import { describe, expect, it, vi } from "vitest";
import { createShellStore, isWorkbenchShellAction } from "./shellState";

describe("the shell-local store", () => {
  it("holds launcher, rebalance, link mode, chooser, and palette; notifies only on change", () => {
    const store = createShellStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ kind: "launcher.open", from: "n-1" });
    expect(store.getState().launcher).toEqual({ from: "n-1" });
    store.dispatch({ kind: "rebalance.close" });
    expect(listener).toHaveBeenCalledTimes(1);
    store.dispatch({ kind: "link.mode.open" });
    store.dispatch({ kind: "relation.palette.open", destination: "v/x" });
    store.dispatch({ kind: "launcher.close" });
    expect(store.getState()).toEqual({ launcher: null, rebalanceOpen: false, linkModeOpen: true, showChooser: null, relationPalette: { destination: "v/x" } });
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("tells shell actions from commands", () => {
    expect(isWorkbenchShellAction({ kind: "launcher.open" })).toBe(true);
    expect(isWorkbenchShellAction({ kind: "placement.close", placementId: "n" })).toBe(false);
  });
});
