import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { UINode } from "../../contracts";
import { UINodeRenderer } from "./UINodeRenderer";

function mount(tree: UINode, onEvent = vi.fn()) {
  const renderReference = vi.fn((reference: { type: string; id: string }, label: string) => <span data-testid="ref">{label || reference.id}</span>);
  const result = render(<UINodeRenderer tree={tree} onEvent={onEvent} renderReference={renderReference} />);
  return { ...result, onEvent, renderReference };
}

describe("UINodeRenderer", () => {
  test("renders every kind with pbui atoms and no raw controls of its own", () => {
    const { container, renderReference } = mount({
      kind: "column",
      children: [
        { kind: "panel", props: { title: "Panel" }, children: [{ kind: "text", text: "hello" }] },
        { kind: "row", children: [{ kind: "badge", text: "tag" }] },
        { kind: "button", props: { label: "Go" } },
        { kind: "input", props: { value: "v", placeholder: "days" } },
        { kind: "select", props: { value: "a", options: [{ value: "a", label: "A" }] } },
        { kind: "table", props: { headers: ["n", "q"], rows: [["x", 1]] } },
        { kind: "meter", props: { fraction: 0.5, label: "stock", value: "3 / 6" } },
        { kind: "sparkline", props: { points: [1, 2, 3], label: "sales" } },
        { kind: "callout", props: { variant: "warning", title: "careful", text: "watch out" } },
        { kind: "ref", props: { reference: { type: "product", id: "2049" }, label: "gold" } },
      ],
    });
    expect(screen.getByText("Panel")).toBeTruthy();
    expect(screen.getByText("hello")).toBeTruthy();
    expect(screen.getByText("tag")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go" })).toBeTruthy();
    expect(screen.getByLabelText("days")).toBeTruthy();
    expect(container.querySelector('[data-part="program-table"] td[data-numeric="true"]')?.textContent).toBe("1");
    expect(screen.getByLabelText("stock")).toBeTruthy();
    expect(screen.getByText("watch out")).toBeTruthy();
    expect(renderReference).toHaveBeenCalledWith({ type: "product", id: "2049" }, "gold");
    expect(screen.getByTestId("ref").textContent).toBe("gold");
  });

  test("a button click sends the ref and its static args", () => {
    const { onEvent } = mount({ kind: "button", props: { label: "Set", onClick: { handler: "set", args: 5 } } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(onEvent).toHaveBeenCalledWith({ handler: "set", args: 5 }, 5);
  });

  test("an input change sends {value}; a select change likewise", () => {
    const { onEvent } = mount({
      kind: "row",
      children: [
        { kind: "input", props: { value: "", placeholder: "name", onChange: { handler: "typed" } } },
        { kind: "select", props: { value: "a", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }], onChange: { handler: "picked" } } },
      ],
    });
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Ada" } });
    expect(onEvent).toHaveBeenCalledWith({ handler: "typed" }, { value: "Ada" });
    fireEvent.change(screen.getByLabelText("program root.1"), { target: { value: "b" } });
    expect(onEvent).toHaveBeenCalledWith({ handler: "picked" }, { value: "b" });
  });

  test("a disabled destructive button is disabled", () => {
    mount({ kind: "button", props: { label: "Delete", variant: "destructive", disabled: true, onClick: { handler: "x" } } });
    expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("renders nothing for a null tree", () => {
    const { container } = render(<UINodeRenderer tree={null} onEvent={vi.fn()} renderReference={() => null} />);
    expect(container.innerHTML).toBe("");
  });

  test("every node carries its path, and highlightPath marks exactly one", () => {
    const tree: UINode = { kind: "column", children: [{ kind: "text", text: "a" }, { kind: "row", children: [{ kind: "badge", text: "b" }] }] };
    const onEvent = vi.fn();
    const renderReference = vi.fn(() => null);
    const { container, rerender } = render(<UINodeRenderer tree={tree} onEvent={onEvent} renderReference={renderReference} highlightPath="root.1.0" />);
    const paths = [...container.querySelectorAll("[data-node-path]")].map((el) => el.getAttribute("data-node-path"));
    expect(paths).toEqual(["root", "root.0", "root.1", "root.1.0"]);
    const marked = [...container.querySelectorAll('[data-highlighted="true"]')].map((el) => el.getAttribute("data-node-path"));
    expect(marked).toEqual(["root.1.0"]);
    rerender(<UINodeRenderer tree={tree} onEvent={onEvent} renderReference={renderReference} />);
    expect(container.querySelector('[data-highlighted="true"]')).toBeNull();
  });
});
