---
Title: 'Design: PBUI-native chat agent with custom PBUI widgets'
Ticket: PBUI-AGENT-1
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - backend
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://proto/hyperslop/pbui/workbench/v1/workbench.proto
      Note: sibling proto; chat.proto goes next to it
    - Path: repo://src/presentation/createPbui.tsx
      Note: Provider/onPerform/accept runtime the router wraps
    - Path: ws://coinvault/internal/webchat/server/server.go
      Note: first-product wiring point (Features slice)
    - Path: ws://pinocchio/pkg/chatapp/features.go
      Note: ChatPlugin interface pbuichat.Plugin implements
    - Path: ws://pinocchio/pkg/chatapp/frontendtools/bridge.go
      Note: BridgeExecutor/Manager.Request that carries pbui_accept and proposals
    - Path: ws://pinocchio/pkg/chatapp/service.go
      Note: PromptRequest.InitialTurn used to pass refs/focus to the model
    - Path: ws://pinocchio/pkg/chatapp/widgets/plugin.go
      Note: WidgetInstance publish/merge path reused for pbui.refs and pbui.widget
    - Path: ws://pinocchio/proto/pinocchio/chatapp/widgets/v1/widget.proto
      Note: WidgetInstance messages (and the never-wired WidgetActionCommand the trace command replaces)
    - Path: ws://react-chat/packages/chat-provider/src/core/extensions.ts
      Note: ChatExtension shape createPbuiChat returns
    - Path: ws://react-chat/packages/chat-provider/src/tools/toolRegistry.ts
      Note: HumanTool render/respond contract
ExternalSources: []
Summary: 'Architecture and protocol for a chat agent whose every structured output is a PBUI presentation object: the object/verb/widget contract, how it rides on pinocchio chatapp + sessionstream + react-chat chat-provider, the Go plugin and TS package that implement it, hydration, trust boundaries, code placement, and a tiered implementation plan.'
LastUpdated: 2026-08-20T11:06:59.951268672-04:00
WhatFor: Let an engineer build the PBUI chat agent without re-deriving which existing seam carries which concern, and give reviewers one place to challenge the protocol decisions.
WhenToUse: Read after design-doc/01 (the showcase). Sections 3–6 are the contract; section 10 is the build order; section 11 lists what is still open.
---


# Design: PBUI-native chat agent with custom PBUI widgets

## 1 · Purpose and scope

Build a chat agent whose user interface is **presentation-based from the
ground up**: every structured thing the agent says or does — a domain object, a
table column, a source, a proposal, a widget, a performed verb, the agent's own
run — is a PBUI `PresentationReference` with a descriptor, and therefore has an
object menu, participates in accept mode, can be inspected, watched, traced,
promoted to a tile, and survives reload with its verbs intact. "Custom widget
capability" means a product (or the agent, at run time) can compose new widgets
out of PBUI atoms and embedded objects **as data**, without a frontend deploy.

This document fixes the protocol and the architecture. The showcase
([design-doc/01](./01-feature-showcase-for-a-pbui-native-chat-agent.md)) lists
what the result should be able to do; §10 maps its tiers onto work.

**Non-goals for v1.** Collaborative multi-user editing of one chat; a new
transport (we keep sessionstream's WebSocket); a new LLM runtime (geppetto);
replacing coinvault's existing eight widgets on day one (they are migrated in
§10 tier 2, behind the same UI).

## 2 · The system in one picture

```
 browser ─────────────────────────────────────────────────────────────────────
 │ product app (coinvault web · datalab-ui · demo)                            │
 │   ├── createPbui<Values,Env,Verb>()   registry · descriptors · verbs (data)│
 │   ├── @hyperslop-systems/pbui-chat   ┐ createPbuiChat({pbui, router})      │
 │   │     PbuiMarkdown (mentions)      │ → chat-provider extension:          │
 │   │     PbuiWidget (widget document) │   widgets  pbui.widget pbui.refs    │
 │   │     Composer (typed mentions)    │   tools    pbui_accept (human)      │
 │   │     verb router glue · trace     │   adapters pbui.trace               │
 │   └── @go-go-golems/chat-provider  ──┘ timeline store · ws transport        │
 │           │  POST /api/chat/sessions/{id}/messages  {prompt, refs, focus}  │
 │           │  POST …/tools/results   (accept result · proposal decision)    │
 │           │  WS   /api/chat/ws      snapshot → live UiEventFrames          │
 │           │  cmd  PbuiVerbPerformed (trace)                                │
 ─────────────┼──────────────────────────────────────────────────────────────
 server       ▼
 │ app HTTP layer (app-owned)  ──► pinocchio chatapp.Service / Engine         │
 │                                   plugins: reasoning · toolcall · widgets  │
 │                                            frontendtools · ►pbuichat◄      │
 │ pbui/pkg/pbuichat                                                          │
 │   Vocabulary (vocabulary.json from the TS registry)                        │
 │   Plugin: mention scan → Resolver → pbui.refs widget                       │
 │           tool-result → object projection (tables, rows)                   │
 │           PbuiVerbPerformed cmd → PbuiTraceEntry entity                    │
 │   Tools:  pbui_widget · pbui_accept · pbui_trace · pbui_describe_types     │
 │           pbui_workbench_get · pbui_workbench_mutate                        │
 │   Prompt: system-prompt section generated from the vocabulary              │
 │ geppetto  engine · tool loop · EventSink · structuredsink                  │
 │ sessionstream  hub · projections · hydration store · ws fanout            │
 │ workbench host (datalab-style) /v1/workbenches/{id}/mutate  ◄── tool      │
 ─────────────────────────────────────────────────────────────────────────────
```

Three new things (bold arrows): the TS package `pbui-chat`, the Go package
`pbuichat` (a `chatapp.ChatPlugin` + tools), and one new command. Everything
else is wiring of seams that exist today (§4 names each).

## 3 · Concepts and vocabulary

