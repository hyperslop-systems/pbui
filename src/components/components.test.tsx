import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { InspectorPanel } from "./InspectorPanel";
import { JsonBlock } from "./JsonBlock";

afterEach(cleanup);

describe("reusable components", () => {
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
