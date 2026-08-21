import type { DispatchIntent, VerbLike } from "../contracts";
import { DEFAULT_LIMITS, type SandboxLimits } from "../limits";

/**
 * Validation of what a handler emitted. Ported from vm-system
 * `frontend/packages/plugin-runtime/src/dispatchIntent.ts` (37bd440) with
 * the `verb` scope replacing `shared`. The host stamps `instanceId` itself
 * and never trusts a program's claim about who it is.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateDispatchIntent(value: unknown, instanceId: string): DispatchIntent {
  if (!isRecord(value)) throw new Error("Dispatch intent must be an object");

  if (value.scope === "plugin") {
    if (typeof value.actionType !== "string" || value.actionType.length === 0) {
      throw new Error("Dispatch intent actionType must be a non-empty string");
    }
    return { scope: "plugin", instanceId, actionType: value.actionType, payload: value.payload };
  }

  if (value.scope === "verb") {
    if (!isRecord(value.verb) || typeof value.verb.kind !== "string" || value.verb.kind.length === 0) {
      throw new Error("Verb intent needs a verb object with a non-empty string kind");
    }
    return { scope: "verb", instanceId, verb: value.verb as VerbLike };
  }

  throw new Error("Dispatch intent scope must be 'plugin' or 'verb'");
}

export function validateDispatchIntents(
  value: unknown,
  instanceId: string,
  limits: SandboxLimits = DEFAULT_LIMITS,
): DispatchIntent[] {
  if (!Array.isArray(value)) throw new Error("Dispatch intents result must be an array");
  if (value.length > limits.intentsPerEvent) {
    throw new Error(`a handler emitted ${value.length} intents, the limit is ${limits.intentsPerEvent}`);
  }
  return value.map((intent) => validateDispatchIntent(intent, instanceId));
}