| Term | Definition | Carried by |
|---|---|---|
| **Presentation reference** | `{type, value}`; `value` carries what its menu needs to decide (id, label, state, provenance) | pbui `PresentationReference` |
| **Descriptor** | per-type `label`, `describe`, `actions → verbs`, `tone` | pbui registry (product-owned) |
| **Verb** | serialisable action data `{kind, …}`; never a closure | product `Verb` union + generated JSON schema |
| **Verb family** | `local` (router performs, no LLM), `agent` (becomes a typed message), `workbench` (becomes a `MutationBatch`), `tool` (answers a parked human tool) | router |
| **Mention** | inline `[[type:id\|label]]` in model prose | message text + `pbui.refs` entity |
| **Widget document** | declarative composition of pbui atoms/molecules with embedded references and verb chips | `WidgetInstanceEntity{widget_name:"pbui.widget", props}` |
| **Accept request** | `{types, prompt, filter?}` asked by the agent; the user answers by clicking a presentation | human tool `pbui_accept` |
| **Proposal** | an object whose verbs resolve a parked human tool (`approve`/`reject`/`edit`) | human tool + `proposal` descriptor |
| **Trace entry** | one performed verb with actor (`human`/`agent`), target reference and outcome | `PbuiVerbPerformed` → `PbuiTraceEntry` entity |
| **Vocabulary** | the registry's types, tones, docs, verb schemas and widget-document schema, exported as JSON | `vocabulary.json` (TS → Go) |
| **Resolver** | app-owned `Resolve(ctx, type, id) → value` so the model supplies ids and the server supplies truth | Go interface |

The rule that makes the whole thing hold together, stated once: **the model
names objects; the server resolves them; the registry decides their verbs; the
router performs them; the trace remembers them.**

## 4 · Which existing seam carries which concern

| Concern | Existing mechanism (verified file) | Used as |
|---|---|---|
| Durable widget with streaming patches | `pinocchio/pkg/chatapp/widgets/plugin.go` — `PublishWidgetInstanceStarted/Patched/Completed/Removed`, entity `ChatWidgetInstance`, `props: Struct`, `patch_paths` append | transport for `pbui.widget` and `pbui.refs` (§5.2) |
| Frontend rendering of widget entities | `react-chat/packages/chat-provider/src/widgets/widgetRegistry.ts` — `defineWidget(name, Component<WidgetProps>)`, `WidgetOutlet` | `defineWidget("pbui.widget", PbuiWidget)` etc. |
| Extension bundle | `core/extensions.ts` — `defineChatExtensions({tools, widgets, timelineAdapters, install})` | `createPbuiChat()` returns one |
| Browser-executed / human-answered tools | `pinocchio/pkg/chatapp/frontendtools` (`Manager.Request` blocks the tool loop; `BridgeExecutor`), `frontend_tool.proto`; chat-provider `HumanTool{render({input, respond, reject})}` | `pbui_accept`, proposals, forms |
| Live + hydrate parity | `ws/timelineAdapterRegistry.ts` `defineLiveAndHydrateAdapter` | `pbui.trace` adapter |
| Per-message extra data to the model | `chatapp.PromptRequest.InitialTurn` (`pinocchio/pkg/chatapp/service.go`) | `refs[]`/`focus` → `pbui.refs@v1` block |
| Plugin seam | `chatapp.ChatPlugin` (`features.go`): `RegisterSchemas`, `HandleRuntimeEvent`, `ProjectUI`, `ProjectTimeline` | `pbuichat.Plugin` |
| Backend tools with schema | `geppetto/pkg/inference/tools/definition.go` `NewToolFromFunc` | all `pbui_*` backend tools |
| Hidden structured blocks in prose | `geppetto/pkg/events/structuredsink` `FilteringSink` + extractors | *not used in v1* (§11 D3) |
| Workbench mutations | `hyperslop-cli/pkg/client/workbenches.go` `MutateWorkbench(id, revision, batch, requestID)`; `pbui/pkg/workbench` validation; datalab `workbenchapp.Catalog` | `pbui_workbench_*` tools, `openInTile` |
| Schema policy | sessionstream-lint / `make schema-vet`: no top-level `Struct` | all new payloads are named messages |
| Presentation runtime | `pbui/src/presentation/createPbui.tsx` — `Provider{onPerform}`, `Presentation`, `ObjectMenu`, `accept()`, `MouseDocLine`, `AcceptBanner`, `conversions` | the UI |
| Tile registry | `pbui/packages/datalab-ui/src/appkit/registry.ts` `registerApp` (product contract) | `chat`, `chat-doc`, `inspector`, `watchlist`, `trace` apps |

## 5 · The contract

### 5.1 Presentation types the chat layer itself declares

The chat layer owns a small, domain-free set of types; products add theirs.
Following DATADROP-11's rule, each is declared because something renders it
and a descriptor answers for it.

```ts
// @hyperslop-systems/pbui-chat — src/types.ts
export interface ChatValues {
  message:    { id: string; role: "user" | "assistant" | "thinking"; runId?: string };
  run:        { id: string; status: "streaming" | "finished" | "failed" | "stopped";
                toolCalls: number; durationMs?: number; tokens?: number };
  tool:       { callId: string; name: string; status: string; parentMessageId: string;
                rows?: number };                       // rows: when the result projected a table
  widget:     { id: string; title?: string; parentMessageId: string; status: string };
  proposal:   { id: string; toolCallId: string; title: string; danger: boolean;
                decision?: { by: string; at: string; value: "approve" | "reject" } };
  traceEntry: { seq: number; actor: "human" | "agent"; verb: unknown;
                target?: PresentationReferenceLike; at: string };
  source:     { evidenceId: string; title: string; locator?: string };
  unresolved: { type: string; id: string; label?: string };   // a mention the server could not resolve
}
```

`unresolved` is important: a mention whose type the registry does not know, or
whose id the resolver rejected, **still renders as a presentation** (fallback
label, tone `neutral`, one verb: *Ask the agent what this is*). Nothing the
model says can break the page.

Products extend `ChatValues` with their own (`product`, `field`, `row`, `datum`,
`table`, `order`, … for coinvault; `drop`, `stream`, `dataset`, `field` for
datalab) and register descriptors in the usual five product-owned files
(playbook §6).

### 5.2 Wire payloads

**No new wire type for objects or widgets.** Both ride in pinocchio's widget
entity, keyed by `widget_name`:

