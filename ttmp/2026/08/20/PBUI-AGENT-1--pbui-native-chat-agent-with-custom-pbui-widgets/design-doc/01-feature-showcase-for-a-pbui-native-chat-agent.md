---
Title: Feature showcase for a PBUI-native chat agent
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
    - Path: repo://src/components/index.ts
      Note: the atom/molecule vocabulary the declarative widget document (C1) is built from
    - Path: repo://src/presentation/createPbui.tsx
      Note: accept mode, ObjectMenu, MouseDocLine that features A2/A3/B2/B4 rely on
    - Path: ws://coinvault/internal/webchat/coinvault_projection_feature.go
      Note: the per-widget pipeline the showcase replaces
    - Path: ws://hyperslop-cli/pkg/client/workbenches.go
      Note: agent-facing workbench mutation client behind D2
    - Path: ws://pinocchio/pkg/chatapp/widgets/plugin.go
      Note: WidgetInstance started/patched/completed lifecycle used by C1/C2
    - Path: ws://react-chat/packages/chat-provider/src/tools/toolRegistry.ts
      Note: human/frontend tools that carry accept results and proposals (B4/B5/C4)
ExternalSources: []
Summary: Twenty-two showcase features for a PBUI-native chat agent, each with an ASCII mock-up and the mechanism that makes it work, grouped from foundation (objects everywhere) to agency (the agent drives accept mode and the workbench).
LastUpdated: 2026-08-20T11:01:29.872481436-04:00
WhatFor: Decide which capabilities the first PBUI chat agent should demonstrate, and agree on what each one looks like before the design doc commits to a protocol.
WhenToUse: Read before the design doc (02) to understand what the protocol has to carry; use the tier table at the end to scope a milestone.
---


# Feature showcase for a PBUI-native chat agent

## 0 · What "PBUI-native" buys, in one paragraph

A conventional chat UI renders **strings** with a few hard-coded cards bolted on
(coinvault today: eight widget types, ~13 edit points each). PBUI renders
**objects**. Every typed thing — a product, a column, a row, a query, a source,
a tool call, a proposal, the agent's own run — is a `PresentationReference
{type, value}` with a descriptor that knows its label, its description and its
**verbs** (serialisable data, never closures). Once agent output is made of
objects, the whole PBUI interaction model comes for free and applies uniformly:
right-click menus, the accept mode that reaches across tiles, the mouse-doc line
that narrates what a click will do, tiles and the workbench, the inspector, the
watchlist, the verb trace, the launcher. The features below are that one idea
applied in twenty-two directions. The domain in the mock-ups is coinvault's
(gold-coin inventory, SQL, knowledge sources) because it is the shipped chat;
two mock-ups use datalab (drops, fields) to show nothing is domain-specific.

Legend for the mock-ups:

```
<product 2049>   a presentation; the angle brackets are how PBUI prints a type
  ▾ …            an object menu, opened by R-click / Enter on a presentation
[ verb ]         a verb chip (one click performs a serialisable verb locally)
┆ …              a streaming / provisional region (live-only, not yet committed)
READY …          the mouse-doc line (bottom strip), L/R say what the buttons do
```

---

## A · Objects everywhere (foundation)

### A1 · Every noun in an answer is a live object

**What it looks like**

```
┌─ chat ───────────────────────────────────────────────────────────────────┐
│ you  which gold eagles are low on stock?                                 │
│                                                                          │
│ agent  Three <category American Gold Eagles> SKUs are below reorder:     │
│        <product 2049 1oz AGE 2024> (qty 3), <product 2051 1/2oz AGE>     │
│        (qty 1) and <product 2077 1/10oz AGE> (qty 0). All three are      │
│        <metal gold>; last sale was <order 88213> two days ago.           │
│                                                                          │
│        ┌─ inventory_table ── 3 rows ─────────────────────────────────┐   │
│        │ <field sku>  <field name>            <field qty> <field $>  │   │
│        │ <row> 2049   1oz AGE 2024              3         2 410      │   │
│        │ <row> 2051   1/2oz AGE 2024            1         1 260      │   │
│        │ <row> 2077   1/10oz AGE 2024           0           265      │   │
│        └─────────────────────────────────────────────────────────────┘   │
│        sources: <source E1 pricing-policy.md §3> <source E2 sql:orders>  │
└──────────────────────────────────────────────────────────────────────────┘
 READY   hover anything · L is the default verb · R opens its menu
