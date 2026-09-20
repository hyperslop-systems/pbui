import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { chat } from "../../../demo/src/chat";
import { DemoChat } from "../../stories/DemoChat";
import { ProposalCard } from "./ProposalCard";

afterEach(() => { cleanup(); chat.store.reset(); });

test.each(["approve", "reject"] as const)("shared card composition preserves %s and exact field values", (decision) => {
  const onDecide = vi.fn();
  const props = { id: "p1", toolCallId: "t1", title: "Local proposal", body: "Explicit decision only", danger: true, fields: [{ label: "exact", value: "9007199254740993.00" }], onDecide };
  const { container, rerender } = render(<DemoChat><ProposalCard {...props} /></DemoChat>);
  expect(container.querySelector('[data-part="key-value-list"]')?.textContent).toContain("9007199254740993.00");
  expect(container.querySelectorAll('[data-part="proposal"]')).toHaveLength(1);
  expect(screen.getByRole("group", { name: "proposal: Local proposal" })).toBeTruthy();
  expect(onDecide).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: decision === "approve" ? "Approve" : "Reject" }));
  expect(onDecide).toHaveBeenCalledWith(decision);
  rerender(<DemoChat><ProposalCard {...props} decision={decision} /></DemoChat>);
  for (const name of ["Approve", "Reject"]) {
    const button = screen.getByRole("button", { name }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toBe(`already ${decision === "approve" ? "approved" : "rejected"}`);
    fireEvent.click(button);
  }
  expect(onDecide).toHaveBeenCalledTimes(1);
});