| `widget_name` | `instance_id` | `props` (inner `Struct`) |
|---|---|---|
| `pbui.refs` | `<messageId>-refs` | `{ schema_version: 1, refs: { "<type>:<id>": { type, value, provenance } } }` |
| `pbui.widget` | `<messageId>-w<n>` or tool-supplied | the widget document (§5.4) |

Why reuse: hydration, patch-merge (`mergeStructPatch` with `patch_paths`), the
chat-provider adapter, `WidgetOutlet` dispatch and the schema policy are all
already correct for this shape, and the `props` field is where an inner
`Struct` is explicitly allowed. A dedicated `PbuiObject` message would buy a
typed `reference` field at the cost of a second hydration path — rejected for
v1 (see §11 D1 for the exit).

**One new command/event/entity triple** (the only addition to the wire), in
pbui's own proto package so pinocchio is untouched:

```proto
// pbui/proto/hyperslop/pbui/chat/v1/chat.proto
syntax = "proto3";
package hyperslop.pbui.chat.v1;
import "google/protobuf/struct.proto";
import "google/protobuf/timestamp.proto";

// A presentation reference as it travels: the type, the stable id the model
// may use, the resolved value (may be absent while unresolved), and where it
// came from.
message Reference {
  string type = 1;
  string id = 2;
  google.protobuf.Struct value = 3;
  Provenance provenance = 4;
}
message Provenance {
  string message_id = 1;
  string tool_call_id = 2;
  string widget_id = 3;
}

// Browser → backend: a verb was performed (by a human through a menu/chip, or
// by the router on the agent's behalf). Replaces the never-wired
// pinocchio ChatWidgetAction for our purposes.
message VerbPerformedCommand {
  string client_seq = 1;                  // idempotency within a session
  Actor actor = 2;
  google.protobuf.Struct verb = 3;        // validated against the vocabulary
  Reference target = 4;                   // optional
  string outcome = 5;                     // "performed" | "rejected:<why>"
}
enum Actor { ACTOR_UNSPECIFIED = 0; ACTOR_HUMAN = 1; ACTOR_AGENT = 2; }

// Backend event + timeline entity (same shape; the event is the entity).
message TraceEntry {
  uint64 seq = 1;                          // assigned server-side, per session
  Actor actor = 2;
  google.protobuf.Struct verb = 3;
  Reference target = 4;
  string outcome = 5;
  google.protobuf.Timestamp at = 6;
}
```

Registered names: command `PbuiVerbPerformed`, event `PbuiVerbRecorded`,
UI event `PbuiTraceEntryUpsert`, entity kind `PbuiTraceEntry`. `Reference`
and `Provenance` are also the schema for every `refs` value inside `props`
(the TS side validates with the same shape), so there is one definition of a
reference on the wire even where it is carried as a `Struct`.

### 5.3 Refs and focus on send (browser → model)

The app's HTTP body for `POST …/messages` gains two optional fields; the
app-owned handler (coinvault: `sessionstream_handlers.go`, pinocchio web-chat:
`routes_sessions.go`) turns them into an `InitialTurn`:

```jsonc
{ "prompt": "why is [[field:t3.qty|qty]] skewed?",
  "refs":  [ { "type": "field", "id": "t3.qty", "value": { "docId": "t3", "name": "qty" } } ],
  "focus": { "reference": { "type": "product", "id": "2049" }, "tile": { "app": "table", "docId": "t3" } } }
```

```go
// app handler, sketch
turn := turns.NewTurn()                                 // geppetto
turns.AppendBlock(turn, turns.NewUserTextBlock(body.Prompt))
turn.Data.Set(pbuichat.RefsKey /* "pbui.refs@v1" */, pbuichat.RefsPayload{Refs: body.Refs, Focus: body.Focus})
req := chatapp.PromptRequest{Prompt: body.Prompt, InitialTurn: turn, Runtime: rt, …}
```

A small geppetto middleware in `pbuichat` (`RefsMiddleware`) renders the refs
block into the model-visible prompt as a fenced `pbui-refs` YAML section after
the user text, and strips nothing from the user's prose. The model therefore
sees the exact objects the user pointed at, typed, alongside the words.

### 5.4 The widget document

A closed vocabulary, validated on both sides from one JSON schema
(`vocabulary.json#/widget`). Version 1:

```yaml
format: pbui.widget
schema_version: 1
title: Gold Eagle health            # optional; becomes the <widget> label
tone: accent                        # optional; PresentationTone
layout: stack | row | grid          # grid takes `columns`
children:                           # each child is one of:
  - kind: text       ; text: "…"  ; markdown: true           # prose with mentions
  - kind: refs       ; label: "…" ; refs: [Reference, …]     # chips
  - kind: meter      ; label ; value ; max ; ref?            # pbui Meter
  - kind: sparkline  ; label ; values: [n] ; ref?            # pbui Sparkline
  - kind: segmented  ; label ; parts: [{label, value, tone?}]# pbui SegmentedBar
  - kind: stat       ; label ; value ; unit? ; delta? ; ref? # Text + Chip
  - kind: callout    ; tone ; text                            # pbui Callout
  - kind: table      ; columns: [{name, type: q|n|t}] ; rows: [[…]] ; docId ; streaming?
  - kind: diff       ; hunks: [{id, header, lines:[{op:" "|"+"|"-", text}]}]
  - kind: log        ; entries: [{level, text, at}]           # pbui ResultLog
  - kind: form       ; fields: [{name, label, input: text|number|select|object, accepts?: [type], required?}]
  - kind: widget     ; document: {…}                          # nesting, depth ≤ 3
verbs:                                # chips under the widget; validated against the verb schema
  - { label: Refresh, verb: { kind: rerunTool, toolCallId: tc_31 }, danger?: false }
```

Rules enforced by the validator (Go on publish, TS on render — same schema):
max 64 children, nesting depth 3, `table.rows` ≤ 500 in one document (bigger
tables stream via patches with `patch_paths: ["children.<i>.rows"]`), every
`ref` must be a `Reference` with a known `type` *or* is rewritten to
`unresolved`, every `verb` must validate against `vocabulary.json#/verbs` *or*
is rendered disabled with `disabledBecause: "unknown verb <kind>"`. A document
that fails structurally is published as `widget_name: "pbui.error"` with the
validation message — an error is a widget too, and the model is told via the
tool result.

### 5.5 The vocabulary file (TS → Go)

