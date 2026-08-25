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

export interface AgentEffectGatewayOptions {
  approvalLedger?: ApprovalLedger;
  report?(envelope: EffectEnvelope): Promise<void>;
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
  readonly #running = new Map<string, RunningEntry>();
  readonly #terminal = new Map<string, TerminalEntry>();
  readonly #pendingReports = new Map<string, EffectEnvelope>();

  constructor(options: AgentEffectGatewayOptions = {}) {
    this.#approvalLedger = options.approvalLedger;
    this.#reporter = options.report;
    this.#now = options.now ?? (() => new Date());
    this.#maxTerminalEntries = options.maxTerminalEntries ?? 1_000;
    this.#terminalTtlMs = options.terminalTtlMs ?? 30 * 60_000;
    if (this.#maxTerminalEntries <= 0 || this.#terminalTtlMs <= 0) {
      throw new Error("effect gateway retention limits must be positive");
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
    return recorded;
  }

  pendingReports(): readonly EffectEnvelope[] {
    return [...this.#pendingReports.values()];
  }

  async #executeOnce<Value>(request: NormalizedEffectRequest<Value>): Promise<AgentEffectResult<Value>> {
    await this.flushReports();
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
      return "recorded";
    } catch {
      this.#pendingReports.set(envelope.effectId, envelope);
      return "pending";
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

function approvalRejection(id: string, kind: string, result: string): string {
  if (result === "already-used" || result === "already-reserved") return `the approval "${id}" has already been used; ask again for this change`;
  if (result === "expired") return `the approval "${id}" has expired; ask again for this change`;
  return `no approved proposal with id "${id}" for ${kind}`;
}
