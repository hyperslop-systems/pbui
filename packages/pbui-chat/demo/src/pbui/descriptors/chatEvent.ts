import { conversationRecord } from "../conversationFacts";
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
    conversation: ref.value ? (conversationRecord(ref.value.conversationId)?.title ?? ref.value.conversationId) : undefined,
  }),

};
