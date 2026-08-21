# Changelog

## 2026-08-21

- Initial workspace created


## 2026-08-21

Step 1: ticket opened; intern guide (multi-conversation design D1–D12, five helper tiles, phases 0–5, R1–R14) and diary step 1 written; no implementation per the user's instruction

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/createPbuiChat.tsx — The one-client assumptions the design removes


## 2026-08-21

Step 2 / Phase 0: chat runtimes as values held by a conversation registry; chat app doc-bound to a conversation; session-aware verb router; demo drops ChatProvider and migrates its persisted session. 131 tests. (commit a5d6d79)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/conversations/registry.ts — The registry every helper tile will read


## 2026-08-21

Step 3 / Phase 1: conversations tile, new-conversation gesture from three doors, five conversation verbs in the package, RouterContext.actor so D7's title ownership can be enforced, gated Go prompt section. 156 tests. (commit 324d335)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/conversations/verbs.ts — What a product splices into its vocabulary


## 2026-08-21

Step 4: conversations and workspaces became objects with right-click menus; four new conversation verbs; rename-without-a-title as a request; one page-level status bar. (commit ed84f22)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/conversations/ConversationsTile/ConversationsTile.tsx — A row IS the conversation


## 2026-08-21

Step 5 / Phase 2: the events tile over chat-provider's classified debug store (families, filters, pause, clear, copy), rows as chatEvent objects. 171 tests. (commit 4a83e0e)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/conversations/EventsTile/EventsTile.tsx — Presentation over a store the runtime already fills


## 2026-08-21

Step 6 / Phase 3: the runs and tools tiles, and the memos that make cross-conversation joins stable under useSyncExternalStore. 182 tests. (commit ba6613d)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/conversations/selectors.ts — toolCallsOf, selectToolTraffic, selectWaiting, useToolTraffic


## 2026-08-21

Step 7 / Phase 4: conversation_list and conversation_send behind an approval checked against the message, the doc-bound agent-context tile, and a scripted handoff verified end to end in the browser. 203 tests. (commit 4855631)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/demo/src/chat.ts — approvedSend — an approval that names only an id authorises everything


## 2026-08-21

Step 8 / Phase 5: Go SessionIndex (memory + SQLite) behind GET /api/chat/sessions and PATCH; registry.sync() merges and never overwrites a human title; DEFAULT_EVENT_FAMILIES; the pbui-chat README; the guide's 4.10 as built. 207 tests. Ticket complete. (commit ad6c6cc)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/conversations/registry.ts — sync() and serverPatch — four fields, four rules

