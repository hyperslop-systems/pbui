#!/usr/bin/env node
/**
 * Probe the exact installed @go-go-golems/chat-provider package, not source in
 * a sibling checkout. Exit 1 unless terminal replay and executor filtering
 * produce exactly one effect and one result submission.
 */
import { existsSync, readFileSync } from 'node:fs';
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
const packageEntry = require.resolve('@go-go-golems/chat-provider');
const packageJsonPath = join(dirname(packageEntry), 'package.json');
const installedPackage = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const toolsIndex = pathToFileURL(require.resolve('@go-go-golems/chat-provider/tools'));
const { createToolRegistry } = await import(toolsIndex);
const { createToolRuntime } = await import(new URL('./toolRuntime.js', toolsIndex));

const executorA = {
  clientInstanceId: 'probe-client-a',
  connectionId: 'probe-connection-a',
  assignmentId: 'probe-assignment-a',
};
const executorB = {
  clientInstanceId: 'probe-client-b',
  connectionId: 'probe-connection-b',
  assignmentId: 'probe-assignment-b',
};
const frameFor = (executor) => ({
  name: 'ChatFrontendToolCallRequested',
  payload: { toolCallId: 'call-1', toolName: 'effect', input: { value: 1 }, executor },
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

function setup(counters, executor) {
  const registry = createToolRegistry();
  registry.register({
    name: 'effect',
    mode: 'frontend',
    async execute(input) {
      counters.executions += 1;
      return { ok: true, input };
    },
  });
  const runtime = createToolRuntime({
    registry,
    async submitToolResult(result) {
      counters.submissions.push(result);
    },
  });
  runtime.setExecutorIdentity(executor);
  return runtime;
}

const replay = { executions: 0, submissions: [] };
const one = setup(replay, executorA);
one.handleFrontendToolUIEvent(frameFor(executorA));
await settle();
one.handleFrontendToolUIEvent(frameFor(executorA));
await settle();

const multitab = { executions: 0, submissions: [] };
const tabA = setup(multitab, executorA);
const tabB = setup(multitab, executorB);
const assignedToB = frameFor(executorB);
tabA.handleFrontendToolUIEvent(assignedToB);
tabB.handleFrontendToolUIEvent(assignedToB);
await settle();

const report = {
  package: `${installedPackage.name}@${installedPackage.version}`,
  terminalReplay: {
    executions: replay.executions,
    submissions: replay.submissions.length,
    submittedExecutor: replay.submissions[0]?.executor ?? null,
    requiredExecutions: 1,
    requiredSubmissions: 1,
  },
  twoIndependentTabs: {
    executions: multitab.executions,
    submissions: multitab.submissions.length,
    submittedExecutor: multitab.submissions[0]?.executor ?? null,
    assignedExecutor: executorB,
    requiredExecutions: 1,
    requiredSubmissions: 1,
  },
};
console.log(JSON.stringify(report, null, 2));
const sameExecutor = JSON.stringify(multitab.submissions[0]?.executor) === JSON.stringify(executorB);
if (
  replay.executions !== 1
  || replay.submissions.length !== 1
  || multitab.executions !== 1
  || multitab.submissions.length !== 1
  || !sameExecutor
) process.exitCode = 1;
