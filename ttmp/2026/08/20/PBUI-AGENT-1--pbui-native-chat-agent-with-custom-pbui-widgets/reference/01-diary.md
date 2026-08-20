---
Title: Diary
Ticket: PBUI-AGENT-1
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - backend
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md
      Note: Playbook for new PBUI-family apps; section 6 states the presentation protocol rules
    - Path: repo://packages/datalab-ui/src/pbui/verbs.ts
      Note: Production example of verbs-as-data vocabulary
    - Path: repo://proto/hyperslop/pbui/workbench/v1/workbench.proto
      Note: Workbench document + mutation protocol an agent could drive
    - Path: repo://src/presentation/createPbui.tsx
      Note: The PBUI runtime (Provider, Presentation, ObjectMenu, accept mode, MouseDocLine) the agent UI binds to
    - Path: repo://src/presentation/types.ts
      Note: Presentation reference/descriptor/action contract every agent widget must satisfy
ExternalSources: []
Summary: 'Chronological implementation diary for PBUI-AGENT-1: workspace survey, PBUI contract analysis, feature showcase, and the chat-agent design.'
LastUpdated: 2026-08-20T10:54:07.856409214-04:00
WhatFor: Record what was investigated, decided, and left open while designing the PBUI-native chat agent, so a second engineer can resume without re-deriving it.
WhenToUse: Read before resuming work on PBUI-AGENT-1 or reviewing its design docs.
---


# Diary

## Goal

Capture, step by step, how the PBUI-AGENT-1 ticket was researched and designed: what the workspace packages contribute to a chat-agent stack, what PBUI's presentation contract actually is, which showcase features were proposed, and how the design doc for a PBUI-native chat agent with custom (PBUI-object-embodying) widgets was arrived at. Failures and dead ends are recorded verbatim.

## Step 1: Survey the workspace and pin down PBUI's presentation contract

The workspace at `/home/manuel/workspaces/2026-08-20/add-pbui-agent` is a `go.work` over eight repos (`pbui`, `coinvault`, `react-chat`, `sessionstream`, `pinocchio`, `geppetto`, `hyperslop-cli`, `datalab`), each a git worktree on branch `task/add-pbui-agent`. docmgr's root is `pbui/ttmp` (per `.ttmp.yaml`), so the ticket lives in the pbui repo. I created `PBUI-AGENT-1`, this diary, and then read PBUI's presentation core directly (types, registry, `createPbui`, chrome, workbench proto) while four explorer agents mapped the other packages in parallel.

The headline finding: PBUI is *not* a widget toolkit in the usual sense. It is a **presentation protocol** — typed values (`{type, value}` references) bound to descriptors (`label`, `describe`, `actions → serializable verbs`, `tone`) with a single object menu, an "accept mode" (a command asks for an object of type X; the user clicks any presentation of that type anywhere, across tiles), a Genera-style mouse-doc line, tile chrome (`TileFrame`, `LauncherShell`, drag/dock) and a protobuf workbench document model. So "chat widgets that embody PBUI objects" means: every structured thing the agent emits must be a *presentation reference* with a descriptor, so it gets the menu, the verbs, accept-mode participation and tile-ability for free — not a one-off React component.

### Prompt Context

**User prompt (verbatim):** "Analyze pbui and coinvault and the other packages in this workspace (do not look outside of it or work outside of it) and create a new docmgr ticket and design a pbui chat agent with custom widget capability so that we can create a full feature PBUI based (presentation based UI native) chat agent whose widgets can embody PBUI objects.

Before writing a design doc, suggest a list of features we can do that would showcase the whole power, and make a doc with the suggestions and how they would work and use little ascii screenshots to show what they would look like.

commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)"

