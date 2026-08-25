import type { JsonValue } from "@bufbuild/protobuf";

export type EffectScope = "workbench" | "sandbox" | "conversation" | "server";

export interface ApprovalSubject {
  version: 1;
  senderConversationId: string;
  operation: string;
  arguments: JsonValue;
  targetIds: string[];
  referenceKeys: string[];
  effectScope: EffectScope;
}

export interface ApprovalCapability {
  id: string;
  subjectDigest: string;
  issuedAt: string;
  expiresAt: string;
}

export type ApprovalConsumeResult = "consumed" | "already-used" | "mismatch" | "expired" | "not-found";

/** One shared authority for every consequential agent effect in a product. */
export interface ApprovalLedger {
  lookup(proposalId: string): Promise<ApprovalCapability | null>;
  consume(capability: ApprovalCapability, subject: ApprovalSubject, effectId: string): Promise<ApprovalConsumeResult>;
}

export interface ApprovalSubjectInput {
  senderConversationId: string;
  operation: string;
  arguments?: JsonValue;
  targetIds?: readonly string[];
  referenceKeys?: readonly string[];
  effectScope: EffectScope;
}

export function createApprovalSubject(input: ApprovalSubjectInput): ApprovalSubject {
  const senderConversationId = input.senderConversationId.trim();
  const operation = input.operation.trim();
  if (!senderConversationId) throw new Error("approval subject requires senderConversationId");
  if (!operation) throw new Error("approval subject requires operation");
  return {
    version: 1,
    senderConversationId,
    operation,
    arguments: normalizeJson(input.arguments ?? null),
    targetIds: sortedUnique(input.targetIds ?? []),
    referenceKeys: sortedUnique(input.referenceKeys ?? []),
    effectScope: input.effectScope,
  };
}

export async function digestApprovalSubject(subject: ApprovalSubject): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(subject as unknown as JsonValue));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Stable JSON used as approval authority: sorted keys, finite numbers, no undefined values. */
export function canonicalJson(value: JsonValue): string {
  return JSON.stringify(normalizeJson(value));
}

function normalizeJson(value: JsonValue | undefined): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("approval subject numbers must be finite");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((entry) => normalizeJson(entry));
  if (typeof value === "object") {
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      const entry = value[key];
      if (entry !== undefined) out[key] = normalizeJson(entry);
    }
    return out;
  }
  throw new Error("approval subject contains a non-JSON value");
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export interface InMemoryApprovalLedgerOptions {
  now?(): Date;
  ttlMs?: number;
  maxEntries?: number;
}

interface LedgerEntry {
  capability: ApprovalCapability;
  consumedBy: string | null;
}

/**
 * Durable products should implement ApprovalLedger on the server. This local
 * implementation exists for offline products and tests; one instance must be
 * shared across all factories to preserve global consume-once semantics.
 */
export class InMemoryApprovalLedger implements ApprovalLedger {
  readonly #entries = new Map<string, LedgerEntry>();
  readonly #now: () => Date;
  readonly #ttlMs: number;
  readonly #maxEntries: number;

  constructor(options: InMemoryApprovalLedgerOptions = {}) {
    this.#now = options.now ?? (() => new Date());
    this.#ttlMs = options.ttlMs ?? 5 * 60_000;
    this.#maxEntries = options.maxEntries ?? 1_000;
    if (this.#ttlMs <= 0 || this.#maxEntries <= 0) throw new Error("approval ledger limits must be positive");
  }

  async grant(proposalId: string, subject: ApprovalSubject): Promise<ApprovalCapability> {
    const id = proposalId.trim();
    if (!id) throw new Error("approval capability requires an id");
    this.#prune();
    const now = this.#now();
    const capability: ApprovalCapability = {
      id,
      subjectDigest: await digestApprovalSubject(subject),
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.#ttlMs).toISOString(),
    };
    const current = this.#entries.get(id);
    if (current && current.capability.subjectDigest !== capability.subjectDigest) {
      throw new Error(`approval capability ${id} is already bound to another subject`);
    }
    if (current?.consumedBy) throw new Error(`approval capability ${id} has already been used`);
    this.#entries.delete(id);
    this.#entries.set(id, { capability, consumedBy: null });
    this.#prune();
    return capability;
  }

  async lookup(proposalId: string): Promise<ApprovalCapability | null> {
    this.#prune();
    return this.#entries.get(proposalId)?.capability ?? null;
  }

  async consume(capability: ApprovalCapability, subject: ApprovalSubject, effectId: string): Promise<ApprovalConsumeResult> {
    const entry = this.#entries.get(capability.id);
    if (!entry || !sameCapability(entry.capability, capability)) return "not-found";
    if (Date.parse(entry.capability.expiresAt) <= this.#now().getTime()) return "expired";
    if (entry.consumedBy) return "already-used";
    if (entry.capability.subjectDigest !== (await digestApprovalSubject(subject))) return "mismatch";
    entry.consumedBy = effectId;
    return "consumed";
  }

  #prune(): void {
    const now = this.#now().getTime();
    for (const [id, entry] of this.#entries) {
      if (!entry.consumedBy && Date.parse(entry.capability.expiresAt) <= now) this.#entries.delete(id);
    }
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.#entries.delete(oldest);
    }
  }
}

function sameCapability(left: ApprovalCapability, right: ApprovalCapability): boolean {
  return (
    left.id === right.id &&
    left.subjectDigest === right.subjectDigest &&
    left.issuedAt === right.issuedAt &&
    left.expiresAt === right.expiresAt
  );
}

export async function consumeApproval(
  ledger: ApprovalLedger | undefined,
  proposalId: string,
  subject: ApprovalSubject,
  effectId: string,
): Promise<ApprovalConsumeResult> {
  if (!ledger) return "not-found";
  const capability = await ledger.lookup(proposalId);
  if (!capability) return "not-found";
  return ledger.consume(capability, subject, effectId);
}
