import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import {
  ListWorkbenchesResponseSchema,
  type WorkbenchDocument,
  type WorkbenchResource,
  WorkbenchResourceSchema,
  type WorkbenchUpdatedEvent,
  WorkbenchUpdatedEventSchema,
} from "@hyperslop-systems/workbench-protocol";

/**
 * Serializable projection of the generated resource.
 *
 * Generated uint64 fields are bigint and generated timestamps contain bigint
 * seconds. Neither belongs in RTK Query's Redux cache. Keep exact revisions as
 * decimal strings at this boundary and convert them to bigint only inside the
 * remote-workbench controller.
 */
export interface CachedWorkbenchResource {
  workbench?: WorkbenchDocument;
  revision: string;
  createdAt: string;
  updatedAt: string;
}

export interface CachedWorkbenchSummary {
  id: string;
  name: string;
  revision: string;
  updatedAt: string;
}

export interface CachedWorkbenchList {
  workbenches: CachedWorkbenchSummary[];
}

function checkedJSON(value: unknown, path: string): JsonValue {
  let encoded: string | undefined;
  try {
    encoded = JSON.stringify(value);
  } catch (error) {
    throw new Error(`${path} is not JSON-serializable`, { cause: error });
  }
  if (encoded === undefined) throw new Error(`${path} is not a JSON value`);
  return JSON.parse(encoded) as JsonValue;
}

export function parseWorkbenchResourceJSON(value: unknown): CachedWorkbenchResource {
  const resource = fromJson(WorkbenchResourceSchema, checkedJSON(value, "workbench resource"), {
    ignoreUnknownFields: false,
  });
  return cacheableResource(resource, value);
}

export function parseWorkbenchListJSON(value: unknown): CachedWorkbenchList {
  const json = checkedJSON(value, "workbench list");
  const list = fromJson(ListWorkbenchesResponseSchema, json, {
    ignoreUnknownFields: false,
  });
  const raw = json as { workbenches?: Array<{ updatedAt?: unknown }> };
  return {
    workbenches: list.workbenches.map((summary, index) => ({
      id: summary.id,
      name: summary.name,
      revision: summary.revision.toString(),
      updatedAt: stringField(raw.workbenches?.[index]?.updatedAt),
    })),
  };
}

export function parseWorkbenchUpdatedEventJSON(value: unknown): WorkbenchUpdatedEvent {
  return fromJson(WorkbenchUpdatedEventSchema, checkedJSON(value, "workbench event"), {
    ignoreUnknownFields: false,
  });
}

function cacheableResource(resource: WorkbenchResource, value: unknown): CachedWorkbenchResource {
  const raw = value as { createdAt?: unknown; updatedAt?: unknown };
  return {
    workbench: resource.workbench,
    revision: resource.revision.toString(),
    createdAt: stringField(raw.createdAt),
    updatedAt: stringField(raw.updatedAt),
  };
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}
