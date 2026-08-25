import type { FrontendTool, ToolDefinition } from "@go-go-golems/chat-provider";
import { z } from "zod";
import type { ConversationRegistry } from "../conversations/registry";
import { ReferenceSchema } from "../vocabulary/schemas";
import type { EffectCorrelation, Outcome, Reference, VerbLike } from "../types";
import type { AgentEffectGateway } from "./agentEffectGateway";

/**
 * The agent's view of the other agents (guide §4.7).
 *
 * Two tools. `conversation_list` says who else is on this workbench, which
 * one the user is working in, and which one is you — a model that cannot tell
 * itself from its neighbours will hand work to itself. `conversation_send`
 * is the handoff, and it is `confirm` by default: a model that can start a
 * run in another conversation unasked is a loop waiting to happen (R9), and
 * the loop is expensive in a way the user does not see until the bill.
 *
 * Both are FRONTEND tools because the browser owns the list. The server's
 * session index, when it exists, is a convenience the registry merges into
 * its records — never the source of truth (D10).
 */

export type ConversationPolicyDecision = "allow" | "confirm" | "deny";

export interface ConversationToolsPolicy {
  conversation_send: ConversationPolicyDecision;
}

export const DEFAULT_CONVERSATION_POLICY: ConversationToolsPolicy = {
  conversation_send: "confirm",
};

export interface ConversationToolsOptions {
  /** Read at call time; null until the product has a registry. */
  getConversations(): ConversationRegistry | null;
  /**
   * Which conversation is calling. The tools are instantiated per session by
   * `createPbuiChat`, so this is a constant per tool set — and it is what
   * lets the list say "this is you" and the send refuse to talk to itself.
   */
  conversationId: string;
  /** Perform through the product's router, so the handoff lands in the trace. */
  perform(verb: VerbLike, correlation?: EffectCorrelation): Promise<Outcome>;
  policy?: Partial<ConversationToolsPolicy>;
  /** How many characters of a handoff message to allow. Default 4000. */
  maxPromptLength?: number;
  /**
   * What the product's approval ledger expects in the proposal, appended
   * to the refusal. Without it a model asked for "a proposal" produces one
   * the check cannot match and never learns why.
   */
  confirmationHint?: string;
  /** Shared product execution, approval, idempotency, and trace gateway. */
  effectGateway: AgentEffectGateway;
}

export interface ConversationTools {
  tools: ToolDefinition[];
}

function fail(error: string) {
  return { ok: false as const, error };
}