```

**How it works.** The model writes markdown with typed mentions
(`[[product:2049|1oz AGE 2024]]`), the same hidden-block discipline coinvault
already uses, but the block is a *reference*, not a widget. The chat's markdown
renderer turns each mention into `<Presentation reference={{type:"product",
value:{id:2049, name, qty, …}}}>` — the value is resolved server-side (the
projection plugin looks the id up, like `projectionlookup` does today) so the
menu can decide its verbs without a round trip. Tables are `table` objects whose
cells are `field`/`row`/`datum` presentations, exactly as datalab's TableApp.
Unknown types still render (registry fallback label) so a new type never
breaks an old client.

### A2 · The object menu on agent output

```
│ agent  … <product 2049 1oz AGE 2024> (qty 3) …                           │
│                        ▾───────────────────────────────────────┐          │
│                        │ <product> 1oz AGE 2024                │          │
│                        ├───────────────────────────────────────┤          │
│                        │ Inspect                               │          │
│                        │ Watch                                 │          │
│                        │ Open in tile                          │          │
│                        │ Filter table by this product          │          │
│                        │ Compare with…            (accept)     │          │
│                        ├─ ask the agent ───────────────────────┤          │
│                        │ Explain stock history                 │          │
│                        │ Draft a reorder for this              │          │
│                        ├───────────────────────────────────────┤          │
│                        │ Reorder now — needs approver role     │  ← disabledBecause
│                        └───────────────────────────────────────┘          │
```

**How it works.** One descriptor file per type (`descriptors/product.ts`)
returns `PresentationAction[]`, each with a serialisable verb. Three verb
families: *local* (`inspect`, `watch`, `openInTile` — performed by the product
router, no LLM), *accepting* (`compareWith` calls `accept({types:["product"]})`
then performs), and *agent* (`askAgent{prompt template, refs}` — puts a typed
request into the conversation). `disabledBecause` renders the rule, not a greyed
mystery.

### A3 · The mouse-doc line narrates the chat

```
 READY   <product> 1oz AGE 2024   —   L: inspect   R: menu            tools: 2 · 1.4s
 ACCEPT MODE   pick the product to compare against   (Esc aborts)
```

**How it works.** `MouseDocLine` from `createPbui`, with the `ambient` slot
showing run stats (`runStatsSlice` from chat-provider). Every presentation's
`doc` prop is authored in the descriptor; the agent's own tool calls carry a doc
line ("sql_query · 25 rows · 120ms").

### A4 · Inspector and Watchlist tiles fed by the chat

```
┌─ chat ──────────────────────┐┌─ inspector ─────────────────────────────┐
│ … <product 2049> …          ││ <product> 1oz AGE 2024                  │
│                             ││ id        2049                          │
│   [Inspect] ───────────────►││ qty       3          reorder_at  5      │
│                             ││ price     2 410.00   cost    2 201.18   │
│                             ││ last_sold <order 88213>                 │
│                             ││ category  <category American Gold …>    │
└─────────────────────────────┘│ from      message m17 · tool sql_query  │
┌─ watchlist ─────────────────┐│ describe  {…json…}                      │
│ <product 2049>  qty 3  ▁▂▃▂ │└─────────────────────────────────────────┘
│ <product 2077>  qty 0  ▃▂▁▁ │
│ <field qty> in <table t3>   │
└─────────────────────────────┘
```

**How it works.** `describe(value, env)` is the inspector payload; the
`InspectorPanel` renders it with `JsonBlock` or a per-type `renderValue`. The
watchlist is a list of references; because a reference carries its provenance
(`from: {messageId, toolCallId}`) the inspector can link back to the message.
Watchlist rows are live: the projection plugin republishes a `product` when a
later tool call returns fresher data (same `(kind,id)` → upsert).

### A5 · Tone-coded conversation

```
 legend   ■ product  ■ field  ■ source  ■ proposal  ■ tool  ■ run
