import { CONVERSATION_BINDING, createChatApps, createConversationApps, RefPresentation, type Reference } from "@hyperslop-systems/pbui-chat";
import { createSandboxDevtools, createScriptApp, type SandboxHost } from "@hyperslop-systems/pbui-sandbox";
import {
  createLocalPersistence,
  createWorkbench,
  describeWorkbench,
  layout,
  rebalanceSettingsApp,
  readWorkbenchSnapshot,
  split,
  tile,
} from "@hyperslop-systems/pbui-workbench";
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

export function defaultLayout() {
  return layout(
    split("row", 0.6, tile("chat"), split("col", 0.34, tile("inspector"), split("col", 0.5, tile("watchlist"), tile("trace")))),
    { id: "pbui-chat-demo", name: "Gold Coin Shop" },
  );
}

/**
 * The layout as this browser last left it: the document AND the workspace it
 * was looking at, which is deliberately not part of the document (a workspace
 * pointer in the layout would make two tabs fight over the selection,
 * DATADROP-18 §1.4).
 *
 * Read BEFORE the workbench is built, so a reload renders the restored layout
 * once instead of the default layout followed by the restored one.
 */
const stored = readWorkbenchSnapshot(WORKBENCH_STORAGE_KEY, {
  // Builds before PBUI-WORKBENCH-2 §5.F wrote the bare document under this
  // key. It arrives as version 0 and the wrap is the whole migration.
  migrate: (payload, from) => (from === 0 ? { version: 1, document: payload } : null),
});

/** Still needed for the legacy session key below; the layout no longer uses it. */
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
  apps: [...createChatApps(chat), ...createConversationApps(chat), ...createDemoApps(), scriptApp, ...devtoolApps, rebalanceSettingsApp],
  initial: stored?.document ?? defaultLayout(),
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
  demo.router = router;
  demo.vocabulary = chat.vocabulary;
  (window as unknown as { __pbuiDemo?: Record<string, unknown> }).__pbuiDemo = demo;
}

// A workspace that is gone (a restored document from an older layout) makes
// this a no-op and the first workspace stays selected.
if (stored?.workspaceId) workbench.verbs.selectWorkspace(stored.workspaceId);

/**
 * One writer for the document and the workspace pointer alike (§5.F). It
 * subscribes to the store rather than to `onMutate`, which is what makes
 * `resetLayout` below a one-liner: `replaceDocument` never reaches
 * `onMutate`, and the hand-written version had to remember to write after it.
 */
export const persistence = createLocalPersistence(workbench, { key: WORKBENCH_STORAGE_KEY });

export function resetLayout() {
  // `reset(factory)`, not `reset()`: `initial` is the STORED layout after a
  // reload, so a plain reset would restore the one the user is escaping.
  workbench.reset(defaultLayout);
  // The default layout's chat tile carries no binding; without this, "reset
  // layout" would leave the user looking at an unbound tile.
  const active = chat.conversations.activeId();
  if (active) bindLooseChatTiles(active);
  persistence.flush();
}
