import type { ChatClient, ChatStore, ToolRegistry } from "@go-go-golems/chat-provider";
import type { ChatRuntimeContextValue } from "./providerTypes";

/**
 * A chat runtime as a value the conversation registry can hold (guide §4.1).
 *
 * The design called for a `createChatRuntime` factory built from the pieces
 * chat-provider exports. It cannot be written that way: `createChatClient`
 * requires a `ToolRuntime`, and `createToolRuntime` is not reachable through
 * any of the package's export paths (`.`, `/core`, `/store`, `/tools`,
 * `/widgets`, `/ws`, `/debug`) in 0.5.0 — nor are the `parseToolInput` /
 * `parseToolResult` helpers it is built on, so vendoring it would mean
 * vendoring the registry's validation too.
 *
 * So a runtime is CAPTURED rather than constructed: `ConversationHost`
 * renders one `<ChatProvider>` per open conversation — outside every tile, so
 * its lifetime is the conversation's, not a tile's — and a capture component
 * inside it reports the runtime graph to the registry. Everything else in the
 * design is unchanged: the registry owns the runtimes, mirrors their stores,
 * and `ChatRuntimeScope` re-provides one to a tile's subtree.
 *
 * What the design wanted from the factory is preserved:
 *
 * - the session id is dispatched into the overlay before `connect()`, so
 *   `ensureSession` returns it rather than consulting the URL, local storage
 *   or `POST /sessions` (the registry mints sessions);
 * - `onDebugEvent` goes to the shared debug store under that id;
 * - the extensions and `sendMessageBody` are built FOR the session, so a
 *   tool's `execute` and a queued mention both know which conversation they
 *   belong to.
 */
export interface ChatRuntime {
  sessionId: string;
  store: ChatStore;
  client: ChatClient;
  /** What `ChatRuntimeContext.Provider` receives; re-provided by `ChatRuntimeScope`. */
  context: ChatRuntimeContextValue;
  toolRegistry: ToolRegistry;
  toolRuntime: ChatRuntimeContextValue["toolRuntime"];
  /** The manifest this runtime last advertised, for the agent-context tile. */
  lastManifest: ManifestRecord | null;
  /** The last body this runtime put on the wire, for the agent-context tile. */
  lastSend: SendRecord | null;
  /** Advertise the current manifest and remember it. */
  syncManifest(): Promise<void>;
}

export interface ManifestRecord {
  at: string;
  revision: number;
  tools: ReturnType<ToolRegistry["manifest"]>;
}

export interface SendRecord {
  at: string;
  prompt: string;
  body: Record<string, unknown>;
}

/** Build the runtime value around a captured chat-provider graph. */
export function chatRuntimeOf(args: {
  sessionId: string;
  store: ChatStore;
  context: ChatRuntimeContextValue;
  now(): string;
}): ChatRuntime {
  const runtime: ChatRuntime = {
    sessionId: args.sessionId,
    store: args.store,
    client: args.context.client,
    context: args.context,
    toolRegistry: args.context.toolRegistry,
    toolRuntime: args.context.toolRuntime,
    lastManifest: null,
    lastSend: null,
    async syncManifest() {
      await args.context.client.tools.syncManifest();
      runtime.lastManifest = {
        at: args.now(),
        revision: args.context.toolRegistry.revision(),
        tools: args.context.toolRegistry.manifest(),
      };
    },
  };
  return runtime;
}
