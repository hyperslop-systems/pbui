# @hyperslop-systems/pbui-chat

A PBUI-native chat layer over `@go-go-golems/chat-provider`: the agent's
messages are presentations, its widgets are documents, its actions are verbs
from a closed vocabulary, and — since `PBUI-AGENT-4` — a product may hold as
many conversations at once as the user wants.

```tsx
const chat = createPbuiChat({ pbui, vocabulary, router, conversations: { key: "my-product.conversations" } });

// once, at the product's root — there is no <ChatProvider> above it
<chat.Provider environment={environment}>…</chat.Provider>
```

## Conversations

A conversation is a chat session, and in a workbench it is a **document**:
the `chat` application is doc-bound to a `conversation`, so two tiles with
two bindings are two agents and two placements of one binding are one agent
seen twice.

Because the workbench core validates every binding against the document store, `attachWorkbench` mirrors the registry into the workbench document as one stub per conversation (format `chat.conversation`). A product whose host validates document formats passes `conversationDocuments: { format: "my.conversation" }`; a product that writes conversation documents itself passes `conversationDocuments: false` and no source is connected.

`chat.conversations` is the registry. Records — id, title, pins, archive
flag, counts — persist in `localStorage`; a **runtime** (a store, a client, a
socket, a tool set) exists only while a conversation is *open*, which is
independent of whether a tile is showing it.

```ts
const snapshot = await chat.conversations.create({ title: "reorder desk" });
chat.conversations.activate(snapshot.id);   // singleton tiles follow this one
chat.conversations.close(id);               // disconnect; the record stays
await chat.conversations.sync();            // merge the server's list in
```

| Method | What it does |
|---|---|
| `create(options?)` | `POST /api/chat/sessions`, record it, open it, activate it |
| `adopt(id, patch?)` | take a session id that already exists (a migrated layout, the server's list) |
| `open` / `close` | build or dispose the runtime; the record survives both |
| `activate` | set *the active conversation*, which singletons follow and untargeted verbs go to |
| `rename` / `pin` / `archive` / `forget` | the record's own fields; `forget` drops it locally, the server keeps the session |
| `requestRename(id)` | ask the interface to open its name editor (see `conversation.rename` below) |
| `sync()` | reconcile with `GET /api/chat/sessions`; merges, never replaces |
| `runtimeFor` / `activeRuntime` / `forEachOpen` | reach the open runtimes |

`useConversations(registry, selector)` subscribes a component. The selector
must return a **stable reference** for an unchanged slice — it feeds
`useSyncExternalStore`, which compares by identity — so anything that derives
rather than reads has to memoise. `selectToolTraffic` and `selectWaiting` do.

A runtime is captured rather than constructed: `ConversationHost` (rendered
by `chat.Provider`) mounts one `<ChatProvider>` per open conversation outside
every tile, and `ChatRuntimeScope` re-provides it to whatever tile is showing
the conversation. `createToolRuntime` is not reachable through the installed chat-provider's
export paths, which is the whole reason; see
`conversations/runtime.ts`.

## Verbs

Nine kinds, declared in the package so their payloads and their refusal
wording are identical in every PBUI product. Splice them into the product's
union and delegate:

```ts
export const VerbSchema = z.discriminatedUnion("kind", [ /* …product verbs… */, ...ConversationVerbSchemas ]);
export const VERB_DOCS: VerbDocs = { /* …product docs… */, ...CONVERSATION_VERB_DOCS };

// in the `local` family handler
if (isConversationVerb(verb)) {
  await performConversationVerb(verb, {
    actor: ctx.actor,
    conversations: chat.conversations,
    workbench: chat.workbench(),
    send: (conversationId, template, refs) => ctx.sendToAgent(template, refs, { conversationId }),
  });
  return;
}
```

| Kind | Family | Notes |
|---|---|---|
| `conversation.new` | local | mints a session and opens a tile; optional `title`, `prompt`, `near` |
| `conversation.open` | local | opens a tile, or goes to the one that has it |
| `conversation.select` | local | makes it the active conversation |
| `conversation.rename` | local | **`title` is optional**: without one the verb asks the interface for its editor |
| `conversation.pin` / `.archive` / `.close` / `.forget` | local | this browser's list; verbs because an object menu entry is a verb or it is nothing |
| `conversation.send` | agent | the handoff — its target is a conversation *other* than the sender |

A human's rename **owns** the title (`titledBy: "human"`); an agent may name
one nobody has named, and is refused otherwise. `sync()` respects the same
rule.

## Tiles

`createChatApps(chat)` gives the conversation and the three panels every
product has wanted since `PBUI-AGENT-1`. `createConversationApps(chat)` gives
the five that start earning their space at the second agent; a product with
one conversation can leave them out.

| id | kind | what it shows |
|---|---|---|
| `chat` | doc-bound to `conversation` | the transcript and composer of one agent |
| `conversations` | singleton | every agent: status, connection, messages, age, tokens, what is waiting |
| `chat-events` | singleton | the wire log — frames, lifecycle changes, projected UI events, by family |
| `chat-runs` | singleton | model, runs, tokens, last duration, and a live token rate while streaming |
| `chat-tools` | singleton | waiting-for-you first, then every tool call with its input and result |
| `conversation-context` | doc-bound to `conversation` | what this agent was told: its tools, its last message, its environment, the vocabulary |

Rows in every list are **presentations**, so what can be done to a thing is
in its object menu rather than in a row of buttons beside it. A product
supplies the descriptors for `conversation`, `chatEvent` and `tool`.

## The agent's conversation tools

`conversation_list` tells a model who else is on the workbench, which
conversation the user is working in, and which one is itself.
`conversation_send` is the handoff, and it is `confirm` by default:

```ts
createPbuiChat({
  // …
  conversationTools: {
    confirmationHint: 'The proposal must carry fields [{"label":"to",…},{"label":"message",…}].',
    isApproved: (confirmationId, target, prompt) => /* …the product decides… */,
  },
});
```

`isApproved` takes the **target and the message**, not only the proposal id.
An approval that names only an id authorises every later send equally. There
is no default that says yes, so without a wiring a `confirm` send is refused —
the right way round for a check whose job is to not be skippable.

The Go side emits a `## Conversations` prompt section only when the product's
vocabulary declares a `conversation` type, the same gate the workspace and
programs sections use.

## The server's part

The browser owns the list. `GET /api/chat/sessions` and
`PATCH /api/chat/sessions/{id}` are backed by a `SessionIndex` (memory, or
SQLite with `Options.SessionsDB`) that the server can rebuild or lose: the
hub and the hydration store stay authoritative, a session id the index has
never heard of still connects and hydrates, and `registry.sync()` therefore
**merges** rather than replaces.

Adding a verb kind takes three steps: change the schema, run
`pnpm --filter @hyperslop-systems/pbui-chat-demo vocab`, and **restart the
server** — it re-validates every reported verb against the vocabulary it
embedded at compile time, so a stale binary makes a performed verb read as
`rejected` in the trace.

## Docs

The designs, with their decision records, live in
`ttmp/2026/08/21/PBUI-AGENT-1--…`, `PBUI-AGENT-2--…`, `PBUI-AGENT-3--…` and
`PBUI-AGENT-4--…` (this one: many conversations, the helper tiles, the
handoff).

```bash
pnpm --filter @hyperslop-systems/pbui-chat test
pnpm --filter @hyperslop-systems/pbui-chat typecheck
pnpm --filter @hyperslop-systems/pbui-chat build
```
