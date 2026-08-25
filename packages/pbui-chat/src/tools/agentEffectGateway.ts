import type { JsonValue } from "@bufbuild/protobuf";
import type { Actor, Outcome } from "../types";
import {
  canonicalJson,
  createApprovalSubject,
  digestCanonicalJson,
  type ApprovalCapability,
  type ApprovalLedger,
  type EffectScope,
} from "./approvalLedger";

export type EffectPolicy = "allow" | "confirm" | "deny";

export interface EffectEnvelope {
  effectId: string;
  invocationKey?: string;
  actor: Actor;
  conversationId: string | null;
  effectKind: string;
  effectScope: EffectScope;
  canonicalInput: JsonValue;
  inputDigest: string;
  targetIds: string[];
  referenceKeys: string[];
  approvalId?: string;
  beforeRevision?: string;
  afterRevision?: string;
  outcome: Outcome;
  occurredAt: string;
}

export interface EffectPerformResult<Value> {
  outcome: Outcome;
  value?: Value;
  afterRevision?: string;
}

export interface AgentEffectRequest<Value> {
  effectId: string;
  invocationKey?: string;
  actor: Actor;
  conversationId: string | null;
  effectKind: string;
  effectScope: EffectScope;
  input: JsonValue;
  targetIds?: readonly string[];
  referenceKeys?: readonly string[];
  policy: EffectPolicy;
  confirmationId?: string;
  deniedReason?: string;
  approvalPrompt?: string;
  approvalDescription?: string;
  approvalMismatchReason?: string;
  beforeRevision?: string;
  perform(): Promise<EffectPerformResult<Value>>;
}

export interface AgentEffectResult<Value> {
  outcome: Outcome;
  value?: Value;
  envelope: EffectEnvelope;
  trace: "recorded" | "pending";
  cached: boolean;
}

export interface EffectOutboxStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AgentEffectGatewayOptions {
  approvalLedger?: ApprovalLedger;
  report?(envelope: EffectEnvelope): Promise<void>;
  outboxStorage?: EffectOutboxStorage | null;
  outboxKey?: string;
  now?(): Date;
  maxTerminalEntries?: number;
  terminalTtlMs?: number;
}

interface TerminalEntry {
  fingerprint: string;
  completedAt: number;
  result: AgentEffectResult<unknown>;
}

interface RunningEntry {
  fingerprint: string;
  promise: Promise<AgentEffectResult<unknown>>;
}

export class EffectConflictError extends Error {
  constructor(effectId: string) {
    super(`effect ${effectId} was reused with different input`);
    this.name = "EffectConflictError";
  }
}

/**
 * The single execution seam for agent-caused product effects. It atomically
 * reserves exact approval authority, executes at most once per effect id,
 * finalizes or releases the reservation from the real outcome, and queues a
 * canonical trace envelope until the reporter durably accepts it.
 */
export class AgentEffectGateway {
  readonly #approvalLedger?: ApprovalLedger;
  readonly #reporter?: (envelope: EffectEnvelope) => Promise<void>;
  readonly #now: () => Date;
  readonly #maxTerminalEntries: number;
  readonly #terminalTtlMs: number;
  readonly #outboxStorage: EffectOutboxStorage | null;
  readonly #outboxKey: string;
  readonly #running = new Map<string, RunningEntry>();
  readonly #terminal = new Map<string, TerminalEntry>();
  readonly #pendingReports = new Map<string, EffectEnvelope>();
  #outboxError: Error | null = null;

  constructor(options: AgentEffectGatewayOptions = {}) {
    this.#approvalLedger = options.approvalLedger;
    this.#reporter = options.report;
    this.#now = options.now ?? (() => new Date());
    this.#maxTerminalEntries = options.maxTerminalEntries ?? 1_000;
    this.#terminalTtlMs = options.terminalTtlMs ?? 30 * 60_000;
    this.#outboxStorage = options.outboxStorage ?? null;
    this.#outboxKey = options.outboxKey ?? "pbui-chat.effect-outbox";
    if (this.#maxTerminalEntries <= 0 || this.#terminalTtlMs <= 0) {
      throw new Error("effect gateway retention limits must be positive");
    }
    this.#restoreOutbox();
    if (this.#pendingReports.size > this.#maxTerminalEntries) {
      throw new Error(`effect trace outbox has ${this.#pendingReports.size} entries, over the limit ${this.#maxTerminalEntries}`);
    }
  }

