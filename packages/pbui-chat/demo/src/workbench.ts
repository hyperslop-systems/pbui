import { CONVERSATION_BINDING, createChatApps, RefPresentation, type Reference } from "@hyperslop-systems/pbui-chat";
import { createSandboxDevtools, createScriptApp, type SandboxHost } from "@hyperslop-systems/pbui-sandbox";
import { createWorkbench, describeWorkbench, layout, parseDocument, split, tile } from "@hyperslop-systems/pbui-workbench";
import { createElement } from "react";
import { createDemoApps } from "./apps";
import { chat, LEGACY_SESSION_KEY, router } from "./chat";
import type { Verb } from "./pbui/verbs";
import { demoBindingChoices, engine, instances, library, programStates, resolveDemoBinding, seedLibrary, LIBRARY_STORAGE_KEY } from "./sandbox";

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

seedLibrary();

/**
 * Everything the sandbox's tiles need from this product, built once: the
 * script tile and every devtool take the same object (guide §4.2).
 */
export const sandboxHost: SandboxHost = {
  library,
  engine,
  states: programStates,
  instances,
  resolve: resolveDemoBinding,
  // A hook: the descriptor environment, so a program sees `canApprove` flip.
  useEnv: () => chat.pbui.usePbui().environment as unknown as Record<string, unknown>,
  // A click inside a generated tile is a HUMAN act on agent-written UI: the
  // verb goes through the router as the human's, validated against the
  // vocabulary and recorded in the trace like any chip.
  perform: (verb, { provenance }) => router.perform(verb as Verb, undefined, { actor: "human", provenance }),
  // A `ref` node is the product's own <Presentation>, menu and all.
  renderReference: (reference, label) =>
    createElement(RefPresentation, { reference: reference as Reference }, label || undefined),
  askAgent: (template, refs) => {
    void router.perform({ kind: "askAgent", template, refs: refs as Reference[] });
  },
  // The playground's binding picker: which products, metals, … exist.
  bindingChoices: demoBindingChoices,
};

/**
 * The one application every agent-written program runs in. Programs are
 * documents it is bound to, not applications of their own (guide D7).
 */
export const scriptApp = createScriptApp(sandboxHost);

/** The inspector, REPL, timeline, playground and source tiles — the same host object, so the script tile knows they exist. */
export const devtoolApps = createSandboxDevtools(sandboxHost, { playgroundKey: `${LIBRARY_STORAGE_KEY}.playground` });

export const workbench = createWorkbench({
  // The chat's own applications (conversation, inspector, watchlist, trace,
  // widget) plus the shop's four, plus the sandbox's one. All in one array
  // because the app registry refuses a duplicate id, so a name collision
  // between the agent's machinery and the product's tiles fails at startup
  // rather than showing whichever descriptor was registered last.
  apps: [...createChatApps(chat), ...createDemoApps(), scriptApp, ...devtoolApps],
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
// …and the sandbox_* tools are offered to the model from here on.
chat.attachSandbox(library, engine, instances);

/**
 * Make sure there is a conversation to show, and that every `chat` tile is
 * bound to one.
 *
 * Three cases. A browser that has run this build has records in storage and
 * a layout whose chat tiles already carry a `conversation` binding. A browser
 * returning from the one-session build has neither: it has the session id the
 * old `sessionPolicy` persisted, which becomes the first record and the
 * binding for its unbound chat tile — the transcript it left is the
 * transcript it comes back to. A fresh browser has nothing, so a session is
 * minted before anything renders a chat tile.
 *
 * Awaited by `main.tsx` before the first render, so no tile ever paints the
 * "not bound to a conversation" state on a normal boot.
 */
export const conversationsReady = bootstrapConversations();

async function bootstrapConversations(): Promise<string | null> {
  const conversations = chat.conversations;
  const legacy = storage()?.getItem(LEGACY_SESSION_KEY)?.trim();
  if (legacy) {
    conversations.adopt(legacy);
    // Migrated once. Leaving it would resurrect the same conversation as a
    // duplicate record the next time storage is cleared by hand.
    storage()?.removeItem(LEGACY_SESSION_KEY);
  }

  let id = conversations.activeId() ?? conversations.all().find((snapshot) => !snapshot.archived)?.id ?? null;
  if (!id) {
    try {
      id = (await conversations.create({ open: false, activate: false })).id;
    } catch (error) {
      console.warn("pbui-chat-demo: could not start a conversation", error);
      return null;
    }
  }
  conversations.open(id);
  conversations.activate(id);
  bindLooseChatTiles(id);
  return id;
}

/** Bind every `chat` tile a saved layout left without a conversation. */
function bindLooseChatTiles(conversationId: string) {
  for (const workspace of describeWorkbench(workbench).workspaces) {
    for (const chatTile of workspace.tiles) {
      if (chatTile.appId !== "chat") continue;
      if (chatTile.documents[CONVERSATION_BINDING]) continue;
      workbench.verbs.rebind(chatTile.viewId, { [CONVERSATION_BINDING]: conversationId });
    }
  }
}

/*
 * The conversation half of the demo's console door
 * (`__pbuiDemo.conversations.create()`), so a reviewer — or a browser test —
 * can open a second agent without a launcher row. Phase 1 gives it a button.
 */
if (typeof window !== "undefined") {
  const demo = (window as unknown as { __pbuiDemo?: Record<string, unknown> }).__pbuiDemo ?? {};
  demo.conversations = chat.conversations;
  demo.workbench = workbench;
  (window as unknown as { __pbuiDemo?: Record<string, unknown> }).__pbuiDemo = demo;
}

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
  // The default layout's chat tile carries no binding; without this, "reset
  // layout" would leave the user looking at an unbound tile.
  const active = chat.conversations.activeId();
  if (active) bindLooseChatTiles(active);
  persistDocument();
  storage()?.removeItem(WORKSPACE_STORAGE_KEY);
}