```jsonc
// generated by `pnpm --filter @hyperslop-systems/pbui-chat vocab` into the product;
// embedded by the Go binary; checked for staleness in CI (playbook §5 pattern)
{
  "schema_version": 1,
  "types": {
    "product": { "tone": "var(--pbui-tone-product)", "doc": "a sellable SKU",
                 "value": { /* JSON schema of Values["product"] */ },
                 "verbs": ["inspect", "watch", "openInTile", "compareWith", "askAgent", "reorder"] },
    "field":   { … }, "proposal": { … }, "traceEntry": { … }, "unresolved": { … }
  },
  "verbs": { "addFilter": { /* JSON schema */ }, "openInTile": { … }, … },
  "widget": { /* JSON schema of the widget document */ },
  "conversions": [ { "from": "datum", "to": "product" }, { "from": "cat", "to": "field" } ]
}
```

Products define `Values` and `Verb` with zod (chat-provider already depends on
zod and uses `z.toJSONSchema()` for tool manifests), so the schemas fall out of
the same declarations the descriptors are typed against. The Go side uses the
file for three things: validating model output, generating the system-prompt
section (§6.4), and answering `pbui_describe_types`.

## 6 · Backend: `pbui/pkg/pbuichat`

### 6.1 Package layout

```
pkg/pbuichat/
  plugin.go        Plugin: chatapp.ChatPlugin (schemas, runtime events, projections)
  vocabulary.go    Load/validate vocabulary.json; Validate{Reference,Verb,Widget}
  resolver.go      type Resolver interface { Resolve(ctx, typ, id string) (map[string]any, error) }
                   type ResolverMux map[string]Resolver   // per type
  mentions.go      scan prose for [[type:id|label]]; resolve; publish pbui.refs
  projection.go    tool results → objects (table/rows) when a ProjectionRule matches
  trace.go         VerbPerformed command handler; TraceEntry projections; pbui_trace tool
  tools.go         pbui_widget, pbui_accept (descriptor only; executes in browser),
                   pbui_describe_types, pbui_workbench_get, pbui_workbench_mutate
  prompt.go        SystemPromptSection(vocab, opts) string; RefsMiddleware
  limits.go        Limits{RefsPerMessage, WidgetBytes, WidgetChildren, Depth, TraceKeep}
  pb/…             generated from proto/hyperslop/pbui/chat/v1
```

Constructor:

```go
p := pbuichat.New(pbuichat.Options{
    Vocabulary: vocab,                           // *Vocabulary, from embedded JSON
    Resolver:   pbuichat.ResolverMux{"product": productResolver, "order": orderResolver},
    Projection: []pbuichat.ProjectionRule{pbuichat.RowsToTable("sql_query", "rows")},
    Workbench:  wbClient,                        // optional; enables pbui_workbench_*
    Limits:     pbuichat.DefaultLimits,
})
// wiring (coinvault server.go Features slice, pinocchio web-chat run.go):
Features: []chatapp.ChatPlugin{ …, widgets.NewWidgetPlugin(), frontendtools.NewPlugin(), p }
hub: p.Install(hub)          // registers the PbuiVerbPerformed command handler
tools: p.RegisterTools(registry, sessionID)   // into the per-run geppetto ToolRegistry
```

### 6.2 Runtime event handling

`HandleRuntimeEvent` looks at three geppetto events and always returns
`handled=false` (it *adds* to the base projection, never replaces it):

| Event | Action |
|---|---|
| `text-segment-finished` (assistant) | `mentions.Scan(text)` → for each `type:id` not yet in this message's refs: `Resolver.Resolve` (bounded concurrency, per-type timeout) → `PublishWidgetInstancePatched{instance_id: msg-refs, patch_paths: ["refs"]}`; first mention in a message publishes `Started`. Unknown type or resolver error → `unresolved` value with the error message. |
| `tool-result-ready` | if a `ProjectionRule` matches the tool name and result shape → publish a `pbui.widget` document (table) with `provenance.tool_call_id`; rows beyond `Limits` are truncated with a `callout` child saying so |
| `run-finished` / `run-failed` | `Completed` for every widget this message started; refs entity `READY` |

Mention scanning during streaming (`text-delta`) is deliberately *not* done in
v1: the chip renders immediately from the mention syntax alone (`unresolved`
until the refs entity arrives), so users see an object at once and its value a
moment later — the same progressive-enhancement shape as coinvault's pills.

### 6.3 Tools

| Tool | Mode | Input → output | Notes |
|---|---|---|---|
| `pbui_widget` | backend | `{document}` → `{widget_id}` | validates, publishes `Started`+`Completed` (or `pbui.error`); returns the id so the model can mention `[[widget:w12]]` |
| `pbui_widget_patch` | backend | `{widget_id, patch, patch_paths}` → ok | streaming tables/logs from long tools |
| `pbui_accept` | **human** (browser) | `{types[], prompt, filter?}` → `{reference}` or `{cancelled: true}` | advertised by the *browser manifest* (chat-provider `HumanTool`), so a client that cannot accept simply does not advertise it and the model is told |
| `pbui_propose` | **human** | `{title, body, danger, fields?}` → `{decision, fields}` | renders a `proposal` object; its verbs call `respond()` |
| `pbui_trace` | backend | `{since_seq?, limit?}` → `{entries[]}` | reads `TimelineView.List("PbuiTraceEntry")` |
| `pbui_describe_types` | backend | `{types?}` → vocabulary subset | cheap; the system prompt already carries a summary |
| `pbui_workbench_get` | backend | `{}` → `{revision, workspaces, views}` | via the workbench client (hyperslop-cli's `Client` or datalab's handlers) |
| `pbui_workbench_mutate` | backend | `{mutations[], expected_revision}` → `{revision}` or conflict | `If-Match` + `Idempotency-Key`; a 409 is returned to the model as a structured error with the current revision |

Backend tools are `geptools.NewToolFromFunc` definitions; the application
profile allowlist (`application-profiles.yaml` `tools:` in coinvault) decides
which are offered per profile, as today.

### 6.4 The generated system-prompt section

