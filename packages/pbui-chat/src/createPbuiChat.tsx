import type { PbuiInstance, PbuiRefusal, PresentationDescriptorRegistry, PresentationValues } from "@hyperslop-systems/pbui";
import {
  createChatDebugEventStore,
  createDefaultChatDebugClassifier,
  defineChatExtensions,
  selectTimelineEntities,
  type ChatDebugEventStore,
  type ChatExtension,
  type ChatProviderConfig,
  type CreateChatDebugEventStoreOptions,
  type ChatDebugFamily,
  type SendMessageRequest,
} from "@go-go-golems/chat-provider";
import type { WorkbenchShell } from "@hyperslop-systems/pbui-workbench";
import { commands, connectDocumentSource, type DocumentSource } from "@hyperslop-systems/workbench-core";
import { useEffect, useMemo, type ReactNode } from "react";
import { traceAdapter } from "./adapters/traceAdapter";
import { Composer } from "./composer/Composer";
import { ConversationHost } from "./conversations/ConversationHost";
import { ConversationScope } from "./conversations/ConversationScope";
import { DEFAULT_EVENT_FAMILIES } from "./conversations/EventsTile";
import {
  createConversationRegistry,
  type ConversationRegistry,
  type ConversationStorage,
  type CreateConversationRegistryOptions,
} from "./conversations/registry";
import { PbuiChatContext, type PbuiChatContextValue } from "./context";
import { formatMention } from "./mentions/mentions";
import { Messages } from "./messages/Messages";
import { ChatInspectorPanel, TilesPanel, TracePanel, WatchlistPanel } from "./panels";
import type { VerbRouter } from "./router/createVerbRouter";
import { createPbuiChatStore, usePbuiChatStore, type PbuiChatState, type PbuiChatStore } from "./store/chatStore";
import { pbuiAcceptTool } from "./tools/acceptTool";
import type { ApprovalLedger } from "./tools/approvalLedger";
import { AgentEffectGateway, type EffectEnvelope } from "./tools/agentEffectGateway";
import { pbuiProposeTool } from "./tools/proposeTool";
import { createConversationTools, type ConversationTools, type ConversationToolsOptions } from "./tools/conversationTools";
import { createSandboxTools, type SandboxTools, type SandboxToolsOptions } from "./tools/sandboxTools";
import { createWorkbenchTools, type WorkbenchTools, type WorkbenchToolsOptions } from "./tools/workbenchTools";
import type { InstanceRegistry, ProgramEngine, ProgramLibrary } from "@hyperslop-systems/pbui-sandbox";
import type { ChatMessageBody, EffectCorrelation, Reference, VerbLike } from "./types";
import { identityReferenceAdapter } from "./types";
import type { ReferenceAdapter } from "./types";
import { exportVocabulary } from "./vocabulary/defineVocabulary";
import type { Vocabulary } from "./vocabulary/schemas";
import { pbuiWidgets } from "./widget/definitions";
import { findWidgetEntity, widgetTitleOf } from "./widget/findWidgetEntity";
import { create } from "@bufbuild/protobuf";
import { DocumentPayloadSchema, MutationSchema } from "@hyperslop-systems/workbench-protocol";
import { WIDGET_BINDING } from "./apps/WidgetApp";

/** The format of the stub document that stands for a conversation in an attached workbench. */
export const CONVERSATION_DOCUMENT_FORMAT = "chat.conversation";
/** The format of the stub document that stands for a widget instance opened in a tile. */
export const WIDGET_DOCUMENT_FORMAT = "chat.widget";