```

**How it works.** `tone` on each descriptor maps to `--pbui-tone-<type>`
tokens; `KindLegend` (already in pbui) renders the legend. A reader can tell
from colour alone whether a chip is data, evidence, or a pending decision.

---

## B · The verb round trip (human ↔ agent)

### B1 · "Ask the agent" verbs put typed references in the composer

```
│ agent  … <field qty> is skewed: 60 % of SKUs under 5 units …             │
│                       ▾────────────────────────────┐                    │
│                       │ <field> qty                │                    │
│                       │ Group table by qty         │                    │
│                       │ Ask: why is this skewed?   │ ◄── chosen         │
│                       └────────────────────────────┘                    │
├─ composer ────────────────────────────────────────────────────────────────┤
│ > why is [<field qty> of <table t3>] skewed?█                            │
│   refs: field{doc:t3,name:qty}                            ⏎ send         │
└──────────────────────────────────────────────────────────────────────────┘
```

**How it works.** An `askAgent` verb is data: `{kind:"askAgent", template:
"why is {0} skewed?", refs:[ref]}`. The composer renders refs as chips and the
send body carries `refs[]` structurally (`sendMessageBody` hook). The backend
turns refs into a typed block in the turn (`pbui.refs@v1`) so the model sees
`{type:"field", value:{…}}`, not prose it has to re-parse.

### B2 · Typed mentions by accept or drag

```
├─ composer ────────────────────────────────────────────────────────────────┤
│ > compare [<product 2049>] with [<product 2051>] over [<datum Q2>]        │
│                                                  ↑ clicked in the chart  │
│   (＋) insert object…   ← enters ACCEPT MODE for any type                 │
└──────────────────────────────────────────────────────────────────────────┘
 ACCEPT MODE   pick an object to mention   (Esc aborts) · works across tiles
```

**How it works.** The composer's `insert object` button calls
`accept({types: registry.allTypes(), prompt})`. The user may click a chip in a
previous message, a row in a table tile, or a mark in a chart tile — accept
mode already spans tiles and workspaces. Conversions apply (`datum → product`
when a row has a product id), so the user clicks the thing they see.

### B3 · Agent-proposed verbs: suggestions that *do* something

```
│ agent  Stock is thin on three SKUs.                                       │
│                                                                          │
│        next   [ Filter table to qty < 5 ]  [ Open chart: qty by metal ]  │
│               [ Watch <product 2077> ]     [ Draft reorder for all 3 ]   │
```

**How it works.** Coinvault's `pills` become real verbs. The model emits
`{verb:{kind:"addFilter", docId, field:"qty", op:"<", value:5}, label}`; the
frontend validates the verb against the registry's verb schema (generated JSON
schema from the `Verb` union) and renders a chip. Clicking performs it
**locally through `onPerform`** — zero LLM latency, and the verb lands in the
trace like any human verb. Invalid verbs render disabled with
`disabledBecause: "unknown verb setColour"`.

### B4 · The agent asks for an object (accept mode driven by the model)

```
│ agent  Which product should I draft the reorder for?                     │
│        ┌──────────────────────────────────────────────────────────────┐  │
│        │ ACCEPTING <product>   click any product, in any tile · Esc   │  │
│        └──────────────────────────────────────────────────────────────┘  │
│                                                                          │
│ (user clicks <product 2051> in the table two messages up)                │
│                                                                          │
│ you  ⇒ <product 2051 1/2oz AGE 2024>            ← the accept result,     │
│                                                   posted as a typed turn │
│ agent  Drafting a reorder for 1/2oz AGE 2024 …                           │
```

**How it works.** A backend tool `pbui_accept{types, prompt, filter?}` is a
*human tool* in chat-provider terms: the tool call is routed to the browser,
which calls `pbui.accept(request)`; the resolved reference is posted back as
the tool result (`FrontendToolResultCommand`). The tool loop resumes with a
structured value. Cancel (Esc) returns `null` and the model is told the user
declined. Nothing new on the wire: this is the frontend-tool bridge that
already exists, carrying a PBUI reference.

### B5 · Proposals: human-in-the-loop as a presentation

```
│ agent  ┌─ <proposal p9> Reorder 1/2oz AGE 2024 ── danger ──────────────┐ │
│        │ supplier   <supplier APMEX>        qty  25   est. $31 500     │ │
│        │ rationale  below reorder_at for 9 days; 4 sales/wk            │ │
│        │                                                               │ │
│        │   [ Approve ]   [ Edit qty… ]   [ Reject ]   [ Ask why 25 ]   │ │
│        └───────────────────────────────────────────────────────────────┘ │
│                                              ▾ R-click: same four verbs  │
```

**How it works.** A `proposal` type with `danger: true` on `approve`. The card
*is* a presentation, so the buttons and the object menu are "two doors to the
same verbs" (playbook §6). Approve performs `{kind:"resolveProposal", id,
decision:"approve"}`, which the product router forwards as a tool result to the
parked human tool. The proposal is a committed timeline entity, so a reload
during deliberation shows the same card with the same verbs — and an approved
proposal re-renders with its verbs disabled: `disabledBecause: "approved by
manuel at 14:02"`.

