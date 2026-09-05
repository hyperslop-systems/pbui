import { createAction } from "@reduxjs/toolkit";
import type { Doc } from "./world";

export interface RemoteWorkbenchLoadedPayload {
  /** The full graphic documents the server sent. */
  documents: Record<string, Doc>;
  /** World documents that belong to local-only stages and survive the replacement. */
  preserveDocumentIds: string[];
}

/**
 * One Redux action replaces every remotely owned WORLD document.
 *
 * The spatial half of an adoption — workspaces, views, stubs — is installed
 * in the workbench core by `replaceDocument`, and navigation by
 * `replaceNavigation`; this is the world's share, dispatched FIRST so no view
 * that arrives with the core's install references a document the world lacks
 * (design §14.3).
 */
export const remoteWorkbenchLoaded =
  createAction<RemoteWorkbenchLoadedPayload>("remote/workbenchLoaded");
