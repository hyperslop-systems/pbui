import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Button } from "@hyperslop-systems/pbui";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile, workspaces } from "../../document";
import { counterApp, demoApps } from "../../stories/demoApps";

afterEach(cleanup);

describe("Launcher", () => {
  test("Ctrl+K opens it; a placed singleton is offered as go-to, the rest as a new tile", async () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) });
    const { container, baseElement } = render(
      <>
        <wb.Surface />
        <wb.Launcher />
      </>,
    );
    expect(baseElement.querySelector('[data-part="launcher"]')).toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    });
    expect(wb.store.getState().launcherOpen).toBe(true);
    // Every PLACED VIEW is offered first (5.D), then applications that could
    // open a new tile; `notes` is a placed singleton and so appears only as
    // its view.
    const rowKinds = [...baseElement.querySelectorAll('[data-part="launcher-row"]')].map((row) =>
      row.id.replace(/:.*$/, ":"),
    );
    expect(rowKinds).toEqual(["goto:", "goto:", "place:"]);
    const titles = [...baseElement.querySelectorAll('[data-part="launcher-row"]')].map(
      (row) => row.querySelector('[data-part="launcher-row-title"]')?.textContent,
    );
    expect(titles).toEqual(["counter", "notes", "counter"]);
    expect(baseElement.querySelector('[data-part="launcher-status"]')?.textContent).toMatch(/starts placement/);

    // Choosing "place" enters PLACEMENT MODE (PBUI-REBALANCE-1): the
    // launcher closes, nothing is placed yet, and the carry hint shows.
    act(() => {
      fireEvent.click(baseElement.querySelector("#place\\:counter")!);
    });
    expect(wb.store.getState().launcherOpen).toBe(false);
    expect(leaves(wb.store.getState().document.workspaces[0]?.tree)).toHaveLength(2);
    expect(baseElement.querySelector('[data-part="workbench-placing"]')?.textContent).toMatch(/placing/);
    // Enter commits the old default spot: split the active tile. The
    // placement outcome is a promise, so the tile lands a microtask later.
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(baseElement.querySelector('[data-part="workbench-placing"]')).toBeNull();
    expect(leaves(wb.store.getState().document.workspaces[0]?.tree)).toHaveLength(3);
    expect(container.querySelectorAll('[data-part="tile"]')).toHaveLength(3);
  });

  test("placement mode: a click on a tile edge docks there; Alt replaces instead", () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("counter"))) });
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Launcher />
      </>,
    );
    // Give the registry real geometry: tile A at 0..100, tile B at 200..300.
    const mockRects = (elements: HTMLElement[]) =>
      elements.forEach((element, index) => {
        // 600px wide: a row split leaves 300px a side, clearing the 240px floor.
        element.getBoundingClientRect = () =>
          ({ left: index * 700, top: 0, right: index * 700 + 600, bottom: 600, width: 600, height: 600, x: index * 700, y: 0, toJSON: () => ({}) }) as DOMRect;
      });
    mockRects([...baseElement.querySelectorAll<HTMLElement>('[data-part="tile"]')]);
    const leafBefore = leaves(wb.store.getState().document.workspaces[0]?.tree).map((l) => l.id);

    // Aim at B's left edge and click: the new tile docks BEFORE B.
    act(() => {
      wb.verbs.openLauncher();
    });
    act(() => {
      fireEvent.click(baseElement.querySelector("#place\\:counter")!);
    });
    act(() => {
      fireEvent(window, new MouseEvent("pointerdown", { clientX: 710, clientY: 300, bubbles: true }));
    });
    const afterDock = leaves(wb.store.getState().document.workspaces[0]?.tree);
    expect(afterDock).toHaveLength(3);
    const created = afterDock.map((l) => l.id).find((id) => !leafBefore.includes(id));
    expect(afterDock.findIndex((l) => l.id === created)).toBe(1); // before B, after A

    // Alt-click on a tile replaces what it shows: tile count unchanged.
    const targetLeaf = afterDock[0]!;
    expect(targetLeaf.body.case === "leaf" && wb.store.getState().document.views[targetLeaf.body.value.viewId]?.appId).toBe("counter");
    act(() => {
      wb.verbs.openLauncher();
    });
    act(() => {
      fireEvent.click(baseElement.querySelector("#place\\:notes")!);
    });
    mockRects([...baseElement.querySelectorAll<HTMLElement>('[data-part="tile"]')]);
    act(() => {
      fireEvent(window, new MouseEvent("pointerdown", { clientX: 300, clientY: 300, altKey: true, bubbles: true }));
    });
    const afterReplace = leaves(wb.store.getState().document.workspaces[0]?.tree);
    expect(afterReplace).toHaveLength(3); // no new tile
    const replacedLeaf = afterReplace.find((l) => l.id === targetLeaf.id);
    const replacedView = replacedLeaf?.body.case === "leaf" ? replacedLeaf.body.value.viewId : "";
    // `replace` retargets a single-placement view in place (same view id, new
    // app) — the pane keeps its identity; what it SHOWS changed.
    expect(wb.store.getState().document.views[replacedView]?.appId).toBe("notes");
  });

  test("placement mode: Escape cancels without placing", () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(tile("counter")) });
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Launcher />
      </>,
    );
    act(() => {
      wb.verbs.openLauncher();
    });
    act(() => {
      fireEvent.click(baseElement.querySelector("#place\\:counter")!);
    });
    expect(baseElement.querySelector('[data-part="workbench-placing"]')).not.toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(baseElement.querySelector('[data-part="workbench-placing"]')).toBeNull();
    expect(leaves(wb.store.getState().document.workspaces[0]?.tree)).toHaveLength(1);
  });

  test("returns focus to the exact control that opened it", async () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(tile("counter")) });
    const { getByRole } = render(
      <>
        <Button onClick={() => wb.verbs.openLauncher()}>open launcher</Button>
        <wb.Surface />
        <wb.Launcher />
      </>,
    );
    const opener = getByRole("button", { name: "open launcher" });
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).not.toBe(opener);
    fireEvent.keyDown(window, { key: "Escape" });
    await Promise.resolve();
    expect(document.activeElement).toBe(opener);
  });

  test("a doc-bound application is not offered as a new tile", () => {
    const widgetApp = { ...counterApp, id: "widget", title: "widget", docBound: true };
    const wb = createWorkbench({ apps: [...demoApps, widgetApp], initial: layout(tile("counter")) });
    const { baseElement } = render(<wb.Launcher />);
    act(() => {
      wb.verbs.openLauncher();
    });
    const rows = [...baseElement.querySelectorAll('[data-part="launcher-row"]')].map((row) => row.id);
    // One goto row for the placed counter view, then the two placeable
    // applications — and no `place:widget`, because a doc-bound application
    // would open empty.
    expect(rows.filter((id) => id.startsWith("place:"))).toEqual(["place:counter", "place:notes"]);
    expect(rows.filter((id) => id.startsWith("goto:"))).toHaveLength(1);
  });

  test("Mod+K is ignored while the launcher is already open", () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(tile("counter")) });
    render(
      <>
        <wb.Surface />
        <wb.Launcher />
      </>,
    );
    act(() => {
      wb.verbs.openLauncher();
    });
    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("Launcher · per-pane invocation and the rows slot (5.D)", () => {
  function twoTiles() {
    const wb = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) });
    const ids = leaves(wb.store.getState().document.workspaces[0]?.tree).map((leaf) => leaf.id);
    return { wb, first: ids[0]!, second: ids[1]! };
  }

  test("per-pane mode replaces the pane it was invoked from, and never adds a tile", () => {
    const { wb, first } = twoTiles();
    const { container, baseElement } = render(
      <>
        <wb.Surface />
        <wb.Launcher />
      </>,
    );
    act(() => {
      wb.verbs.openLauncher(first);
    });
    expect(baseElement.querySelector('[data-part="launcher-status"]')?.textContent).toContain("shows it instead");
    act(() => {
      fireEvent.click(baseElement.querySelector("#place\\:counter")!);
    });
    // Two tiles before, two after: a per-pane choice never grows the layout.
    expect(container.querySelectorAll('[data-part="tile"]')).toHaveLength(2);
    expect(wb.store.getState().launcherOpen).toBe(false);
    expect(wb.store.getState().launcherFrom).toBeNull();
  });

  test("per-pane mode links the pane to a chosen view", () => {
    const { wb, first, second } = twoTiles();
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Launcher />
      </>,
    );
    const viewOfSecond = (() => {
      const leaf = leaves(wb.store.getState().document.workspaces[0]?.tree).find((node) => node.id === second)!;
      return leaf.body.case === "leaf" ? leaf.body.value.viewId : "";
    })();
    act(() => {
      wb.verbs.openLauncher(first);
    });
    act(() => {
      fireEvent.click(baseElement.querySelector(`#goto\\:${viewOfSecond}`)!);
    });
    const tree = wb.store.getState().document.workspaces[0]?.tree;
    const viewIds = leaves(tree).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
    expect(viewIds).toEqual([viewOfSecond, viewOfSecond]);
  });

  test("a global choice never destroys a working tile", async () => {
    const { wb } = twoTiles();
    const { container, baseElement } = render(
      <>
        <wb.Surface />
        <wb.Launcher />
      </>,
    );
    act(() => {
      wb.verbs.openLauncher();
    });
    act(() => {
      fireEvent.click(baseElement.querySelector("#place\\:counter")!);
    });
    // Placement mode is live; Enter commits the default (split the active
    // tile). The outcome is a promise the launcher awaits, so the placement
    // lands a microtask later.
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(container.querySelectorAll('[data-part="tile"]')).toHaveLength(3);
  });

  test("a product rows function is honoured, and choose can claim a row", () => {
    const { wb } = twoTiles();
    const claimed: string[] = [];
    const { baseElement } = render(
      <wb.Launcher
        rows={() => [{ id: "custom:one", kind: "app", appId: "counter", title: "My row", detail: "mine" }]}
        choose={(row) => {
          claimed.push(row.id);
          return true;
        }}
      />,
    );
    act(() => {
      wb.verbs.openLauncher();
    });
    const rows = [...baseElement.querySelectorAll('[data-part="launcher-row"]')].map((row) => row.id);
    expect(rows).toEqual(["custom:one"]);
    const before = wb.store.getState().document;
    act(() => {
      fireEvent.click(baseElement.querySelector("#custom\\:one")!);
    });
    expect(claimed).toEqual(["custom:one"]);
    // Claiming means the default meaning never ran.
    expect(wb.store.getState().document).toBe(before);
    expect(wb.store.getState().launcherOpen).toBe(false);
  });

  test("choose returning false falls through to the default meaning", async () => {
    const { wb } = twoTiles();
    const { container, baseElement } = render(
      <>
        <wb.Surface />
        <wb.Launcher choose={() => false} />
      </>,
    );
    act(() => {
      wb.verbs.openLauncher();
    });
    act(() => {
      fireEvent.click(baseElement.querySelector("#place\\:counter")!);
    });
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(container.querySelectorAll('[data-part="tile"]')).toHaveLength(3);
  });

  test("an unavailable application is not offered", () => {
    const scoped = { ...counterApp, id: "scoped", title: "scoped", available: () => false };
    const wb = createWorkbench({ apps: [...demoApps, scoped], initial: layout(tile("counter")) });
    const { baseElement } = render(<wb.Launcher />);
    act(() => {
      wb.verbs.openLauncher();
    });
    const rows = [...baseElement.querySelectorAll('[data-part="launcher-row"]')].map((row) => row.id);
    expect(rows).not.toContain("place:scoped");
  });

  test("a tile whose layout names an excluded application still renders it", () => {
    const scoped = { ...counterApp, id: "scoped", title: "scoped", available: () => false };
    const wb = createWorkbench({ apps: [...demoApps, scoped], initial: layout(tile("scoped")) });
    const { container } = render(<wb.Surface />);
    // Hiding it from the launcher must never silently drop a seeded tile.
    expect(container.querySelectorAll('[data-part="counter-app"]')).toHaveLength(1);
  });

  test("group and blurb shape the default rows", () => {
    const grouped = { ...counterApp, id: "tools", title: "tools", group: "TOOLS", blurb: "the useful ones" };
    const wb = createWorkbench({ apps: [...demoApps, grouped], initial: layout(tile("counter")) });
    const { baseElement } = render(<wb.Launcher />);
    act(() => {
      wb.verbs.openLauncher();
    });
    // The shell renders a group's label as its first child; there is no part
    // name on it, so read the group's own first element.
    const labels = [...baseElement.querySelectorAll('[data-part="launcher-group"]')].map(
      (group) => group.firstElementChild?.textContent,
    );
    expect(labels).toEqual(["ON SCREEN", "TOOLS", "NEW TILE"]);
    expect(baseElement.querySelector("#place\\:tools")?.textContent).toContain("the useful ones");
  });

  test("renderDetail replaces the detail line", () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(tile("counter")) });
    const { baseElement } = render(<wb.Launcher renderDetail={(row) => `[${row.kind}]`} />);
    act(() => {
      wb.verbs.openLauncher();
    });
    expect(baseElement.querySelector("#place\\:notes")?.textContent).toContain("[app]");
  });
});

