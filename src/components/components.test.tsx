import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Chip } from "./atoms";
import { InspectorPanel } from "./InspectorPanel";
import { JsonBlock } from "./JsonBlock";

afterEach(cleanup);

describe("reusable components", () => {
  test("Chip reveals its label as the native tooltip unless silenced per call site", () => {
    const { container, rerender } = render(<Chip label="revenue_per_capita" />);
    const chip = () => container.querySelector('[data-part="chip"]');
    // The default keeps truncated labels recoverable by pointer.
    expect(chip()?.getAttribute("title")).toBe("revenue_per_capita");
    // A help-enabled call site silences the native tooltip explicitly.
    rerender(<Chip label="revenue_per_capita" title="" />);
    expect(chip()?.getAttribute("title")).toBe("");
    rerender(<Chip label="seq" title="full explanation" />);
    expect(chip()?.getAttribute("title")).toBe("full explanation");
  });

  test("JsonBlock contains serialization failures", () => {
    render(<JsonBlock value={{ count: 1n }} />);
    expect(screen.getByText(/cannot be shown as JSON/)).toBeTruthy();
  });

  test("InspectorPanel delegates structured rendering", () => {
    render(
      <InspectorPanel
        inspected={{ title: "Record", value: { id: 7 } }}
        renderValue={({ value }) => <output>{String((value as { id: number }).id)}</output>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Record" })).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
  });
});
