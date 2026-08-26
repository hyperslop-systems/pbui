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

};
