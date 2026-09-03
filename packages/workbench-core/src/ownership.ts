import { clone, type DescMessage, type MessageShape } from "@bufbuild/protobuf";
import type { WorkbenchIndex } from "./graph";

/**
 * Owned state (design doc 04 §6.5, Decision C). The core clones every
 * document at ingress, so a caller keeping a reference to what it passed in
 * cannot change the core's state under an unchanged revision; and in
 * development it deep-freezes what it exposes, so a caller that mutates
 * `getState().document` fails at the assignment instead of corrupting the
 * document silently. Production trusts callers (no freeze cost per install)
 * unless `ownership: "freeze"` is set; `core.snapshot()` is the safe door
 * for an integration that wants a document of its own to write on.
 */
export type OwnershipMode = "freeze" | "trust";

export function defaultOwnership(): OwnershipMode {
  try {
    const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV;
    return env === "production" ? "trust" : "freeze";
  } catch {
    return "trust";
  }
}

export function own<Desc extends DescMessage>(schema: Desc, message: MessageShape<Desc>): MessageShape<Desc> {
  return clone(schema, message);
}

/** Freeze a value and everything reachable from it (plain objects and arrays; protobuf messages are plain). Idempotent. */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) deepFreeze((value as Record<string, unknown>)[key]);
  return value;
}

const REFUSE = (what: string) => () => {
  throw new TypeError(`workbench-core: the index is read-only; ${what} is not allowed (change the document through the core)`);
};

/** Make the index's maps refuse writes; the type already says `ReadonlyMap`, this makes the instance agree. */
export function readonlyIndex(index: WorkbenchIndex): WorkbenchIndex {
  for (const value of Object.values(index)) {
    if (value instanceof Map && !Object.isFrozen(value)) {
      Object.defineProperties(value, {
        set: { value: REFUSE("set") },
        delete: { value: REFUSE("delete") },
        clear: { value: REFUSE("clear") },
      });
      Object.freeze(value);
    }
  }
  return Object.freeze(index);
}
