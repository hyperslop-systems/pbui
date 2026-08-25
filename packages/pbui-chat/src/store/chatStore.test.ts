import { describe, expect, it } from "vitest";
import { createPbuiChatStore } from "./chatStore";
import type { Reference } from "../types";

const product: Reference = { type: "product", id: "p-1", value: { name: "Boots" } };

describe("conversation composer drafts", () => {
  it("isolates text and references by conversation", () => {
    const store = createPbuiChatStore();

    store.setDraftText("conversation-a", "ask about ");
    store.insertReference("conversation-a", product, "Boots");
    store.setDraftText("conversation-b", "unrelated question");

    expect(store.draftFor("conversation-a")).toEqual({
      text: "ask about [[product:p-1|Boots]] ",
      refs: { "product:p-1": product },
    });
    expect(store.draftFor("conversation-b")).toEqual({ text: "unrelated question", refs: {} });
  });

  it("clears and forgets only the selected conversation", () => {
    const store = createPbuiChatStore();
    store.setDraftText("conversation-a", "first");
    store.setDraftText("conversation-b", "second");

    store.clearDraft("conversation-a");
    expect(store.draftFor("conversation-a")).toEqual({ text: "", refs: {} });
    expect(store.draftFor("conversation-b").text).toBe("second");

    store.forgetDraft("conversation-a");
    expect(store.getState().drafts).not.toHaveProperty("conversation-a");
    expect(store.draftFor("conversation-b").text).toBe("second");
  });
});
