/**
 * The conversation-facts slot (PBUI-ACTIONS-2 P6).
 *
 * Neither `actions.ts` nor any descriptor may (transitively) import
 * `chat.ts`: the registry pulls every descriptor in, `chat.ts` pulls the
 * runtime in, and the runtime pulls the registry and actions in — so a
 * descriptor→chat edge closes a cycle in which `createPbui` is called with a
 * partially evaluated module and the provider dies before first render (it
 * did, the moment a test entered the graph through `./actions`). This
 * dependency-light slot breaks every such edge: `chat.ts` REGISTERS its
 * conversation registry here at startup; descriptors and the snapshot
 * builder read through the slot at call time. Before registration a
 * conversation reads as unknown, which resolves to the honest
 * "not in this browser's list" reasons rather than a crash.
 */

export interface ConversationRecordLike {
  title: string;
  titledBy?: string;
  open: boolean;
  active: boolean;
  pinned: boolean;
  archived: boolean;
  waiting: number;
  messageCount?: number;
  lastActivityAt?: string;
  runStatus?: string;
  wsStatus?: string;
  model?: string | null;
  stats?: { totals?: unknown; completedRuns?: unknown } | null;
}

let source: { get(id: string): ConversationRecordLike | null | undefined } | null = null;

export function registerConversationSource(
  next: { get(id: string): ConversationRecordLike | null | undefined },
): void {
  source = next;
}

/** The full record for labels and describe; null before registration or for unknown ids. */
export function conversationRecord(id: string): ConversationRecordLike | null {
  return source?.get(id) ?? null;
}
