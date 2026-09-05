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

## Bindings and launch policy

A manifest declares the legal `view.documents` keys as binding rules — `bindings: { product: { required: true, formats: ["shop.product"], role: "primary" } }` — and a launch policy: `"unbound"` (the launcher may create a view with no bindings), `"requires-bindings"` (the application is a view OF something and is opened from it), `"hidden"`. A `documentSlot` port declares a binding `{ required: false, role: "primary" }` unless a rule says otherwise, and the launch policy defaults to `requires-bindings` when any binding is primary. An application whose inputs are named by what it binds (the sandbox's `script`) sets `additionalBindings: { formats? }`. The core validates, in this order and with the same codes as `pkg/workbench`: `unknown_binding`, `unknown_document`, `invalid_binding_format`, then `required_binding`; the shared fixtures under `contracts/workbench/v1` are asserted by both validators.

## Documents for what tiles bind

The core validates every `view.documents` binding against the document store, so products bind things that live elsewhere — a conversation in a registry, a program in a library, a product in a catalogue — through a stub document that stands for them:

```ts
import { connectDocumentSource } from "@hyperslop-systems/workbench-core";

const disconnect = connectDocumentSource(core, {
  id: "chat.conversations",
  format: "chat.conversation",
  list: () => registry.all().map((c) => ({ id: c.id })),
  subscribe: (listener) => registry.subscribe(listener),
});
```

One stub per listed resource, of that format, put when missing and deleted when the source no longer lists it — unless a view still binds it, in which case the stub stays until the view goes. A stub records its writer in the reserved body field `$source`: a listed id that names a document of another format is a collision (`onCollision`, never overwritten), and a stub of the same format owned by another source is left alone. `update: "replace-body"` makes the body follow the source. Reconciliation is tried synchronously and, when signalled from inside a publication, retried once in a microtask, after it. `readWorkbenchSnapshot(key, { apps, sources })` hydrates a stored layout with the sources' stubs BEFORE validating it against the catalog, so a layout stored before a source existed is repaired rather than discarded.

## Publication order and observer failures

A transaction has three stages (design doc 04 §6.1): **prepare** (plan or apply the raw batch, validate, stage the link runtime's next value — all pure), **install** (set the core state and the link state, without notifying anyone), **publish** (the receipt hook `onCommit`, then the link runtime's subscribers, then the core's subscribers). Past install, nothing makes the operation look uncommitted: every observer is attempted exactly once, a throwing observer is recorded, and the collection is reported after all attempts through `onObserverError({ stage, revision, error })`. A mutation door called from an observer — `execute`, `apply`, `replaceDocument`, `restore`, `reset` — is refused with `reentrant_execution`; an integration that reacts to a publication schedules its own transaction for after it (a document source retries in a microtask).

## Owned state

Every document that enters the core — `initial`, a replacement, a restore, a server adoption — is cloned, so a caller's later edits to what it passed in reach nothing. What the core exposes through `getState()` is deep-frozen (the document, the session, and the index's maps) unless `ownership: "trust"` is set or `NODE_ENV` is `production`; a caller that mutates it fails at the assignment. `core.snapshot()` returns a clone to write on. Preview never consumes ids: plans read them through a lookahead pool and only a committed execution consumes what its plan drew, so `execute` after `preview` mints the ids the preview reported. A transition that reproduces the current document with an unchanged session is `changed: false` and installs nothing.

## Revision and operation identity

The core deliberately has three non-interchangeable identity types:

- `LocalRevision` is the installed generation in `core.getState().revision`. It is a non-negative safe integer and advances once per successful local installation.
- `ServerRevision` is the server's opaque conditional-write token. Construct it only while decoding a transport response with `serverRevision(value)`; never parse or increment it.
- `OperationId` identifies idempotent transport work. `newOperationId()` mints one UUID per enqueued local batch.

The sync adapter carries those types end to end:

```ts
import { serverRevision, type OperationId, type ServerRevision } from "@hyperslop-systems/workbench-core";
import { createWorkbenchSync, type SyncClient } from "@hyperslop-systems/workbench-core/sync";

const client: SyncClient = {
  async get() {
    const response = await fetch("/workbench");
    if (response.status === 404) return null;
    const payload = await response.json();
    return { document: decodeDocument(payload.document), revision: serverRevision(payload.revision) };
  },
  async create(document) {
    const payload = await postDocument(document);
    return { document: decodeDocument(payload.document), revision: serverRevision(payload.revision) };
  },
  async mutate(revision: ServerRevision, mutations, operationId: OperationId) {
    const response = await fetch("/workbench/mutate", {
      method: "POST",
      headers: { "If-Match": revision, "Idempotency-Key": operationId },
      body: encodeMutations(mutations),
    });
    const payload = await response.json();
    return { document: decodeDocument(payload.document), revision: serverRevision(payload.revision) };
  },
};

const sync = createWorkbenchSync({ client });
```

The outbox preserves whole mutation batches. Each batch UUID survives transport retry. A concrete send receives a collision-resistant `OperationId` derived with framed SHA-256 from the base server revision, ordered batch UUIDs, and canonical mutation JSON. Therefore retrying exactly the same send is idempotent, while rebasing, isolating an invalid batch, reordering batches, changing content, or enqueueing the same content as a new operation produces a different identity. `operationIds` is injectable only for deterministic tests and replay harnesses.

There is no broad `Revision` alias and no legacy request-ID sync API. Datalab's separate remote whole-document replacement controller and other correlation IDs belong to different domains and are intentionally unchanged.

## Package boundary

The core's only PBUI import is `@hyperslop-systems/pbui/link-kernel`, the pure semantic entry (ports, terms, link planning and evaluation, identity, badges, the type graph), and PBUI declares React as an OPTIONAL peer, so a consumer that installs workbench-core alone gets no React. Three checks keep that true: the source fence (`fence.test.ts`: no `react`, no DOM, no PBUI root entry), the declaration test (`packageGraph.test.ts`: runtime, peer and dev dependencies by kind), and `pnpm boundary`, which packs pbui, workbench-protocol and workbench-core, installs the core alone into an empty project with scripts disabled, asserts React is absent, imports the core and plans a command, and scans the built output's imports.

## Invariants

- Planning never touches anything observable; `preview` leaves the document, the session, and the link runtime exactly as they were.
- Every durable change — a command, a raw batch, a replacement — goes through one gateway: applied atomically, validated, links maintained, installed with one notification.
- Commands the core generates never leave a view unplaced; imported unplaced views are accepted.
- `workspace.rebalance` only rearranges: the placement→view map before and after is identical.
- Deterministic ids: pass `ids: sequentialIds()` for goldens and replay.
