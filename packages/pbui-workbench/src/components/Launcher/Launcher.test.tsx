import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { counterApp, demoApps } from "../../stories/demoApps";

afterEach(cleanup);

describe("Launcher", () => {
  test("Ctrl+K opens it; a placed singleton is offered as go-to, the rest as a new tile", () => {
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
    expect(baseElement.querySelector('[data-part="launcher-status"]')?.textContent).toMatch(/a new tile opens (beside|below)/);

    // Choosing "place" splits the active tile; the launcher closes.
    act(() => {
      fireEvent.click(baseElement.querySelector("#place\\:counter")!);
    });
    expect(wb.store.getState().launcherOpen).toBe(false);
    expect(leaves(wb.store.getState().document.workspaces[0]?.tree)).toHaveLength(3);
    expect(container.querySelectorAll('[data-part="tile"]')).toHaveLength(3);
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

  test("a global choice never destroys a working tile", () => {
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

  test("choose returning false falls through to the default meaning", () => {
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
