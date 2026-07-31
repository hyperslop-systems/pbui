import { createAction } from "@reduxjs/toolkit";
import type { Doc } from "./world";
import type { AppView, Node } from "./layout";

export interface RemoteOwnedWorkbenchState {
  id: string;
  name: string;
  workspaces: Array<{ id: string; name: string; tree: Node }>;
  views: Record<string, AppView>;
  viewOrder: string[];
  documents: Record<string, Doc>;
}

export interface RemoteWorkbenchLoadedPayload {
  state: RemoteOwnedWorkbenchState;
  stageId: string;
  preserveViewIds: string[];
  preserveDocumentIds: string[];
}

/**
 * One Redux action replaces every remotely owned workspace, view, and document.
 *
 * Both slices handle this action during the same root dispatch, so subscribers
 * never observe a layout whose document bindings refer to the previous world.
 */
export const remoteWorkbenchLoaded =
  createAction<RemoteWorkbenchLoadedPayload>("remote/workbenchLoaded");
