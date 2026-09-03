# @hyperslop-systems/workbench-core

The headless PBUI workbench engine. No React, no DOM: a browser shell, an agent, a test, a worker, and a server-side tool all cross the same command boundary.

```text
plan(world, commands) -> { mutations, session, effects } | refused | ambiguous
execute(commands)     -> plan fresh, check the revision, apply + validate, install once, run effects
```

## What it owns

| Module | Role |
|---|---|
| `apps` | `WorkbenchAppManifest` (`viewCardinality`, `duplicatePlacement`, ports), `defineAppManifest`, `createManifestCatalog` |
| `policy` | pane constraints, headless axis, duplicate policy, empty placement, initial document policy (`followTheCrowd`) |
| `graph` | the six-map structural `WorkbenchIndex`, rebuilt per document revision |
| `queries` | on-demand document questions: bindings to a document, formats, orphan views, placements of a view |
| `validation` | essential validation with `pkg/workbench` codes and paths; `parseWorkbenchDocument` |
| `document` | `layout`, `workspaces`, `singleTile`, `buildLayout`, `specOf`, serialize |
| `commands` | `WorkbenchCommand`, `ViewRequest` / `PlacementRequest`, `isWorkbenchCommand`, `describeWorkbenchCommand`, `commands.*` builders |
| `planner` | `resolveView`, `resolvePlacement`, `materialize`; placement, workspace, session, link handlers; one orphan sweep and one links maintenance per batch |
| `createWorkbenchCore` | one immutable observable state (document, session, index, revision); `execute`, `preview`, `apply`, `replaceDocument`, `restore`, `reset` |
| `links` | `createWorkbenchLinks` — the explicit collaborator: link commands as data, `pbui.links` document, lifecycle maintenance, runtime values |
| `describe` | the agent-facing description |
| `/rebalance` | the pure layout-repair engine and the preservation law |
| `/persistence` | `readWorkbenchSnapshot`, `createLocalPersistence` |
| `/sync` | the server outbox loop |

## Headless use

```ts
import { commands, createWorkbenchCore, createWorkbenchLinks, defineAppManifest, layout, split, tile } from "@hyperslop-systems/workbench-core";

const core = createWorkbenchCore({
  apps: [defineAppManifest({ id: "orders" }), defineAppManifest({ id: "notes", viewCardinality: "one" })],
  initial: layout(split("row", 0.5, tile("orders"), tile("notes"))),
  links: createWorkbenchLinks(),
});

const result = core.execute(commands.duplicate(placementId, "row"));
// { ok: true, changed: true, placementId: "n-…", viewId: "v-…" }

const advisory = core.preview(commands.close(placementId));
// { ok: true, mutations: [...], session: {...}, explanation: "close this tile" } — nothing changed
```

Geometry is a value: pass `execute(command, { geometry })` with a `GeometrySnapshot` the caller measured; without one the policy's deterministic fallbacks apply.

## Invariants

- Planning never touches anything observable; `preview` leaves the document, the session, and the link runtime exactly as they were.
- Every durable change — a command, a raw batch, a replacement — goes through one gateway: applied atomically, validated, links maintained, installed with one notification.
- Commands the core generates never leave a view unplaced; imported unplaced views are accepted.
- `workspace.rebalance` only rearranges: the placement→view map before and after is identical.
- Deterministic ids: pass `ids: sequentialIds()` for goldens and replay.
