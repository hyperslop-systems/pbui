# Adding editing support to a PBUI application

> **The three PBUI playbooks, and which one you want:**
>
> | If you are… | Read |
> |---|---|
> | starting a new application on PBUI | [building-a-new-hyperslop-systems-app-on-pbui.md](./building-a-new-hyperslop-systems-app-on-pbui.md) |
> | moving an existing frontend to the component convention | [refactoring-a-pbui-app-into-atoms-molecules-and-organisms.md](./refactoring-a-pbui-app-into-atoms-molecules-and-organisms.md) |
> | making an application edit durable workbench state | [adding-editing-support-to-a-pbui-application.md](./adding-editing-support-to-a-pbui-application.md) |

This playbook explains how to make a Datalab application edit durable workbench
state. It covers the frontend path implemented in PBUI and the server contract
implemented by Datadrop. The intended reader can follow the procedure without
having worked on the workbench protocol.

The central rule is simple: an application does not save itself. It dispatches
ordinary Redux actions that change a document or logical view. Remote
persistence observes the resulting normalized state, encodes one complete
workbench snapshot, and conditionally replaces the server revision.

## 1. Decide what the application edits

Before writing a component, identify the durable entity that owns the value.
PBUI separates four identities:

| Entity | Owns | Typical edit |
|---|---|---|
| Application descriptor | Registration and rendering policy | Change code, not runtime state |
| `AppView` | Application selection, title, named document bindings | Rename a view or rebind its primary document |
| Document | Domain content shared by one or more views | Change a mark, encoding, transform, or source |
| Placement node | Geometry inside one workspace | Split, resize, replace, or close a tile |

Most editing applications should change a document. A title editor changes an
`AppView`. A layout command changes a placement. Do not put document content in
the component, descriptor, or placement node merely because the control that
edits it is rendered there.

```text
placement --viewId--> AppView --documents.primary--> Document
```

A linked duplicate creates another placement with the same `viewId`. An
independent duplicate creates another `AppView`, initially with the same
document bindings. Therefore:

- Changing an `AppView` title is visible in all linked placements.
- Changing a document is visible in every view bound to that document.
- Changing component-local React state is visible only in that mounted
  component and is not persisted.

## 2. Choose the integration case

There are three common cases.

### Case A: edit an existing graphic document

Use this path when the application edits the existing
`datadrop.gog.document` model. Chart, Encoding, Pipeline, and Source are
examples. Add a reducer action and dispatch it from the application. The
protocol, remote codec, and Datadrop schema do not need to change if the edited
field is already part of `GraphicDocument`.

### Case B: add another application over existing documents

Use this path when the application gives a new presentation or editing surface
for `GraphicDocument`. Register an `AppDescriptor`, read the document through a
named binding, dispatch existing or new world actions, and add the application
ID to Datadrop's allowed catalog.

### Case C: introduce a new durable document format

Use this path only when the state cannot be represented honestly as a
`GraphicDocument`. The protobuf already carries document bodies as
`google.protobuf.Struct`, so a new format does not automatically require a
protobuf change. It does require:

- a TypeScript domain type and Redux storage policy;
- encode/decode support in `remote/codec.ts`;
- a server-side validator selected by format and schema version;
- application-binding validation;
- shared valid and invalid fixtures;
- round-trip, mutation, HTTP, and browser tests.

Do not make the server accept an unvalidated opaque object. Server acceptance
means every connected frontend must be able to traverse the document safely.

## 3. Read the current implementation boundaries

Start with these files:

- `packages/datalab-ui/src/appkit/registry.ts` defines `AppDescriptor` and
  `AppProps`.
- `packages/workbench-core` owns workspaces, views, and placement trees as the
  protocol's `WorkbenchDocument`; `packages/datalab-ui/src/store/runtime.ts`
  builds one core per Datalab workbench and
  `packages/datalab-ui/src/store/controller.ts` puts Datalab's policy in
  front of its commands.
- `packages/datalab-ui/src/store/navigation.ts` owns stages and per-workspace
  metadata above the workbench document.
- `packages/datalab-ui/src/store/world.ts` owns analytical documents; the
  workbench holds identity stubs for them
  (`packages/datalab-ui/src/store/graphicSource.ts`).
- `packages/datalab-ui/src/remote/projection.ts` decides what crosses the
  server boundary (the work stage, with full documents) and how a server
  document is adopted; `packages/datalab-ui/src/remote/codec.ts` is the JSON
  and graphic-envelope codec.
- `packages/datalab-ui/src/appkit/useRemoteWorkbench.ts` loads, fingerprints,
  saves, streams, and reports conflicts.
