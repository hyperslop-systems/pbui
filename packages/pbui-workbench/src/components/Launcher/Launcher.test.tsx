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
    const rows = [...baseElement.querySelectorAll('[data-part="launcher-row"]')].map((row) => row.id);
    expect(rows).toEqual(["goto:notes", "place:counter"]);
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
    expect(rows).toEqual(["place:counter", "place:notes"]);
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