export interface CreatePbuiChatOptions<Values extends PresentationValues, Environment, Verb extends VerbLike> {
  /** The product's `createPbui()` instance. */
  pbui: PbuiInstance<Values, Environment, Verb>;
  /** Defaults to `pbui.presentation.descriptors`. */
  registry?: PresentationDescriptorRegistry<Values, Environment>;
  vocabulary: Vocabulary;
  router: VerbRouter<Verb>;
  /**
   * The wire↔product reference codec. Default: the identity convention
   * (the presentation value IS the wire reference). Products with
   * structured values supply their own — see ReferenceAdapter in types.ts.
   */
  referenceAdapter?: ReferenceAdapter<Values>;
  /** One product-wide authority shared by every conversation and tool factory. */
  approvalLedger?: ApprovalLedger;
  /** Override the product-wide effect gateway (primarily for offline products/tests). */
  effectGateway?: AgentEffectGateway;
  /** Prefix for `/api/...`. */
  basePrefix?: string;
  /** Supply one to share it with product code created before the chat. */
  store?: PbuiChatStore;
  /**
   * How conversations are created, persisted and connected. Every open
   * conversation gets a chat-provider runtime built from this (guide §4.1);
   * the product no longer mounts `<ChatProvider>` itself.
   */
  conversations?: {
    /** Storage key for the conversation records; default `pbui-chat.conversations`. */
    key?: string;
    storage?: ConversationStorage | null;
    /** Transport, http and `apiBase` for every runtime. */
    config?: Omit<ChatProviderConfig, "extensions" | "sessionPolicy" | "onDebugEvent" | "sendMessageBody" | "basePrefix">;
    debug?: ChatDebugEventStore;
    debugOptions?: CreateChatDebugEventStoreOptions;
    /** Extra UI-event name → family entries, merged over `DEFAULT_EVENT_FAMILIES`. */
    eventFamilies?: Partial<Record<string, ChatDebugFamily>>;
    fetch?: typeof fetch;
    onRejected?: CreateConversationRegistryOptions["onRejected"];
    now?(): string;
    /** Connect each runtime as it opens; default true. Stories and tests pass false. */
    autoConnect?: boolean;
  };
  /**
   * A pbui-workbench to open widget tiles in. Usually attached AFTER
   * construction with `chat.attachWorkbench(wb)`, because the workbench's
   * apps (`createChatApps(chat)`) need the chat first.
   */
  workbench?: WorkbenchShell;
  /**
   * How conversations are mirrored into an attached workbench's document so
   * `chat` tiles can bind them (the core validates every binding against the
   * document store). Default: a stub per conversation in the
   * `chat.conversation` format. A product whose host validates document
   * formats passes its own `format`; a product that keeps conversation
   * documents itself (a reconciler writing richer bodies) passes `false`
   * and no source is connected.
   */
  conversationDocuments?: { format: string } | false;
  /**
   * Tune the workbench tools the agent uses to rearrange the screen: limits,
   * the per-verb policy, and whether the raw mutation tool is offered.
   * Confirm-policy authority always comes from the product-wide ledger.
   */
  workbenchTools?: Omit<WorkbenchToolsOptions, "getWorkbench" | "perform" | "senderConversationId" | "effectGateway">;
  /**
   * The agent's conversation tools: whether it may message another agent
   * unassisted (`confirm` by default) and how long a handoff may be.
   * Confirm-policy authority always comes from the product-wide ledger.
   */
  conversationTools?: Omit<ConversationToolsOptions, "getConversations" | "conversationId" | "perform" | "effectGateway">;
  /**
   * The sandbox tools: how bindings resolve for a dry render, limits, and policy.
   * The library and engine usually arrive AFTER construction
   * through `chat.attachSandbox(library, engine)`, for the same reason the
   * workbench does; until then the tools are not offered to the model.
   */
  sandbox?: Omit<SandboxToolsOptions, "getLibrary" | "getEngine" | "getWorkbench" | "perform" | "vocabulary" | "senderConversationId" | "effectGateway"> & {
    library?: ProgramLibrary;
    engine?: ProgramEngine;
  };
}

export interface PbuiChatProviderProps<Environment> {
  children: ReactNode;
  environment?: Environment;
  /**
   * A menu row that failed fresh revalidation before its verb reached the
   * router (PBUI-KERNEL-1 §14.2). Default: a console warning — the chat
   * layer has no status line of its own; a product with one passes its own.
   */
  onRefuse?(refusal: PbuiRefusal<PresentationValues>): void;
}

interface PendingSend {
  refs: Reference[];
  focus?: { reference: Reference };
}