```
## Objects and verbs (PBUI)
You are talking to a user through a presentation-based interface. When you
refer to a concrete object, write it as a mention: [[type:id|label]]. Known
types and what identifies them:
  product   id = products.id           e.g. [[product:2049|1oz AGE 2024]]
  field     id = <docId>.<column>      e.g. [[field:t3.qty|qty]]
  source    id = evidence id E<n>      e.g. [[source:E2|pricing policy]]
  …
Never invent ids. The interface resolves mentions; unknown ids are shown as
unresolved and the user will see that.
To show structured results, call pbui_widget with a widget document (schema
below). Prefer a widget over an ASCII table. Offer next steps as verbs in the
document's `verbs` list; only these verb kinds exist: addFilter{docId,field,op,
value}, openInTile{widgetId|docId,app}, watch{ref}, askAgent{template,refs}, …
To ask the user to choose an object, call pbui_accept. To ask for approval
before a consequential action, call pbui_propose.
The user's message may end with a `pbui-refs` section listing objects they
pointed at; treat those as authoritative.
```

Generated from `vocabulary.json` by `prompt.SystemPromptSection`, so adding a
type to the registry updates the model's instructions with no prose to edit.
Appended by the app's runtime composer exactly where coinvault appends its
projection prompts today (`appendProjectionPrompts`).

### 6.5 Trace

