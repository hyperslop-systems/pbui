import { createChatApps } from "@hyperslop-systems/pbui-chat";
import { createWorkbench, layout, parseDocument, split, tile } from "@hyperslop-systems/pbui-workbench";
import { chat } from "./chat";

/**
 * The demo's tiles: the chat on the left (60%), and a right-hand column of
 * inspector over watchlist over trace. Persisted per browser; "reset layout"
 * returns to this.
 */
export const WORKBENCH_STORAGE_KEY = "pbui-chat-demo.workbench.v1";
/**
 * Which workspace THIS browser is looking at, kept out of the document on
 * purpose: it is not part of the layout (DATADROP-18 §1.4), and writing it
 * into the document would make two tabs fight over the selection. Without it
 * a reload silently returns to workspaces[0], which quietly abandons a
 * workspace the user — or the agent — just created and switched to.
 */
export const WORKSPACE_STORAGE_KEY = `${WORKBENCH_STORAGE_KEY}.workspace`;

export function defaultLayout() {
  return layout(
    split("row", 0.6, tile("chat"), split("col", 0.34, tile("inspector"), split("col", 0.5, tile("watchlist"), tile("trace")))),
    { id: "pbui-chat-demo", name: "Gold Coin Shop" },
  );
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export const workbench = createWorkbench({
  apps: createChatApps(chat),
  initial: parseDocument(storage()?.getItem(WORKBENCH_STORAGE_KEY)) ?? defaultLayout(),
  // The document is the only thing worth writing; onMutate fires once per
  // committed batch and never for activation or launcher state, so this is
  // one write per real change rather than one per store notification.
  onMutate: () => persistDocument(),
  onRejected: (_mutations, error) => {
    console.warn(`layout change refused: ${error.code} at ${error.path} — ${error.detail}`);
  },
});

// "Open in tile" now opens a widget tile beside the active one.
chat.attachWorkbench(workbench);

function persistDocument() {
  storage()?.setItem(WORKBENCH_STORAGE_KEY, workbench.serialize());
}

// The selected workspace is separate state with its own write, so switching
// tabs costs one small string rather than re-serialising the whole document.
let selected = workbench.store.getState().workspaceId;
workbench.store.subscribe(() => {
  const next = workbench.store.getState().workspaceId;
  if (next === selected) return;
  selected = next;
  storage()?.setItem(WORKSPACE_STORAGE_KEY, next);
});

// A workspace that is gone (a restored document from an older layout) makes
// this a no-op and the first workspace stays selected.
const restored = storage()?.getItem(WORKSPACE_STORAGE_KEY);
if (restored) workbench.verbs.selectWorkspace(restored);

export function resetLayout() {
  workbench.store.replaceDocument(defaultLayout());
  persistDocument();
  storage()?.removeItem(WORKSPACE_STORAGE_KEY);
}
