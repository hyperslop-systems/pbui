## What this branch does

Two tickets, seven completed steps, plus the publish plumbing that unblocks the rest.

### PBUI-WORKBENCH-2 — the shared workbench package grows up

**Phase 1** (`8200d59`, `cd1e7d7`, `ccd02f8`, `cd13915`) — store injection with `onMutate`/`onRejected`; `buildLayout`/`workspaces()`; five workspace verbs (`select`/`create`/`rename`/`delete`/`clone`) and a `WorkspaceStrip`; `tile.replace`/`tile.link`/`view.rebind` with a `splitPolicy` and a `binding` config; `MutationError.detail` restored for TS↔Go parity.

**Phase 2** (`0dfd1bb`) — the launcher's rows model behind product slots (`rows`/`choose`/`renderDetail`), per-pane invocation (`launcher.open({placementId})`), `group`/`blurb`/`available` on `AppDescriptor`, `createTileDescriptor`, the `×N` linked badge, `focusPlacement`, and divider `aria-valuetext`/Home/End/double-click.

**C1** (`agentlogic`, separate repo) — the first product migration: net −232 lines there, `TileTree` and `LauncherPanel` deleted, product policy reduced to a 147-line shell.

**Three core defects C1 found** (`5e4d592`) — all in Phase 1 code, none findable by another test in this package:

1. `splitPolicy: { app }` was silently inoperative for singletons. The guard short-circuited before the policy was read; `duplicate_singleton` is a hazard of *duplicating*, and `{ app }` places a different application.
2. A tile placed by `split(…, appId)` was born unbound — it used the protocol's `splitPlacement`, which mints a view with no documents. `place()` routes through `split`, so the launcher had it too.
3. `createWorkbench({ store, onMutate })` silently dropped the hook. Now throws at construction.

### PBUI-AGENT-2 — the chat agent can build and rearrange the workspace

**B0** (`13734a1`) — `specOf` and `describeWorkbench`: the read side an agent addresses verbs from, with opt-in rendered geometry.

**B1** (`1c65426`, `dfbab54`) — six browser-side workbench tools. Nothing calls `wb.verbs.*`; every tool performs through the product's router, so an agent's rearrangement lands in the trace beside a human's with `actor: "agent"`. `confirm`-policy verbs require a `confirmationId` **and** a product-supplied `isApproved`, which defaults to false.

**B2** (`668759d`, `dfbab54`) — `tile`/`workspace`/`app` presentation types, twenty workbench verb kinds spelled exactly as the package spells them, the tile descriptor from `createTileDescriptor`, and a `## The workspace` prompt section gated on the vocabulary declaring `tile`.

**B3** (`531df03`, `455c756`) — four demo tile types (`inventory`, `sku`, `metals`, `notes`), each exercising a different mechanism; `notes` is the only thing in the product that uses `WorkbenchDocument.documents`.

Right-clicking a tile bar now offers the same verbs the chrome buttons perform — which completes Phase 2's third acceptance gesture.

### Publishing (`96d1703`)

`publish-pbui-workbench.yml` and `publish-pbui-chat.yml`, copied from `publish-workbench-protocol.yml` so the gates are identical. `workbench-protocol` 0.2.0 → 0.3.0 for the additive `MutationError.detail`.

**These workflows are the point of merging this.** `workflow_dispatch` only registers for files on the default branch, and `pbui-workbench` being unpublished is what blocks every remaining product migration.

## Verification

`make ci-check` clean · pbui-workbench 114 tests · pbui-chat 72 · workbench-protocol 44 · demo typecheck + build · `pnpm install --frozen-lockfile` resolves after the bump · Storybook builds · browser passes on the embedded binary for both phases.

## Known-broken, deliberately

`agentlogic`'s `package.json` names `^0.1.0` for `pbui-workbench` with no lockfile entry — C1 verified against locally packed tarballs. It points at this publish and is fixed by a real install once the package exists.

## Reading

Diaries carry the full record including every failure: `ttmp/2026/08/20/PBUI-WORKBENCH-2--…/reference/01-diary.md` steps 3–5, and `ttmp/2026/08/20/PBUI-AGENT-2--…/reference/01-diary.md` steps 1–3.