describe("Launcher · rows scope (C1 finding 6)", () => {
  function twoWorkspaces() {
    const wb = createWorkbench({
      apps: demoApps,
      initial: workspaces([
        { name: "one", spec: tile("counter") },
        { name: "two", spec: tile("notes", { title: "elsewhere" }) },
      ]),
    });
    return wb;
  }

  test("the default reaches the whole document, marking the foreign rows", () => {
    const wb = twoWorkspaces();
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Launcher />
      </>,
    );
    act(() => {
      wb.verbs.openLauncher();
    });
    const rows = [...baseElement.querySelectorAll('[data-part="launcher-row"]')].map((row) => row.textContent ?? "");
    expect(rows.some((row) => row.includes("elsewhere") && row.includes("in another workspace"))).toBe(true);
  });

  test('scope="workspace" lists only what is in front of the user', () => {
    const wb = twoWorkspaces();
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Launcher scope="workspace" />
      </>,
    );
    act(() => {
      wb.verbs.openLauncher();
    });
    const rows = [...baseElement.querySelectorAll('[data-part="launcher-row"]')].map((row) => row.textContent ?? "");
    expect(rows.some((row) => row.includes("elsewhere"))).toBe(false);
    // The applications are unaffected: scope is about what is ON SCREEN.
    expect(baseElement.querySelector("#place\\:notes")).not.toBeNull();
  });
});