- `proto/hyperslop/pbui/workbench/v1/workbench.proto` defines the shared
  workbench and mutation contract.
- `pkg/workbench/validate.go` and `pkg/workbench/mutation.go` define the shared
  Go invariants.

The Datadrop consumer supplies these server-owned boundaries:

- `pkg/workbenchapp/catalog.go` allows application IDs and binding policies.
- `pkg/workbenchapp/graphic_validation.go` validates graphic-document bodies.
- `pkg/server/handlers_workbenches.go` enforces authorization, revisions, and
  idempotency.
- `pkg/store/workbenches.go` commits snapshots and audit records.

## 4. Implement a document edit

Suppose an application needs to edit a graphic document's mark.

### 4.1 Add or reuse a reducer action

Reducers accept identifiers explicitly. Do not depend on the active document
when the application already has a bound document ID; two visible tiles can
edit different documents.

```ts
setGeom(
  state,
  action: PayloadAction<{ docId: string | null; geom: Mark }>,
) {
  const document = target(state, action.payload.docId);
  if (!document) return;
  rootView(document).mark = action.payload.geom;
}
```

The reducer must preserve these properties:

- The resulting state is JSON-serializable.
- The update is deterministic from its action and previous state.
- The action does not store DOM objects, promises, callbacks, class instances,
  `bigint`, or cyclic values.
- A missing target has a defined behavior.
- Shared references do not bypass Immer or mutate objects outside Redux.

Add reducer tests before connecting the UI. Test the changed value, unchanged
sibling documents, and any invalid or empty target behavior.

### 4.2 Resolve the bound document from the view

An application receives the placement and logical view:

```ts
export interface AppProps {
  placementId: NodeId;
  view: AppView;
}
```

Read the named binding instead of the global active document:

```tsx
function MarkEditorApp({ view }: AppProps) {
  const dispatch = useDispatch();
  const docId = view.documents.primary ?? null;
  const document = useSelector((state: RootState) =>
    docId ? state.world.docs[docId] : undefined,
  );

  if (!document) return <EmptyDocumentState />;

  return (
    <MarkEditor
      value={rootView(document).mark}
      onChange={(geom) =>
        dispatch(worldActions.setGeom({ docId, geom }))
      }
    />
  );
}
```

Do not copy `document` into component state as the authoritative value. Local
state is appropriate for an incomplete text draft or an open menu, but commit
the completed edit through Redux.

### 4.3 Register the application

Register the descriptor once at module load:

```ts
registerApp({
  id: "mark-editor",
  title: "mark editor",
  tone: "var(--pbui-tone-chart)",
  docBound: true,
  duplicable: true,
  singleton: false,
  Component: MarkEditorApp,
});
```

The fields have durable behavior:

- `docBound: true` exposes document selection and requires a valid binding.
- `duplicable: true` permits an independent view duplicate.
- `singleton: true` permits only one logical view, although that view may still
  have several linked placements.

Add the module to the application import set so registration executes. Extend
the registry tests; do not rely on opening the launcher manually to prove the
descriptor is reachable.

### 4.4 Allow the application on the server

Datadrop rejects unknown application IDs. Add the new ID and its binding policy
to `pkg/workbenchapp/catalog.go`, then test:

- a valid view with the required `primary` binding;
- a missing required binding;
- an unsupported binding name if the application has a closed binding set;
- a reference to an absent document;
- singleton violations if applicable.

This server change is required even if the frontend renders correctly. Without
it, a local workbench works while every remote save fails validation.

## 5. Understand how a Redux edit becomes a remote commit

`useRemoteWorkbench` does not intercept application actions. It derives the
remotely managed subgraph after every Redux change:

```text
layout workspaces in the work stage
    -> collect referenced view IDs
    -> collect named document bindings
    -> collect referenced documents
    -> encode WorkbenchDocument
```

The controller compares a canonical fingerprint with the last applied server
snapshot. A changed fingerprint becomes dirty. After a 500 ms debounce, it
sends a complete conditional replacement:

```text
PUT /v1/workbenches/{id}
If-Match: "workbench-{id}-{revision}"
Idempotency-Key: {stable UUID for this fingerprint}

{ complete WorkbenchDocument }
```

The same request ID is retained while retrying the same fingerprint. A
successful response advances the revision and clears dirty state. A
`workbench_revision_conflict` preserves the local state and stops automatic
saves until the user chooses reload or retry.

This gives an application editing support without adding HTTP calls to the
application component. If an editor calls the workbench endpoint directly, it
creates two writers in one browser and bypasses the established dirty,
idempotency, and conflict policy.

## 6. Add a new document format

The current Datalab codec accepts only canonical graphic documents:

