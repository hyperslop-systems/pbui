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
    - Path: repo://pkg/chatserver/scripted/scenarios.go
      Note: Demo scenarios (mentions, streaming table, accept/propose) (commit dfe42fa)
    - Path: repo://pkg/chatserver/server.go
      Note: 'Server wiring: chatapp + sessionstream + pbuichat + scripted engine (commit dfe42fa)'
    - Path: repo://pkg/pbuichat/emitter.go
      Note: Emission contract shared by the real runtime and the scripted engine (commit dfe42fa)
    - Path: repo://pkg/pbuichat/plugin.go
      Note: chatapp.ChatPlugin mapping geppetto events to refs/widgets and trace projections (commit dfe42fa)
    - Path: repo://plugins/devctl_pbui_chat.py
      Note: devctl plugin with dev/dev-real/prod profiles (commit dfe42fa)
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

## Step 3: Write the design doc, decide placement, seed the implementation tasks

The design doc (`design-doc/02`) turns the showcase into a contract. The central decision was *how little* new wire surface to add: objects and widgets ride inside pinocchio's existing `ChatWidgetInstance` entity (`widget_name ∈ {pbui.refs, pbui.widget, pbui.error}`, document in `props`), accept/proposals ride the frontend-tool bridge as human tools, and the only new command is `PbuiVerbPerformed` → `PbuiTraceEntry` — the typed replacement for pinocchio's never-wired `ChatWidgetAction`. The second decision was the single source of truth for the vocabulary: the product's zod-typed `Values`/`Verb`/widget-document schemas export a `vocabulary.json` that the Go plugin embeds to validate model output, generate the system-prompt section and answer `pbui_describe_types`, with a CI staleness check in the playbook's `schema-check` shape.

Placement: TS `@hyperslop-systems/pbui-chat` in `pbui/packages/pbui-chat`, Go `pbuichat` in `pbui/pkg/pbuichat`, `chat.proto` beside `workbench.proto`, a demo binary with a mock runtime, coinvault as the first product behind a flag, datalab-ui second. The known cost — pbui's `go.mod` pulling pinocchio/sessionstream/geppetto — is recorded as D2/R1 with a mechanical exit. Committed as `7944c1a`; the ticket index now has an overview and a reading order, and four Tier-0 tasks are queued.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Produce the design doc for the PBUI chat agent with custom widget capability, grounded in the showcase and the verified seams.

**Inferred user intent:** A design an engineer can start implementing (Tier 0) without further research, and a reviewer can challenge decision by decision.

**Commit (docs):** 7944c1a — "PBUI-AGENT-1: design doc for the PBUI-native chat agent; index overview; tier-0 tasks"

### What I did
- Wrote `design-doc/02-design-pbui-native-chat-agent-with-custom-pbui-widgets.md` (754 lines): §2 system map, §3 vocabulary, §4 seam table, §5 contract (chat-layer types, wire payloads, `chat.proto`, refs/focus on send, widget document, `vocabulary.json`), §6 Go package, §7 TS package, §8 four sequences, §9 hydration/consistency/trust, §10 placement + tiers with gesture-stated acceptance + required tests, §11 decisions D1–D7 and risks R1–R4, §12 appendix (descriptor, verb schema, hydrated refs entity, coinvault wiring).
- Related ten files to the design doc; filled `index.md`; ticked tasks 3–4; added four Tier-0/decision tasks; changelog entry; committed.

### Why
- Reusing `ChatWidgetInstance` avoids a second hydration path and stays inside the schema policy (inner `Struct` only); the one new command is the one channel that genuinely does not exist.
- Putting the vocabulary in zod lets descriptors, chip validation, the Go validator and the system prompt all derive from one declaration — the "two hand-written copies drift, silently" lesson from playbook §5.

### What worked
- Every row in the §4 seam table points at a file I had read; the four sequence diagrams could be written from the verified function names (`Manager.Request`, `BridgeExecutor`, `PublishWidgetInstancePatched`, `InitialTurn`).
- `docmgr validate frontmatter` passed on both design docs.

### What didn't work
- N/A for this step (no commands failed).

