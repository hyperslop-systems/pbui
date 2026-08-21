/**
 * The document binding a `chat` tile carries: which conversation it shows.
 * Its own module so the app descriptors, the verbs and the layout migration
 * can share it without importing the registry.
 */
export const CONVERSATION_BINDING = "conversation";
