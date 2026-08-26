export interface ApprovalConsumptionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const CONSUMED_APPROVALS_STORAGE_KEY = "pbui-chat-demo:consumed-approval-ids:v1";

/**
 * Durable single-use marker for the demo approval ledger.
 *
 * The timeline proves what the user approved; this store records that the
 * capability has already been spent. Keeping the two concerns separate lets
 * a newly created demo ledger reject reuse after a page reload.
 */
export class ConsumedApprovalStore {
  private readonly inMemory = new Set<string>();

  constructor(
    private readonly storage: ApprovalConsumptionStorage | null =
      typeof window === "undefined" ? null : window.localStorage,
  ) {}

  has(id: string): boolean {
    return this.read().has(id);
  }

  add(id: string): void {
    this.inMemory.add(id);
    if (!this.storage) return;
    this.storage.setItem(CONSUMED_APPROVALS_STORAGE_KEY, JSON.stringify([...this.read()].sort()));
  }

  private read(): Set<string> {
    if (!this.storage) return new Set(this.inMemory);
    try {
      const decoded: unknown = JSON.parse(this.storage.getItem(CONSUMED_APPROVALS_STORAGE_KEY) ?? "[]");
      if (!Array.isArray(decoded)) return new Set(this.inMemory);
      return new Set([...this.inMemory, ...decoded.filter((value): value is string => typeof value === "string")]);
    } catch {
      return new Set(this.inMemory);
    }
  }
}