### What I learned
- chat-provider 0.5 has no generic "submit command" on the client; frontend-tool results go through an HTTP route that the app turns into `hub.Submit`. The verb report therefore needs an app route for v1 (D4) — a small but real gap worth proposing upstream as `client.submitCommand`.
- The widget document needs an explicit `unresolved` rewrite rule and a `pbui.error` widget so that *every* failure mode is visible in the timeline; coinvault's `projection_error` taught that silence is the worst outcome.
- "Verb availability is never stored": recomputing `disabledBecause` from entity state in the descriptor is what makes reload-correct proposals free.

### What was tricky to build
- Separating **timeline truth** from **model truth**. The server-published `pbui.refs` entity is UI-only (the model already said those ids); user refs must go into a turn block (`pbui.refs@v1`) or the model never sees them again after the next turn. Getting this wrong would make "compare these two" work once and then silently forget the objects.
- Deciding whether the model emits widgets via hidden blocks (coinvault's way, `structuredsink`) or a tool. I chose the tool (D3): provider-validated arguments, an id the model can mention, no prose contamination; the extractor path stays available.
- Naming the actor on the trace: the browser is the only place a verb becomes an effect, so it reports both human and agent verbs; the server assigns `seq`. An agent verb that the model *asked for* but the router *rejected* is still recorded (`outcome: rejected:…`), which is what makes the trace an audit rather than a log of successes.

### What warrants a second pair of eyes
- D1 (reuse `ChatWidgetInstance`): a reviewer may prefer a typed `PbuiObjectEntity` from day one; the exit is cheap but not free.
- D2 (Go package in pbui): dependency weight on a library repo.
- §9's claim that accept mode survives reload via `reconcileFrontendToolRequests` — verified by reading, not by running (R3).
- The `Limits` defaults (32 refs/message, 64 children, depth 3, 500 rows/document) are guesses; they should be tuned against coinvault's real answers.

### What should be done in the future
- Tier 0 as listed in design §10.2 and in the task list; resolve D1–D7 before writing `chat.proto`.
- Propose `client.submitCommand` upstream in react-chat to retire D4's app route.
- Consider writing the `vocabulary.json` staleness check and the Go/TS widget-document parity fixtures *first* (they are what keeps both sides honest).

### Code review instructions
- Read design §5 (contract) and §11 (decisions) first; then §6.2/§6.3 against `pinocchio/pkg/chatapp/features.go` and `widgets/plugin.go`; then §7.2 against `react-chat/packages/chat-provider/src/core/extensions.ts` and `tools/toolRegistry.ts`.
- Validate docs: `docmgr doctor --ticket PBUI-AGENT-1`, `docmgr validate frontmatter --doc <each design doc>`.

### Technical details

Commits on `task/add-pbui-agent` in the pbui worktree for this ticket:

| Commit | Content |
|---|---|
| `6b0a960` | ticket opened, diary step 1 |
| `7a8e536` | design-doc/01 feature showcase |
| `94c40d3` | diary step 2 |
| `7944c1a` | design-doc/02 design, index overview, tier-0 tasks |

Nothing outside `pbui/ttmp/2026/08/20/PBUI-AGENT-1--…/` was modified; no code was written in any repo.

## Step 4: Implement the Go side in pbui — proto, `pbuichat` plugin, `chatserver`, scripted engine, SPA embed, `pbui-chat` command, devctl

The user asked for the design to be implemented inside pbui, with a Go server backend in pbui too, plus devctl profiles for dev and prod. This step is the Go half. It follows design §5/§6 closely with two deliberate simplifications recorded below: the vocabulary validator is structural (known types, verb kinds and required fields with coarse types, widget-document shape and limits) rather than a JSON-Schema engine, and user refs reach the real runtime as a `pbui-refs` fenced section appended to the prompt rather than as a separate turn block. Everything compiles under `GOWORK=off` (the Makefile/CI mode) against the published versions pinned in `go.mod` — pinocchio v0.11.12, sessionstream v0.1.2, geppetto v0.13.10, glazed v1.4.3 — which match the local worktree HEADs.

The scripted engine is the piece that makes the product demoable without a model: it answers eight intents (help, low stock, health dashboard, reorder with accept + proposal, compare, form, error, top sellers, trace) through exactly the emission code the real runtime uses (`Emitter.EmitRefsForText`, `EmitWidget`, `EmitStreamingTable`) and the frontend-tool bridge (`Manager.Request` for `pbui_accept`/`pbui_propose`). Five end-to-end tests drive the HTTP surface and assert on the hydrated snapshot.

### Prompt Context

**User prompt (verbatim):** "Implement it, as part of pbui, with a go server backend in pbui as well .
 
   write a detailed project report for the obsidian vault as a deep dive technical analysis blog post using a textbook
  writing style (no analogies, see skill).
   Commit and push the bsidian vault when done (go-go-parc vault)."

**User prompt (verbatim, mid-turn):** "add a devctl setup to launch it (dev and prod versions) in pbui as well. (see skill)"

**Assistant interpretation:** Build the design for real inside the pbui repo: Go plugin + Go HTTP server + TS package + demo SPA embedded in the binary, with devctl dev/prod profiles; then write a textbook-style technical report into the go-go-parc Obsidian vault and push it.

**Inferred user intent:** A working, runnable PBUI chat agent in pbui (not just a design), reproducible via devctl, and a durable write-up.

### What I did
- `proto/hyperslop/pbui/chat/v1/chat.proto` (`Reference`, `Provenance`, `Actor`, `VerbPerformedCommand`, `TraceEntry`, `WidgetRequestedEvent`); split buf templates (`buf.gen.yaml` for workbench, `buf.gen.chat.yaml` for chat) invoked with `--path`; Go gen in `gen/go/hyperslop/pbui/chat/v1`, TS gen in `packages/pbui-chat/src/generated`.
- `pkg/pbuichat`: `vocabulary.go` (parse/validate `vocabulary.json`, `ValidateVerb`, `ValidateReference`), `mentions.go` (`[[type:id|label]]` scanner), `widgetdoc.go` (closed child-kind set, limits, `ValidateWidgetDocument`, `NewTableDocument`), `reference.go`, `resolver.go` (`Resolver`, `ResolverMux`, `StaticResolver`), `emitter.go` (`pbui.refs` / `pbui.widget` / `pbui.error` through pinocchio's widget events), `plugin.go` (`chatapp.ChatPlugin`: runtime events → refs/widgets; `RowsToTable` projection; trace projections), `trace.go` (`PbuiVerbPerformed` command handler with per-session `seq`, in-memory ring + timeline entity), `events.go` (geppetto event `pbui-widget-requested`), `tools.go` (`pbui_widget`, `pbui_trace`, `pbui_describe_types` via `NewToolFromFunc`), `prompt.go` (`SystemPromptSection`, `RenderRefsSuffix`), 7 unit tests.
- `pkg/chatserver`: `server.go` (schema registry, hydration/turn stores via `serverkit.StoreSpec`, ws transport, chatapp engine + plugins, hub installs), `handlers.go` (Go 1.22 patterns: sessions, snapshot, messages with `{prompt, refs, focus}`, stop, tools manifest/results, `/verbs`, `/api/pbui/vocabulary`, `/api/chat/ws`), `real_runtime.go` (pinocchio `profilebootstrap` → engine wrapped with a system-prompt middleware, PBUI tools + browser tools in one registry, `BridgeExecutor`), `demo/` (vocabulary.json + 8-SKU world + resolvers), `scripted/` (engine + scenarios), `server_test.go` (5 e2e tests).
- `pkg/chatui`: `embed.go` (`//go:build embed`, `all:embed`), `embed_none.go` (on-disk), `generate.go` (behind `generate_ui` tag so CI's `go generate ./...` needs no node), `spa.go` (`GET /{$}`, `/ui/{path...}`, `/static/{path...}` with no fallback) + test.
- `cmd/pbui-chat`: glazed `serve` (host/port/timeline-db/turns-db/chunk-delay/real-runtime/system-prompt + pinocchio profile section) and `prompt` (prints the generated section).
- `.devctl.yaml` profiles `dev`, `dev-real`, `prod`; `plugins/devctl_pbui_chat.py` (config.mutate, validate.run, build.run for prod, launch.plan, commands ui-build/vocab/prompt). Makefile: `chat-ui`, `chat-build`, `chat-serve`, `chat-test`; `protocol-generate/check` cover both templates. `.gitignore`: `pkg/chatui/embed/*` except `.gitkeep`, `bin/`, `var/`.
- `go work use …` at the workspace root (go.work now says `go 1.26.6`), `GOWORK=off go mod tidy`, logcopter regeneration for the new packages.

### Why
- Riding pinocchio's widget entity for refs and widgets keeps one hydration path and satisfies the schema policy; only the trace needed a new wire type.
- A scripted engine lets the browser, CI and the devctl `prod` profile work without credentials, and is the fixture source for the TS stories.
- The build-tag guard on `go generate` keeps the Go CI job node-free while still offering one command to build the UI.

### What worked
- `pbuichat` tests passed on the first run; the five `chatserver` e2e tests (refs + widgets after a run, trace recording incl. rejected verbs, accept → propose round trip via `/tools/manifest` + `/tools/results`, error widget, vocabulary endpoint) passed on the first run.
- `golangci-lint run` → 0 issues after fixing two `predeclared` names (`max`, `real`); `glazed-lint` and `logcopter-check` clean.

### What didn't work
- `pnpm install --frozen-lockfile` at the pbui root failed: `ERR_PNPM_FETCH_403 GET https://npm.pkg.github.com/download/@hyperslop-systems/plot/0.2.0/… Forbidden` (datalab-ui's dependency; the local token has no access). Workaround: `pnpm install --no-frozen-lockfile --filter '!@hyperslop-systems/datalab-ui'` — succeeded and left the lockfile unchanged. Recorded in the Makefile comment and the devctl validate warning.
- `go build ./pbui/...` in workspace mode failed with `module sessionstream listed in go.work file requires go >= 1.26.6, but go.work lists go 1.25`; fixed with `go work use` (bumps go.work to 1.26.6).
- First `go vet` after adding deps: dozens of `missing go.sum entry` lines → `GOWORK=off go mod tidy` (twice: once for the plugin, once for the command's glazed logging imports).
- `buf generate` with one template failed: `plugin packages/workbench-protocol/node_modules/.bin/protoc-gen-es: … no such file` (no node_modules yet) and buf v2 has no per-plugin path filter, hence two templates + `--path`.
- Two lefthook pre-commit rejections: first `golangci-lint fmt --diff` on a one-line test helper; second the full `go test ./...` ran while the server package was half-written (`no required module provides package …/chatserver/scripted`) plus two typecheck errors: `serverkit.EncodeSnapshotResponse` takes a `func([]SnapshotEntity) string`, and `middleware.NewEngineWithMiddleware` does not exist (geppetto's `newEngineWithMiddlewares` is unexported in `toolloop/enginebuilder`) — restated as a 10-line `withMiddlewares` using `middleware.Chain`.
- `profilebootstrap.ProfileSettingsSlug` does not exist; it is `ProfileSettingsSectionSlug`, and `ProfileSettings` has no `ConfigFile` (dropped; `ParsedValues` carries it).
- logcopter-gen creates a package-level `log` in every `pkg/...` package, which collided with my `zerolog/log` imports (`other declaration of log`); dropped the imports and used the generated logger (zerolog-compatible API).

### What I learned
- Patch merge semantics differ: the Go timeline projection *replaces* a path listed in `patch_paths`, while chat-provider *appends* arrays for listed paths. The only encoding both treat identically is a patch without `patch_paths` carrying the whole accumulated top-level value — which is sessionstream's batch-patch-into-delta pattern anyway. `Emitter.PatchWidget` documents this.
- `RuntimeEventContext.Publish` and `sessionstream.EventPublisher` differ only in binding the session id; one `Publisher` func type lets the real runtime and the scripted engine share every emission path.
- A tool executed by geppetto does not know the chat message id; publishing a custom geppetto event from the tool (`PublishEventToContext`) and letting the plugin's `HandleRuntimeEvent` (which has `runtime.MessageID`) assign the widget id is the clean seam.
- lefthook runs the *whole* Go gate (fmt, lint, logcopter, glazed-lint, tests, build) on every commit in pbui — about 25 s; half-written packages block unrelated commits.

### What was tricky to build
- Keeping live and hydrated widget state identical (see merge semantics above). Symptom if wrong: a streaming table looks right live and shows only the last batch after reload. Fix: accumulated top-level values, no paths.
- Per-session sequence numbers for the trace across restarts: the in-memory counter is seeded from the timeline view's highest `seq` inside `ProjectTimeline`, so a rehydrated session never reuses a number.
- The frontend-tool round trip in tests: `Manager.Request` blocks the scripted goroutine until `/tools/results` arrives; the test polls the snapshot for a `ChatFrontendToolCall` with `status:"requested"` and answers it, twice (accept, then propose).

### What warrants a second pair of eyes
- `Plugin` embeds `*Emitter` and reuses its mutex for `widgetCount`; fine today, but a separate lock is cleaner if the plugin grows state.
- `pbui_widget` returns a placeholder widget id (the id is assigned when the event is handled); the model is told to mention the title. If precise ids matter, the tool needs the message id via context (a small pinocchio change or a context key set in `RuntimeContext`).
- The real runtime path compiles but was not exercised against a provider (no credentials in this environment).
- Limits defaults (32 refs/message, 64 children, depth 3, 500 rows, 500 trace entries) are untuned.

### What should be done in the future
- Exercise `--real-runtime` with a pinocchio profile; add a recorded-run test.
- Pass refs as a typed turn block (`InitialTurn`) instead of a prompt suffix once the model-facing shape has settled.
- Propose `client.submitCommand` upstream in chat-provider so `/verbs` can retire.

### Code review instructions
- Start at `pkg/pbuichat/emitter.go` (the emission contract) and `pkg/pbuichat/plugin.go` (how runtime events map to it); then `pkg/chatserver/server.go` for wiring and `pkg/chatserver/scripted/scenarios.go` for the demo behaviour.
- Validate: `make chat-test` (Go part: `GOWORK=off go test ./pkg/pbuichat/... ./pkg/chatserver/... ./pkg/chatui/...`), `GOWORK=off golangci-lint run`, `make protocol-check`, `GOWORK=off go run ./cmd/pbui-chat prompt`.
- Run: `GOWORK=off go run ./cmd/pbui-chat serve --port 8090` then `curl -X POST localhost:8090/api/chat/sessions -d '{}'`.

### Technical details

```
POST /api/chat/sessions                      -> {sessionId}
POST /api/chat/sessions/{id}/messages        {prompt, refs?: Reference[], focus?}
POST /api/chat/sessions/{id}/stop
GET  /api/chat/sessions/{id}                 hydrated snapshot (serverkit encoding)
POST /api/chat/sessions/{id}/tools/manifest  {revision, tools[{name, mode, inputSchema, available}]}
POST /api/chat/sessions/{id}/tools/results   {toolCallId, toolName, result, status}
POST /api/chat/sessions/{id}/verbs           {clientSeq, actor, verb, target?, outcome}
GET  /api/pbui/vocabulary                    vocabulary.json
GET  /api/chat/ws                            sessionstream websocket (snapshot, then live)
GET  /{$} · /ui/{path...} · /static/{path...}
```

Widget instance names: `pbui.refs` (`<messageId>-refs`, props `{schema_version, refs{"type:id": Reference}}`), `pbui.widget` (`<messageId>-w<n>`, props = document), `pbui.error` (`<widgetId>-error`, props `{message, document?, at}`). Trace: command `PbuiVerbPerformed`, event `PbuiVerbRecorded`, UI event `PbuiTraceEntryUpsert`, entity `PbuiTraceEntry` (id `trace-<seq>`).

## Step 5: TypeScript package lands, prod profile runs the embedded binary, the real model path works

The TypeScript half was built by a subagent against the contract from Step 4 and came back green (43 tests; typecheck; lib, demo and storybook builds; the demo's `exportVocabulary()` deep-equals the Go-embedded `vocabulary.json`). I verified its checks myself, committed it (`a7960e4`), and then ran the whole product the way an operator would: `devctl up --profile prod` built pbui, the demo SPA and `bin/pbui-chat` with `-tags embed`, and served it on :8090; in a Playwright browser the page rendered the legend, composer and mouse-doc line, a "low stock" question produced an answer whose nouns are presentations, a streaming table whose headers are `field` objects and rows `row` objects, and verb chips; right-clicking a product opened the PBUI object menu with a `disabledBecause` entry ("Draft a reorder — needs approver role"); "Add to watchlist" updated the watchlist and recorded trace entry #1.

The user asked whether this was a real backend. It is the real Go server (pinocchio chatapp, sessionstream hydration and websocket, the pbuichat plugin), but the answers came from the scripted engine. A pinocchio profile registry exists on this machine, so I wired the real path properly and ran it against `gpt-5-nano-low`: after three fixes (below) the model calls `shop_products`, the result is projected into a table widget, the model's own `pbui_widget` call is accepted after the validator's messages corrected it, and the final prose's mentions resolve into a `pbui.refs` entity. Committed as `086c82c`.

### Prompt Context

**User prompt (verbatim, mid-turn):** "is this a real backend?"

**Assistant interpretation:** Clarify what is real (server, transport, plugin) versus scripted (the model), and if credentials exist, prove the real model path.

**Inferred user intent:** Know whether the demo reflects the production architecture or a mock.

**Commit (code):** a7960e4 — "pbui-chat: TypeScript package and demo product"; e052ea3 — "demo data tools for the real runtime; devctl build.run schema fix"; 086c82c — "make the real runtime emit refs and projections"

### What I did
- Re-ran the TS gates (`typecheck`, 43 vitest tests, demo typecheck); committed `packages/pbui-chat` + demo, `pnpm-workspace.yaml` (added the demo), lockfile, the reformatted `vocabulary.json`.
- Patched the demo `vite.config.ts` with a `closeBundle` plugin that re-creates `pkg/chatui/embed/.gitkeep` (`emptyOutDir` deleted it); fixed `make chat-ui` and the devctl build step to use `pnpm --include-workspace-root --filter @hyperslop-systems/pbui build` (pnpm excludes the root from filtered runs).
- `devctl up --profile prod`: the build ran, then `E_CONFIG_INVALID: could not resolve launch plan`; with `--skip-build` it launched, which isolated the cause to my `build.run` response. `devctl help plugin-authoring` §6.3 wants `steps[{name, ok, duration_ms}]` and `artifacts` as a name→path map; rewrote `build_steps`.
- Browser check through the Playwright MCP on http://127.0.0.1:8090/ (embedded binary): snapshot of the conversation, object menu, watchlist and trace; screenshot saved as `pbui-chat-low-stock.png`.
- Added `pkg/chatserver/demo/tools.go` (`shop_products`, `shop_product`) and an `Options.Tools` hook so a real model can learn the inventory; default projection rule `RowsToTable("shop_products","rows")`.
- Ran `go run ./cmd/pbui-chat serve --port 8091 --real-runtime --profile gpt-5-nano-low --profile-registries ~/.config/pinocchio/profiles.yaml` in tmux and drove it with curl; iterated until refs, projection and model widgets all appeared in the snapshot.

### Why
- The prod profile is the only path that proves the embedded binary, the SPA route boundaries and hydration together.
- The user's question deserved a demonstration, not an assurance; the registry made one possible.

### What worked
- The TS package integrated with the Go server without a single contract mismatch: the widget-instance shapes, the `/verbs` body, the human-tool result shapes and the vocabulary all matched on first contact.
- gpt-5-nano-low used the tools as intended and recovered from two rejected widget documents using the validator's error strings ("verbs[3]: verb reorder is missing productId").

### What didn't work
- `devctl up --profile prod --force`: `E_USAGE: unknown flag: --force` (and `status --tail-lines`); the installed devctl has neither flag. Used plain `up`/`status`.
- `devctl up --profile prod` → `E_CONFIG_INVALID: could not resolve launch plan` caused by the `build.run` response shape (see above).
- First real run: `resolve pinocchio profile "gpt-5-nano-low": open /home/manuel/workspaces/2026-06-30/benchmark-cpu-inference/rag-ttc/profiles.yaml: no such file or directory` — the default registry path came from a stale pinocchio config; passing `--profile-registries ~/.config/pinocchio/profiles.yaml` fixed it (the devctl `dev-real` profile already passes it).
- Second real run: the model answered correctly but no `pbui.widget` for the tool result and no `pbui.refs` appeared. Two distinct causes: (1) `chatapp.Engine.handleFeatureRuntimeEvent` returns at the first plugin reporting `handled=true`, and the tool-call plugin claims tool events — pbuichat must be first in the list; (2) pinocchio's `runtimeEventSink.PublishEvent` handles `EventTextSegmentStarted/Delta/Finished` in its own `switch` and only the `default` branch reaches plugins, so `HandleRuntimeEvent` never sees finished text. Fixed with a `ComposedRuntime.WrapSink` wrapper (`runBinding`/`refsSink` in `real_runtime.go`) bound to the session publisher through `RuntimeContext`.
- The model's first `pbui_widget` call guessed a schema (`document.document.columns/rows/type`) → "widget has no children". Added a worked example to the tool description and to the generated prompt; subsequent runs produced valid documents within one retry.
- A `gofmt` rejection by lefthook on a long closure line; `golangci-lint fmt` fixed it.

### What I learned
- The scripted engine masked two real-runtime seams (plugin ordering, the sink switch) because it calls the emitter directly. A scripted engine is valuable, but the real path must be run at least once before claiming the plugin works.
- `WrapSink` is the general-purpose "see every geppetto event" hook in pinocchio's runtime; plugins see only what the sink does not consume.
- devctl's `plan` validates `launch.plan` but not `build.run`; a malformed build response surfaces later as a launch-plan error.

### What was tricky to build
- Binding the sink wrapper to the session: the wrapper is created when the `PromptRequest` is built (session known, message id not), while `RuntimeContext` is called when the run starts (message id known). A small mutex-guarded `runBinding` shared by both closures carries `sid/messageID/pub` across that gap.

### What warrants a second pair of eyes
- The `profiles.yaml` on this machine carries an inline API key; it appeared in a tool output while inspecting the profile stack. Nothing was copied anywhere, but the file should move to `env:` references.
- `refsSink` uses `context.Background()` for resolution; a per-run context with a timeout would be better once resolvers hit databases.

### What should be done in the future
- Tiles: the user asked for proper PBUI workbench tiles (drag, dock, resize, launcher) reusable across PBUI apps — in progress as `packages/pbui-workbench` (Step 6).
- Return the real widget id from `pbui_widget` by carrying the message id in the run context.

### Code review instructions
- `pkg/chatserver/real_runtime.go` (`runBinding`, `refsSink`, plugin order comment in `server.go`), `pkg/chatserver/demo/tools.go`, `plugins/devctl_pbui_chat.py` (`build_steps`).
- Validate: `devctl up --profile prod` then open http://127.0.0.1:8090/; `go run ./cmd/pbui-chat serve --port 8091 --real-runtime --profile gpt-5-nano-low --profile-registries ~/.config/pinocchio/profiles.yaml` and ask "which gold eagles are low on stock?".

### Technical details

Hydrated snapshot of the real run (abridged): `ChatToolCall shop_products {"category":"7","low_stock":true,"metal":"gold"}` → `ChatWidgetInstance chat-msg-1-w1 pbui.widget [table]` → `ChatToolCall pbui_widget` (rejected: "verbs[0]: verb reorder is missing productId") → `ChatToolCall pbui_widget` → `ChatWidgetInstance chat-msg-1-w2 pbui.widget [table] verbs=2` → assistant text with `[[product:2049|…]]` → `ChatWidgetInstance chat-msg-1-refs pbui.refs refs=[product:2049, product:2051, product:2077]`.
