import type { useChatRuntime } from "@go-go-golems/chat-provider/core";

/**
 * What `ChatRuntimeContext.Provider` carries: the client, the tool runtime,
 * the tool registry, the widget registry and the adapter registry.
 *
 * chat-provider 0.5.0 exports the context and the hook but not the type, so
 * it is recovered from the hook rather than re-declared — a re-declaration
 * would silently drift the day the package adds a field.
 */
export type ChatRuntimeContextValue = ReturnType<typeof useChatRuntime>;
