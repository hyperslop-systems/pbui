#!/usr/bin/env node

/**
 * Focused executable probes for the tool-call review. Run from the PBUI repo root
 * after building @hyperslop-systems/pbui-chat.
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const outIndex = process.argv.indexOf("--output");
const output = outIndex >= 0 ? process.argv[outIndex + 1] : null;
const load = (path) => import(pathToFileURL(resolve(path)).href);
const tick = () => new Promise((resolveTick) => setTimeout(resolveTick, 15));

const { createToolRegistry } = await load(
  "packages/pbui-chat/node_modules/@go-go-golems/chat-provider/tools/toolRegistry.js",
);
const { createToolRuntime } = await load(
  "packages/pbui-chat/node_modules/@go-go-golems/chat-provider/tools/toolRuntime.js",
);
const { createConversationTools, createSandboxTools } = await load("packages/pbui-chat/dist/index.js");

// Probe 1: a completed automatic frontend request can execute again when the
// same request is reconciled from a later snapshot.
const autoRegistry = createToolRegistry();
let autoExecutions = 0;
const autoResults = [];
autoRegistry.register({
  name: "review_auto",
  mode: "frontend",
  execute: async () => ({ execution: ++autoExecutions }),
});
const autoRuntime = createToolRuntime({
  registry: autoRegistry,
  submitToolResult: async (result) => autoResults.push(result),
});
const repeatedRequest = { toolCallId: "same-call", toolName: "review_auto", input: {} };
autoRuntime.reconcileFrontendToolRequests([repeatedRequest]);
await tick();
autoRuntime.reconcileFrontendToolRequests([repeatedRequest]);
await tick();
assert.equal(autoExecutions, 2);
assert.equal(autoResults.length, 2);

// Probe 2: respondToHumanTool does not reject a second response after pending
// state has been deleted. A UI double-submit can therefore POST twice.
const humanRegistry = createToolRegistry();
const humanResults = [];
humanRegistry.register({ name: "review_human", mode: "human", render: () => null });
const humanRuntime = createToolRuntime({
  registry: humanRegistry,
  submitToolResult: async (result) => humanResults.push(result),
});
humanRuntime.reconcileFrontendToolRequests([
  { toolCallId: "human-call", toolName: "review_human", input: {} },
]);
await tick();
await humanRuntime.respondToHumanTool({
  toolCallId: "human-call",
  toolName: "review_human",
  status: "success",
  result: { decision: "approve" },
});
await humanRuntime.respondToHumanTool({
  toolCallId: "human-call",
  toolName: "review_human",
  status: "success",
  result: { decision: "approve" },
});
assert.equal(humanResults.length, 2);

// Probe 3: conversation_send binds approval to target+prompt through the
// product callback, but the tool factory does not consume the approval id.
const other = { id: "other", title: "Other", open: true };
const conversationRegistry = {
  all: () => [other],
  activeId: () => "self",
  get: (id) => (id === "other" ? other : null),
};
let handoffs = 0;
const conversationSet = createConversationTools({
  getConversations: () => conversationRegistry,
  conversationId: "self",
  isApproved: () => true,
  perform: async () => {
    handoffs += 1;
    return "performed";
  },
});
const send = conversationSet.tools.find((tool) => tool.name === "conversation_send");
const handoffInput = { conversationId: "other", prompt: "same exact handoff", confirmationId: "approved-once" };
await send.execute(handoffInput);
await send.execute(handoffInput);
assert.equal(handoffs, 2);

// Probe 4: action.define can be configured as confirm, but successful creates
// never add the confirmation id to the factory's spent set.
const actions = {};
let actionCounter = 0;
const library = {
  getState: () => ({ programs: {}, actions }),
  putAction(input) {
    const id = input.id ?? `action-${++actionCounter}`;
    const record = { ...input, id, pinned: false };
    actions[id] = record;
    return record;
  },
};
const sandboxSet = createSandboxTools({
  getLibrary: () => library,
  getEngine: () => ({ kind: "probe" }),
  getWorkbench: () => null,
  perform: async () => "performed",
  resolve: () => null,
  policy: { "action.define": "confirm" },
  isApproved: () => true,
});
const defineAction = sandboxSet.tools.find((tool) => tool.name === "sandbox_define_action");
const actionInput = {
  label: "Probe action",
  types: ["product"],
  behaviour: { kind: "askAgent", template: "inspect {0}" },
  confirmationId: "approved-action-once",
};
const firstAction = await defineAction.execute(actionInput);
const secondAction = await defineAction.execute(actionInput);
assert.equal(firstAction.ok, true);
assert.equal(secondAction.ok, true);
assert.equal(Object.keys(actions).length, 2);

const probes = [
  ["completed frontend request replay", `executions=${autoExecutions}; submittedResults=${autoResults.length}`],
  ["duplicate human-tool response", `submittedResults=${humanResults.length}`],
  ["conversation approval replay", `performedHandoffs=${handoffs}`],
  ["sandbox action approval replay", `createdActions=${Object.keys(actions).length}`],
];

const body = `---\nTitle: 'Tool runtime executable probes'\nTicket: PBUI-AGENT-4\nStatus: active\nTopics: [pbui, chat, frontend, backend, onboarding]\nDocType: reference\nIntent: long-term\nOwners: []\nRelatedFiles: []\nExternalSources: []\nSummary: 'Executable evidence for replay and duplicate-submission findings in the agent-to-UI tool path.'\nWhatFor: Verify review claims that are easy to miss in static reading.\nWhenToUse: Reviewing tool-call idempotency and approval-consumption remediation.\n---\n\n# Tool runtime executable probes\n\nResult: **PASS (all currently observable hazards reproduced)**\n\n| Probe | Observation |\n|---|---|\n${probes.map(([name, observation]) => `| ${name} | \`${observation}\` |`).join("\n")}\n\nA PASS means the probe successfully reproduced the reviewed current behavior; it does **not** mean the behavior is desirable. After remediation, invert these assertions and treat replay/duplicate execution as a failing condition.\n`;

if (output) writeFileSync(output, body);
else process.stdout.write(body);
