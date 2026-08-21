import { chat } from "../../chat";
import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

/**
 * A conversation, as an object: what the agent mentions as
 * `[[conversation:…|reorder desk]]`, what a chat tile's title is, and what a
 * row of the conversations list IS.
 *
 * Every action lives here, which is the point. The conversations tile does
 * not lay its actions out as buttons beside each row — it renders the
 * conversation and lets this menu be the one door to what can be done to it.
 * That is why `conversation.pin`, `.archive`, `.close` and `.forget` are
 * verbs even though they only change this browser's list: an entry in an
 * object menu is a verb or it is nothing.
 *
 * The registry is read at describe/actions time rather than carried in the
 * value, so a mention the agent made ten messages ago still shows what is
 * true now: whether it is open, how many messages it has, whether it is the
 * active one.
 */
export const conversationDescriptor: PresentationDescriptor<"conversation"> = {
  ptype: "conversation",
  tone: TONES.conversation,

  label: (ref) => chat.conversations.get(ref.id)?.title ?? ref.value?.title ?? `conversation ${ref.id.slice(0, 8)}`,

  describe: (ref) => {
    const snapshot = chat.conversations.get(ref.id);
    return {
      presentationType: "conversation",
      id: ref.id,
      ...ref.value,
      ...(snapshot
        ? {
            title: snapshot.title,
            titledBy: snapshot.titledBy,
            open: snapshot.open,
            active: snapshot.active,
            pinned: snapshot.pinned,
            archived: snapshot.archived,
            messages: snapshot.messageCount,
            lastActivityAt: snapshot.lastActivityAt,
            status: snapshot.runStatus,
            connection: snapshot.wsStatus,
            waitingForYou: snapshot.waiting,
            ...(snapshot.model ? { model: snapshot.model } : {}),
            ...(snapshot.stats ? { tokens: snapshot.stats.totals, runs: snapshot.stats.completedRuns } : {}),
          }
        : { missing: "not in this browser's list" }),
    };
  },

  actions: (ref) => {
    const snapshot = chat.conversations.get(ref.id);
    // Every entry stays in the menu when it cannot be performed, with the
    // reason. A menu that silently drops entries teaches the user that the
    // menu is unreliable.
    const missing = snapshot ? undefined : "this conversation is not in this browser's list";
    return [
      {
        label: "Open in a tile",
        verb: { kind: "conversation.open", conversationId: ref.id },
        ...(missing ? { disabledBecause: missing } : {}),
      },
      {
        label: "Make it the active one",
        description: "the trace, the events and the other singleton tiles follow it",
        verb: { kind: "conversation.select", conversationId: ref.id },
        ...(missing ? { disabledBecause: missing } : snapshot?.active ? { disabledBecause: "it is already the active conversation" } : {}),
      },
      {
        // No title: the verb asks for the editor rather than carrying a name
        // the menu has no way to collect.
        label: "Rename…",
        verb: { kind: "conversation.rename", conversationId: ref.id },
        ...(missing ? { disabledBecause: missing } : {}),
      },
      {
        label: snapshot?.pinned ? "Stop keeping it at the top" : "Keep it at the top",
        verb: { kind: "conversation.pin", conversationId: ref.id, pinned: !snapshot?.pinned },
        ...(missing ? { disabledBecause: missing } : {}),
      },
      {
        label: snapshot?.archived ? "Bring it back" : "Archive it",
        description: "out of the way; the transcript stays",
        verb: { kind: "conversation.archive", conversationId: ref.id, archived: !snapshot?.archived },
        ...(missing ? { disabledBecause: missing } : {}),
      },
      {
        label: "Disconnect it",
        description: "closes the socket; the record and the server's session stay",
        verb: { kind: "conversation.close", conversationId: ref.id },
        ...(missing ? { disabledBecause: missing } : snapshot?.open ? {} : { disabledBecause: "it is already disconnected" }),
      },
      {
        label: snapshot && snapshot.waiting > 0 ? `Show what is waiting · ${snapshot.waiting}` : "Show what is waiting",
        description: "the tools tile, where a parked tool can be answered",
        verb: { kind: "view.open", appId: "chat-tools", documents: {} as Record<string, string> },
        ...(snapshot && snapshot.waiting > 0 ? {} : { disabledBecause: "nothing is waiting in this conversation" }),
      },
      {
        label: "Show what it was told",
        description: "its tools, the last message it sent, its environment",
        verb: { kind: "view.open", appId: "conversation-context", documents: { conversation: ref.id } },
        ...(missing ? { disabledBecause: missing } : {}),
      },
      { label: "Inspect", verb: { kind: "inspect", ref } },
      {
        label: "Hand something to this agent…",
        description: "sends a message to that conversation rather than this one",
        verb: { kind: "conversation.send", conversationId: ref.id, template: "please take a look at this: " },
        ...(missing ? { disabledBecause: missing } : snapshot?.open ? {} : { disabledBecause: "it is closed; open it first" }),
      },
      {
        label: "Ask about it",
        verb: { kind: "askAgent", template: "what is the conversation {0} about?", refs: [ref] },
      },
      {
        label: "Drop it from the list",
        description: "this browser forgets it; the server keeps the session",
        danger: true,
        verb: { kind: "conversation.forget", conversationId: ref.id },
        ...(missing ? { disabledBecause: missing } : {}),
      },
    ];
  },
};
