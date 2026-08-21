import type { PbuiInstance, PresentationRegistry, PresentationValues } from "@hyperslop-systems/pbui";
import {
  defineChatExtensions,
  selectTimelineEntities,
  useChatClient,
  type ChatExtension,
  type SendMessageRequest,
} from "@go-go-golems/chat-provider";
import type { Workbench } from "@hyperslop-systems/pbui-workbench";
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
import { createSandboxTools, type SandboxTools, type SandboxToolsOptions } from "./tools/sandboxTools";
import { createWorkbenchTools, type WorkbenchTools, type WorkbenchToolsOptions } from "./tools/workbenchTools";
import type { InstanceRegistry, ProgramEngine, ProgramLibrary } from "@hyperslop-systems/pbui-sandbox";
import type { ChatMessageBody, Reference, VerbLike } from "./types";
import { fromPresentationReference, toPresentationReference } from "./types";
import { exportVocabulary } from "./vocabulary/defineVocabulary";
import type { Vocabulary } from "./vocabulary/schemas";
import { pbuiWidgets } from "./widget/definitions";
import { findWidgetEntity, widgetTitleOf } from "./widget/findWidgetEntity";
import { WIDGET_BINDING } from "./apps/WidgetApp";

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
  /**
   * A pbui-workbench to open widget tiles in. Usually attached AFTER
   * construction with `chat.attachWorkbench(wb)`, because the workbench's
   * apps (`createChatApps(chat)`) need the chat first.
   */
  workbench?: Workbench;
  /**
   * Tune the workbench tools the agent uses to rearrange the screen: limits,
   * the per-verb policy, whether the raw mutation tool is offered, and
   * `isApproved` — which the product must supply for any `confirm`-policy
   * verb to be performable at all.
   */
  workbenchTools?: Omit<WorkbenchToolsOptions, "getWorkbench" | "perform">;
  /**
   * The sandbox tools: how bindings resolve for a dry render, limits, policy,
   * `isApproved`. The library and engine usually arrive AFTER construction
   * through `chat.attachSandbox(library, engine)`, for the same reason the
   * workbench does; until then the tools are not offered to the model.
   */
  sandbox?: Omit<SandboxToolsOptions, "getLibrary" | "getEngine" | "getWorkbench" | "perform" | "vocabulary"> & {
    library?: ProgramLibrary;
    engine?: ProgramEngine;
  };
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
  let workbench: Workbench | null = options.workbench ?? null;
  /*
   * The chat client, once a Provider has mounted. Held so `attachWorkbench`
   * can re-sync the tool manifest: the manifest the server holds still says
   * `available: false` until the next send, which hides the workbench tools
   * for exactly one message — a bug that looks like the model ignoring them.
   */
  let chatClientRef: ReturnType<typeof useChatClient> | null = null;

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
      workbench.verbs.openView("widget", { [WIDGET_BINDING]: widgetId }, { ...(near ? { near } : {}), title });
    };
  }

  /*
   * The workbench tools read the workbench through a closure rather than
   * receiving it, because the workbench cannot exist yet: its applications
   * come from `createChatApps(chat)`, so the chat must be built first. Each
   * tool's `available()` is false until `attachWorkbench` runs, and
   * `RegisterManifestTools` skips an unavailable descriptor — so the model is
   * simply not offered them rather than being offered ones that fail.
   */
  const workbenchTools: WorkbenchTools = createWorkbenchTools({
    getWorkbench: () => workbench,
    perform: (verb) => router.perform(verb, undefined, { actor: "agent" }),
    ...(options.workbenchTools ?? {}),
  });

  /*
   * Same construction-order trick as the workbench tools: the library and the
   * engine are read through closures and the tools are `available` only once
   * both exist. A product without a sandbox never calls `attachSandbox`, and
   * its model is never told these tools exist.
   */
  let library: ProgramLibrary | null = options.sandbox?.library ?? null;
  let engine: ProgramEngine | null = options.sandbox?.engine ?? null;
  let instances: InstanceRegistry | null = null;
  const { library: _library, engine: _engine, ...sandboxOptions } = options.sandbox ?? { resolve: () => null };
  const sandboxTools: SandboxTools = createSandboxTools({
    getLibrary: () => library,
    getEngine: () => engine,
    getWorkbench: () => workbench,
    getInstances: () => instances,
    perform: (verb) => router.perform(verb, undefined, { actor: "agent" }),
    vocabulary,
    ...sandboxOptions,
  });

  const extension: ChatExtension = defineChatExtensions({
    name: "pbui-chat",
    widgets: pbuiWidgets,
    tools: [pbuiAcceptTool, pbuiProposeTool, ...workbenchTools.tools, ...sandboxTools.tools],
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
    chatClientRef = client;
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
        openTile: openTileWith(() => selectTimelineEntities(client.getStore().getState())),
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
    /** The agent's layout tools: their undo ring, and the history behind it. */
    workbenchTools,
    /** Route `openInTile` to a workbench's `widget` tiles from now on (null detaches). */
    attachWorkbench(next: Workbench | null) {
      workbench = next;
      // Re-advertise: every workbench tool's `available()` just flipped, and
      // the manifest the server holds is only refreshed on connect, on send,
      // and on extension install. Without this the tools are invisible to the
      // model for exactly one message, which reads as the model ignoring them.
      void chatClientRef?.tools.syncManifest();
    },
    /** The attached workbench, if any. */
    workbench: () => workbench,
    /** The agent's program tools and their shared dry-run path. */
    sandboxTools,
    /** Offer the sandbox tools from now on (null, null detaches). Re-advertises the manifest, as attachWorkbench does. */
    attachSandbox(nextLibrary: ProgramLibrary | null, nextEngine: ProgramEngine | null, nextInstances: InstanceRegistry | null = null) {
      library = nextLibrary;
      engine = nextEngine;
      instances = nextInstances;
      void chatClientRef?.tools.syncManifest();
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
