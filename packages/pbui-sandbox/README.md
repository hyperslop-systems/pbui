# @hyperslop-systems/pbui-sandbox

A reactive sandbox for agent-written programs, borrowed from vm-system's
plugin runtime: a program calls `definePlugin(({ ui }) => ({ initialState,
widgets: { main: { render, handlers } } }))`; `render` is a pure function
from `(pluginState, globalState)` to a JSON `UINode` tree; `handlers` never
mutate anything — they emit intents (`state/merge`, `state/replace`, or a
`verb`) that the host reduces. The host renders the tree with PBUI atoms,
keeps the state, and performs verbs through the product's router.

- `createEvalEngine()` — evaluates programs with `new Function` on the
  calling thread. Same contracts, no isolation, no timeouts. For development
  and demos.
- `createQuickJsEngine()` (planned) — the same contracts inside QuickJS in a
  Web Worker, with memory, stack and time limits.

The design, with its decision records, lives in
`ttmp/2026/08/21/PBUI-AGENT-3--…/design-doc/01-intern-guide-….md`.

```bash
pnpm --filter @hyperslop-systems/pbui-sandbox test
pnpm --filter @hyperslop-systems/pbui-sandbox typecheck
pnpm --filter @hyperslop-systems/pbui-sandbox build
```
