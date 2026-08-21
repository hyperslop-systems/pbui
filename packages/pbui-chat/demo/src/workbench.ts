import { createChatApps, RefPresentation, type Reference } from "@hyperslop-systems/pbui-chat";
import { createSandboxDevtools, createScriptApp, type SandboxHost } from "@hyperslop-systems/pbui-sandbox";
import { createWorkbench, layout, parseDocument, split, tile } from "@hyperslop-systems/pbui-workbench";
import { createElement } from "react";
import { createDemoApps } from "./apps";
import { chat, router } from "./chat";
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
chat.attachSandbox(library, engine);

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
