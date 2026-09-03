import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { split, tile, workspaces } from "@hyperslop-systems/workbench-core";
import { createWorkbench } from "../../createWorkbenchShell";
import { demoApps } from "../../stories/demoApps";

afterEach(cleanup);

function threeWorkspaces() {
  return createWorkbench({
    apps: demoApps,
    initial: workspaces([
      { id: "a", name: "main", spec: split("row", 0.5, tile("counter"), tile("notes")) },
      { id: "b", name: "scratch", spec: tile("counter") },
      { id: "c", name: "third", spec: tile("counter") },
    ]),
  });
}

describe("WorkspaceStrip", () => {
  test("renders one button per workspace and marks the current one", () => {
    const wb = threeWorkspaces();
    const { container } = render(<wb.WorkspaceStrip />);
    const buttons = container.querySelectorAll<HTMLButtonElement>('[data-part="workspace-strip"] button');
    expect([...buttons].map((b) => b.textContent)).toEqual(["main", "scratch", "third"]);
    expect(buttons[0]?.getAttribute("aria-current")).toBe("true");
    expect(buttons[1]?.getAttribute("aria-current")).toBeNull();
  });

  test("clicking a workspace selects it and the Surface follows", () => {
    const wb = threeWorkspaces();
    const { container } = render(
      <>
        <wb.WorkspaceStrip />
        <wb.Surface />
      </>,
    );
    expect(container.querySelectorAll('[data-part="tile"]')).toHaveLength(2);
    fireEvent.click(container.querySelectorAll('[data-part="workspace-strip"] button')[1]!);
    expect(wb.core.getState().session.workspaceId).toBe("b");
    expect(container.querySelectorAll('[data-part="tile"]')).toHaveLength(1);
  });

  test("the tile count rides in the title, not the label", () => {
    const wb = threeWorkspaces();
    const { container } = render(<wb.WorkspaceStrip />);
    const buttons = container.querySelectorAll('[data-part="workspace-strip"] button');
    expect(buttons[0]?.getAttribute("title")).toBe("2 tiles");
    expect(buttons[1]?.getAttribute("title")).toBe("1 tile");
  });

  test("no add button unless addLabel is given", () => {
    const wb = threeWorkspaces();
    const { container, rerender } = render(<wb.WorkspaceStrip />);
    expect(container.querySelectorAll('[data-part="workspace-strip"] button')).toHaveLength(3);
    rerender(<wb.WorkspaceStrip addLabel="new" />);
    const buttons = container.querySelectorAll<HTMLButtonElement>('[data-part="workspace-strip"] button');
    expect(buttons).toHaveLength(4);
    fireEvent.click(buttons[3]!);
    expect(wb.core.getState().document.workspaces).toHaveLength(4);
    expect(wb.core.getState().session.workspaceId).not.toBe("a");
  });

  test("renderWorkspace replaces the default button", () => {
    const wb = threeWorkspaces();
    const { container } = render(<wb.WorkspaceStrip renderWorkspace={(workspace, placement) => <b data-part="custom-ws">{`${workspace.name}/${placement.tileCount}/${placement.active}`}</b>} />);
    expect([...container.querySelectorAll('[data-part="custom-ws"]')].map((n) => n.textContent)).toEqual(["main/2/true", "scratch/1/false", "third/1/false"]);
  });
});
