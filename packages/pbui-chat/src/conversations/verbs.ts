import type { Workbench } from "@hyperslop-systems/pbui-workbench";
import { z } from "zod";
import type { Actor, Reference, VerbLike } from "../types";
import type { VerbDocs } from "../vocabulary/defineVocabulary";
import { ReferenceSchema } from "../vocabulary/schemas";
import { CONVERSATION_BINDING } from "./bindings";
import type { ConversationRegistry } from "./registry";

/**
 * The five things anyone — a person through a menu, a model through a tool —
 * can do to a conversation (guide §4.7).
 *
 * They are declared here rather than in each product for the same reason the
 * workbench declares its own: the wording of a refusal, the shape of the
 * payload and the name of the kind should be identical in every PBUI product,
 * so a trace from one reads in another. A product splices
 * `ConversationVerbSchemas` into its verb union and `CONVERSATION_VERB_DOCS`
 * into its docs, and its `local` handler delegates to
 * `performConversationVerb`.
 *
 * `conversation.send` is the odd one: it is an AGENT verb, and its target is
 * a conversation other than the one performing it. That is the handoff
 * gesture — "ask the other agent about this" — and it is why the router's
 * `sendToAgent` takes a target at all.
 */

export const ConversationVerbSchemas = [
  z.object({
    kind: z.literal("conversation.new"),
    title: z.string().optional(),
    prompt: z.string().optional(),
    near: z.string().optional(),
  }),
  z.object({ kind: z.literal("conversation.open"), conversationId: z.string(), near: z.string().optional() }),
  z.object({ kind: z.literal("conversation.select"), conversationId: z.string() }),
  /*
   * `title` is OPTIONAL, and its absence is a gesture rather than an
   * omission: "rename this" with no name asks the interface to open its
   * editor, the way `compareWith` without a `right` opens accept mode. It is
   * what lets the object menu — which cannot hold a text field — offer a
   * rename at all.
   */
  z.object({ kind: z.literal("conversation.rename"), conversationId: z.string(), title: z.string().optional() }),
  z.object({ kind: z.literal("conversation.pin"), conversationId: z.string(), pinned: z.boolean() }),
  z.object({ kind: z.literal("conversation.archive"), conversationId: z.string(), archived: z.boolean() }),
  z.object({ kind: z.literal("conversation.close"), conversationId: z.string() }),
  z.object({ kind: z.literal("conversation.forget"), conversationId: z.string() }),
  z.object({
    kind: z.literal("conversation.send"),
    conversationId: z.string(),
    template: z.string(),
    refs: z.array(ReferenceSchema).optional(),
  }),
] as const;

const ConversationVerbSchema = z.discriminatedUnion("kind", [...ConversationVerbSchemas]);

export type ConversationVerb = z.infer<typeof ConversationVerbSchema>;
export type ConversationVerbKind = ConversationVerb["kind"];

export const CONVERSATION_VERB_KINDS: readonly ConversationVerbKind[] = [
  "conversation.new",
  "conversation.open",
  "conversation.select",
  "conversation.rename",
  "conversation.pin",
  "conversation.archive",
  "conversation.close",
  "conversation.forget",
  "conversation.send",
];

export const CONVERSATION_VERB_DOCS: VerbDocs = {
  "conversation.new": { doc: "start another conversation and open it in a tile" },
  "conversation.open": { doc: "open a conversation in a tile beside another" },
  "conversation.select": { doc: "make a conversation the active one" },
  "conversation.rename": { doc: "give a conversation a name; without a title, ask the user for one" },
  "conversation.pin": { doc: "keep a conversation at the top of the list" },
  "conversation.archive": { doc: "put a conversation out of the way; it keeps its transcript" },
  "conversation.close": { doc: "disconnect a conversation; the record and the server's session stay", danger: true },
  "conversation.forget": { doc: "drop a conversation from this browser's list; the server keeps the session", danger: true },
  "conversation.send": { doc: "send a message to another conversation" },
};

export function isConversationVerb(verb: VerbLike): verb is ConversationVerb & VerbLike {
  return typeof verb.kind === "string" && verb.kind.startsWith("conversation.");
}

