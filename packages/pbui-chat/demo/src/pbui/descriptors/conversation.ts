import { chat } from "../../chat";
import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

/**
 * A conversation, as an object: what the agent mentions as
 * `[[conversation:…|reorder desk]]` and what a chat tile's title is.
 *
 * The menu is where the handoff lives. *Send this to that agent* is
 * `conversation.send`, whose target is a conversation OTHER than the one the
 * verb was performed in — the only verb in the shop with that shape, and the
 * reason the router's `sendToAgent` takes a target.
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
    const missing = snapshot ? undefined : "this conversation is not in this browser's list";
    return [
      {
        label: "Open in a tile",
        verb: { kind: "conversation.open", conversationId: ref.id },
        ...(missing ? { disabledBecause: missing } : {}),
      },
      {
        label: "Make it the active one",
        verb: { kind: "conversation.select", conversationId: ref.id },
        ...(missing ? { disabledBecause: missing } : snapshot?.active ? { disabledBecause: "it is already the active conversation" } : {}),
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
    ];
  },
};
