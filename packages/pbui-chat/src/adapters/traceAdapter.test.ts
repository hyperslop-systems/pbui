import { describe, expect, test } from "vitest";
import { TRACE_SNAPSHOT_KIND, TRACE_UI_EVENT, traceAdapter, traceEntryProps } from "./traceAdapter";

/** protojson of a TraceEntry, as the Go side publishes it. */
const payload = {
  seq: "12",
  actor: "ACTOR_HUMAN",
  verb: { kind: "inspect", ref: { type: "product", id: "2049" } },
  target: {
    type: "product",
    id: "2049",
    value: { name: "1oz American Gold Eagle 2024", stock: 12 },
    provenance: { messageId: "m7" },
  },
  outcome: "performed",
  at: "2026-08-20T10:15:30.250Z",
  clientSeq: "1755684930250-1",
};

const context = { sessionId: "s1" };

describe("traceAdapter", () => {
  test("live and hydrate produce identical entities", () => {
    const live = traceAdapter.live.project({ type: "ui-event", name: TRACE_UI_EVENT, payload }, context);
    const hydrated = traceAdapter.hydrate.project({ kind: TRACE_SNAPSHOT_KIND, id: "trace-12", payload }, context);
    expect(live).not.toBeNull();
    expect(hydrated).not.toBeNull();
    expect(live?.upsert).toEqual(hydrated);
  });

  test("maps protojson onto the trace_entry props", () => {
    const entity = traceAdapter.hydrate.project({ kind: TRACE_SNAPSHOT_KIND, id: "x", payload }, context);
    expect(entity).toMatchObject({
      id: "trace-12",
      kind: "trace_entry",
      createdAt: Date.parse("2026-08-20T10:15:30.250Z"),
      props: {
        seq: 12,
        actor: "human",
        verb: { kind: "inspect", ref: { type: "product", id: "2049" } },
        target: {
          type: "product",
          id: "2049",
          value: { name: "1oz American Gold Eagle 2024", stock: 12 },
          provenance: { messageId: "m7" },
        },
        outcome: "performed",
        at: "2026-08-20T10:15:30.250Z",
        clientSeq: "1755684930250-1",
      },
    });
  });

  test("preserves a canonical effect envelope on live and hydrated trace rows", () => {
    const effectPayload = {
      seq: "13",
      actor: "ACTOR_AGENT",
      verb: { kind: "tile.close" },
      outcome: "performed",
      at: "2026-08-25T17:00:00Z",
      effect: {
        effectId: "agent-a:tool-1",
        invocationKey: "agent-a/tool-1",
        actor: "ACTOR_AGENT",
        conversationId: "agent-a",
        effectKind: "tile.close",
        effectScope: "workbench",
        canonicalInput: { kind: "tile.close", placementId: "n1" },
        inputDigest: "a".repeat(64),
        targetIds: ["n1"],
        referenceKeys: [],
        approvalId: "proposal-1",
        beforeRevision: "r1",
        afterRevision: "r2",
        outcome: "performed",
        occurredAt: "2026-08-25T17:00:00Z",
      },
    };
    expect(traceEntryProps(effectPayload)).toMatchObject({
      seq: 13,
      effect: {
        effectId: "agent-a:tool-1",
        actor: "agent",
        canonicalInput: { kind: "tile.close", placementId: "n1" },
        approvalId: "proposal-1",
        outcome: "performed",
      },
    });
    expect(traceAdapter.live.project({ type: "ui-event", name: TRACE_UI_EVENT, payload: effectPayload }, context)?.upsert).toEqual(
      traceAdapter.hydrate.project({ kind: TRACE_SNAPSHOT_KIND, id: "trace-13", payload: effectPayload }, context),
    );
  });

  test("agent actor, no target, rejected outcome", () => {
    const props = traceEntryProps({ seq: "3", actor: "ACTOR_AGENT", verb: { kind: "openInTile", widgetId: "w1" }, outcome: "rejected:no tile" });
    expect(props).toEqual({
      seq: 3,
      actor: "agent",
      verb: { kind: "openInTile", widgetId: "w1" },
      outcome: "rejected:no tile",
      at: "",
    });
  });

  test("tolerates loosely typed payloads (numeric seq and actor)", () => {
    const props = traceEntryProps({ seq: 7, actor: 2, verb: { kind: "watch" }, outcome: "performed", at: "2026-01-01T00:00:00Z" });
    expect(props).toMatchObject({ seq: 7, actor: "agent", verb: { kind: "watch" } });
  });

  test("ignores other frames and entities", () => {
    expect(traceAdapter.live.accepts({ name: "ChatTextPatch" })).toBe(false);
    expect(traceAdapter.live.accepts({ name: TRACE_UI_EVENT })).toBe(true);
    expect(traceAdapter.hydrate.project({ kind: "ChatMessage", id: "m1", payload: {} }, context)).toBeNull();
    expect(traceEntryProps({ actor: "ACTOR_HUMAN" })).toEqual(expect.objectContaining({ seq: 0 }));
    expect(traceEntryProps("nope")).toBeNull();
  });
});
