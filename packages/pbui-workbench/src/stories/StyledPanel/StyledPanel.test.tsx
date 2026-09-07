import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StyledPanel, StyledPanelDemo, StyledWorkbench } from "./StyledPanel";

afterEach(cleanup);
describe("documented styled panel", () => {
  it("edits controlled input without inspecting until explicitly requested", () => {
    render(<StyledPanelDemo />);
    fireEvent.change(screen.getByRole("textbox", { name: "Fixture name" }), { target: { value: "Edited fixture" } });
    expect(screen.queryByText("Inspected value")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
    expect(screen.getByText("Inspected value")).toBeTruthy();
  });
  it.each(["loading", "disabled"] as const)("disables inspection with a visible reason in %s", state => {
    const inspect = vi.fn();
    render(<StyledPanel value="fixture" state={state} onValueChange={() => {}} onInspect={inspect} />);
    const button = screen.getByRole("button", { name: "Inspect" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(inspect).not.toHaveBeenCalled();
    expect(screen.getByText(/inspection is (unavailable|disabled)/i)).toBeTruthy();
  });
  it("names loading, empty and error states rather than using colour alone", () => {
    const props = { value: "fixture", onValueChange: () => {}, onInspect: () => {} };
    const view = render(<StyledPanel {...props} state="loading" />);
    expect(screen.getByText("Loading fixture…")).toBeTruthy();
    view.rerender(<StyledPanel {...props} state="empty" />);
    expect(screen.getByText("No result selected")).toBeTruthy();
    view.rerender(<StyledPanel {...props} state="error" />);
    expect(screen.getByRole("alert").textContent).toContain("Fixture unavailable");
  });
  it("mounts a native workbench and exposes wiring without a shortcut", () => {
    const { container } = render(<StyledWorkbench />);
    expect(container.querySelector('[data-part="app-shell"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Wiring" }));
    expect(screen.getByRole("button", { name: "Close wiring" })).toBeTruthy();
  });
});
