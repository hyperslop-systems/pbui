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


## 2026-08-22

Code review guide for an external auditor: the four load-bearing pieces, the API reasoning, 14 shortcuts I took and 8 defects in dependencies this change works around, a review order and eight things to try to break. Found and fixed a Rules-of-Hooks violation in ContextTile while writing it.

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/conversations/ContextTile/ContextTile.tsx — A hook below an early return, reachable from 'Drop it from the list'


## 2026-08-22

Step 9: began the three-part architecture review; recorded full automated validation and browser evidence for shared multi-conversation drafts and closed tiles stuck in an opening state

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/composer/Composer/Composer.tsx — Browser probe proved both mounted composers read and mutate the same product-wide draft
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/conversations/ConversationScope.tsx — Browser probe proved an explicitly closed mounted scope renders opening indefinitely
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/21/PBUI-AGENT-4--agent-helper-tiles-conversations-multiple-agents-event-tracing-run-stats-and-tool-traffic/scripts/01-review-inventory.mjs — Reproducible inventory for the three review scopes


## 2026-08-22

Step 10: drafted the three full intern-oriented architecture/code-review documents (PBUI core, JS API/interaction, agent framework/tiles) and added live focus/title/helper-tile evidence

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/21/PBUI-AGENT-4--agent-helper-tiles-conversations-multiple-agents-event-tracing-run-stats-and-tool-traffic/design-doc/03-pbui-itself-core-presentation-system-components-chrome-accessibility-and-design-system-code-review.md — PBUI core review
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/21/PBUI-AGENT-4--agent-helper-tiles-conversations-multiple-agents-event-tracing-run-stats-and-tool-traffic/design-doc/04-pbui-javascript-api-and-interaction-workbench-protocol-verbs-state-and-integration-code-review.md — Workbench/protocol JavaScript API review
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/ttmp/2026/08/21/PBUI-AGENT-4--agent-helper-tiles-conversations-multiple-agents-event-tracing-run-stats-and-tool-traffic/design-doc/05-agent-framework-and-tiles-multi-conversation-runtime-routing-tools-server-and-helper-tile-code-review.md — Agent runtime, server and tiles review