export function createConversationTools(options: ConversationToolsOptions): ConversationTools {
  const policy: ConversationToolsPolicy = { ...DEFAULT_CONVERSATION_POLICY, ...(options.policy ?? {}) };
  const maxPromptLength = options.maxPromptLength ?? 4000;
  const available = () => options.getConversations() !== null;

  const listTool: FrontendTool<{ includeArchived?: boolean }, Record<string, unknown>> = {
    name: "conversation_list",
    mode: "frontend",
    description:
      "The other conversations on this workbench: their ids, names, whether they are connected, how busy they are, " +
      "which one the user is currently working in, and which one is you. Ids come from here and nowhere else.",
    parameters: z.object({
      includeArchived: z.boolean().optional().describe("include conversations the user has put away; omitted means no"),
    }),
    available,
    execute(input) {
      const conversations = options.getConversations();
      if (!conversations) return fail("this product has only one conversation") as unknown as Record<string, unknown>;
      const rows = conversations
        .all()
        .filter((snapshot) => input.includeArchived || !snapshot.archived)
        .map((snapshot) => ({
          conversationId: snapshot.id,
          title: snapshot.title,
          isYou: snapshot.id === options.conversationId,
          isActive: snapshot.active,
          connected: snapshot.open,
          status: snapshot.runStatus,
          streaming: snapshot.streaming,
          messages: snapshot.messageCount,
          lastActivityAt: snapshot.lastActivityAt,
          waitingForUser: snapshot.waiting,
          ...(snapshot.pinned ? { pinned: true } : {}),
          ...(snapshot.archived ? { archived: true } : {}),
          ...(snapshot.model ? { model: snapshot.model } : {}),
        }));
      return {
        ok: true,
        you: options.conversationId,
        activeConversationId: conversations.activeId(),
        conversations: rows,
      } as unknown as Record<string, unknown>;
    },
  };

  const sendTool: FrontendTool<
    { conversationId: string; prompt: string; refs?: Reference[]; confirmationId?: string },
    Record<string, unknown>
  > = {
    name: "conversation_send",
    mode: "frontend",
    description:
      "Send a message to ANOTHER conversation on this workbench, which starts a run there. " +
      "Say what you are asking for and include the mentions it will need — the other agent cannot see this conversation. " +
      "Use it when the user asks, or when work plainly belongs to an agent already doing it; never to think out loud.",
    parameters: z.object({
      conversationId: z.string().describe("from conversation_list; not your own"),
      prompt: z.string().describe("what to ask the other agent; write mentions as [[type:id|label]]"),
      refs: z.array(ReferenceSchema).optional().describe("the objects the message names, so they resolve there too"),
      confirmationId: z.string().optional().describe("the id of a pbui_propose the user approved for this send"),
    }),
    available,
    async execute(input, context) {
      const conversations = options.getConversations();
      if (!conversations) return fail("this product has only one conversation") as unknown as Record<string, unknown>;

      const decision = policy.conversation_send;
      const target = conversations.get(input.conversationId);
      if (!target) return fail(`no conversation ${input.conversationId}; call conversation_list for the ids`) as unknown as Record<string, unknown>;
      if (input.conversationId === options.conversationId) {
        // A model that messages itself starts a run that starts a run.
        return fail("that is this conversation; answer the user directly instead") as unknown as Record<string, unknown>;
      }
      if (!target.open) return fail(`${target.title} is disconnected; ask the user to open it first`) as unknown as Record<string, unknown>;
      if (!input.prompt.trim()) return fail("a message needs something in it") as unknown as Record<string, unknown>;
      if (input.prompt.length > maxPromptLength) {
        return fail(`that message is ${input.prompt.length} characters; the limit is ${maxPromptLength}`) as unknown as Record<string, unknown>;
      }

      const verb: VerbLike = {
        kind: "conversation.send",
        conversationId: input.conversationId,
        template: input.prompt,
        ...(input.refs && input.refs.length > 0 ? { refs: input.refs } : {}),
      };
      const result = await options.effectGateway.execute({
        effectId: `${options.conversationId}:${context.toolCallId}`,
        invocationKey: `${options.conversationId}/${context.toolCallId}`,
        actor: "agent",
        conversationId: options.conversationId,
        effectKind: "conversation.send",
        effectScope: "conversation",
        input: { prompt: input.prompt },
        targetIds: [input.conversationId],
        referenceKeys: input.refs?.map((reference) => `${reference.type}:${reference.id}`) ?? [],
        policy: decision,
        confirmationId: input.confirmationId,
        deniedReason: "this product does not let agents message each other",
        approvalPrompt:
          `sending to another agent needs the user's approval: call pbui_propose describing what you want to ask ${target.title}, ` +
          `then call this again with that proposal's id as confirmationId.${options.confirmationHint ? ` ${options.confirmationHint}` : ""}`,
        approvalDescription: "this message",
        approvalMismatchReason: `proposal ${input.confirmationId ?? ""} was not approved for this message`,
        async perform() {
          const effectId = `${options.conversationId}:${context.toolCallId}`;
          const outcome = await options.perform(verb, {
            effectId,
            invocationKey: `${options.conversationId}/${context.toolCallId}`,
            ...(input.confirmationId ? { approvalId: input.confirmationId } : {}),
          });
          return {
            outcome,
            ...(outcome === "performed"
              ? {
                  value: {
                    ok: true,
                    conversationId: input.conversationId,
                    title: target.title,
                    note: "the other agent is answering now; its reply lands in its own conversation, not here",
                  },
                }
              : {}),
          };
        },
      });
      if (result.outcome !== "performed") {
        return fail(result.outcome.replace(/^rejected:/, "")) as unknown as Record<string, unknown>;
      }
      return result.value as unknown as Record<string, unknown>;
    },
  };

  return { tools: [listTool, sendTool] as ToolDefinition[] };
}
