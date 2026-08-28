import { create } from "@bufbuild/protobuf";
import {
  DocumentPayloadSchema,
  MutationSchema,
  type Mutation,
  type WorkbenchDocument,
} from "@hyperslop-systems/workbench-protocol";
import { normalizeConfig, type RebalanceConfig } from "./config";

/**
 * The rebalance configuration rides IN the workbench document as a
 * `DocumentPayload` (design-doc/01 §4.5): it serializes, restores, and syncs
 * wherever the document does, and there is no second persistence mechanism.
 * A missing or foreign-format payload means "defaults", never an error, and a
 * stale schema is repaired field-by-field by `normalizeConfig`.
 */
export const REBALANCE_CONFIG_DOC_ID = "rebalance-config";
export const REBALANCE_CONFIG_FORMAT = "pbui.rebalance-config";
export const REBALANCE_CONFIG_SCHEMA_VERSION = 1;

export function readRebalanceConfig(doc: WorkbenchDocument): RebalanceConfig | null {
  const payload = doc.documents[REBALANCE_CONFIG_DOC_ID];
  if (!payload || payload.format !== REBALANCE_CONFIG_FORMAT) return null;
  const body = payload.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return normalizeConfig(body);
}

/** One `documentPut` that stores the whole config (idempotent overwrite). */
export function rebalanceConfigMutation(config: RebalanceConfig): Mutation {
  return create(MutationSchema, {
    body: {
      case: "documentPut",
      value: {
        document: create(DocumentPayloadSchema, {
          id: REBALANCE_CONFIG_DOC_ID,
          format: REBALANCE_CONFIG_FORMAT,
          schemaVersion: REBALANCE_CONFIG_SCHEMA_VERSION,
          // Struct bodies are JsonObjects; the config is JSON-safe by
          // construction (numbers, booleans, strings, one nullable number).
          body: JSON.parse(JSON.stringify(config)),
        }),
      },
    },
  });
}
