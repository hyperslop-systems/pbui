import { describe, expect, it } from "vitest";
import {
  InMemoryApprovalLedger,
  canonicalJson,
  createApprovalSubject,
  digestApprovalSubject,
} from "./approvalLedger";

function subject(prompt = "price the Eagle") {
  return createApprovalSubject({
    senderConversationId: "agent-a",
    operation: "conversation.send",
    arguments: { prompt, nested: { z: 2, a: 1 } },
    targetIds: ["agent-b", "agent-b"],
    referenceKeys: ["source:E1", "product:2049"],
    effectScope: "conversation",
  });
}

describe("approval subjects", () => {
  it("canonicalizes object keys and authority sets deterministically", async () => {
    const first = subject();
    const second = createApprovalSubject({
      senderConversationId: "agent-a",
      operation: "conversation.send",
      arguments: { nested: { a: 1, z: 2 }, prompt: "price the Eagle" },
      targetIds: ["agent-b"],
      referenceKeys: ["product:2049", "source:E1"],
      effectScope: "conversation",
    });

    expect(canonicalJson(first as never)).toBe(canonicalJson(second as never));
    await expect(digestApprovalSubject(first)).resolves.toBe(await digestApprovalSubject(second));
  });

  it("rejects non-finite authority values", () => {
    expect(() =>
      createApprovalSubject({
        senderConversationId: "agent-a",
        operation: "workbench.raw",
        arguments: { ratio: Number.NaN },
        effectScope: "workbench",
      }),
    ).toThrow("must be finite");
  });
});

describe("InMemoryApprovalLedger", () => {
  it("binds an approval to one exact subject and consumes it once globally", async () => {
    const ledger = new InMemoryApprovalLedger();
    const capability = await ledger.grant("proposal-1", subject());

    await expect(ledger.consume(capability, subject("different"), "effect-wrong")).resolves.toBe("mismatch");
    await expect(ledger.consume(capability, subject(), "effect-1")).resolves.toBe("consumed");
    await expect(ledger.consume(capability, subject(), "effect-2")).resolves.toBe("already-used");
  });

  it("expires capabilities and keeps forged capability objects from consuming", async () => {
    let now = new Date("2026-08-25T12:00:00.000Z");
    const ledger = new InMemoryApprovalLedger({ now: () => now, ttlMs: 1_000 });
    const capability = await ledger.grant("proposal-1", subject());

    await expect(ledger.consume({ ...capability, expiresAt: "2099-01-01T00:00:00.000Z" }, subject(), "forged")).resolves.toBe(
      "not-found",
    );
    now = new Date("2026-08-25T12:00:01.000Z");
    await expect(ledger.consume(capability, subject(), "late")).resolves.toBe("expired");
  });

  it("does not let a proposal id be rebound to another subject", async () => {
    const ledger = new InMemoryApprovalLedger();
    await ledger.grant("proposal-1", subject());
    await expect(ledger.grant("proposal-1", subject("different"))).rejects.toThrow("already bound");
  });
});
