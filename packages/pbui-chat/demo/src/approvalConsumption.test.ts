import { describe, expect, test } from "vitest";
import {
  ConsumedApprovalStore,
  CONSUMED_APPROVALS_STORAGE_KEY,
  type ApprovalConsumptionStorage,
} from "./approvalConsumption";

class MemoryStorage implements ApprovalConsumptionStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("ConsumedApprovalStore", () => {
  test("a newly created ledger observes approval consumption from before reload", () => {
    const storage = new MemoryStorage();
    const beforeReload = new ConsumedApprovalStore(storage);
    beforeReload.add("proposal-1");

    const afterReload = new ConsumedApprovalStore(storage);
    expect(afterReload.has("proposal-1")).toBe(true);
    expect(JSON.parse(storage.getItem(CONSUMED_APPROVALS_STORAGE_KEY)!)).toEqual(["proposal-1"]);
  });

  test("merges consumption from concurrent ledger instances", () => {
    const storage = new MemoryStorage();
    const first = new ConsumedApprovalStore(storage);
    const second = new ConsumedApprovalStore(storage);

    first.add("proposal-1");
    second.add("proposal-2");

    expect(new ConsumedApprovalStore(storage).has("proposal-1")).toBe(true);
    expect(new ConsumedApprovalStore(storage).has("proposal-2")).toBe(true);
  });

  test("keeps enforcing in-memory consumption when persisted data is malformed", () => {
    const storage = new MemoryStorage();
    storage.setItem(CONSUMED_APPROVALS_STORAGE_KEY, "not-json");
    const store = new ConsumedApprovalStore(storage);

    store.add("proposal-safe");
    expect(store.has("proposal-safe")).toBe(true);
  });
});