### B6 · The verb trace, readable by both parties

```
┌─ trace ─────────────────────────────────────────────────────────────────┐
│ #41 14:02:10  human  resolveProposal  <proposal p9> approve             │
│ #40 14:01:55  agent  addFilter        <table t3> qty < 5                │
│ #39 14:01:40  human  openInTile       <inventory_table w7> → chart      │
│ #38 14:01:12  agent  accept           <product> → <product 2051>        │
│ #37 14:00:58  human  askAgent         why is <field qty> skewed?        │
│   [ Undo #40 ]   [ Replay from #37 ]   [ Ask: summarise what I did ]    │
└─────────────────────────────────────────────────────────────────────────┘
```

**How it works.** Every `onPerform` appends a `traceEntry` (datalab already has
the type and the capped-trace rule). Agent-performed verbs are tagged `agent`.
A backend tool `pbui_trace{since}` lets the model read it, which makes "what
did I just do?" and "undo that" answerable without the model guessing from
prose. Undo is a verb on `traceEntry` whose availability is decided by the
router (`disabledBecause: "a tool result cannot be undone"`).

---

## C · Custom widgets = composed presentations

### C1 · Declarative widget documents (no frontend deploy per widget)

```
│ agent  ┌─ <widget w12> Gold Eagle health ─────────────────────────────┐ │
│        │  stock        ▰▰▰▰▰▱▱▱▱▱  5 / 25     <meter>                 │ │
│        │  30-day sales ▁▂▃▅▇▅▃▂▁▂▃▅  ↑12 %     <sparkline>             │ │
│        │  by metal     ▓▓▓▓▓▓▓▓░░░░░░▒▒▒      <segmented gold/silver/pt>│ │
│        │  worst        <product 2077>  <product 2051>  <product 2049>  │ │
│        │  [ Refresh ]  [ Open as tile ]  [ Show the SQL ]              │ │
│        └──────────────────────────────────────────────────────────────┘ │
```

```yaml
# what the model (or a tool) emits — a widget document, validated server-side
format: pbui.widget
schema_version: 1
title: Gold Eagle health
layout: stack
children:
  - { kind: meter,     label: stock,        value: 5, max: 25, ref: {type: stat, value: {...}} }
  - { kind: sparkline, label: 30-day sales, values: [3,4,6,9,12,9,6,4,3,4,6,9] }
  - { kind: segmented, label: by metal,     parts: [{label: gold, value: 61}, …] }
  - { kind: refs,      label: worst,        refs: [{type: product, value: {id: 2077, …}}, …] }
verbs:
  - { label: Refresh,      verb: {kind: rerunTool, toolCallId: tc_31} }
  - { label: Open as tile, verb: {kind: openInTile, widgetId: w12} }
```

**How it works.** The widget document is a closed vocabulary of pbui atoms and
molecules (`Meter`, `Sparkline`, `SegmentedBar`, `Chip`, `Callout`, `DiffHunk`,
`ResultLog`, `Stack`, `Surface`, table) plus `refs` slots that embed
presentations. It rides in `WidgetInstanceEntity.props` (an inner `Struct`,
which the schema policy allows) under `widget_name: "pbui.widget"`. One
`defineWidget("pbui.widget", PbuiWidget)` renders every future widget; the
server validates the document against a JSON schema before publishing, and a
rejected document becomes a `projection_error` entity instead of silence. This
is the "custom widget capability": new widgets are data, old clients still
render what they know and show a `Callout` for parts they do not.

### C2 · Streaming widgets: preview, then commit