  async execute<Value>(request: AgentEffectRequest<Value>): Promise<AgentEffectResult<Value>> {
    const normalized = normalizeRequest(request);
    const fingerprint = await digestCanonicalJson({
      conversationId: normalized.conversationId,
      effectKind: normalized.effectKind,
      effectScope: normalized.effectScope,
      input: normalized.input,
      policy: normalized.policy,
      confirmationId: normalized.confirmationId ?? null,
      beforeRevision: normalized.beforeRevision ?? null,
    });
    this.#prune();

    const terminal = this.#terminal.get(normalized.effectId);
    if (terminal) {
      if (terminal.fingerprint !== fingerprint) throw new EffectConflictError(normalized.effectId);
      return { ...(terminal.result as AgentEffectResult<Value>), cached: true };
    }
    const running = this.#running.get(normalized.effectId);
    if (running) {
      if (running.fingerprint !== fingerprint) throw new EffectConflictError(normalized.effectId);
      const result = (await running.promise) as AgentEffectResult<Value>;
      return { ...result, cached: true };
    }

    const promise = this.#executeOnce(normalized).then((result) => {
      this.#running.delete(normalized.effectId);
      this.#terminal.set(normalized.effectId, {
        fingerprint,
        completedAt: this.#now().getTime(),
        result: result as AgentEffectResult<unknown>,
      });
      this.#prune();
      return result;
    }, (error: unknown) => {
      this.#running.delete(normalized.effectId);
      throw error;
    });
    this.#running.set(normalized.effectId, { fingerprint, promise: promise as Promise<AgentEffectResult<unknown>> });
    return promise;
  }

  async flushReports(): Promise<number> {
    if (!this.#reporter) return 0;
    let recorded = 0;
    for (const [effectId, envelope] of [...this.#pendingReports]) {
      try {
        await this.#reporter(envelope);
        this.#pendingReports.delete(effectId);
        this.#markTraceRecorded(effectId);
        recorded += 1;
      } catch {
        // Keep the envelope for the next explicit or opportunistic flush.
      }
    }
    this.#persistOutbox();
    return recorded;
  }

  pendingReports(): readonly EffectEnvelope[] {
    return [...this.#pendingReports.values()];
  }

  outboxError(): Error | null {
    return this.#outboxError;
  }

  async #executeOnce<Value>(request: NormalizedEffectRequest<Value>): Promise<AgentEffectResult<Value>> {
    await this.flushReports();
    if (this.#reporter && this.#pendingReports.size >= this.#maxTerminalEntries && !this.#pendingReports.has(request.effectId)) {
      throw new Error(`effect trace outbox is full (${this.#maxTerminalEntries}); refusing an untraceable effect`);
    }
    const inputDigest = await digestCanonicalJson(request.input);
    let capability: ApprovalCapability | null = null;
    let outcome: Outcome;
    let value: Value | undefined;
    let afterRevision: string | undefined;

    if (request.policy === "deny") {
      outcome = `rejected:${request.deniedReason ?? `${request.effectKind} is not something the assistant may do; ask the user to do it`}`;
    } else {
      if (request.policy === "confirm") {
        if (!request.confirmationId) {
          outcome = `rejected:${request.approvalPrompt ?? `${request.effectKind} needs the user's approval: call pbui_propose first and pass its id as confirmationId`}`;
          return this.#finish(request, inputDigest, outcome);
        }
        capability = (await this.#approvalLedger?.lookup(request.confirmationId)) ?? null;
        if (!capability || !this.#approvalLedger) {
          outcome = `rejected:${request.approvalMismatchReason ?? `no approved proposal with id "${request.confirmationId}" for ${request.approvalDescription ?? request.effectKind}`}`;
          return this.#finish(request, inputDigest, outcome);
        }
        const subject = createApprovalSubject({
          senderConversationId: request.conversationId ?? "server",
          operation: request.effectKind,
          arguments: request.input,
          targetIds: request.targetIds,
          referenceKeys: request.referenceKeys,
          effectScope: request.effectScope,
        });
        const reserved = await this.#approvalLedger.reserve(capability, subject, request.effectId);
        if (reserved !== "reserved" && reserved !== "already-reserved") {
          outcome = `rejected:${
            reserved === "mismatch" || reserved === "not-found"
              ? request.approvalMismatchReason ?? approvalRejection(request.confirmationId, request.approvalDescription ?? request.effectKind, reserved)
              : approvalRejection(request.confirmationId, request.approvalDescription ?? request.effectKind, reserved)
          }`;
          return this.#finish(request, inputDigest, outcome);
        }
      }

      try {
        const performed = await request.perform();
        outcome = performed.outcome;
        value = performed.value;
        afterRevision = performed.afterRevision;
      } catch (error) {
        outcome = `rejected:${error instanceof Error ? error.message : String(error)}`;
      }

      if (capability && this.#approvalLedger) {
        if (outcome === "performed") {
          const finalized = await this.#approvalLedger.finalize(capability, request.effectId);
          if (finalized !== "finalized" && finalized !== "already-finalized") {
            throw new Error(`effect ${request.effectId} performed but approval finalization returned ${finalized}`);
          }
        } else {
          const released = await this.#approvalLedger.release(capability, request.effectId);
          if (released !== "released" && released !== "already-available") {
            throw new Error(`effect ${request.effectId} was rejected but approval release returned ${released}`);
          }
        }
      }
    }

    return this.#finish(request, inputDigest, outcome, value, afterRevision);
  }

  async #finish<Value>(
    request: NormalizedEffectRequest<Value>,
    inputDigest: string,
    outcome: Outcome,
    value?: Value,
    afterRevision?: string,
  ): Promise<AgentEffectResult<Value>> {
    const envelope: EffectEnvelope = {
      effectId: request.effectId,
      ...(request.invocationKey ? { invocationKey: request.invocationKey } : {}),
      actor: request.actor,
      conversationId: request.conversationId,
      effectKind: request.effectKind,
      effectScope: request.effectScope,
      canonicalInput: request.input,
      inputDigest,
      targetIds: request.targetIds,
      referenceKeys: request.referenceKeys,
      ...(request.confirmationId ? { approvalId: request.confirmationId } : {}),
      ...(request.beforeRevision ? { beforeRevision: request.beforeRevision } : {}),
      ...(afterRevision ? { afterRevision } : {}),
      outcome,
      occurredAt: this.#now().toISOString(),
    };
    const trace = await this.#record(envelope);
    return { outcome, ...(value !== undefined ? { value } : {}), envelope, trace, cached: false };
  }

  async #record(envelope: EffectEnvelope): Promise<"recorded" | "pending"> {
    if (!this.#reporter) return "recorded";
    try {
      await this.#reporter(envelope);
      this.#pendingReports.delete(envelope.effectId);
      this.#persistOutbox();
      return "recorded";
    } catch {
      this.#pendingReports.set(envelope.effectId, envelope);
      this.#persistOutbox();
      return "pending";
    }
  }

  #restoreOutbox(): void {
    if (!this.#outboxStorage) return;
    const raw = this.#outboxStorage.getItem(this.#outboxKey);
    if (!raw) return;
    let values: unknown;
    try {
      values = JSON.parse(raw);
    } catch (error) {
      throw new Error(`effect trace outbox is corrupt: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!Array.isArray(values)) throw new Error("effect trace outbox is corrupt: expected an array");
    for (const value of values) {
      if (!isEffectEnvelope(value)) throw new Error("effect trace outbox contains an invalid envelope");
      this.#pendingReports.set(value.effectId, value);
    }
  }

  #persistOutbox(): void {
    if (!this.#outboxStorage) return;
    try {
      if (this.#pendingReports.size === 0) {
        this.#outboxStorage.removeItem(this.#outboxKey);
      } else {
        this.#outboxStorage.setItem(this.#outboxKey, JSON.stringify([...this.#pendingReports.values()]));
      }
      this.#outboxError = null;
    } catch (error) {
      this.#outboxError = error instanceof Error ? error : new Error(String(error));
    }
  }

  #markTraceRecorded(effectId: string): void {
    const terminal = this.#terminal.get(effectId);
    if (terminal) terminal.result = { ...terminal.result, trace: "recorded" };
  }

  #prune(): void {
    const cutoff = this.#now().getTime() - this.#terminalTtlMs;
    for (const [effectId, entry] of this.#terminal) {
      if (entry.completedAt <= cutoff) this.#terminal.delete(effectId);
    }
    while (this.#terminal.size > this.#maxTerminalEntries) {
      const oldest = this.#terminal.keys().next().value as string | undefined;
      if (!oldest) break;
      this.#terminal.delete(oldest);
    }
  }
}

type NormalizedEffectRequest<Value> = Omit<AgentEffectRequest<Value>, "effectId" | "effectKind" | "input" | "targetIds" | "referenceKeys"> & {
  effectId: string;
  effectKind: string;
  input: JsonValue;
  targetIds: string[];
  referenceKeys: string[];
};

function normalizeRequest<Value>(request: AgentEffectRequest<Value>): NormalizedEffectRequest<Value> {
  const effectId = request.effectId.trim();
  const effectKind = request.effectKind.trim();
  if (!effectId) throw new Error("agent effect requires effectId");
  if (!effectKind) throw new Error("agent effect requires effectKind");
  if (request.actor === "agent" && !request.conversationId) throw new Error("agent effect requires conversationId");
  // canonicalJson performs recursive validation before a side effect is possible.
  const input = JSON.parse(canonicalJson(request.input)) as JsonValue;
  return {
    ...request,
    effectId,
    effectKind,
    input,
    targetIds: [...new Set((request.targetIds ?? []).map((id) => id.trim()).filter(Boolean))].sort(),
    referenceKeys: [...new Set((request.referenceKeys ?? []).map((key) => key.trim()).filter(Boolean))].sort(),
  };
}

function isEffectEnvelope(value: unknown): value is EffectEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const envelope = value as Partial<EffectEnvelope>;
  return (
    typeof envelope.effectId === "string" &&
    typeof envelope.effectKind === "string" &&
    typeof envelope.inputDigest === "string" &&
    typeof envelope.conversationId === "string" &&
    (envelope.outcome === "performed" || (typeof envelope.outcome === "string" && envelope.outcome.startsWith("rejected:"))) &&
    typeof envelope.occurredAt === "string"
  );
}

function approvalRejection(id: string, kind: string, result: string): string {
  if (result === "already-used" || result === "already-reserved") return `the approval "${id}" has already been used; ask again for this change`;
  if (result === "expired") return `the approval "${id}" has expired; ask again for this change`;
  return `no approved proposal with id "${id}" for ${kind}`;
}