/** One conversation's agent tools, and the extension that installs them. */
export interface ConversationToolset {
  workbenchTools: WorkbenchTools;
  sandboxTools: SandboxTools;
  conversationTools: ConversationTools;
  extension: ChatExtension;
}

/**
 * Assemble a PBUI-native chat for one product. The result is everything the
 * product mounts: a Provider that wraps pbui's with the router as
 * `onPerform` and hosts every open conversation's runtime, the transcript,
 * the composer, the side panels, and the conversation registry the chat and
 * helper tiles are views of.
 *
 * Mount `<chat.Provider>` once, at the product's root. There is no
 * `<ChatProvider>` above it any more: one lives inside, per open
 * conversation, so a product can have several agents at once (guide §4.5).
 */
export function createPbuiChat<Values extends PresentationValues, Environment, Verb extends VerbLike>(
  options: CreatePbuiChatOptions<Values, Environment, Verb>,
) {
  const { pbui, vocabulary } = options;
  const registry = options.registry ?? pbui.presentation.descriptors;
  const referenceAdapter = options.referenceAdapter ?? identityReferenceAdapter<Values>();
  const router = options.router as unknown as VerbRouter<VerbLike>;
  const store = options.store ?? createPbuiChatStore();
  const basePrefix = options.basePrefix ?? "";
  const conversationOptions = options.conversations ?? {};
  const effectFetch = conversationOptions.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const effectGateway =
    options.effectGateway ??
    new AgentEffectGateway({
      approvalLedger: options.approvalLedger,
      outboxStorage: typeof window !== "undefined" ? window.localStorage : null,
      outboxKey: `${conversationOptions.key ?? "pbui-chat.conversations"}.effect-outbox`,
      async report(envelope: EffectEnvelope) {
        if (!envelope.conversationId) throw new Error("cannot report an effect without a conversation");
        const response = await effectFetch(`${basePrefix}/api/chat/sessions/${encodeURIComponent(envelope.conversationId)}/effects`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(envelope),
        });
        if (!response.ok) throw new Error(`effect report failed: ${response.status}`);
      },
    });

  /*
   * Queued mentions, per conversation. As one module-level field a mention
   * composed in conversation A rode along on whichever conversation sent
   * next — the refs would arrive attached to a message the user never
   * associated with them.
   */
  const pending = new WeakMap<SendMessageRequest, PendingSend>();

  /**
   * Where "Open in tile" goes. With a workbench: a `widget` tile bound to
   * the instance, beside the tile the user is in, titled like the widget.
   * Without one: the store's `tiles` list, for `TilesPanel`.
   */
  function openTileWith(getEntities: () => ReturnType<typeof selectTimelineEntities>) {
    return (widgetId: string) => {
      if (!workbench) {
        store.openTile(widgetId);
        return;
      }
      const title = widgetTitleOf(findWidgetEntity(getEntities(), widgetId), widgetId);
      const near = workbench.activePlacementId();
      // The core validates the binding against the document store, so the
      // widget instance gets a stub document first. It is never removed: a
      // widget that left the timeline is what the tile's empty state reports.
      if (!workbench.core.getState().document.documents[widgetId]) {
        workbench.apply([
          create(MutationSchema, {
            body: { case: "documentPut", value: { document: create(DocumentPayloadSchema, { id: widgetId, format: WIDGET_DOCUMENT_FORMAT, schemaVersion: 1, body: {} }) } },
          }),
        ]);
      }
      workbench.execute(commands.open("widget", { [WIDGET_BINDING]: widgetId }, { ...(near ? { near } : {}), title }));
    };
  }

  /*
   * The agent's tools are built PER CONVERSATION (guide D5). A tool's
   * `execute` receives only `{ signal, toolCallId }`, so one shared closure
   * could not tell which model called it and every verb it performed would be
   * traced against whichever conversation happened to be active. Building the
   * set per session moves that knowledge into the closure, where it is exact.
   *
   * No agent undo token is advertised: a whole-document restore could erase
   * another agent's later changes, and the protocol does not yet provide a
   * safe inverse batch. Callers receive the committed revision instead.
   *
   * The workbench, library and engine are read through closures rather than
   * received, because they cannot exist yet: the workbench's applications
   * come from `createChatApps(chat)`, so the chat must be built first. Each
   * tool's `available()` is false until `attachWorkbench` / `attachSandbox`
   * runs, and `RegisterManifestTools` skips an unavailable descriptor — so
   * the model is simply not offered them rather than being offered ones that
   * fail.
   */
  let workbench: WorkbenchShell | null = null;
  let disconnectConversations: () => void = () => undefined;
  /**
   * Conversations live in the registry, not in the workbench document, but
   * a `chat` tile BINDS one and the core validates that binding against the
   * document store. So every conversation the registry knows is mirrored
   * into the attached workbench as a stub document (`chat.conversation`),
   * kept in step with the registry for as long as the workbench is attached.
   */
  function connectWorkbench(next: WorkbenchShell | null) {
    disconnectConversations();
    disconnectConversations = () => undefined;
    workbench = next;
    if (!next || options.conversationDocuments === false) return;
    const source: DocumentSource = {
      format: options.conversationDocuments?.format ?? CONVERSATION_DOCUMENT_FORMAT,
      list: () => conversations.all().map((snapshot) => ({ id: snapshot.id })),
      subscribe: (listener) => conversations.subscribe(listener),
    };
    disconnectConversations = connectDocumentSource(next.core, source);
  }
  let library: ProgramLibrary | null = options.sandbox?.library ?? null;
  let engine: ProgramEngine | null = options.sandbox?.engine ?? null;
  let instances: InstanceRegistry | null = null;
  const { library: _library, engine: _engine, ...sandboxOptions } = options.sandbox ?? { resolve: () => null };

  const toolsByConversation = new Map<string, ConversationToolset>();

  function toolsFor(conversationId: string): ConversationToolset {
    let built = toolsByConversation.get(conversationId);
    if (built) return built;
    const perform = (verb: VerbLike, correlation?: EffectCorrelation) =>
      router.perform(verb, undefined, { actor: "agent", conversationId, ...correlation });
    const workbenchTools = createWorkbenchTools({
      getWorkbench: () => workbench,
      perform,
      ...(options.workbenchTools ?? {}),
      senderConversationId: conversationId,
      effectGateway,
    });
    const sandboxTools = createSandboxTools({
      getLibrary: () => library,
      getEngine: () => engine,
      getWorkbench: () => workbench,
      getInstances: () => instances,
      perform,
      vocabulary,
      ...sandboxOptions,
      senderConversationId: conversationId,
      effectGateway,
    });
    /*
     * The conversation tools are the one set that MUST be per session: their
     * whole job is to tell this model which conversation it is, and a shared
     * descriptor could only guess.
     */
    const conversationTools = createConversationTools({
      getConversations: () => conversations,
      conversationId,
      perform,
      ...(options.conversationTools ?? {}),
      effectGateway,
    });
    built = {
      workbenchTools,
      sandboxTools,
      conversationTools,
      extension: defineChatExtensions({
        name: "pbui-chat",
        widgets: pbuiWidgets,
        tools: [pbuiAcceptTool, pbuiProposeTool, ...workbenchTools.tools, ...sandboxTools.tools, ...conversationTools.tools],
        timelineAdapters: [traceAdapter],
      }),
    };
    toolsByConversation.set(conversationId, built);
    return built;
  }

  /** The chat extension for one conversation; the registry installs it into that runtime. */
  function extensionFor(conversationId: string): ChatExtension {
    return toolsFor(conversationId).extension;
  }

  /*
   * The classifier files an unlisted `ui-event` under `timeline`, so without
   * a family map the events tile's `llm`, `tool` and `widget` chips can never
   * match anything. The default map covers the chatapp event vocabulary; a
   * product with its own events adds to it.
   */
  const debug =
    conversationOptions.debug ??
    createChatDebugEventStore({
      maxEntriesPerConversation: 1000,
      classifier: createDefaultChatDebugClassifier({
        familyAliases: { ...DEFAULT_EVENT_FAMILIES, ...(conversationOptions.eventFamilies ?? {}) },
      }),
      ...(conversationOptions.debugOptions ?? {}),
    });

  function sendMessageBodyFor(conversationId: string) {
    return (request: SendMessageRequest): ChatMessageBody => {
      const queued = pending.get(request) ?? null;
      pending.delete(request);
      const focus =
        queued?.focus ?? (store.getState().focus ? { reference: store.getState().focus as Reference } : undefined);
      const body: ChatMessageBody = {
        prompt: request.prompt,
        ...(request.attachments && request.attachments.length > 0 ? { attachments: request.attachments } : {}),
        ...(queued && queued.refs.length > 0 ? { refs: queued.refs } : {}),
        ...(focus ? { focus } : {}),
      };
      // What actually went on the wire, which is what the agent-context tile
      // shows — not the prompt the composer had.
      conversations.runtimeFor(conversationId)?.recordSend(request.prompt, body as unknown as Record<string, unknown>);
      return body;
    };
  }

  const conversations: ConversationRegistry = createConversationRegistry({
    key: conversationOptions.key ?? "pbui-chat.conversations",
    ...(conversationOptions.storage !== undefined ? { storage: conversationOptions.storage } : {}),
    basePrefix,
    ...(conversationOptions.fetch ? { fetch: conversationOptions.fetch } : {}),
    ...(conversationOptions.onRejected ? { onRejected: conversationOptions.onRejected } : {}),
    ...(conversationOptions.now ? { now: conversationOptions.now } : {}),
    ...(conversationOptions.autoConnect === undefined ? {} : { autoConnect: conversationOptions.autoConnect }),
    configFor: (conversationId) => ({
      ...conversationOptions.config,
      basePrefix,
      extensions: [extensionFor(conversationId)],
      sendMessageBody: sendMessageBodyFor(conversationId),
      onDebugEvent: (event) => debug.push(conversationId, event),
      sessionPolicy: { restore: "never" },
    }),
  });
  if (options.workbench) connectWorkbench(options.workbench);

  /** Send to a conversation, queueing its refs and focus for `sendMessageBody`. */
  async function sendTo(conversationId: string | null, body: Omit<ChatMessageBody, "attachments">) {
    const target = conversationId ?? conversations.activeId();
    if (!target) throw new Error("there is no conversation to send to");
    const runtime = conversations.runtimeFor(target);
    if (!runtime) throw new Error(`conversation ${target} is not open`);
    const request: SendMessageRequest = { prompt: body.prompt };
    pending.set(request, { refs: body.refs ?? [], ...(body.focus ? { focus: body.focus } : {}) });
    try {
      await runtime.client.send(request);
    } finally {
      pending.delete(request);
    }
  }

  /** Re-advertise every open conversation's manifest — an `attach…` changed what is available. */
  function syncAllManifests() {
    conversations.forEachOpen((runtime) => {
      void runtime.syncManifest().catch(() => undefined);
    });
  }

  function labelWith(environment: Environment) {
    return (reference: Reference): string => {
      const label = registry.labelFor(referenceAdapter.toProduct(reference), environment);
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
    const pbuiContext = pbui.usePbui();
    const environment = pbuiContext.environment;
    const accept = pbuiContext.accept;

    const value = useMemo<PbuiChatContextValue>(() => {
      const labelFor = labelWith(environment);
      return {
        pbui,
        registry,
        vocabulary,
        store,
        router,
        basePrefix,
        conversations,
        debug,
        // Outside any conversation tile: the inspector, the watchlist, an
        // object menu on a product tile. Their sends go to the active one.
        conversationId: null,
        runtime: null,
        send: (body) => sendTo(null, body),
        sendTo,
        refs: referenceAdapter,
        labelFor,
        docFor: (type) => vocabulary.types[type]?.doc,
        toneFor: (type) => vocabulary.types[type]?.tone,
      };
    }, [environment, accept]);

    /*
     * ONE binding for the product, not one per client. The vocabulary, the
     * families and the handlers are product facts; only the destination of a
     * trace POST and of `sendToAgent` is a session fact, and that is resolved
     * per call through `conversation()` (guide D4).
     */
    useEffect(() => {
      const labelFor = value.labelFor;
      return router.bind({
        store,
        vocabulary,
        basePrefix,
        conversation: (conversationId) => {
          const id = conversationId ?? conversations.activeId();
          if (!id) return null;
          const runtime = conversations.runtimeFor(id);
          return runtime ? { id, client: runtime.client } : null;
        },
        runtimeFor: (conversationId) => conversations.runtimeFor(conversationId),
        accept: async ({ types, prompt }) => {
          const picked = await accept({ types: types as never, prompt });
          return picked ? referenceAdapter.fromProduct(picked) : null;
        },
        labelFor,
        openTile: openTileWith(() => {
          const runtime = conversations.activeRuntime();
          return runtime ? selectTimelineEntities(runtime.store.getState()) : [];
        }),
        sendToAgent: async (template, refs, target) => {
          const prompt = template.replace(/\{(\d+)\}/g, (whole, index: string) => {
            const reference = refs[Number(index)];
            return reference ? formatMention(reference, labelFor(reference)) : whole;
          });
          await sendTo(target?.conversationId ?? null, { prompt, refs: [...refs] });
        },
      });
    }, [value, accept]);

    return (
      <PbuiChatContext.Provider value={value}>
        <ConversationHost registry={conversations} />
        {children}
      </PbuiChatContext.Provider>
    );
  }

  function Provider({ children, environment, onRefuse }: PbuiChatProviderProps<Environment>) {
    const PbuiProvider = pbui.Provider;
    return (
      <PbuiProvider
        environment={environment}
        onPerform={async (verb) => {
          await router.perform(verb as VerbLike);
        }}
        onRefuse={(refusal) => {
          if (onRefuse) onRefuse(refusal as unknown as PbuiRefusal<PresentationValues>);
          else console.warn(`pbui-chat: refused ${refusal.action ?? "action"} (${refusal.code})${refusal.because ? ` — ${refusal.because}` : ""}`);
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
    Provider,
    Messages,
    Composer,
    ConversationScope,
    TracePanel,
    InspectorPanel: ChatInspectorPanel,
    WatchlistPanel,
    TilesPanel,
    MouseDocLine: pbui.MouseDocLine,
    ObjectMenu: pbui.ObjectMenu,
    AcceptBanner: pbui.AcceptBanner,
    /** Every conversation, open or not, and which one is active. */
    conversations,
    /** The classified debug stream of every conversation, keyed by session id. */
    debug,
    /** The chat extension for one session; the registry installs it per runtime. */
    extensionFor,
    exportVocabulary: () => exportVocabulary(vocabulary),
    store,
    useStore,
    router: options.router,
    vocabulary,
    registry,
    pbui,
    /** Product-wide execution, approval, idempotency, and effect trace gateway. */
    effectGateway,
    /** One conversation's revision-bound workbench and program tools. */
    toolsFor,
    /** Route `openInTile` to a workbench's `widget` tiles from now on (null detaches). */
    attachWorkbench(next: WorkbenchShell | null) {
      connectWorkbench(next);
      // Re-advertise: every workbench tool's `available()` just flipped, and
      // the manifest the server holds is only refreshed on connect, on send,
      // and on extension install. Without this the tools are invisible to the
      // model for exactly one message, which reads as the model ignoring them.
      syncAllManifests();
    },
    /** The attached workbench, if any. */
    workbench: () => workbench,

    /** Offer the sandbox tools from now on (null, null detaches). Re-advertises every open manifest. */
    attachSandbox(
      nextLibrary: ProgramLibrary | null,
      nextEngine: ProgramEngine | null,
      nextInstances: InstanceRegistry | null = null,
    ) {
      library = nextLibrary;
      engine = nextEngine;
      instances = nextInstances;
      syncAllManifests();
    },
    /** The attached library, if any. */
    library: () => library,
    /** The attached engine, if any. */
    engine: () => engine,
  };
}

export type PbuiChat<Values extends PresentationValues, Environment, Verb extends VerbLike> = ReturnType<
  typeof createPbuiChat<Values, Environment, Verb>
>;