```
│ agent  ┌─ <table t4> top sellers ── ┆ streaming 12/25 ┆ ───────────────┐ │
│        │ <field sku> <field name>              <field sold> <field $>  │ │
│        │ 2049   1oz AGE 2024                      41      98 810       │ │
│        │ 3110   1oz Maple 2024                    37      88 430       │ │
│        │ ┆ 2301   1oz Buffalo …                   ┆                    │ │
│        └────────────────────────────────────────────────────────────── ┘ │
```

**How it works.** Sessionstream's batch-patch-into-delta pattern:
`WidgetInstancePatched` with `patch_paths: ["rows"]` appends rows live; the
timeline projection folds every patch into the whole entity, so a reconnecting
client hydrates the full table rather than replaying deltas. Provisional state
is live-only (the `┆` region); `WidgetInstanceCompleted` commits. Presentations
inside a streaming widget are already clickable — accept mode works on a row
that arrived a second ago.

### C3 · Widget-local verbs

```
│        │ <field qty> ▾──────────────────────┐                           │
│        │             │ Sort ascending       │                           │
│        │             │ Filter qty < …       │                           │
│        │             │ Group by qty         │                           │
│        │             │ Map to y (chart)     │ ← only if a chart is open │
│        │             │ Ask: describe qty    │                           │
│        │             └──────────────────────┘                           │
│        │ <row 2051> R-click → Inspect · Watch · Compare with… · Ask     │
```

**How it works.** The same `field`/`row`/`datum` descriptors datalab ships;
the table widget mints references with `docId` = the widget's document, so a
verb on a column in message 17 targets *that* table, not whichever is active.
Verbs that need a target tile (map to `y`) carry `disabledBecause: "no chart is
open for this document"` until one is.

### C4 · Forms as presentations (human tools, filled by clicking)

```
│ agent  ┌─ <form f2> Reorder details ───────────────────────────────────┐ │
│        │ product   [ <product 2051 1/2oz AGE 2024>        ] (＋ pick)  │ │
│        │ supplier  [ <supplier APMEX>                      ] (＋ pick)  │ │
│        │ quantity  [ 25            ]   eta  [ 2026-09-01 ]             │ │
│        │ note      [                                         ]         │ │
│        │                              [ Submit ]   [ Cancel ]          │ │
│        └──────────────────────────────────────────────────────────────┘ │
 ACCEPT MODE   pick the supplier for this reorder   (Esc aborts)
```

**How it works.** A `form` widget document whose fields have `accepts: [type]`;
the `(＋ pick)` affordance enters accept mode for that field. Submit posts the
form as a frontend-tool result (it *is* a human tool with `render`), so the
backend receives typed values. Validation rules live in the document
(`required`, `min`), rendered with pbui inputs (`TextInput`, `SelectInput`).

### C5 · Diff and plan widgets with per-hunk verbs

```
│ agent  I'd change the query like this:                                   │
│        ┌─ <diff d3> sql_query args ─────────────────────────────────────┐ │
│        │ @@ -1,3 +1,4 @@                                                │ │
│        │  SELECT sku, name, qty FROM products                            │ │
│        │ -WHERE qty < 10                                                 │ │
│        │ +WHERE qty < reorder_at                                         │ │
│        │ +  AND discontinued = 0                                         │ │
│        │   [ Apply ]  [ Apply hunk 1 only ]  [ Explain ]                 │ │
│        └───────────────────────────────────────────────────────────────┘ │
```

