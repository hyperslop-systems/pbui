import type { IdGenerator } from "@hyperslop-systems/workbench-protocol/client";

/**
 * Deterministic ids for tests and goldens: `v-00000001-0000`, the same
 * thirteen-character shape `newId` cuts from a UUID, so a fixture built under
 * this generator and one built under the stubbed UUID of the Phase 0 goldens
 * read identically.
 */
export function sequentialIds(start = 1): IdGenerator {
  let next = start;
  return (prefix) => `${prefix}-${String(next++).padStart(8, "0")}-0000`;
}
