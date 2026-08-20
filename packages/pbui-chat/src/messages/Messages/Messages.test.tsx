import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { chat } from "../../../demo/src/chat";
import { DemoChat, transcript } from "../../stories/DemoChat";
import { Messages } from "./Messages";

/**
 * The transcript rendered end to end through a seeded chat-provider store:
 * the reference index, the widget outlets, the verb chips and the local
 * verbs all run for real (no backend; the router skips the trace POST
 * without a session id).
 */
afterEach(() => {
  cleanup();
  chat.store.reset();
});

function renderTranscript() {
  return render(
    <DemoChat entities={transcript}>
      <Messages follow={false} />
    </DemoChat>,
  );
}

describe("Messages", () => {
  test("mentions resolve through pbui.refs, unknown ones fall back to <unresolved>", () => {
    renderTranscript();
    const eagle = screen.getAllByTestId("mention-product-2049")[0]!;
    expect(eagle?.getAttribute("data-ptype")).toBe("product");
    expect(eagle?.getAttribute("data-tone")).toBe("var(--pbui-tone-product)");
    expect(eagle?.textContent).toMatch(/the Eagle/i);

    const ghost = screen.getByTestId("mention-order-99999");
    expect(ghost?.getAttribute("data-ptype")).toBe("unresolved");
    expect(ghost?.getAttribute("data-tone")).toBe("var(--pbui-tone-neutral)");
    expect(ghost?.textContent).toContain("an order I cannot resolve");
  });

  test("pbui.refs is invisible, pbui.widget renders, pbui.error is a callout, trace entries stay out", () => {
    const { container } = renderTranscript();
    expect(container.querySelector('[data-timeline-id="m2-refs"]')).toBeNull();
    expect(screen.getByTestId("widget-title-m2-w1")?.textContent).toContain("Gold Eagle health");
    expect(container.querySelector('[data-timeline-id="m2-w2"] [data-part="widget"]')?.getAttribute("data-state")).toBe("streaming");
    expect(screen.getByText(/unknown kind "hologram"/)).toBeTruthy();
    expect(container.querySelector('[data-timeline-kind="trace_entry"]')).toBeNull();
    expect(container.querySelector('[data-part="tool-card"]')?.textContent).toContain("sales_report");
  });

  test("verb chips validate against the vocabulary; invalid ones are disabled with the reason", () => {
    const { container } = renderTranscript();
    const chips = container.querySelectorAll<HTMLButtonElement>('[data-timeline-id="m2-w1"] [data-part="verb-chip"]');
    expect(chips.length).toBe(5);
    const teleport = Array.from(chips).find((c) => c.dataset.verb === "teleport")!;
    expect(teleport.disabled).toBe(true);
    expect(teleport?.getAttribute("data-state")).toBe("disabled");
    expect(teleport.title).toBe("unknown verb teleport");
    const reorder = Array.from(chips).find((c) => c.dataset.verb === "reorder")!;
    expect(reorder.disabled).toBe(false);
  });

  test("a local verb chip performs through the router into the chat store", async () => {
    const { container } = renderTranscript();
    const watch = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-timeline-id="m2-w1"] [data-part="verb-chip"]')).find(
      (c) => c.dataset.verb === "watch",
    )!;
    fireEvent.click(watch);
    await screen.findByText("Gold Eagle health");
    expect(chat.store.getState().watchlist.map((r) => r.id)).toEqual(["2049"]);

    const only = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-timeline-id="m2-w2"] [data-part="verb-chip"]')).find(
      (c) => c.dataset.verb === "addFilter",
    )!;
    fireEvent.click(only);
    await screen.findByText(/filtered out/);
    const table = container.querySelector('[data-timeline-id="m2-w2"] [data-part="table"]')!;
    expect(within(table as HTMLElement).getAllByRole("row").length).toBe(1 + 3);
    expect(chat.store.getState().tables.t3?.filters).toEqual([{ field: "metal", op: "=", value: "gold" }]);
  });

  test("tables mint <field> headers and <row> handles", () => {
    const { container } = renderTranscript();
    const table = container.querySelector('[data-timeline-id="m2-w2"] [data-part="table"]')!;
    const fields = table.querySelectorAll('[data-pbui="presentation"][data-ptype="field"]');
    expect(fields.length).toBe(5);
    const rows = table.querySelectorAll('[data-pbui="presentation"][data-ptype="row"]');
    expect(rows.length).toBe(5);
    expect(rows[0]?.textContent).toContain("#0");
  });
});