```text
format = "datadrop.gog.document"
schema_version = 1
```

To add another format, introduce an explicit format dispatch on both sides.

```ts
function decodeDocument(payload: DocumentPayload): DomainDocument {
  switch (`${payload.format}@${payload.schemaVersion}`) {
    case "datadrop.gog.document@1":
      return decodeGraphicDocument(payload);
    case "example.notebook@1":
      return decodeNotebookDocument(payload);
    default:
      throw new Error("unsupported document format");
  }
}
```

The Go boundary must make the same decision:

```text
validateDocument(payload):
    require map key == payload.id
    switch (payload.format, payload.schema_version):
        case ("datadrop.gog.document", 1):
            validateGraphicDocument(payload.body)
        case ("example.notebook", 1):
            validateNotebookDocument(payload.body)
        default:
            reject unsupported format
```

Do not add a compatibility adapter unless migration is an explicit
requirement. Introduce a new schema version when the durable meaning changes.

## 7. Verify the application at every boundary

Use this minimum test matrix.

### Reducer and component

- The UI dispatches the intended action with the bound document ID.
- The reducer changes only the selected document.
- A linked placement observes the same view change.
- A second view bound to the same document observes the document change.
- Empty and invalid bindings render a deliberate state instead of throwing.

### Codec and shared model

- TypeScript encode/decode round-trips the new state.
- Go proto JSON round-trips the same fixture.
- Map keys agree with embedded IDs.
- Every view binding resolves.
- Every placement resolves a view.
- Resource limits and recursive depth remain enforced.

### Server

- The application ID is accepted only with valid bindings.
- The document format receives semantic validation.
- A stale `If-Match` returns `workbench_revision_conflict`.
- Reusing an idempotency key with a different request body is rejected.
- A failed validation or audit write commits no partial snapshot.

### Browser

Run the API and frontend in tmux, then use two browser tabs:

1. Open the same workbench in both tabs.
2. Edit the new application in tab A.
3. Confirm the API revision increments once.
4. Confirm clean tab B refetches and renders the edit.
5. Make tab B locally dirty.
6. Commit another edit from tab A or `hyperslop ui mutate`.
7. Confirm tab B retains its local value and reports a conflict.
8. Reload tab B and confirm it converges on the server snapshot.

Capture screenshots for the normal and conflict states. Inspect browser console
errors and API logs; a visually correct tile is not sufficient evidence.

## 8. Expose agent edits when the operation is reusable

Browser snapshot replacement works for every Redux edit. Add a protobuf
mutation only when agents or other clients need a stable atomic operation.

For a new mutation:

1. Add one `Mutation` `oneof` case in
   `proto/hyperslop/pbui/workbench/v1/workbench.proto`.
2. Run `buf lint` and `buf generate`.
3. Implement the case in `pkg/workbench/mutation.go`.
4. Validate the complete output graph after applying the batch.
5. Add the case to the every-mutation-kind test.
6. Add CLI examples only after the JSON shape is generated and tested.

One batch may create a document, create a view, and split a placement
atomically. Prefer that over a sequence that leaves a visible intermediate
state.

## 9. Integration checklist

- [ ] The durable value has one clear owner: view, document, or placement.
- [ ] The application reads a named view binding rather than ambient active
      state when a binding is available.
- [ ] Completed edits dispatch serializable Redux actions.
- [ ] Component-local state is used only for transient interaction state.
- [ ] The application descriptor and import registration are tested.
- [ ] Datadrop's application catalog accepts the new ID and binding policy.
- [ ] A new document format has matching TypeScript and Go validators.
- [ ] Cross-language fixtures exercise valid and invalid data.
- [ ] Remote save, exact revision advancement, SSE refetch, and conflict
      preservation pass in two browsers.
- [ ] A reusable agent operation is represented as a generated typed mutation,
      not a handwritten JSON discriminator.

## 10. Failure patterns

The following implementations are incomplete:

- An editor updates React state but never dispatches Redux state.
- A component edits `activeDocId` although its view is bound to another
  document.
- The frontend registers an application that Datadrop's catalog rejects.
- The server checks only the document's outer shape and accepts a graph the
  frontend cannot traverse.
- An editor calls the workbench HTTP endpoint in parallel with
  `useRemoteWorkbench`.
- A stream event overwrites dirty local state.
- A revision enters Redux as `bigint`, violating Redux serialization.
- A linked duplicate is implemented by cloning a view.
- A placement close deletes the referenced view globally.

When these boundaries are preserved, adding an editor is ordinary frontend
work: select durable state, render controls, and dispatch deterministic
actions. The existing remote controller supplies persistence, optimistic
concurrency, live invalidation, and conflict reporting.