`Install(hub)` registers `PbuiVerbPerformed`. The handler assigns `seq` (per
session, from the timeline view's last entry + 1), validates `verb` against the
vocabulary (an invalid verb is still recorded, with `outcome:
"rejected:invalid verb"`, because the trace must reflect what the UI did), and
publishes `PbuiVerbRecorded`. `ProjectUI` → `PbuiTraceEntryUpsert`;
`ProjectTimeline` → `PbuiTraceEntry{id: seq}`; entries beyond `Limits.TraceKeep`
are tombstoned oldest-first (datalab's capped-trace rule, with the same "index
is a moving target, seq is not" reasoning).

Agent-performed verbs (chips the user clicked, accepted suggestions, workbench
mutations the model requested) are recorded with `ACTOR_AGENT` by the router —
the browser is the single place where a verb becomes an effect, so it is the
single place that reports it.

## 7 · Frontend: `@hyperslop-systems/pbui-chat`

### 7.1 Package layout (`pbui/packages/pbui-chat`)

```
src/
  index.ts
  createPbuiChat.tsx        the entry point (§7.2)
  types.ts                  ChatValues, ChatVerb, Reference, Router types
  descriptors/              message.ts run.ts tool.ts widget.ts proposal.ts traceEntry.ts source.ts unresolved.ts
  vocabulary/               zod schemas for Reference, widget document; exportVocabulary()
  markdown/                 PbuiMarkdown: remark plugin turning [[type:id|label]] into <Presentation>
  widget/                   PbuiWidget: document → pbui components; children renderers; verb chips
  composer/                 Composer with typed mention chips; insert-object (accept); focus capture
  tools/                    pbuiAcceptTool (human), pbuiProposeTool (human) — render with pbui parts
  adapters/                 traceAdapter (defineLiveAndHydrateAdapter)
  apps/                     ChatApp, ChatDocApp, InspectorApp, WatchlistApp, TraceApp (tile containers)
  router/                   createVerbRouter: families, trace reporting, workbench client glue
  parts.ts                  data-part names; styles via pbui tokens; no hex values
  *.stories.tsx · *.test.ts
```

Peer dependencies: `react`, `@hyperslop-systems/pbui` (≥ 0.5), `@go-go-golems/chat-provider` (≥ 0.5), `zod`. Optional: `@hyperslop-systems/workbench-protocol` for the workbench verbs.

### 7.2 `createPbuiChat`

```ts
const chat = createPbuiChat<Values, Environment, Verb>({
  pbui,                                   // the product's createPbui() instance
  registry,                               // its PresentationRegistry (for labels/verbs)
  verbSchema: VerbSchema,                 // zod union → vocabulary + chip validation
  valueSchemas: { product: ProductSchema, field: FieldSchema, … },
  router: createVerbRouter<Verb>({
    local:     (verb, ctx) => dispatch(actionsForVerb(verb)),      // product reducer path
    agent:     (verb, ctx) => ctx.composer.insert(verb),           // askAgent → typed mention
    workbench: (verb, ctx) => wb.mutate(batchForVerb(verb)),       // openInTile, splits
    tool:      (verb, ctx) => ctx.respond(verb),                   // proposal/form answers
  }),
  conversions: [datumToProduct],          // forwarded to accept
});

// what it returns
chat.extension        // ChatExtension: widgets [pbui.widget, pbui.refs, pbui.error], tools [pbui_accept, pbui_propose], adapters [pbui.trace]
chat.Provider         // wraps pbui.Provider with onPerform = router.perform (records the trace)
chat.Messages         // ChatMessages with renderers: message → PbuiMarkdown, widget → WidgetOutlet, tool_call → ToolCard(<tool>), PbuiTraceEntry → hidden (TraceApp shows them)
chat.Composer         // typed mentions, insert-object, focus
chat.apps             // AppDescriptors for the tile registry
chat.sendMessageBody  // (req) => ({ prompt, attachments, refs, focus })
chat.exportVocabulary // () => vocabulary.json content (used by the `vocab` script)
```

`onPerform` is wrapped once: `perform(verb, target?)` → route by family → on
success/failure send `PbuiVerbPerformed{actor, verb, target, outcome}` through
the chat client (a raw command over the existing WebSocket is not available in
chat-provider 0.5; v1 posts it to an app route `POST …/verbs` that the app
handler turns into `hub.Submit`, mirroring how `/tools/results` works — §11 D4).

### 7.3 Rendering rules

- **Messages**: `PbuiMarkdown` renders assistant prose; each mention becomes
  `<Presentation reference={lookup(type,id) ?? unresolved(type,id,label)} doc=…>` with the
  label text as child. Lookup reads the message's `pbui.refs` entity from the
  timeline store (`useChatSelector`). User messages render their `refs` the
  same way, so the user's own mentions are live too.
- **Widgets**: `PbuiWidget` maps each child `kind` to a pbui component; any
  `ref` on a child wraps it in `<Presentation>`; a `table` child mints
  `field`/`row`/`datum` references with the document's `docId`; `verbs` render
  as chips whose click calls `perform(verb)` after schema validation.
  `status === STREAMING` shows the `┆` provisional style via `data-state`.
  Unknown child kinds render a `Callout` ("this client cannot render `<kind>`")
  — forward compatibility by construction.
- **Tool calls**: rendered as a `<tool>` presentation (`ToolCard`) with verbs
  *Show arguments*, *Show result*, *Re-run*, *Open table* (when the plugin
  projected one). The `<run>` presentation wraps the whole turn's tool segment
  (`TransportBar` + `SegmentedBar`), and scrubbing sets a local "as-of ordinal"
  the renderers honour (entity versions come from the hydration store's
  snapshot-at-ordinal in a later tier; v1 scrubs what is in memory).
- **Human tools**: `pbui_accept`'s `render` calls `pbui.accept(input)` on mount
  and `respond({reference})` / `respond({cancelled:true})` on settle; while
  pending it renders nothing (the `AcceptBanner` is the UI). `pbui_propose`
  renders a `<proposal>` presentation whose verbs call `respond`. After
  hydration chat-provider re-parks pending human tools, so both survive reload.
- **Mouse-doc**: the chat tile renders `pbui.MouseDocLine` with `ambient` =
  run stats; every descriptor authors `doc`.

### 7.4 Tiles

`chat.apps` registers: `chat` (not doc-bound, not singleton), `chat-doc`
(doc-bound: the bound document's `describe()` seeds `focus`), `inspector`,
`watchlist`, `trace` (singletons). Products that already have an inspector or
trace tile (datalab-ui) pass `apps: { inspector: false }` to skip.

## 8 · Sequences

### 8.1 An answer with mentions and a projected table

```
model            geppetto             pbuichat.Plugin        sessionstream       browser
  │ tool sql_query  │                       │                      │                │
  │────────────────►│ tool-result-ready ───►│ RowsToTable matches   │                │
  │                 │                       │ PublishWidgetStarted ─►│ UiEvent ──────►│ <table t4> (READY)
  │ "…[[product:2049|1oz AGE]]…" text-delta │                      │                │ chip renders as
  │────────────────►│──────────────────────►│ (ignored in v1)       │ text patch ───►│ <unresolved product 2049>
  │ text-segment-finished ────────────────►│ scan → Resolve(2049)  │                │
  │                 │                       │ PublishWidgetStarted  │                │
  │                 │                       │   pbui.refs m17-refs ─►│ UiEvent ──────►│ chip becomes <product 2049>
  │ run-finished ──────────────────────────►│ Completed ×2 ────────►│                │ verbs now decidable
```

### 8.2 The agent asks for an object (accept)

```
model          geppetto/toolloop     frontendtools.Manager     browser (chat-provider + pbui)
  │ pbui_accept{types:[product]}│                          │
  │────────────────────────────►│ BridgeExecutor ─────────►│ FrontendToolCallRequested ──► HumanTool.render
  │                             │   Manager.Request blocks  │   └─ pbui.accept({types, prompt})  → AcceptBanner
  │                             │                          │      user clicks <product 2051> in ANY tile
  │                             │◄── /tools/results ───────│   respond({reference})  (or cancelled on Esc)
  │◄── tool result {reference} ─│                          │
  │ "Drafting a reorder for [[product:2051|…]]"            │
```

### 8.3 A human verb, recorded

```
browser: R-click <field t3.qty> → ObjectMenu → "Filter qty < 5" → onPerform(verb)
  router.family(verb) = local → dispatch(addFilter) → table+chart tiles update (linked doc)
  → POST …/verbs VerbPerformedCommand{actor:HUMAN, verb, target:<field>, outcome:"performed"}
server: hub.Submit → pbuichat handler: seq=42, validate → PbuiVerbRecorded
  → ProjectUI PbuiTraceEntryUpsert → browser trace tile shows #42
  → ProjectTimeline PbuiTraceEntry{id:"42"} → survives reload
model (later): pbui_trace{since_seq: 37} → sees #38–#42 → "you filtered the table to qty < 5 …"
```

### 8.4 Open in tile

```
browser: verb openInTile{widgetId:w12} → family workbench
  → batch = [DocumentPut{format:"pbui.table", body}, ViewCreate{app:"table", documents:{primary}}, PlacementSplit{…}]
  → workbench client mutate(id, revision, batch, requestID)    (If-Match, Idempotency-Key)
  → 200 {revision} → SSE workbench.updated → tiles re-render; trace #43 recorded with target <widget w12>
  → 409 → toast via Callout; verb recorded with outcome "rejected:revision conflict"; user retries
```

## 9 · Hydration, consistency, trust

**Hydration.** Every object is a timeline entity (`ChatWidgetInstance` for
refs/widgets, `PbuiTraceEntry`, `ChatFrontendToolCall` for accept/proposals)
and every adapter is live+hydrate (chat-provider's widget and frontend-tool
adapters exist; `pbui.trace` is ours). Verb availability is never stored: the
descriptor recomputes it from entity state (`proposal.decision` →
`disabledBecause: "approved by … at …"`). Mentions in *old* messages resolve
against the refs entity of their own message, so history does not depend on
later lookups.

**Two truths, kept distinct** (pinocchio's rule): the timeline is what the UI
shows; the turn store is what the model remembers. Anything the model must see
again goes into a turn block: user refs (`pbui.refs@v1`), tool results
(already), widget ids (the `pbui_widget` tool result). The refs entity the
*server* publishes for assistant mentions is UI-only; the model already said
those ids.

**Ordering.** Widget and refs entities are keyed by message and ordinal;
trace entries by `seq`. Scrubbing (C6) in v1 uses in-memory entity versions;
a later tier can ask the hydration store for a snapshot `asOf` ordinal, which
sessionstream already supports (`Snapshot(ctx, sid, asOf)`).

**Trust boundaries.**
- The model supplies **ids**; values come from the app's `Resolver`. A value
  never contains secrets (datalab DR-28: presentation values flow to the
  inspector, watchlist, trace and storage).
- Verbs from the model are data validated against the vocabulary; the router
  decides whether a verb family is allowed for `ACTOR_AGENT` (e.g. `danger`
  verbs always require a human click; workbench mutations require the tool
  allowlist).
- Widget documents are size- and depth-limited (`Limits`) and schema-validated
  before publish; failure is visible (`pbui.error`).
- `focus` sends a reference and `describe()` output, never DOM text.
- Tool allowlists stay in the application profile; `pbui_workbench_mutate` is
  off unless the profile grants it.
- Trace entries record rejected verbs too, so an audit sees attempts.

## 10 · Where the code lives, and the build order

### 10.1 Placement (decision, with the alternative)

| Piece | Location | Why |
|---|---|---|
| proto `hyperslop.pbui.chat.v1` | `pbui/proto/hyperslop/pbui/chat/v1/chat.proto`; Go gen into `pbui/gen/go`, TS gen into `pbui/packages/pbui-chat/src/generated` | beside the workbench proto, same buf config and `make protocol-check` |
| Go `pbuichat` | `pbui/pkg/pbuichat` | must stay in lockstep with the vocabulary and proto; go.work makes the cross-repo loop trivial. **Cost:** pbui's `go.mod` gains pinocchio/sessionstream/geppetto. If that weight is unwanted, extraction to `hyperslop-systems/pbui-chat` is a mechanical move of one package + one proto (§11 D2). |
| TS `@hyperslop-systems/pbui-chat` | `pbui/packages/pbui-chat` | a workspace package like `datalab-ui`; published by a `publish-pbui-chat.yml` twin of the existing workflows |
| Demo/mock | `pbui/cmd/pbui-chat-demo` (Go, embeds a Vite demo under `packages/pbui-chat/demo`) using a deterministic mock runtime in react-chat's `internal/mockengine` style | Storybook fixtures, CI smoke, the five-minute demo script with no LLM key |
| First product | coinvault: `internal/webchat/server.go` adds `pbuichat.New(...)` to `Features`; `web/` adds `createPbuiChat` next to the Golden Eagle shell, behind a profile flag | it is the shipped chat; its eight widgets become widget documents one by one |
| Second product | datalab-ui: a `chat` tile using the existing `datadropRegistry` | proves domain neutrality (E3) |

### 10.2 Tiers → work (acceptance stated as a gesture)

**Tier 0 — foundation** (showcase A1 A2 A3 A5 E1)
- `pbui-chat`: types, descriptors, `PbuiMarkdown` mentions, `createPbuiChat` skeleton, vocabulary export, Storybook with fixtures.
- `pbuichat`: vocabulary loader + validators, `Resolver`, mention scan, `pbui.refs` publishing, `SystemPromptSection`.
- demo binary with mock runtime; coinvault wiring behind a flag with `product`, `category`, `order`, `source` resolvers.
- *Done when:* in the demo and in coinvault, every mention in an answer can be right-clicked and shows the descriptor's verbs; hovering narrates in the mouse-doc line; an unknown type renders as `<unresolved>` without a console error; `make schema-vet` and `make protocol-check` pass.

**Tier 1 — round trip** (B1 B2 B3 D4)
- Composer with typed mentions + insert-object (accept); `refs`/`focus` on send; `RefsMiddleware`; verb chips in widget documents; `pbui_widget` tool (non-streaming); hydration parity tests for `pbui.refs`/`pbui.widget`.
- *Done when:* right-click a column → *Ask…* → the model's reply names the column by id; a suggestion chip performs locally with no network to the LLM; reload mid-conversation and every chip still has its verbs.

**Tier 2 — custom widgets** (C1 C2 C3 A4)
- Full widget-document vocabulary; `pbui_widget_patch` + streaming tables; `RowsToTable` projection; inspector + watchlist tiles; migrate coinvault's `inventory_cards`, `inventory_table`, `sql_table`, `stats_row`, `stock_alert`, `pills`, `sources`, `answer_meta` to documents (prompt contracts become `pbui_widget` calls).
- *Done when:* coinvault's eight widget types render through `pbui.widget` with their old fixtures, and adding a ninth needs zero frontend changes.

**Tier 3 — agency** (B4 B5 C4 B6 E2)
- `pbui_accept`, `pbui_propose`, forms; `PbuiVerbPerformed` command + trace plugin + trace tile + `pbui_trace`; `focus` capture.
- *Done when:* the model can ask for an object and the user can answer from a different tile; a proposal approved before reload shows as approved after; "what did I just do?" is answered from the trace.

**Tier 4 — workbench** (D1 D2 D3 C5 C6)
- Workbench verbs (`openInTile`, split/title), `pbui_workbench_get/mutate`, `chat`/`chat-doc` apps, diff and run widgets, as-of scrubbing.
- *Done when:* "put the chart on the right" produces a revision-checked mutation card with a working Undo.

**Tier 5 — breadth** (E3): datalab-ui chat tile over `datadropRegistry`.

### 10.3 Tests that must exist

- Vocabulary staleness check (TS export vs embedded Go copy) in CI, like `make schema-check`.
- Go/TS parity fixtures for widget documents (valid + invalid) in `contracts/chat/v1/`, mirroring `contracts/workbench/v1/`.
- chat-provider adapter parity: live vs hydrated `pbui.refs`, `pbui.widget`, `PbuiTraceEntry` produce identical entities.
- Descriptor tests: `actions(value, env)` returns exact verbs, including `disabledBecause` strings (no DOM).
- "Every kind of object a message draws has verbs": a Storybook-driven test right-clicks every `[data-pbui=presentation]` in the fixtures and asserts a non-empty menu or an explicit "no verbs" descriptor decision.
- Schema policy: `make schema-vet` over the new registrations.

## 11 · Open decisions and risks

| # | Decision | Recommendation | Exit if wrong |
|---|---|---|---|
| D1 | Reuse `ChatWidgetInstance` for refs/widgets vs a dedicated `PbuiObject` entity | Reuse (no second hydration path; schema-policy clean) | Add `PbuiObjectEntity` later; the TS lookup is behind one function |
| D2 | Go package in `pbui/pkg/pbuichat` (pulls pinocchio into pbui's go.mod) vs new module | In pbui for v1 | Move package + proto to `hyperslop-systems/pbui-chat`; importers change one path |
| D3 | Model-facing widget channel: `pbui_widget` tool vs hidden `<pbui:widget:v1>` blocks via `structuredsink` | Tool: provider-validated arguments, returns an id, no prose contamination | Add an extractor that forwards to the same publish path; both can coexist |
| D4 | Browser→backend verb report: new app route `POST …/verbs` vs a raw command frame in chat-provider | App route for v1 (chat-provider 0.5 has no generic command send) | Propose `client.submitCommand(name, payload)` upstream and switch |
| D5 | Mention syntax `[[type:id\|label]]` | Keep; unambiguous, survives markdown, cheap to scan | Any syntax works as long as the scanner and the remark plugin agree |
| D6 | Streaming mention resolution | Resolve at segment end; chips render unresolved first | Resolve on `text-delta` with a debounce if latency is felt |
| D7 | Widget documents reference pbui components by `kind` names | Closed enum per `schema_version` | Bump `schema_version`; old clients show a Callout for unknown kinds |
| R1 | pbui `go.mod` weight (D2) | accept for v1 | — |
| R2 | The model over-mentions (every noun becomes a chip) | prompt guidance + `Limits.RefsPerMessage` (default 32) + resolver cost caps | tune; unresolved beyond the cap |
| R3 | Accept mode across reload depends on chat-provider re-parking human tools | verified in code (`reconcileFrontendToolRequests`), not yet exercised end-to-end | tier 3 test |
| R4 | Two push models (WS for chat, SSE for workbench) | keep both; `openInTile` waits for the SSE revision before reporting success | — |

## 12 · Appendix

### 12.1 A product descriptor (coinvault `product`)

```ts
export const productDescriptor: PresentationDescriptor<ProductRef, Env, Verb> = {
  tone: "var(--pbui-tone-product)",
  label: (p) => p.name,
  describe: (p) => ({ id: p.id, qty: p.qty, reorderAt: p.reorderAt, price: p.price, lastSold: p.lastSold }),
  actions: (p, env) => [
    { id: "inspect",  label: "Inspect",  verb: { kind: "inspect", ref: refOf(p) } },
    { id: "watch",    label: "Watch",    verb: { kind: "watch",   ref: refOf(p) } },
    { id: "tile",     label: "Open in tile", verb: { kind: "openInTile", ref: refOf(p), app: "product" } },
    { id: "compare",  label: "Compare with…", verb: { kind: "compareWith", left: refOf(p) } },   // router enters accept
    { id: "ask",      label: "Explain stock history", group: "ask the agent",
      verb: { kind: "askAgent", template: "explain the stock history of {0}", refs: [refOf(p)] } },
    { id: "reorder",  label: "Reorder now", danger: true, verb: { kind: "reorder", productId: p.id },
      disabledBecause: env.canApprove ? undefined : "needs approver role" },
  ],
};
```

### 12.2 The verb union (excerpt) and its schema

```ts
export const VerbSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("inspect"),    ref: ReferenceSchema }),
  z.object({ kind: z.literal("watch"),      ref: ReferenceSchema }),
  z.object({ kind: z.literal("openInTile"), ref: ReferenceSchema.optional(), widgetId: z.string().optional(), app: z.string() }),
  z.object({ kind: z.literal("addFilter"),  docId: z.string(), field: z.string(), op: z.enum(["<","<=","=",">=",">","!=","contains"]), value: z.string() }),
  z.object({ kind: z.literal("askAgent"),   template: z.string(), refs: z.array(ReferenceSchema) }),
  z.object({ kind: z.literal("resolveProposal"), id: z.string(), decision: z.enum(["approve","reject"]) }),
  z.object({ kind: z.literal("rerunTool"),  toolCallId: z.string(), args: z.record(z.unknown()).optional() }),
  // …
]);
export type Verb = z.infer<typeof VerbSchema>;
// vocabulary.verbs = Object.fromEntries(VerbSchema.options.map(o => [o.shape.kind.value, z.toJSONSchema(o)]))
```

### 12.3 A refs entity as it hydrates

```json
{ "kind": "ChatWidgetInstance", "id": "m17-refs",
  "payload": { "instanceId": "m17-refs", "widgetName": "pbui.refs", "parentMessageId": "m17", "status": "WIDGET_STATUS_READY",
    "props": { "schema_version": 1, "refs": {
      "product:2049": { "type": "product", "id": "2049", "value": { "id": 2049, "name": "1oz AGE 2024", "qty": 3, "reorderAt": 5, "price": 2410 },
                        "provenance": { "message_id": "m17", "tool_call_id": "tc_31" } },
      "source:E2":    { "type": "source", "id": "E2", "value": { "evidenceId": "E2", "title": "sql:orders" } },
      "product:9999": { "type": "unresolved", "id": "9999", "value": { "type": "product", "id": "9999", "error": "no such product" } }
    } } } }
```

### 12.4 Minimal wiring in a product (coinvault)

```go
// internal/webchat/server/server.go
vocab := pbuichat.MustLoadVocabulary(webui.VocabularyJSON)          // embedded, CI-checked
pbuiPlugin := pbuichat.New(pbuichat.Options{
    Vocabulary: vocab,
    Resolver: pbuichat.ResolverMux{
        "product":  projectionlookup.ProductResolver(db),
        "category": projectionlookup.CategoryResolver(db),
        "order":    projectionlookup.OrderResolver(db),
        "source":   evidenceResolver,                                 // from the run's evidence cache
    },
    Projection: []pbuichat.ProjectionRule{pbuichat.RowsToTable("sql_query", "rows")},
})
Features: []chatapp.ChatPlugin{ webchat.NewCoinVaultProjectionFeature(db), plugins.NewReasoningPlugin(),
                                plugins.NewToolCallPlugin(), widgets.NewWidgetPlugin(), frontendtools.NewPlugin(), pbuiPlugin }
```

```tsx
// web/src/pbui/chat.ts
export const chat = createPbuiChat<Values, Env, Verb>({ pbui, registry, verbSchema: VerbSchema, valueSchemas, router });
// web/src/app/App.tsx
<ChatProvider config={{ basePrefix: "", extensions: [chat.extension], sendMessageBody: chat.sendMessageBody }}>
  <chat.Provider environment={env}>
    <chat.Messages /> <chat.Composer /> <pbui.ObjectMenu /> <pbui.AcceptBanner /> <pbui.MouseDocLine ambient={stats} />
  </chat.Provider>
</ChatProvider>
```
