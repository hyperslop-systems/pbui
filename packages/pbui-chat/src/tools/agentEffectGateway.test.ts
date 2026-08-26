import { describe, expect, it, vi } from "vitest";
import { InMemoryApprovalLedger, createApprovalSubject } from "./approvalLedger";
import { AgentEffectGateway, EffectConflictError, type AgentEffectRequest, type EffectEnvelope } from "./agentEffectGateway";

function request(overrides: Partial<AgentEffectRequest<string>> = {}): AgentEffectRequest<string> {
  return {
    effectId: "agent-a:tool-1",
    invocationKey: "agent-a/tool-1",
    actor: "agent",
    conversationId: "agent-a",
    effectKind: "tile.close",
    effectScope: "workbench",
    input: { kind: "tile.close", placementId: "tile-1" },
    targetIds: ["tile-1"],
    policy: "allow",
    perform: async () => ({ outcome: "performed", value: "closed", afterRevision: "rev-2" }),
    ...overrides,
  };
}

async function approvedLedger() {
  const ledger = new InMemoryApprovalLedger();
  await ledger.grant(
    "proposal-1",
    createApprovalSubject({
      senderConversationId: "agent-a",
      operation: "tile.close",
      arguments: { kind: "tile.close", placementId: "tile-1" },
      targetIds: ["tile-1"],
      effectScope: "workbench",
    }),
  );
  return ledger;
}

describe("AgentEffectGateway", () => {
  it("emits a canonical causal envelope for a performed effect", async () => {
    const reported: EffectEnvelope[] = [];
    const gateway = new AgentEffectGateway({ report: async (envelope) => void reported.push(envelope) });

    const result = await gateway.execute(request({ beforeRevision: "rev-1" }));

    expect(result).toMatchObject({ outcome: "performed", value: "closed", trace: "recorded", cached: false });
    expect(result.envelope).toMatchObject({
      effectId: "agent-a:tool-1",
      invocationKey: "agent-a/tool-1",
      actor: "agent",
      conversationId: "agent-a",
      effectKind: "tile.close",
      effectScope: "workbench",
      beforeRevision: "rev-1",
      afterRevision: "rev-2",
      outcome: "performed",
    });
    expect(result.envelope.inputDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(reported).toEqual([result.envelope]);
  });

  it("reserves and finalizes exact approval once", async () => {
    const ledger = await approvedLedger();
    const gateway = new AgentEffectGateway({ approvalLedger: ledger });

    const first = await gateway.execute(request({ policy: "confirm", confirmationId: "proposal-1" }));
    expect(first.outcome).toBe("performed");

    const replay = await gateway.execute(request({ policy: "confirm", confirmationId: "proposal-1" }));
    expect(replay).toMatchObject({ outcome: "performed", cached: true });

    const secondEffect = await gateway.execute(
      request({ effectId: "agent-a:tool-2", invocationKey: "agent-a/tool-2", policy: "confirm", confirmationId: "proposal-1" }),
    );
    expect(secondEffect.outcome).toContain("already been used");
  });

  it("releases a reservation when the domain refuses before a side effect", async () => {
    const ledger = await approvedLedger();
    const gateway = new AgentEffectGateway({ approvalLedger: ledger });

    const refused = await gateway.execute(
      request({
        policy: "confirm",
        confirmationId: "proposal-1",
        perform: async () => ({ outcome: "rejected:stale revision" }),
      }),
    );
    expect(refused.outcome).toBe("rejected:stale revision");

    const retry = await gateway.execute(
      request({
        effectId: "agent-a:tool-2",
        invocationKey: "agent-a/tool-2",
        policy: "confirm",
        confirmationId: "proposal-1",
      }),
    );
    expect(retry.outcome).toBe("performed");
  });

  it("deduplicates concurrent and terminal retries but rejects key reuse", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const perform = vi.fn(async () => {
      await blocked;
      return { outcome: "performed" as const, value: "closed" };
    });
    const gateway = new AgentEffectGateway();

    const first = gateway.execute(request({ perform }));
    const concurrent = gateway.execute(request({ perform }));
    await vi.waitFor(() => expect(perform).toHaveBeenCalledTimes(1));
    release();
    expect(await first).toMatchObject({ cached: false });
    expect(await concurrent).toMatchObject({ cached: true });
    expect(await gateway.execute(request({ perform }))).toMatchObject({ cached: true });
    await expect(gateway.execute(request({ input: { kind: "tile.close", placementId: "tile-other" } }))).rejects.toBeInstanceOf(
      EffectConflictError,
    );
  });

  it("persists failed reports across gateway recreation and marks cached results recorded after flush", async () => {
    let available = false;
    const values = new Map<string, string>();
    const outboxStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
    };
    const report = vi.fn(async () => {
      if (!available) throw new Error("offline");
    });
    const gateway = new AgentEffectGateway({ report, outboxStorage });

    const result = await gateway.execute(request());
    expect(result.trace).toBe("pending");
    expect(gateway.pendingReports()).toHaveLength(1);

    const restored = new AgentEffectGateway({ report, outboxStorage });
    expect(restored.pendingReports()).toEqual([result.envelope]);
    available = true;
    await expect(restored.flushReports()).resolves.toBe(1);
    expect(restored.pendingReports()).toHaveLength(0);
    expect(values.size).toBe(0);

    await expect(gateway.flushReports()).resolves.toBe(1);
    expect(await gateway.execute(request())).toMatchObject({ trace: "recorded", cached: true });
  });

  it("fails closed for denied or unavailable confirmations without performing", async () => {
    const perform = vi.fn(async () => ({ outcome: "performed" as const }));
    const gateway = new AgentEffectGateway();

    expect((await gateway.execute(request({ policy: "deny", perform }))).outcome).toContain("not something the assistant may do");
    expect(
      (await gateway.execute(request({ effectId: "agent-a:tool-2", policy: "confirm", confirmationId: "missing", perform }))).outcome,
    ).toContain("no approved proposal");
    expect(perform).not.toHaveBeenCalled();
  });
});
