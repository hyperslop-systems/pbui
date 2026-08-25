import { describe, expect, test } from "vitest";
import { vocabulary } from "./vocabulary";

/**
 * The generated Go demo embeds this browser vocabulary. Keep the consequential
 * handoff contract and trace presentation discoverable in both copies.
 */
describe("demo vocabulary", () => {
  test("advertises the approval-gated conversation handoff", () => {
    expect(vocabulary.types.conversation?.verbs).toContain("conversation.send");
    expect(vocabulary.verbs["conversation.send"]).toMatchObject({
      doc: expect.stringContaining("another conversation"),
      fields: expect.objectContaining({ conversationId: "string", template: "string" }),
    });
    expect(vocabulary.types.proposal?.verbs).toContain("resolveProposal");
  });

  test("makes durable effect and verb traces inspectable", () => {
    expect(vocabulary.types.traceEntry).toMatchObject({
      doc: expect.stringContaining("session trace"),
      verbs: expect.arrayContaining(["inspect", "askAgent"]),
    });
  });
});
