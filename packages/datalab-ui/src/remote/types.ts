export const WORKBENCH_FORMAT = "pbui.workbench" as const;
export const WORKBENCH_SCHEMA_VERSION = 1 as const;

export type WorkbenchPersistence =
  | { kind: "memory" }
  | { kind: "local"; key: string }
  | { kind: "remote"; workbenchId: string };

/** The server's identity for the workbench: what the projection stamps on every wire document. */
export interface RemoteIdentity {
  id: string;
  name: string;
}
