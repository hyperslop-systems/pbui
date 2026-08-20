import type { PbuiInstance, PresentationRegistry, PresentationValues } from "@hyperslop-systems/pbui";
import {
  defineChatExtensions,
  useChatClient,
  type ChatExtension,
  type SendMessageRequest,
} from "@go-go-golems/chat-provider";
import { useEffect, useMemo, type ReactNode } from "react";
import { traceAdapter } from "./adapters/traceAdapter";
import { Composer } from "./composer/Composer";
import { PbuiChatContext, type PbuiChatContextValue } from "./context";
import { formatMention } from "./mentions/mentions";
import { Messages } from "./messages/Messages";
import { ChatInspectorPanel, TilesPanel, TracePanel, WatchlistPanel } from "./panels";
import type { VerbRouter } from "./router/createVerbRouter";
import { createPbuiChatStore, usePbuiChatStore, type PbuiChatState, type PbuiChatStore } from "./store/chatStore";
import { pbuiAcceptTool } from "./tools/acceptTool";
import { pbuiProposeTool } from "./tools/proposeTool";
import type { ChatMessageBody, Reference, VerbLike } from "./types";
import { fromPresentationReference, toPresentationReference } from "./types";
import { exportVocabulary } from "./vocabulary/defineVocabulary";
import type { Vocabulary } from "./vocabulary/schemas";
import { pbuiWidgets } from "./widget/definitions";

export interface CreatePbuiChatOptions<Values extends PresentationValues, Environment, Verb extends VerbLike> {
  /** The product's `createPbui()` instance. */
  pbui: PbuiInstance<Values, Environment, Verb>;
  /** Defaults to `pbui.registry`. */
  registry?: PresentationRegistry<Values, Environment, Verb>;
  vocabulary: Vocabulary;
  router: VerbRouter<Verb>;
  /** Prefix for `/api/...`; same value you give `ChatProvider`'s `basePrefix`. */
  basePrefix?: string;
  /** Supply one to share it with product code created before the chat. */
  store?: PbuiChatStore;
}

export interface PbuiChatProviderProps<Environment> {
  children: ReactNode;
  environment?: Environment;
}

interface PendingSend {
  refs: Reference[];
  focus?: { reference: Reference };
}

/**
 * Assemble a PBUI-native chat for one product. The result is everything the
 * product mounts: a chat-provider extension (widgets, human tools, the
 * trace adapter), a Provider that wraps pbui's with the router as
 * `onPerform`, the transcript, the composer, the side panels, and the
 * `sendMessageBody` hook that puts typed refs and focus on the wire.
 *
 * Mount order: `<ChatProvider config={{ extensions: [chat.extension],
 * sendMessageBody: chat.sendMessageBody }}>` outside, `<chat.Provider>`
 * inside it (the Provider needs the chat client to bind the router).
 */
export function createPbuiChat<Values extends PresentationValues, Environment, Verb extends VerbLike>(
  options: CreatePbuiChatOptions<Values, Environment, Verb>,
) {
  const { pbui, vocabulary } = options;
  const registry = options.registry ?? pbui.registry;
  const router = options.router as unknown as VerbRouter<VerbLike>;
  const store = options.store ?? createPbuiChatStore();
  const basePrefix = options.basePrefix ?? "";

  let pending: PendingSend | null = null;

  const extension: ChatExtension = defineChatExtensions({
    name: "pbui-chat",
    widgets: pbuiWidgets,
    tools: [pbuiAcceptTool, pbuiProposeTool],
    timelineAdapters: [traceAdapter],
  });

  function sendMessageBody(request: SendMessageRequest): ChatMessageBody {
    const queued = pending;
    pending = null;
    const focus = queued?.focus ?? (store.getState().focus ? { reference: store.getState().focus as Reference } : undefined);
    return {
      prompt: request.prompt,
      ...(request.attachments && request.attachments.length > 0 ? { attachments: request.attachments } : {}),
      ...(queued && queued.refs.length > 0 ? { refs: queued.refs } : {}),
      ...(focus ? { focus } : {}),
    };
  }

  function labelWith(environment: Environment) {
    return (reference: Reference): string => {
      const label = registry.labelFor(toPresentationReference<Values>(reference), environment);
      if (typeof label === "string" || typeof label === "number") return String(label);
      const value = reference.value;
      if (value && typeof value === "object") {
        for (const key of ["label", "name", "title"]) {
          const candidate = (value as Record<string, unknown>)[key];
          if (typeof candidate === "string" && candidate) return candidate;
        }
      }
      return reference.id;
    };
  }

  function Binder({ children }: { children: ReactNode }) {
    const client = useChatClient();
    const pbuiContext = pbui.usePbui();
    const environment = pbuiContext.environment;
    const accept = pbuiContext.accept;

    const value = useMemo<PbuiChatContextValue>(() => {
      const labelFor = labelWith(environment);
      const send = async (body: Omit<ChatMessageBody, "attachments">) => {
        pending = { refs: body.refs ?? [], ...(body.focus ? { focus: body.focus } : {}) };
        await client.send({ prompt: body.prompt });
      };
      return {
        pbui,
        registry,
        vocabulary,
        store,
        router,
        basePrefix,
        send,
        labelFor,
        docFor: (type) => vocabulary.types[type]?.doc,
        toneFor: (type) => vocabulary.types[type]?.tone,
      };
    }, [client, environment, accept]);

    useEffect(() => {
      const labelFor = value.labelFor;
      return router.bind({
        store,
        client,
        vocabulary,
        basePrefix,
        accept: async ({ types, prompt }) => {
          const picked = await accept({ types: types as never, prompt });
          return picked ? fromPresentationReference(picked) : null;
        },
        labelFor,
        sendToAgent: async (template, refs) => {
          const prompt = template.replace(/\{(\d+)\}/g, (whole, index: string) => {
            const reference = refs[Number(index)];
            return reference ? formatMention(reference, labelFor(reference)) : whole;
          });
          await value.send({ prompt, refs: [...refs] });
        },
      });
    }, [value, client, accept]);

    return <PbuiChatContext.Provider value={value}>{children}</PbuiChatContext.Provider>;
  }

  function Provider({ children, environment }: PbuiChatProviderProps<Environment>) {
    const PbuiProvider = pbui.Provider;
    return (
      <PbuiProvider
        environment={environment}
        onPerform={async (verb) => {
          await router.perform(verb as VerbLike);
        }}
      >
        <Binder>{children}</Binder>
      </PbuiProvider>
    );
  }

  function useStore<T = PbuiChatState>(selector?: (state: PbuiChatState) => T): T {
    return usePbuiChatStore(store, selector);
  }

  return {
    extension,
    Provider,
    Messages,
    Composer,
    TracePanel,
    InspectorPanel: ChatInspectorPanel,
    WatchlistPanel,
    TilesPanel,
    MouseDocLine: pbui.MouseDocLine,
    ObjectMenu: pbui.ObjectMenu,
    AcceptBanner: pbui.AcceptBanner,
    sendMessageBody,
    exportVocabulary: () => exportVocabulary(vocabulary),
    store,
    useStore,
    router: options.router,
    vocabulary,
    registry,
    pbui,
  };
}

export type PbuiChat<Values extends PresentationValues, Environment, Verb extends VerbLike> = ReturnType<
  typeof createPbuiChat<Values, Environment, Verb>
>;
