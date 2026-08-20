import { createChatApps } from "@hyperslop-systems/pbui-chat";
import { createWorkbench, layout, parseDocument, split, tile } from "@hyperslop-systems/pbui-workbench";
import { chat } from "./chat";

/**
 * The demo's tiles: the chat on the left (60%), and a right-hand column of
 * inspector over watchlist over trace. Persisted per browser; "reset layout"
 * returns to this.
 */
export const WORKBENCH_STORAGE_KEY = "pbui-chat-demo.workbench.v1";

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
});

// "Open in tile" now opens a widget tile beside the active one.
chat.attachWorkbench(workbench);

// Persist the DOCUMENT, not the transient state: one write per committed
// batch, nothing on activation or launcher open/close.
let persisted = workbench.store.getState().document;
workbench.store.subscribe(() => {
  const { document } = workbench.store.getState();
  if (document === persisted) return;
  persisted = document;
  storage()?.setItem(WORKBENCH_STORAGE_KEY, workbench.serialize());
});

export function resetLayout() {
  workbench.store.replaceDocument(defaultLayout());
}
