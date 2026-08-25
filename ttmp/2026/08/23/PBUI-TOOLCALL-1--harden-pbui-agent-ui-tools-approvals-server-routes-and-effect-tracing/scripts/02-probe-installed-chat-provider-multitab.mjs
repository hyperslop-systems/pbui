#!/usr/bin/env node
/**
 * Probe the exact installed @go-go-golems/chat-provider package, not source in
 * a sibling checkout. Exit 1 while terminal replay or two-runtime ownership is
 * unsafe. This is blocker evidence, not a test that should be made green with
 * a PBUI-side compatibility wrapper.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, 'packages/pbui-chat/package.json'))) {
  const parent = dirname(root);
  if (parent === root) throw new Error('could not find the PBUI repository root');
  root = parent;
}
const require = createRequire(join(root, 'packages/pbui-chat/package.json'));
const toolsIndex = pathToFileURL(require.resolve('@go-go-golems/chat-provider/tools'));
const { createToolRegistry } = await import(toolsIndex);
const { createToolRuntime } = await import(new URL('./toolRuntime.js', toolsIndex));

const frame = {
  name: 'ChatFrontendToolCallRequested',
  payload: { toolCallId: 'call-1', toolName: 'effect', input: { value: 1 } },
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

function setup(counters) {
  const registry = createToolRegistry();
  registry.register({
    name: 'effect',
    mode: 'frontend',
    async execute(input) {
      counters.executions += 1;
      return { ok: true, input };
    },
  });
  return createToolRuntime({
    registry,
    async submitToolResult(result) {
      counters.submissions.push(result);
    },
  });
}

const replay = { executions: 0, submissions: [] };
const one = setup(replay);
one.handleFrontendToolUIEvent(frame);
await settle();
one.handleFrontendToolUIEvent(frame);
await settle();

const multitab = { executions: 0, submissions: [] };
const tabA = setup(multitab);
const tabB = setup(multitab);
tabA.handleFrontendToolUIEvent(frame);
tabB.handleFrontendToolUIEvent(frame);
await settle();

const report = {
  package: '@go-go-golems/chat-provider@0.5.0',
  terminalReplay: {
    executions: replay.executions,
    submissions: replay.submissions.length,
    requiredExecutions: 1,
  },
  twoIndependentTabs: {
    executions: multitab.executions,
    submissions: multitab.submissions.length,
    requiredExecutions: 1,
  },
};
console.log(JSON.stringify(report, null, 2));
if (replay.executions !== 1 || multitab.executions !== 1) process.exitCode = 1;