/** How the object menu and the trace word each one. */
export function describeConversationVerb(verb: ConversationVerb): string {
  switch (verb.kind) {
    case "conversation.new":
      return verb.title ? `start a conversation called “${verb.title}”` : "start another conversation";
    case "conversation.open":
      return `open conversation ${verb.conversationId}`;
    case "conversation.select":
      return `make conversation ${verb.conversationId} the active one`;
    case "conversation.rename":
      return verb.title ? `rename the conversation to “${verb.title}”` : "rename this conversation";
    case "conversation.pin":
      return verb.pinned ? "keep this conversation at the top" : "stop keeping this conversation at the top";
    case "conversation.archive":
      return verb.archived ? "archive this conversation" : "bring this conversation back";
    case "conversation.close":
      return "disconnect this conversation";
    case "conversation.forget":
      return "drop this conversation from the list";
    case "conversation.send":
      return `send a message to conversation ${verb.conversationId}`;
  }
}

export interface ConversationVerbContext {
  conversations: ConversationRegistry;
  /** Who is performing it; a human's rename owns the title, an agent's does not (D7). */
  actor: Actor;
  /** Where a conversation's tile is opened; null in a product with no workbench. */
  workbench: Workbench | null;
  /** Send to a named conversation — the router's `sendToAgent` with a target. */
  send(conversationId: string, template: string, refs: readonly Reference[]): Promise<void>;
}

/**
 * Perform one of the four LOCAL conversation verbs. Throws on a refusal, so
 * the router turns it into `rejected:…` in the trace and in the tool result —
 * swallowing it would tell the agent that an open of a forgotten conversation
 * had landed.
 *
 * `conversation.send` is not handled here: it belongs to the `agent` family,
 * where the product's handler calls `ctx.sendToAgent(template, refs, target)`.
 */
export async function performConversationVerb(verb: ConversationVerb, ctx: ConversationVerbContext): Promise<void> {
  switch (verb.kind) {
    case "conversation.new": {
      const snapshot = await ctx.conversations.create(verb.title ? { title: verb.title } : {});
      openConversationTile(ctx, snapshot.id, verb.near);
      if (verb.prompt) await ctx.send(snapshot.id, verb.prompt, []);
      return;
    }
    case "conversation.open": {
      requireKnown(ctx, verb.conversationId);
      ctx.conversations.open(verb.conversationId);
      ctx.conversations.activate(verb.conversationId);
      openConversationTile(ctx, verb.conversationId, verb.near);
      return;
    }
    case "conversation.select": {
      requireKnown(ctx, verb.conversationId);
      ctx.conversations.activate(verb.conversationId);
      return;
    }
    case "conversation.rename": {
      const snapshot = requireKnown(ctx, verb.conversationId);
      if (ctx.actor === "agent" && snapshot.titledBy === "human") {
        // The user named this one. An agent renaming it would be the interface
        // quietly disagreeing with them about what they are looking at.
        throw new Error("the user named this conversation; ask them before renaming it");
      }
      if (verb.title === undefined) {
        // No name given: open the editor wherever the conversation is shown.
        ctx.conversations.requestRename(verb.conversationId);
        return;
      }
      if (!verb.title.trim()) throw new Error("a conversation needs a name");
      ctx.conversations.rename(verb.conversationId, verb.title, ctx.actor === "agent" ? "agent" : "human");
      return;
    }
    case "conversation.pin":
      requireKnown(ctx, verb.conversationId);
      ctx.conversations.pin(verb.conversationId, verb.pinned);
      return;
    case "conversation.archive":
      requireKnown(ctx, verb.conversationId);
      ctx.conversations.archive(verb.conversationId, verb.archived);
      return;
    case "conversation.close":
      requireKnown(ctx, verb.conversationId);
      ctx.conversations.close(verb.conversationId);
      return;
    case "conversation.forget":
      requireKnown(ctx, verb.conversationId);
      ctx.conversations.forget(verb.conversationId);
      return;
    case "conversation.send":
      throw new Error("conversation.send is an agent verb; route it to sendToAgent with the target conversation");
  }
}

function requireKnown(ctx: ConversationVerbContext, conversationId: string) {
  const snapshot = ctx.conversations.get(conversationId);
  if (!snapshot) throw new Error(`no conversation ${conversationId} in this browser`);
  return snapshot;
}

/**
 * A conversation's tile. `openView` is doc-bound de-duplication: a second
 * open of a conversation that already has a tile goes to that tile rather
 * than minting a second one.
 */
function openConversationTile(ctx: ConversationVerbContext, conversationId: string, near?: string) {
  const workbench = ctx.workbench;
  if (!workbench) return;
  const beside = near ?? workbench.activePlacementId() ?? undefined;
  const placed = workbench.verbs.openView(
    "chat",
    { [CONVERSATION_BINDING]: conversationId },
    beside ? { near: beside } : {},
  );
  if (!placed) throw new Error("the workbench refused to open a conversation tile");
}
