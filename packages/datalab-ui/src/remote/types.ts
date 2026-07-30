import type { GraphicDocument } from "../model/graphic";
import type { AppView, Node } from "../store/layout";

export const WORKBENCH_FORMAT = "pbui.workbench" as const;
export const WORKBENCH_SCHEMA_VERSION = 1 as const;

export type WorkbenchPersistence =
  | { kind: "memory" }
  | { kind: "local"; key: string }
  | { kind: "remote"; workbenchId: string };

export interface RemoteWorkspace {
  id: string;
  name: string;
  tree: Node;
}

export interface RemoteWorkbenchState {
  id: string;
  name: string;
  workspaces: RemoteWorkspace[];
  views: Record<string, AppView>;
  viewOrder: string[];
  documents: Record<string, GraphicDocument>;
}
