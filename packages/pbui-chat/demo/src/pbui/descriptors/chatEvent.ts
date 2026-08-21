import { chat } from "../../chat";
import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

/**
 * One line of a conversation's wire log, as an object.
 *
 * The events tile does not spell its actions out beside each row — the row
 * IS this object, and *inspect* is the door to the raw frame the summary was
 * made from. That is the whole point of classifying at ingest: the list shows
 * one line, and the object carries everything the line left out.
 */
export const chatEventDescriptor: PresentationDescriptor<"chatEvent"> = {
  ptype: "chatEvent",
  tone: TONES.chatEvent,

  label: (ref) => ref.value?.eventType ?? `event ${ref.id}`,

  describe: (ref) => ({
    presentationType: "chatEvent",
    id: ref.id,
    ...ref.value,
    conversation: ref.value ? (chat.conversations.get(ref.value.conversationId)?.title ?? ref.value.conversationId) : undefined,
  }),

  actions: (ref) => {
    const conversationId = ref.value?.conversationId ?? "";
    const known = conversationId ? chat.conversations.get(conversationId) : null;
    return [
      { label: "Inspect the raw frame", verb: { kind: "inspect", ref } },
      {
        label: "Go to its conversation",
        verb: { kind: "conversation.select", conversationId },
        ...(known ? (known.active ? { disabledBecause: "it is already the active conversation" } : {}) : { disabledBecause: "that conversation is not in this browser's list" }),
      },
      {
        label: "Ask the agent what it means",
        verb: { kind: "askAgent", template: "what does this event mean, and should I worry about it? {0}", refs: [ref] },
      },
    ];
  },
};