**How it works.** `DiffHunk` is a pbui molecule already; a `diff` type with
hunk-level references (`<hunk d3/1>`). `apply` is a verb the router turns into
a tool call (`rerunTool` with edited args) or a workbench `DocumentPut`. Same
shape for "plan" widgets: a list of `step` objects with `toggleStep`/`moveStep`
verbs (datalab's pipeline vocabulary).

### C6 · The run as an object: scrub the agent's work

```
│ agent  ┌─ <run r17> 4 tool calls · 6.2 s · 11 k tokens ────────────────┐ │
│        │ ◀◀ ◀ ▶ ▶▶  ├──●────┼─────┼──────────┼───┤  step 2 / 4           │ │
│        │ ▓▓▓▓ sql_doc ░░░░░░░░ sql_query ▒▒▒▒▒ knowledge_search ▓▓ answer│ │
│        │ at step 2: <tool sql_query> 25 rows → <table t4>               │ │
│        │   [ Re-run from here ]  [ Open trace ]  [ Ask: why this query? ]│ │
│        └───────────────────────────────────────────────────────────────┘ │
```

**How it works.** `TransportBar` + `SegmentedBar` were ported *from* an agent
workbench prototype (DATADROP-11) and are waiting for exactly this. The run
entity is built from geppetto's run/tool events by the projection plugin; each
segment is a `tool` presentation with its own menu. Scrubbing shows the
timeline view "as of" that ordinal (`TimelineView.Ordinal()` — the store keeps
entity versions).

---

## D · Workbench integration

### D1 · Promote any widget to a tile; linked views

```
┌─ chat ───────────────────────────┐┌─ table · t4 ─────────────────────────┐
│ … <table t4 top sellers>         ││ sku   name              sold   $     │
│      ▾ Open in tile ─────────────┼►│ 2049  1oz AGE 2024        41  98 810 │
│                                  ││ 3110  1oz Maple 2024      37  88 430 │
│                                  │├─ chart · t4 ─────────────────────────┤
│                                  ││  sold ▇                              │
│                                  ││       ▇ ▇                            │
│                                  ││       ▇ ▇ ▇ ▅ ▃ ▂   x: <field name>  │
└──────────────────────────────────┘└──────────────────────────────────────┘
```

**How it works.** `openInTile` performs a workbench `MutationBatch`:
`DocumentPut{format:"pbui.table", body}` + `ViewCreate{app_id:"table",
documents:{primary: docId}}` + `PlacementSplit`. Two tiles bound to one
document are *linked* (the workbench's own model): a filter applied in the
chat's table verb updates the chart tile. The chat keeps a `<tile>` reference
back, so "close that tile" is a verb too.

### D2 · The agent arranges the workbench

```
│ you    put the chart on the right, half width, and title it "Q3 movers"   │
│ agent  done.                                                             │
│        ┌─ <mutation m5> applied at revision 42 ──────────────────────┐   │
│        │ placement.split  ws1/n3 → row 0.5 · view chart-t4           │   │
│        │ view.configure   chart-t4  title "Q3 movers"                │   │
│        │   [ Undo ]  [ Show JSON ]                                   │   │
│        └─────────────────────────────────────────────────────────────┘   │
```

**How it works.** A backend tool `pbui_workbench_mutate{mutations[]}` calls the
same `POST /v1/workbenches/{id}/mutate` that `hyperslop ui mutate` uses
(`If-Match`, `Idempotency-Key`); the host's `ApplicationCatalog` +
`DocumentValidator` reject anything illegal and the 409/422 goes back to the
model as a tool error. The applied batch is itself presented (`mutation` type)
with `undo` = the inverse batch. The agent reads the current layout with
`pbui_workbench_get` first, so "the chart" resolves to a real view id.

### D3 · The chat is a tile; many chats; a chat per document

```
┌─ launcher ─────────────────────────┐
│ > chat                             │
│ ─ applications ─────────────────── │
│   chat            new conversation │
│   chat · t4       ask about table  │ ← document-bound chat
│ ─ objects from chat ────────────── │
│   <product 2049>  m17              │
│   <table t4>      m19              │
│ ⏎ place · splits the active tile ⬌ │
└────────────────────────────────────┘
```

**How it works.** `registerApp({id:"chat", docBound:false, singleton:false})`
and a second `registerApp({id:"chat-doc", docBound:true})` whose system prompt
is seeded with the bound document's `describe()`. The `LauncherShell` lists
rows the product supplies; adding "objects from chat" rows is just another
group. A conversation is a workbench document (`format: pbui.chat`), so
workspaces can be exported with their chats.

### D4 · Object permanence: reload, resume, export

```
│ (after reload)                                                           │
│ agent  … <product 2049> …  ← still a presentation with the same verbs    │
│        ┌─ <proposal p9> … approved by manuel at 14:02 ─────────────────┐ │
│        │   [ Approve — already approved ]  [ Reject — already approved]│ │
```

**How it works.** Every object is a timeline entity hydrated by the snapshot;
the `chat-provider.widget` adapter already guarantees live and hydrated paths
produce the same entity (CHATOVERLAY-010). Verb availability is recomputed from
entity state by the descriptor, so a reloaded proposal knows it was approved.
Export uses pinocchio's export service plus the workbench document for layout.

---

## E · Agent self-knowledge

### E1 · The agent knows the vocabulary

```
system prompt (generated)
  Presentation types you may reference: product{id,name,qty,price,…},
  field{docId,name}, source{evidenceId}, proposal{…}, …
  Verbs you may propose: addFilter{docId,field,op,value}, openInTile{…}, …
  Rules: verbs are data; never invent a kind; cite sources by evidence id only.
tools
  pbui_describe_types   → the registry's types, tones, and verb schemas
  pbui_accept           → ask the user for an object (blocks the run)
  pbui_trace            → recent verbs by human and agent
  pbui_workbench_get / pbui_workbench_mutate
  pbui_widget           → publish a widget document (validated)
```

**How it works.** The TS registry is the source of truth; a build step emits a
JSON schema for `Values`, `Verb` and the widget document (`cmd/schemagen` in the
playbook's shape, here TS → JSON). The Go side embeds that schema, uses it to
validate model output and to render the system-prompt section, so the model's
vocabulary and the UI's vocabulary cannot drift.

### E2 · "This" resolves to what the user is looking at

```
│ you    why is this one so expensive?        (cursor on <product 2049>)   │
│ agent  <product 2049 1oz AGE 2024> is priced at spot + 6.8 % …           │
```

**How it works.** The send body carries `focus: {reference, describe}` — the
last hovered/focused presentation (the mouse-doc line already tracks it) and
the active tile's document. Deictic prompts stop being guesswork. Privacy rule:
only the *reference and describe output* travel, never raw screen contents.

### E3 · Two chats, one object model — domain neutrality (datalab)

```
┌─ chat · datalab ─────────────────────────────────────────────────────────┐
│ you   what's in the sensors drop today?                                  │
│ agent <drop sensors> has <stream events> with 18 402 events since 00:00; │
│       <field temp_c> ranges 18.2–24.9. Suggested:                        │
│       [ Open table: last 500 ]  [ Chart temp_c by hour ]  [ Tail live ]  │
└──────────────────────────────────────────────────────────────────────────┘
```

**How it works.** Same chat package, different registry (`drop`, `stream`,
`dataset`, `field`, `datum`) and different tools (datalab's typed `/table` and
`/events` endpoints). Nothing in the chat layer names a domain: it takes a
`createPbui` instance and a verb router, like every other PBUI product.

---

## F · A five-minute demo script (ties it together)

1. Ask "which gold eagles are low on stock?" → A1 answer with live chips and a
   streaming table (C2). Hover: the mouse-doc line narrates (A3).
2. Right-click `<field qty>` → *Ask: why is this skewed?* (B1). The composer
   shows a typed mention; send.
3. The agent answers with a health widget (C1) and verb chips (B3); click
   *Open chart: qty by metal* → a chart tile appears, linked (D1).
4. Say "put the chart on the right and title it Q3 movers" → D2 mutation card.
5. Say "draft a reorder" → the agent enters accept mode (B4); click a row in the
   chart tile; a proposal card appears (B5); approve.
6. Reload the page → everything is still there with correct verb states (D4);
   open the trace tile (B6) and ask "summarise what I did".

---

## G · Tiers: what to build first

| Tier | Features | Why this order |
|---|---|---|
| **0 · foundation** | A1, A2, A3, A5, E1 | Everything else is a verb on an object; without the registry-generated vocabulary the model cannot emit valid objects |
| **1 · round trip** | B1, B2, B3, D4 | Proves verbs-as-data both ways and that hydration keeps verbs alive; no new backend command needed beyond `refs[]` on send |
| **2 · custom widgets** | C1, C2, C3, A4 | The declarative widget document replaces coinvault's per-widget pipeline; streaming via existing `WidgetInstancePatched` |
| **3 · agency** | B4, B5, C4, B6, E2 | Needs the frontend-tool bridge carrying PBUI references and the trace tool |
| **4 · workbench** | D1, D2, D3, C5, C6 | Needs a workbench host (datalab-style server) next to the chat server |
| **5 · breadth** | E3 | A second registry proves domain neutrality |

Each tier is demoable on its own; tier 2 is the point where the product is
already better than the current coinvault chat for the people who maintain it.