**Assistant interpretation:** Research the workspace packages (PBUI first, then coinvault's existing web-chat as the reference agent stack, plus react-chat / sessionstream / pinocchio / geppetto / datalab / hyperslop-cli), open a docmgr ticket, write (1) a feature-showcase document with ASCII mockups and (2) a design doc for a PBUI-native chat agent whose chat widgets are PBUI presentations. Keep a diary, commit as I go, stay inside the workspace.

**Inferred user intent:** Get a credible, well-grounded plan for a flagship "chat agent on PBUI" product that demonstrates what presentation-based UI buys over a conventional chat UI (object menus, accept mode, verbs as data, tiles/workbench), reusing the existing go-go-golems chat stack rather than inventing a new one.

### What I did
- Listed the workspace, read `AGENT.md`, `go.work`, `.ttmp.yaml`, `.wsm/wsm.json`; confirmed each repo is a worktree and noted its HEAD.
- `docmgr ticket create-ticket --ticket PBUI-AGENT-1 --title "PBUI-native chat agent with custom PBUI widgets" --topics pbui,chat,frontend,backend`; `docmgr doc add … --doc-type reference --title "Diary"`.
- Read `pbui/README.md`, `pbui/docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md` (all 695 lines), `src/presentation/{types,registry,createPbui}.ts(x)`, `src/chrome/{TileFrame,LauncherShell}.tsx`, `src/components/index.ts` + folder inventory, `proto/hyperslop/pbui/workbench/v1/workbench.proto`, `pkg/workbench/model.go`, and datalab-ui's binding layer (`packages/datalab-ui/src/pbui/{types,verbs,runtime}.ts(x)`, `descriptors/field.ts`, `appkit/registry.ts`, `apps/all.ts`).
- Launched four Explore agents: pbui (deep), coinvault (webchat), pinocchio + react-chat, sessionstream + geppetto + hyperslop-cli + datalab.

### Why
- The ticket's value hinges on understanding what PBUI's *protocol* is, not just its component list; the playbook and `createPbui.tsx` are where that protocol is stated and argued.
- coinvault is the only package with a shipped LLM web chat, so it is the reference for the backend/transport shape.

### What worked
- docmgr ticket creation and the diary scaffold worked first time; docmgr root resolves to `pbui/ttmp` so ticket commits go to the pbui worktree.
- Reading `createPbui.tsx` end to end gave the precise runtime surface: `Provider{onPerform,onAccept,environment}`, `Presentation{reference,activate,inComposite,doc}`, `ObjectMenu`, `MouseDocLine`, `AcceptBanner`, `usePbui(){accept,abortAccept,openMenu,perform,…}`, plus `conversions` (type coercion for accept) and `renderMenuHeader`.

### What didn't work
- `cat ttmp/2026/08/index.md` — `No such file or directory`; the ticket tree is `ttmp/YYYY/MM/DD/TICKET--slug/`, there is no month-level index.
- A chained `cd pbui && …` after an earlier `cd` produced `(eval):cd:1: no such file or directory: pbui` because the shell cwd had already moved into `pbui/`. Switched to absolute paths / `git -C`.

### What I learned
- PBUI's key types (`src/presentation/types.ts`): `PresentationReference<Values> = {type, value}`; `PresentationDescriptor{label, describe?, actions?, tone?}`; `PresentationAction{id,label,verb,description?,group?,danger?,disabledBecause?}` — **one field** for unavailability (the `disabled`/`disabledReason` pair is tombstoned as `never`).
- "Verbs are serializable data, never closures" (playbook §6) — this is exactly what makes an LLM able to *emit* and *receive* verbs: the agent can propose a verb as JSON and the product router performs it; the UI can report performed verbs back to the agent as a trace.
- Accept mode (`accept(request) → Promise<reference|null>`) reaches across tiles and workspaces — the natural shape for "agent asks the user to pick an object".
- A presentation value "carries what its menu needs to decide, resolved by the component that already knows it" (datalab `TileRef` comment). Agent-emitted objects must therefore carry enough state for their verbs to be decidable without a round trip.
- The workbench protocol (`workbench.proto`) models workspaces → split trees → `AppView{app_id, documents}` → `DocumentPayload{format, schema_version, Struct body}` with a `Mutation` oneof; the Go side (`pkg/workbench`) validates with host-provided `ApplicationCatalog` + `DocumentValidator`. An agent that can emit `Mutation`s can rearrange the user's workbench.
- Tile registry contract (`appkit/registry.ts`): `AppDescriptor{id,title,tone,docBound,duplicable,singleton,Component}` registered by side-effect import; a tile is a container that reads the store and hands data to an organism.

### What was tricky to build
- Nothing built yet; the tricky part was conceptual: separating "PBUI component" (Button, Meter, …) from "PBUI object" (a presentation reference with a descriptor). The user's phrase "widgets can embody PBUI objects" resolves to the latter — the design must make agent output *objects first*, with rendering as a consequence.

### What warrants a second pair of eyes
- Whether the ticket should live in `pbui/ttmp` (where docmgr points) or in a new product repo later. I kept it in pbui because that is the configured root and the design is PBUI-first.

### What should be done in the future
- Fold the explorer findings (coinvault/pinocchio/react-chat/sessionstream/geppetto) into Step 2 and relate the key files.

### Code review instructions
- Start with `pbui/src/presentation/createPbui.tsx` (the runtime), `pbui/src/presentation/types.ts` (the contract), `pbui/docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md` §6 (the argument). Then `packages/datalab-ui/src/pbui/verbs.ts` for a production verb vocabulary.
- Validate docmgr state: `docmgr doc list --ticket PBUI-AGENT-1`, `docmgr doctor --ticket PBUI-AGENT-1`.

### Technical details

The PBUI runtime surface a chat agent product will bind to:

```ts
const pbui = createPbui<Values, Environment, Verb>({ registry, defaultEnvironment, conversions?, renderMenuHeader? });
<pbui.Provider onPerform={(verb) => route(verb)} onAccept={(ref) => …} environment={env}>
  <pbui.Presentation reference={{type:"txn", value}} doc="a transaction" activate={{run, doc}} inComposite />
  <pbui.ObjectMenu /> <pbui.MouseDocLine ambient="…" /> <pbui.AcceptBanner />
</pbui.Provider>
const { accept, openMenu, perform, environment } = pbui.usePbui();
const picked = await accept({ types: ["field","txn"], prompt: "pick the field to group by", filter? });
```

## Step 2: Map the chat stack (coinvault, pinocchio, react-chat, sessionstream, geppetto, datalab, hyperslop-cli) and write the feature showcase

With PBUI's contract pinned down, the four explorer agents returned their maps and I cross-checked the load-bearing claims against source (`widget.proto`, `frontend_tool.proto`, `widgets/plugin.go`, `features.go`, `widgetRegistry.ts`, `toolRegistry.ts`, `extensions.ts`, `createChatClient.ts`, `service.go`). The picture that emerged: **every layer needed for a PBUI chat agent already exists, and the one thing missing is the object layer itself.** Pinocchio has a generic widget plugin (`WidgetInstanceStarted/Patched/Completed/Removed` → durable `ChatWidgetInstance` with `props: Struct`), react-chat's chat-provider has `defineWidget`/`WidgetOutlet` plus frontend/human tools and a unified live+hydrate adapter API, sessionstream gives snapshot-before-live hydration and the preview/commit pattern, geppetto gives `NewToolFromFunc` and `PublishEventToContext`, and hyperslop-cli/datalab already expose an agent-facing workbench `MutationBatch` API. Coinvault is the cautionary reference: eight bespoke widgets at ~13 edit points each.

I then wrote `design-doc/01-feature-showcase-for-a-pbui-native-chat-agent.md`: 22 features in five groups (objects everywhere; the verb round trip; custom widgets as composed presentations; workbench integration; agent self-knowledge), each with an ASCII mock-up and a "how it works" paragraph naming the existing mechanism it rides on, plus a five-minute demo script and a six-tier build order. Committed as `7a8e536`.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Fold the package research into the ticket, then produce the requested feature-suggestion document with ASCII screenshots before the design doc.

**Inferred user intent:** See the space of what "PBUI-native" makes possible (and cheap) before committing to a protocol, so the design doc optimises for the right things.

**Commit (docs):** 7a8e536 — "PBUI-AGENT-1: feature showcase doc with ASCII mock-ups"

### What I did
- Read the four explorer reports; verified the key files directly: `pinocchio/proto/pinocchio/chatapp/widgets/v1/widget.proto`, `pinocchio/proto/pinocchio/chatapp/frontendtools/v1/frontend_tool.proto`, `pinocchio/pkg/chatapp/widgets/plugin.go`, `pinocchio/pkg/chatapp/features.go`, `pinocchio/pkg/chatapp/service.go` (`PromptRequest{Prompt, Attachments, IdempotencyKey, Runtime, InitialTurn, OnFinalTurn}`), `react-chat/packages/chat-provider/src/{widgets/widgetRegistry.ts,tools/toolRegistry.ts,core/extensions.ts,core/createChatClient.ts}`.
- Wrote and committed the showcase doc; related six files; ticked task 2; added a changelog entry.

### Why
- The showcase has to be grounded in mechanisms that exist, or the design doc would be writing a new chat stack instead of an object layer on the existing one.

### What worked
- The explorer fan-out (4 agents, ~350–435 s each) covered eight repos in parallel without overlap; every "how it works" paragraph in the showcase names a real file.

### What didn't work
- `cat >> ttmp/...` and `git add` failed once with `no such file or directory` / `fatal: not a git repository` because the shell cwd had drifted to the workspace root between calls; re-ran with `cd /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui` prefixed. (Absolute paths from here on.)
- One correction to an explorer claim: react-chat's report said "CoinVault is referenced only via a migration guide" — true for react-chat's tree, but coinvault itself depends on `@go-go-golems/chat-provider` v0.2.1 solely for `buildWebSocketURL`; the frontend port is tracked as COINVAULT-044 and is not done.

### What I learned
- **Transport is WebSocket-only** in pinocchio/react-chat/coinvault (sessionstream `transport/ws`); the PBUI *workbench* streams SSE revision invalidations. Two different push models meet in this product.
- **Schema policy**: sessionstream-lint / `make schema-vet` rejects a top-level `structpb.Struct` payload; an inner `Struct` field (as in `WidgetInstanceEntity.props`) is allowed. So a generic PBUI payload must be a named proto message wrapping a Struct or typed fields.
- **`ChatWidgetAction` is a dead letter**: `WidgetActionCommand` exists in `widget.proto` and `CommandWidgetAction = "ChatWidgetAction"` is a constant, but `WidgetPlugin.RegisterSchemas` never registers it and no handler exists. The only browser→backend interaction today is the frontend-tool bridge (`FrontendToolManifestCommand` / `FrontendToolResultCommand`; `Manager.Request` blocks the tool loop until the browser answers).
- **Human tools** in chat-provider (`mode: 'human'`, `render({input, respond, reject})`) are the natural carrier for "agent asks for an object" (accept mode) and for proposals; they hydrate (`reconcileFrontendToolRequests` re-parks pending calls after reload).
- **Timeline = UI truth, turns = model-context truth** (pinocchio): the widget entity and the turn block are separate; anything the model must *see again* has to be in a turn block, not only in a timeline entity.
- `PromptRequest.InitialTurn` lets the app seed the user turn with extra blocks — the cheapest way to give the model typed references (`refs[]`) without changing pinocchio.
- Coinvault's anti-hallucination rules are worth keeping: the model supplies *ids*, the server resolves values (`projectionlookup`); evidence ids only; closed enums; failures become an error entity rather than silence.
- sessionstream Pattern 2 (batch-patch-into-delta): carry the accumulated state in every patch so a reconnecting client hydrates the whole widget; previews are live-only; the commit clears the preview.
- DATADROP-11 already ported the "agent workbench" widgets (TransportBar, SegmentedBar, DiffHunk, Sparkline, ResultLog) into pbui and deliberately did *not* declare agent presentation types ("do not declare a presentation type until something renders it and a descriptor answers for it") — this ticket is where they get declared.

### What was tricky to build
- Choosing the mock-up domain. Coinvault's (products, SQL, evidence) makes the features concrete; datalab's (drops, fields) proves neutrality. I used coinvault for 20 mock-ups and datalab for one (E3), and kept every mechanism paragraph domain-free.
- Keeping ASCII boxes legible inside a Markdown code fence while showing nested menus; I used a fixed legend (`<type …>`, `▾`, `[ verb ]`, `┆`) and kept each mock-up under 80 columns.

### What warrants a second pair of eyes
- Tier ordering in §G: I put "custom widgets" (tier 2) *after* "round trip" (tier 1) because verbs-as-data both ways is the novel claim; a reviewer optimising for replacing coinvault's pipeline quickly might swap them.
- B4's claim that accept mode can be carried by a human tool with no wire change — true for the request/result path, but the *accept banner must survive reload*; that relies on `reconcileFrontendToolRequests` re-parking the pending call, which I verified exists but did not run.

### What should be done in the future
- Design doc (Step 3): decide the named proto message for PBUI objects, the refs-on-send contract, the verb schema generation, and where the code lives.

### Code review instructions
- Read `design-doc/01-feature-showcase-for-a-pbui-native-chat-agent.md` §0 and §G first, then any one feature in full; check its "how it works" against the file it names.
- Key reference files: `pinocchio/pkg/chatapp/widgets/plugin.go`, `pinocchio/proto/pinocchio/chatapp/widgets/v1/widget.proto`, `react-chat/packages/chat-provider/src/tools/toolRegistry.ts`, `coinvault/internal/webchat/coinvault_projection_feature.go`, `hyperslop-cli/pkg/client/workbenches.go`.

### Technical details

The existing seams the showcase relies on (verified):

```go
// pinocchio/pkg/chatapp/features.go
type ChatPlugin interface {
    RegisterSchemas(reg *sessionstream.SchemaRegistry) error
    HandleRuntimeEvent(ctx, runtime RuntimeEventContext, event gepevents.Event) (handled bool, err error)
    ProjectUI(ctx, ev, session, view) ([]sessionstream.UIEvent, bool, error)
    ProjectTimeline(ctx, ev, session, view) ([]sessionstream.TimelineEntity, bool, error)
}
// pinocchio/pkg/chatapp/widgets/plugin.go
PublishWidgetInstanceStarted(ctx, sid, pub, &widgetv1.WidgetInstanceStarted{InstanceId, WidgetName, ParentMessageId, Status, Props})
PublishWidgetInstancePatched(ctx, sid, pub, &widgetv1.WidgetInstancePatched{InstanceId, Status, Patch, PatchPaths})
PublishWidgetInstanceCompleted / PublishWidgetInstanceRemoved
```

```ts
// react-chat/packages/chat-provider
defineWidget(name, Component<WidgetProps{instanceId, widgetName, status, props}>)
defineChatExtensions({ name, tools, widgets, timelineAdapters, install })
HumanTool{ mode:'human', parameters: zod, render({toolCallId, input, respond, reject}) }
ChatProviderConfig{ sendMessageBody?: (req: {prompt, attachments?}) => body }
```
