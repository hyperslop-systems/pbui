# @hyperslop-systems/pbui-sandbox

A reactive sandbox for agent-written programs, borrowed from vm-system's
plugin runtime: a program calls `definePlugin(({ ui }) => ({ initialState,
widgets: { main: { render, handlers } } }))`; `render` is a pure function
from `(pluginState, globalState)` to a JSON `UINode` tree; `handlers` never
mutate anything — they emit intents (`state/merge`, `state/replace`, or a
`verb`) that the host reduces. The host renders the tree with PBUI atoms,
keeps the state, and performs verbs through the product's router.

## Engines

- `createEvalEngine()` — evaluates programs with `new Function` on the
  calling thread. Same contracts, no isolation, no timeouts. For development,
  tests and demos.
- `createQuickJsEngine({ worker })` (from `@hyperslop-systems/pbui-sandbox/quickjs`)
  — the same contracts inside QuickJS in a Web Worker, with memory, stack and
  time limits. The consumer owns the one-line worker file
  (`installQuickJsWorker()`), because only its bundler knows the asset layout.
- `createQuickJsDirectEngine()` — QuickJS on the calling thread, for tests
  and Node hosts.

Every engine passes the same conformance suite (`src/engines/conformance.ts`),
including `evaluate`, the REPL's door.

## Hosting programs

```ts
const host: SandboxHost = { library, engine, states, instances, resolve, useEnv, perform, renderReference, askAgent, bindingChoices };
const apps = [createScriptApp(host), ...createSandboxDevtools(host, { playgroundKey: "my-product.playground" })];
```

- `createProgramLibrary({ key })` — programs and generated actions in
  `localStorage`, with a version history per program and `rollback`.
- `createProgramStateStore()` — program state keyed by view id, so linked
  tiles share one state.
- `createInstanceRegistry()` — what is running (status, meta, trees,
  timings, a control handle), one global timeline of loads, renders, events,
  intents, errors and evaluations, and *the selected sandbox*: the program
  tile the user last clicked.
- `createScriptApp(host)` — the one workbench application every program runs
  in, doc-bound to `program`.

## Devtools

`createSandboxDevtools(host)` returns five more applications, all built from
pbui atoms on the registry:

| id | kind | what it does |
|---|---|---|
| `program-inspector` | doc-bound to `program` | a running instance's state (editable), resolved bindings, render tree as an outline (hover highlights the node in the tile; fire its handler), meta and timings |
| `sandbox-repl` | singleton | evaluate code *inside* the selected sandbox — `$plugin`, `$ui`, `$state`, `$global`, `$render()`, `$event()` — render a returned tree, set a result as state, apply returned intents, patch `$plugin` and re-render |
| `sandbox-timeline` | singleton | every entry across instances, newest first, with durations against the limits; filters, pause, *copy as `sandbox_test` events*, fire again |
| `sandbox-playground` | singleton | a persisted draft run live as you type, a bindings picker, save as new / update / load from / ask the agent |
| `program-source` | doc-bound to `program` | the source with line numbers, every kept version, a diff between any two, rollback (a confirm when pinned), edit in playground |

Program tiles get *inspect* and *source* buttons when the devtools are
registered with the same `host` object. The REPL and timeline follow the
selected sandbox; the playground's draft is itself an instance (`draft`),
so the REPL can target it and the timeline shows it.

The design, with its decision records, lives in
`ttmp/2026/08/21/PBUI-AGENT-3--…/design-doc/01-intern-guide-….md` (the
sandbox) and `ttmp/2026/08/21/PBUI-SANDBOX-1--…/design-doc/01-intern-guide-….md`
(the registry and the devtools).

```bash
pnpm --filter @hyperslop-systems/pbui-sandbox test
pnpm --filter @hyperslop-systems/pbui-sandbox typecheck
pnpm --filter @hyperslop-systems/pbui-sandbox build
```
