import type { ChatClient } from "@go-go-golems/chat-provider";
import type { PbuiChatStore } from "../store/chatStore";
import type { Actor, Outcome, Reference, VerbLike } from "../types";
import type { Vocabulary } from "../vocabulary/schemas";
import { validateReference, validateVerb } from "../vocabulary/validate";

export type VerbFamily = "local" | "agent" | "tool";

/**
 * What a family handler may reach. Everything here is bound by
 * `createPbuiChat`'s Provider once it mounts; the router itself is plain
 * code created before React exists, so it cannot hold these at construction.
 */
export interface RouterContext {
  store: PbuiChatStore;
  client: ChatClient;
  vocabulary: Vocabulary;
  basePrefix: string;
  /** Enter accept mode; resolves with the picked wire reference or null. */
  accept(request: { types: readonly string[]; prompt: string }): Promise<Reference | null>;
  /** The product's label for a reference, as text. */
  labelFor(reference: Reference): string;
  /**
   * Send a message to the agent. `{0}`, `{1}`… in the template are replaced
   * by mentions of the corresponding refs; the refs ride along in the body.
   */
  sendToAgent(template: string, refs: readonly Reference[]): Promise<void>;
  /**
   * Open a widget instance in its own tile. With a workbench attached to
   * the chat this opens a `widget` tile beside the active one; without one
   * it falls back to the chat store's `tiles` list, which `TilesPanel`
   * renders. Handlers call this rather than the store so the product's
   * `openInTile` verb does the right thing either way.
   */
  openTile(widgetId: string): void;
  /** Perform another verb (for handlers that decompose into one). */
  perform: VerbRouter<VerbLike>["perform"];
}

export type VerbHandler<Verb> = (
  verb: Verb,
  context: RouterContext,
  target: Reference | undefined,
) => void | Promise<void>;

export interface VerbRouterOptions<Verb extends VerbLike> {
  /** Which family performs a verb. Required for every kind the vocabulary declares. */
  families: (verb: Verb) => VerbFamily;
  local?: VerbHandler<Verb>;
  agent?: VerbHandler<Verb>;
  tool?: VerbHandler<Verb>;
  /** Prefix for `/api/chat/sessions/{id}/verbs`; overridden by the bound context's. */
  basePrefix?: string;
  fetch?: typeof fetch;
  /** Set false to perform without POSTing the trace (stories, tests). */
  report?: boolean;
}

export interface PerformOptions {
  actor?: Actor;
}

export type RouterBinding = Omit<RouterContext, "perform">;

export interface VerbRouter<Verb extends VerbLike> {
  /**
   * Validate, dispatch to the family handler, then report the outcome to the
   * server so the trace remembers it. Rejections are reported too — the trace
   * must reflect what the UI did, including what it refused to do.
   */
  perform(verb: Verb, target?: Reference, options?: PerformOptions): Promise<Outcome>;
  bind(binding: RouterBinding): () => void;
  isBound(): boolean;
  familyOf(verb: Verb): VerbFamily;
}

/** The verb's own reference field, when it carries one, as the trace target. */
export function targetOf(verb: VerbLike): Reference | undefined {
  for (const key of ["ref", "left", "target"]) {
    const candidate = verb[key];
    if (candidate && typeof candidate === "object" && !validateReference(candidate)) {
      return candidate as Reference;
    }
  }
  const refs = verb.refs;
  if (Array.isArray(refs) && refs[0] && typeof refs[0] === "object" && !validateReference(refs[0])) {
    return refs[0] as Reference;
  }
  return undefined;
}

export function createVerbRouter<Verb extends VerbLike>(options: VerbRouterOptions<Verb>): VerbRouter<Verb> {
  let binding: RouterBinding | null = null;
  let clientSeq = 0;
  const fetchImpl = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  function familyOf(verb: Verb): VerbFamily {
    return options.families(verb);
  }

  async function report(actor: Actor, verb: Verb, target: Reference | undefined, outcome: Outcome) {
    if (options.report === false || !binding) return;
    const sessionId = binding.client.getStore().getState().overlay.sessionId;
    if (!sessionId) return;
    clientSeq += 1;
    const body = {
      clientSeq: `${Date.now()}-${clientSeq}`,
      actor,
      verb,
      ...(target ? { target } : {}),
      outcome,
    };
    const prefix = binding.basePrefix ?? options.basePrefix ?? "";
    try {
      const response = await fetchImpl(`${prefix}/api/chat/sessions/${encodeURIComponent(sessionId)}/verbs`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        console.warn(`pbui-chat: verb report failed: ${response.status}`);
      }
    } catch (error) {
      console.warn("pbui-chat: verb report failed", error);
    }
  }

  const router: VerbRouter<Verb> = {
    familyOf,
    isBound: () => binding !== null,
    bind(next) {
      binding = next;
      return () => {
        if (binding === next) binding = null;
      };
    },
    async perform(verb, explicitTarget, performOptions) {
      const actor = performOptions?.actor ?? "human";
      const target = explicitTarget ?? targetOf(verb);
      let outcome: Outcome;

      const reason = binding ? validateVerb(binding.vocabulary, verb) : null;
      if (reason) {
        outcome = `rejected:${reason}`;
      } else {
        const family = familyOf(verb);
        const handler = options[family];
        if (!handler) {
          outcome = `rejected:no ${family} handler for ${verb.kind}`;
        } else if (!binding) {
          outcome = "rejected:router is not bound to a chat";
        } else {
          try {
            await handler(verb, { ...binding, perform: router.perform as VerbRouter<VerbLike>["perform"] }, target);
            outcome = "performed";
          } catch (error) {
            outcome = `rejected:${error instanceof Error ? error.message : String(error)}`;
          }
        }
      }

      void report(actor, verb, target, outcome);
      return outcome;
    },
  };
  return router;
}
