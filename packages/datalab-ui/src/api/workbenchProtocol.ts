import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import {
  ListWorkbenchesResponseSchema,
  type WorkbenchResource,
  WorkbenchResourceSchema,
  type WorkbenchUpdatedEvent,
  WorkbenchUpdatedEventSchema,
} from "@hyperslop-systems/workbench-protocol";

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

export function parseWorkbenchResourceJSON(value: unknown): WorkbenchResource {
  return fromJson(WorkbenchResourceSchema, checkedJSON(value, "workbench resource"), {
    ignoreUnknownFields: false,
  });
}

export function parseWorkbenchListJSON(value: unknown) {
  return fromJson(ListWorkbenchesResponseSchema, checkedJSON(value, "workbench list"), {
    ignoreUnknownFields: false,
  });
}

export function parseWorkbenchUpdatedEventJSON(value: unknown): WorkbenchUpdatedEvent {
  return fromJson(WorkbenchUpdatedEventSchema, checkedJSON(value, "workbench event"), {
    ignoreUnknownFields: false,
  });
}
