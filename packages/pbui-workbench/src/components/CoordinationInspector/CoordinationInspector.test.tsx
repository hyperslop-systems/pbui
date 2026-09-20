import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { linkVerbs } from "@hyperslop-systems/pbui";
import { layout, split, tile } from "@hyperslop-systems/workbench-core";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { createWorkbench } from "../../createWorkbenchShell";
import { demoApps } from "../../stories/demoApps";
import { coordinationInspectorApp } from "./CoordinationInspector";

afterEach(cleanup);

test("the styled inspector retains live link facts and a visible wiring action", () => {
  const wb = createWorkbench({
    apps: [...demoApps, coordinationInspectorApp],
    initial: layout(split("row", 0.5, split("col", 0.5, tile("counter"), tile("notes")), tile("coordination"))),
  });
  const [counter, notes] = leaves(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId)).map((leaf) => leaf.body.case === "leaf" ? leaf.body.value.viewId : "");
  wb.perform(linkVerbs.follow(`${counter}/count`, `${notes}/subject`));
  const { container } = render(<wb.Surface />);
  expect(screen.getByText("Ports")).toBeTruthy();
  expect(screen.getByText("Wires")).toBeTruthy();
  expect(container.querySelector('[data-part="inspector-bindings"]')?.textContent).toContain("following");
  act(() => wb.links.runtime.emit(`${counter}/count`, { type: "number", value: 42 }));
  expect(container.querySelector('[data-part="inspector-bindings"]')?.textContent).toContain("now <number>");
  fireEvent.click(screen.getByRole("button", { name: "show wiring" }));
  expect(container.querySelector('[data-part="tile-frame-overlay"]')).toBeTruthy();
});

test("an unlinked inspector keeps its explanatory empty state", () => {
  const wb = createWorkbench({ apps: [coordinationInspectorApp], initial: layout(tile("coordination")) });
  render(<wb.Surface />);
  expect(screen.getByText("nothing is linked yet")).toBeTruthy();
  expect(screen.getByRole("button", { name: "show wiring" })).toBeTruthy();
});
