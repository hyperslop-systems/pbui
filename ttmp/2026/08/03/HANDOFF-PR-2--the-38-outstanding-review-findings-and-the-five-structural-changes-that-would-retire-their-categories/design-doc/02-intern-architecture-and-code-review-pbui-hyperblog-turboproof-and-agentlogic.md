---
Title: 'Intern architecture and code review: PBUI, hyperblog, turboproof, and agentlogic'
Ticket: HANDOFF-PR-2
Status: active
Topics:
    - pbui
    - frontend
    - backend
    - review
    - onboarding
    - refactoring
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://src/components/organisms/FileBrowser/FileBrowser.tsx
      Note: Composite tree selection, focus, and keyboard ownership reviewed in section 3.4.
    - Path: repo://src/presentation/createPbui.tsx
      Note: Shared provider, presentation renderer, menu, accept, and keyboard composition reviewed in sections 3 and 9.
    - Path: repo://src/presentation/types.ts
      Note: Shared presentation and verb contracts reviewed in section 3.
    - Path: repo://src/styles-wiring.test.ts
      Note: Stylesheet wiring false-negative finding covered in the 38-item matrix.
    - Path: ws://agentlogic/ui/src/components/organisms/ChangesPanel/ChangesPanel.tsx
      Note: Downstream nested-interactive keyboard ownership reference reviewed in section 7.
    - Path: ws://hyperblog/pkg/glossary/index.go
      Note: Corpus construction and reader projection boundary reviewed in sections 6.2-6.4.
    - Path: ws://hyperblog/pkg/glossary/markdown.go
      Note: Filesystem error classification and date validation reviewed in section 6.4.
    - Path: ws://hyperblog/pkg/glossary/search.go
      Note: Paid-body search oracle and reader-safe index boundary reviewed in section 6.2.
    - Path: ws://hyperblog/pkg/server/handlers_corpus.go
      Note: Wire-shape normalization reviewed in section 6.3.
    - Path: ws://hyperblog/pkg/server/handlers_workbenches.go
      Note: Owner-private cache policy reviewed in section 6.5.
    - Path: ws://hyperblog/ui/src/App.tsx
      Note: Root verb routing and React updater timing defect reviewed in section 6.6.
    - Path: ws://hyperblog/ui/src/appkit/registry.ts
      Note: Tile registration and advertised binding consumption reviewed in section 6.7.
    - Path: ws://hyperblog/ui/src/components/pages/Workbench/Workbench.tsx
      Note: Placement rendering boundary for deriving TileScope reviewed in section 6.7.
    - Path: ws://hyperblog/ui/src/model/paneTree.ts
      Note: Pure pane-tree mutation boundary reviewed in section 6.6.
    - Path: ws://hyperblog/ui/src/pbui/verbs.ts
      Note: Layout, accept, and domain verb partition reviewed in section 6.6.
    - Path: ws://hyperblog/ui/src/store/world.tsx
      Note: Ambient cursor ownership and per-placement scope reviewed in section 6.7.
    - Path: ws://turboproof/pkg/filestore/store.go
      Note: Root containment, fingerprints, rename, overlapping roots, directories, and symlink semantics reviewed in section 5.
    - Path: ws://turboproof/pkg/server/handlers_files.go
      Note: Disk-mutating HTTP request validation and payload presence semantics reviewed in section 5.5.
    - Path: ws://turboproof/ui/src/apps/SaveControl.tsx
      Note: Deleted-file save and missing-resource flow reviewed in section 5.6.
    - Path: ws://turboproof/ui/src/hooks/fileTree.ts
      Note: File-tree refresh preservation reviewed in section 5.6.
    - Path: ws://turboproof/ui/src/store/renameBinding.ts
      Note: Open-document URI collision invariant reviewed in section 5.4.
    - Path: ws://turboproof/ui/src/store/sync.tsx
      Note: Missing-versus-failed classification and retry delivery reviewed in section 5.6.
ExternalSources:
    - https://github.com/hyperslop-systems/turboproof/pull/3
    - https://github.com/hyperslop-systems/hyperblog/pull/1
    - https://github.com/hyperslop-systems/agentlogic/pull/3
    - https://github.com/hyperslop-systems/pbui/pull/9
Summary: Evidence-backed architecture and code review of the four PBUI-family repositories behind the 38 open findings, written as an intern onboarding guide. It validates the findings, explains the runtime and API boundaries, corrects three proposed refactoring boundaries, and gives a security-first implementation and verification plan.
LastUpdated: 2026-08-03T20:15:00-04:00
WhatFor: Teach a new contributor enough of the four-repository system to fix the outstanding review findings without repeating their categories.
WhenToUse: Read sections 1-6 before editing. Use sections 7-12 as the implementation and review plan.
---























# Intern architecture and code review

## 1. Executive summary

This review covers the four repositories and pull-request branches named by
`HANDOFF-PR-2`:

| repository | branch | reviewed commit | role |
|---|---|---|---|
| `pbui` | `task/pbui-api-hardening` | `8133149` | shared React presentation system and Go workbench protocol |
| `turboproof` | `task/lint-private-module` | `e9de793` | Lean 4 proof workbench and rooted file editor |
| `hyperblog` | `task/transcript-agent` | `e622489` | glossary-driven subscription reader and saved workbench API |
| `agentlogic` | `task/agentlogic-ui-1` | `d6c0e91` | coding-agent transcript analysis workbench and downstream pattern reference |

The live GitHub review state was re-derived from the API on 2026-08-03. It is
still exactly **38 open findings: 7 P1 and 31 P2**. The distribution is 12 in
turboproof, 18 in hyperblog, 8 in pbui, and 0 in agentlogic. This agrees with
the ticket source file and is important because the previous handoff
undercounted by eleven.

All four repositories pass their current Go suites. All four frontend suites
pass, and all four TypeScript checks pass. The exact frontend totals are:

- pbui: 12 test files, 94 tests;
- turboproof: 17 test files, 131 tests;
- hyperblog: 4 test files, 25 tests;
- agentlogic: 14 passed and 1 skipped test file, 121 passed and 1 skipped test.

That is not a contradiction. The findings are concentrated at **composition
boundaries, error classifications, cross-request races, browser security
boundaries, and alternative input states**. Unit suites are strongest inside
modules and weakest where one valid module hands an incomplete value to
another.

The original HANDOFF-PR-2 diagnosis is substantially correct: most defects are
not missing ideas. They are second paths that bypass an idea already present.
This review confirms the four highest-priority defects:

1. Hyperblog search examines paid prose before redacting the snippet. The hit
   existence, count, paragraph id, and score form a substring oracle.
2. Turboproof accepts simple cross-origin JSON-shaped POSTs on disk-mutating
   create and rename endpoints because it checks neither media type nor
   origin.
3. Hyperblog's owner-private workbench GETs have no private/no-store response
   policy or credential `Vary` header.
4. Turboproof can rename a file onto a URI already held by a stale open
   document, violating the one-document-per-URI invariant.

The five proposed structural changes are also directionally right, but three
need sharper boundaries:

- A reader-scoped corpus must be a **materialized safe projection**, not merely
  a wrapper retaining public access to the unredacted `Corpus`.
- Hyperblog verbs naturally form **three** groups, not two: pure layout
  mutations, accept-mediated commands, and domain commands.
- The shared keyboard abstraction should be a small **event ownership
  predicate**, not one hook pretending the file tree, a presentation, and an
  agentlogic row have the same keyboard state machine.

Two additional concrete defects were found while validating the proposed
refactors:

- Hyperblog advertises the optional `term` binding in the Go catalog and in
  TypeScript, but no tile reads `bindings.term`. `TermApp` and the reader's term
  highlight always read the ambient cursor.
- Hyperblog's `performLayout` learns whether a verb was handled by mutating a
  local boolean from inside a React state updater. React does not promise that
  updater runs before the next line checks the boolean. Classification must be
  pure and happen before scheduling state.

The result is a security-first plan that fixes the seven P1s, then changes the
types and ownership boundaries so the same categories stop being writable.

## 2. How to think about the system

### 2.1 Four repositories, one family

PBUI is both a React design system and an interaction protocol. The three
products are Go binaries that embed React single-page applications. Their
shared shape is:

```text
                       browser
                          |
                 /ui + /static assets
                          |
             one product Go HTTP server
              /v1 API          /ws or SSE
                 |                  |
          product domain       live workbench state
                 |
        shared PBUI workbench protocol

React side:
  product objects -> descriptors -> serializable verbs -> one interpreter
                               |
                               +-> PBUI Presentation/ObjectMenu/accept flow
```

Each product commits its built frontend under `pkg/webui/dist` and embeds it
with `go:embed`. Therefore three things are different artifacts:

1. TypeScript source.
2. The built asset committed under `pkg/webui/dist`.
3. The currently running Go binary, which embedded whichever asset existed at
   its own build time.

After a UI change, `pnpm` tests can pass while a running binary still serves
the previous bundle. End-to-end validation must rebuild both layers.

### 2.2 The vocabulary

Before reading code, distinguish these terms:

- **Presentation:** a rendered typed value such as a term, file, post, tile,
  or workspace.
- **Descriptor:** pure product code that labels a value, describes it, and
  returns actions for it.
- **Verb:** serializable data describing an intention. A verb is never a
  closure.
- **Interpreter:** the one boundary that turns verbs into effects.
- **Tile application:** a registered React component such as `reader`,
  `files`, or `term`.
- **View:** the logical application instance in a saved workbench document.
- **Placement:** one leaf in one workspace tree displaying a view. A singleton
  view may appear in more than one placement.
- **Binding:** a document address a placement uses instead of an ambient
  cursor.
- **Workbench:** a document containing views, placements, workspaces, and a
  binary layout tree.
- **Plane:** a state/side-effect domain. Turboproof has layout, file, and Lean
  proof planes; hyperblog has layout and reader-domain planes.

The distinction between view and placement is load-bearing. Turboproof's
first implementation treated a singleton files view as proof that only one
`FilesApp` component could mount. Linked placements invalidate that reasoning.
Commands that act on component-local UI state must address a placement.

## 3. PBUI: typed objects, menus, accept, and workbench structure

### 3.1 The presentation protocol

The generic API is built in
`pbui/src/presentation/createPbui.tsx:25-178`. A product supplies:

```ts
createPbui<Values, Environment, Verb>({
  registry,             // descriptors for the product's value vocabulary
  defaultEnvironment,   // read-only ambient data descriptors may consult
  conversions,          // optional accept-protocol conversions
  renderMenuHeader,
})
```

`Values` is a mapping from presentation type to its value shape. From that
mapping, `PresentationReference` in `pbui/src/presentation/types.ts:6-14`
constructs a discriminated union:

```ts
interface ProductValues {
  term: { id: string };
  post: { id: string };
}

type ProductReference =
  | { type: "term"; value: { id: string } }
  | { type: "post"; value: { id: string } };
```

The runtime flow is:

```text
right click <Presentation reference={term}>
        |
        v
Provider.openMenu(reference, x, y)
        |
        v
ObjectMenu asks registry.actionsFor(reference, environment)
        |
        v
user clicks an action carrying a plain Verb value
        |
        v
Provider.perform(verb)
        |
        v
product interpreter mutates layout/domain/server state
```

The accept protocol reverses the direction of selection:

```text
verb: "swap with another tile"
        |
        v
await pbui.accept({ types: "tile", prompt: "click another tile" })
        |
        v
every Presentation asks isAcceptable(reference)
        |
        v
click acceptable object -> settle Promise with typed reference
```

Descriptors remain pure because they emit the intent and never receive the
store or dispatcher.

### 3.2 Why `onPerform` must be required

`PbuiProviderProps` declares `onPerform?` at
`createPbui.tsx:40-49`, and `perform` calls `onPerform?.(verb)` at
`createPbui.tsx:261-264`. The Provider still opens and closes menus without a
router, so a missing interpreter looks like a working menu whose actions do
nothing. Hyperblog shipped exactly that composition.

The minimal API correction is:

```ts
interface PbuiProviderProps<Values, Environment, Verb> {
  children: ReactNode;
  environment?: Environment;
  onPerform(verb: Verb): void | Promise<void>; // required
  onAccept?: (result: PresentationReference<Values> | null) => void;
}
```

Stories that intentionally do not care about actions must write
`onPerform={() => {}}`. The explicit no-op documents the test boundary. A
product root cannot omit the prop by accident.

Hyperblog's current installation ref still weakens this guarantee. `App.tsx`
initializes the ref with a no-op at line 65, then `Workbench.tsx:162-166`
installs the real function in an effect. There is a render-to-effect window in
which the required callback exists but is inert. The durable composition is to
make the component that owns layout state also render the PBUI Provider:

```tsx
function WorkbenchRuntime() {
  const [workspaces, setWorkspaces] = useState(...);
  const perform = useCallback((verb: Verb) => {
    if (isLayoutVerb(verb)) return performLayout(verb);
    return performDomain(verb);
  }, [performDomain]);

  return (
    <PbuiProvider environment={environment} onPerform={perform}>
      <WorkbenchShell />
      <ObjectMenu />
      <AcceptBanner />
    </PbuiProvider>
  );
}
```

This removes the install ref rather than making a required callback point at a
placeholder.

### 3.3 Composite widget keyboard ownership

PBUI's `Presentation` normally owns a tab stop and `role="button"`. With
`inComposite`, it yields both to the parent tree item at
`createPbui.tsx:436-446`. That fixes invalid nested semantics but also makes
the presentation's `onKeyDown` unreachable: the DOM focus remains on the tree,
and the tree has no command to open the active descendant's object menu. This
is the open `createPbui.tsx:442` finding.

The parent composite must own the keyboard gesture and call an explicit menu
operation for its active row. Do not reintroduce a tab stop inside every row.
A suitable library seam is:

```ts
interface CompositePresentationHandle {
  openMenu(anchor?: DOMRect): void;
  acceptOrActivate(): void;
}

// The file tree owns Shift+F10 / ContextMenu and asks the active row's handle.
```

The smaller event invariant is:

```ts
function eventBelongsToContainer(
  event: Pick<React.KeyboardEvent, "target" | "currentTarget">
): boolean {
  return event.target === event.currentTarget;
}
```

This is stronger than `isEditableTarget`. A nested button, link, select, or
future custom control owns its own key event. Agentlogic already applies this
correctly at `ChangesPanel.tsx:95-118`. The file tree currently checks only
editable targets at `FileBrowser.tsx:316-334`, and Presentation has no guard at
`createPbui.tsx:385-425`.

The shared abstraction should be the predicate plus focused tests. The three
containers have different command sets; forcing them through one hook would
hide meaningful differences.

### 3.4 FileBrowser's state model

`FileBrowser` is intentionally presentational. The product supplies roots,
load states, expansion, selection, and callbacks. The organism never fetches.
Important contracts are:

```ts
type RootState =
  | { status: "loading" }
  | { status: "failed"; reason: string }
  | { status: "ready"; tree: FileNode };

interface FileNode {
  id: string;                // unique across every displayed root
  name: string;
  kind: "file" | "directory";
  children?: FileNode[];     // undefined means not loaded; [] means loaded empty
}
```

The open findings expose four incomplete parts of the composite model:

- Focus initializes from `selectedId`; when it is null, there is no active
  descendant and the first ArrowDown skips row zero
  (`FileBrowser.tsx:245-247`, `335-345`).
- `rowDomId` collapses punctuation and is not injective
  (`FileBrowser.tsx:300-315`). Use an encoding, not replacement. A simple
  base64url encoding of UTF-8 or `encodeURIComponent` with a stable prefix is
  reversible and collision-free.
- Activating the show-more sentinel removes the focused DOM node but leaves its
  key as active state (`FileBrowser.tsx:288-292`). Focus should move to the
  first newly revealed row or the parent before the sentinel disappears.
- The sentinel omits the focused row class (`FileBrowser.tsx:417-434`).

`RootState` is exported by `FileBrowser.tsx` but not by either barrel
(`FileBrowser/index.ts:3`, `organisms/index.ts:4`). This is a public API defect:
consumers can receive the contract in a prop but cannot name it from the public
import path.

## 4. The shared workbench protocol

All three products have a frontend registry and a Go catalog. The registry
knows which React component mounts. The catalog tells PBUI's Go validator
which application ids, singleton constraints, and bindings are legal.

```text
frontend registry                         Go catalog
ui/src/appkit/registry.ts                 pkg/workbenchapp/catalog.go
        |                                        |
        +---- both checked against fixture ------+
                     registry.fixture.json
```

This deliberate duplication avoids requiring a JavaScript toolchain during a
Go build. Parity tests turn drift into a test failure. All three products have
both halves; the earlier handoff claim that two were absent was stale and has
already been corrected.

A workbench is a binary tree:

```text
split(row, ratio=.55)
├── leaf placement=t1 view=reader bindings={post:p1}
└── split(col, ratio=.50)
    ├── leaf placement=t2 view=term bindings={term:load-factor}
    └── leaf placement=t3 view=launcher bindings={}
```

Application singleton means one logical view, not one mounted component. A
single view can be linked into two placements. Any state owned by a mounted
component must therefore be addressed by placement id, or lifted to the view.

## 5. Turboproof architecture and review

### 5.1 What turboproof is

Turboproof is a Lean 4 IDE-shaped workbench. The React side contains a file
tree, CodeMirror source editor, goals, diagnostics, timeline, and proof-state
tiles. A Lean process or mock server sits behind `/ws`. The rooted file API is
separate from the workbench protocol:

```text
FileBrowser tile ---- /v1/files/* ---- pkg/filestore ---- project filesystem
      |
      +---- open/rebind document ---- workbench document ---- Lean session

Source editor ---- overlay text ---- saved workbench document
SaveControl ----- fingerprinted PUT -----------------------> disk
```

That separation is sound. Arrangement mutations must not touch disk, and file
API operations must not silently rearrange the workbench.

### 5.2 Rooted path API

Clients never send absolute paths. Every operation uses `(root, relativePath)`.
`filestore.New` canonicalizes each configured root at startup.
`Store.resolve` rejects unknown roots, absolute paths, NULs, traversal
segments, and symlink targets outside the root (`store.go:169-279`).

The current root invariant is incomplete. Two named roots can resolve to the
same directory, or one can contain the other. Then one physical file has two
public URIs and can acquire two Lean sessions and two optimistic-concurrency
histories. `New` should compare canonical roots pairwise and reject equality
or ancestry before storing them.

Pseudocode:

```go
for each candidateRoot:
    canonical = EvalSymlinks + Abs + Clean
    for each acceptedRoot:
        relA = filepath.Rel(accepted.Dir, canonical)
        relB = filepath.Rel(canonical, accepted.Dir)
        if relA == "." or relA is descendant or relB is descendant:
            return configuration error naming both roots
    accept candidateRoot
```

This is a startup error, not a per-request canonicalization rule. Persisted
document identity remains one root-relative URI.

### 5.3 Save is a compare-and-swap

`Store.Write` implements optimistic concurrency with a content fingerprint:

```text
GET file -> {text, fingerprint F}
user edits overlay
PUT file If-Match: F
server locks canonical path
server computes current fingerprint
if current != F -> 409 conflict
else temp-write + chmod + rename -> new fingerprint
```

The previous round correctly added reference-counted per-path mutexes and
temp-file replacement. The remaining edge cases are type and path resolution
errors:

- If the file became a directory, `os.Stat` reports existence and
  `fingerprintAt` tries to stream it (`store.go:469-488`). Return
  `ErrIsDirectory` before the fingerprint branch.
- An in-root file symlink is read and fingerprinted through its target, but the
  final `os.Rename(tmp, logicalPath)` replaces the symlink itself
  (`store.go:520`). Content operations must consistently use the resolved
  physical target.
- Directory listings classify a directory symlink as a file because
  `DirEntry.Info` describes the entry rather than following the target
  (`store.go:321-330`). Classification must use a followed stat after the
  confinement check.

The coherent symlink policy is:

- read, fingerprint, write, and list-through-directory **dereference** an
  in-root link;
- rename and delete of the link's own entry act on the namespace entry;
- all dereferenced targets must remain inside the configured root;
- content-operation locks key on the canonical physical target.

This preserves useful in-root links without turning a save into link
replacement. It must be documented and tested because content and namespace
operations intentionally differ.

### 5.4 Rename crosses disk and document state

The server rename and client rebinding are separate operations. After the disk
request succeeds, `renameAndRebind` re-reads the current workbench and rewrites
every open descendant URI (`renameBinding.ts:51-88`). This correctly avoids
writing stale text captured before the await.

The missing invariant is destination ownership. Before dispatching any
rebinding mutations, build the complete move set and compare every destination
URI with documents not in that move set:

```ts
const moves = renameMoves(current, roots, root, from, to);
const movingIds = new Set(moves.map(m => m.documentId));

for (const move of moves) {
  const occupant = documentIdByUri(current, move.toUri);
  if (occupant && !movingIds.has(occupant)) {
    return conflict("destination URI is already open", occupant);
  }
}

dispatch one workbench mutation batch for all document puts;
dispatch one file-sync rebind batch;
```

Do not dispatch move-by-move before validation. Otherwise the workbench can be
half rebound when the collision is discovered. A server rename already
succeeded at that point, so refusal needs a visible recovery action: close or
merge the stale destination buffer and retry rebinding. Silently merging text
would choose which user's work wins.

### 5.5 File API HTTP boundary

The file handlers decode JSON directly (`handlers_files.go:77-147`). Create
and rename use POST, so a hostile web page can issue a simple cross-origin
request with a permissive content type. Loopback binding is not a browser
security boundary.

Add one guard for every JSON mutation route:

```go
func requireJSONMutation(w http.ResponseWriter, r *http.Request) bool {
    mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
    if err != nil || mediaType != "application/json" {
        writeProblem(..., http.StatusUnsupportedMediaType, ...)
        return false
    }
    if origin := r.Header.Get("Origin"); origin != "" && !sameOrigin(r, origin) {
        writeProblem(..., http.StatusForbidden, ...)
        return false
    }
    return true // no Origin remains valid for non-browser clients
}
```

Apply it to file create, rename, and content writes, and to any future POST
that mutates local state. Requiring JSON alone blocks the simple-request path;
origin validation keeps the policy explicit and protects future media types.

For PUT content, decode `Text *string` and reject nil. Both `{}` and
`{"text":null}` produce nil and must not truncate the file. Run a second JSON
decode and require `io.EOF` so trailing values are rejected consistently.

### 5.6 File tree and synchronization

`useFileTree` owns transient tree state. Its single global `error` makes one
root failure replace the entire browser (`FilesApp.tsx:301-315`). The PBUI
`RootState` contract already models the correct answer. Change the product
hook to:

```ts
interface FileTreeState {
  roots: FileRoot[] | null;
  trees: Record<string, RootState | undefined>;
  // operationError is for create/rename/delete, not root loading
  operationError: string | null;
}
```

Each root request updates only its own state. The browser can show one failed
root beside two usable roots.

`loadDirectory` currently replaces refreshed children with fresh shallow
nodes (`fileTree.ts:42-50`). `reloadRoots` already contains the correct merge
at lines 70-85. Extract that merge into one pure function and use it at both
sites so expanded descendants survive refresh.

The workbench sync layer collapses transport failure and absence:

```ts
const fresh = await getWorkbench(id).catch(() => null);
if (fresh) rebase(); else detached();
```

But `getWorkbench` already distinguishes a 404 by returning null and throws on
other failures. Preserve that distinction with an explicit result:

```ts
type FetchResult<T> =
  | { status: "ok"; value: T }
  | { status: "missing" }
  | { status: "failed"; error: Error };
```

Only `missing` detaches. `failed` transitions offline and retries. The same
rule fixes SaveControl: a PUT returning 404 means the file entered the existing
missing flow, not a generic string error.

Finally, do not call `markSeeded` while `syncPhase === "offline"`. A seed is
delivered only after the server acknowledges the mutation. Local “offered” and
remote “accepted” are different states.

## 6. Hyperblog architecture and review

### 6.1 What hyperblog is

Hyperblog is a glossary-centered reading workbench. Its three domain rules are:

1. The cursor is a term, not a page.
2. Backlinks are derived from prose, never stored.
3. The whole corpus loads into memory at startup.

The corpus is authored as Markdown with YAML front matter. `pkg/glossary`
parses it, derives indexes and diagnostics, and serves a per-reader projection.
SQLite stores reader identity, sessions, notes, marks, membership, and saved
workbenches. The React world holds the already-loaded corpus and reader state.

```text
corpus markdown
    |
readDir -> parseDocument -> Build
    |                         |
    |                         +-> mentions, backlinks, edges, topics, series
    v
immutable in-memory Corpus
    |
reader tier projection
    v
GET /v1/corpus -> IndexedCorpus -> tiles
```

### 6.2 The paywall and the search oracle

`redactPost` copies a post and sets `Body = nil` for an insufficient tier
(`handlers_corpus.go:149-163`). The corpus response keeps public metadata,
mentions, and term relations. This is intentional product policy: a reader
can see that paid writing exists and which public glossary concepts it uses.

`Corpus.Search`, however, scans every body before deciding only whether to
withhold the snippet (`search.go:120-153`). For a locked post the response
still reveals:

- whether an arbitrary substring exists;
- how many paragraphs contain it;
- the first matching paragraph id;
- a score partly derived from the number of matches;
- whether the post appears in the result set at all.

Repeated adaptive queries can reconstruct withheld prose. Hiding the snippet
does not protect the text used to decide the response.

The structural fix is a materialized reader-safe projection:

```go
type ReaderPost struct {
    Post
    LockedBy string `json:"lockedBy,omitempty"`
}

type ReaderCorpus struct {
    Terms       []Term
    Posts       []ReaderPost          // locked Body is already nil
    PostByID    map[string]ReaderPost // built from the same safe values
    Series      []Series
    Mentions    map[string][]Mention
    UsesIn      map[string][]string
    DefRefs     map[string][]string
    DefBack     map[string][]string
    Edges       []Edge
    Topics      map[string][]string
    Diagnostics []Diagnostic
}

func (c *Corpus) ForTier(tier string) ReaderCorpus
func (c ReaderCorpus) Search(query string) Results // no tier argument
```

The safe type must not export or embed the original `*Corpus`. Every endpoint
that carries corpus-derived data begins with `safe := s.corpus.ForTier(p.Tier)`.
Search loops only over `safe.Posts`, so locked bodies are absent before query
evaluation.

Expected locked-post search behavior:

- title and dek may still match and return the post;
- `Hits` is zero and `ParagraphID` empty unless readable body matched;
- no body-derived score contribution exists;
- public term definitions remain searchable because terms are free.

This preserves product discovery while eliminating the oracle.

### 6.3 Nil versus empty collections

`Corpus.Series` can remain nil when the optional `series/` directory is absent.
JSON serializes nil as `null`, while the frontend assumes an array and calls
`.map`. API response construction must normalize every collection contract:

```go
func nonNilSlice[T any](in []T) []T {
    if in == nil { return []T{} }
    return in
}
```

The stronger place is the `ReaderCorpus` constructor: a safe wire projection
should also be a shape-normalized projection. Do not rely on every handler to
remember which source slices may be nil.

### 6.4 Corpus loading and validation

`readDir` treats every `fs.ReadDir` error as “optional directory absent” at
`markdown.go:127-131`. Suppress only `fs.ErrNotExist`. Permission errors,
invalid roots, and I/O faults must stop startup with the directory in the
wrapped error. Otherwise the server starts successfully with an empty product.

Post dates are validated only by string length at `markdown.go:291-299`.
Because lexical sorting and UI date arithmetic depend on canonical ISO dates,
parse and round-trip:

```go
parsed, err := time.Parse("2006-01-02", date)
if err != nil || parsed.Format("2006-01-02") != date {
    return error
}
```

The HTTP JSON decoder correctly refuses unknown fields but accepts a valid
object followed by another JSON value (`problem.go:152-165`). Decode once,
then decode a sentinel and require `io.EOF`.

### 6.5 Private workbench HTTP responses

Workbench list and get are owner-scoped in the store, but response headers do
not express that fact (`handlers_workbenches.go:88-114`, `344-355`). A shared
cache can reuse a successful GET across Cookie or Authorization identities.

Create one helper and call it before every owner-private response, including
successes and ideally relevant conditional responses:

```go
func privateReaderResponse(w http.ResponseWriter) {
    w.Header().Set("Cache-Control", "private, no-store")
    w.Header().Add("Vary", "Cookie")
    w.Header().Add("Vary", "Authorization")
}
```

Do not overwrite an existing `Vary`. Use a helper that merges tokens. Tests
must cover both list and get with both credential modes.

### 6.6 The verb language

Hyperblog currently has one 24-member `Verb` union. `applyLayoutVerb` accepts
the entire union and returns null for domain verbs (`paneTree.ts:104-166`).
`App.tsx` handles domain verbs and logs a default (`App.tsx:90-165`). This
makes both switches intentionally partial, so TypeScript cannot prove either
is exhaustive.

Two missing behaviors are the result:

- `swapTilesByAccept` is emitted by the tile descriptor and handled nowhere.
- `linkTermByAccept` asks for a term but only changes the ambient cursor; it
  ignores `fromTermId` and does not create the advertised side-by-side view.

The union has three semantic groups:

```ts
type LayoutMutationVerb =
  | SplitTile | CloseTile | ReplaceView | SwapTiles | DockTile
  | SelectWorkspace | OpenLauncher | BindTile;

type AcceptVerb =
  | { kind: "swapTilesByAccept"; placementId: string }
  | { kind: "linkTermByAccept"; fromTermId: string };

type DomainVerb =
  | FocusTerm | OpenPost | OpenSeries | ...;

type Verb = LayoutMutationVerb | AcceptVerb | DomainVerb;
```

Each layer is exhaustive:

```ts
function reduceLayout(tree: Node, verb: LayoutMutationVerb): Node {
  switch (verb.kind) { ...; default: return assertNever(verb); }
}

async function performAccept(verb: AcceptVerb): Promise<void> {
  switch (verb.kind) { ...; default: return assertNever(verb); }
}

async function performDomain(verb: DomainVerb): Promise<void> {
  switch (verb.kind) { ...; default: return assertNever(verb); }
}
```

A type guard classifies before scheduling React state. This also fixes the new
`performLayout` issue: handled-ness no longer depends on a side effect inside
a state updater (`Workbench.tsx:137-159`).

For `linkTermByAccept`, the accepted term should create or select a term tile
beside the placement that presented `fromTermId`. The current verb lacks a
placement address, so change its data shape rather than guessing from the
ambient cursor:

```ts
{ kind: "linkTermByAccept"; fromPlacementId: string; fromTermId: string }
```

The descriptor value must carry the placement id, just as file verbs do in
turboproof.

### 6.7 Per-placement bindings, not a ban on world state

The original R4 proposes making `useWorld()` unreachable from all eleven tile
call sites. Inspection shows that most uses are legitimate shared services:
the immutable corpus, reading state, membership, trace, and domain command
functions. Passing all of those through every tile prop would create a large
manual dependency surface without enforcing the dangerous invariant.

The dangerous values are ambient addresses for data a placement can bind.
The concrete rule is:

```text
effective post = bindings.post ?? world.cursor.postId
effective term = bindings.term ?? world.cursor.termId
```

Today `ReaderApp` applies the post half. No component reads `bindings.term`.
The Go catalog advertises term bindings for `term`, `map`, and `reader`
(`pkg/workbenchapp/catalog.go:36-102`), but `TermApp.tsx:24-28` and the reader
highlight use `cursor.termId` directly.

Introduce a single derived tile scope at the mount boundary:

```ts
interface TileScope {
  placementId: string;
  postId: string;
  termId: string;
  pinned: { post: boolean; term: boolean };
}

function scopeFor(node: Leaf, world: World): TileScope {
  return {
    placementId: node.id,
    postId: node.bindings.post ?? world.cursor.postId,
    termId: node.bindings.term ?? world.cursor.termId,
    pinned: {
      post: node.bindings.post !== undefined,
      term: node.bindings.term !== undefined,
    },
  };
}
```

Pass `scope` in `TileProps`. Tiles may still use `useWorld` for corpus and
commands, but they must use `scope.postId` and `scope.termId` for addressable
content. A source-level architecture test can forbid `world.cursor.postId` and
`world.cursor.termId` under `ui/src/apps/` except in `scopeFor`.

### 6.8 Remaining hyperblog defects

The other findings are local but should follow shared contracts:

- `NoteEditor` closes with `note.body`, even though blur just saved `draft`
  (`NoteEditor.tsx:40-67`). Close once with `draft ?? note.body` and `open=false`;
  do not send a blur save followed by a close save.
- `LauncherApp` filters only itself and re-offers singleton applications already
  present (`ShellApps.tsx:199-229`). Derive availability from the same registry
  and current tree used by `companionFor`.
- Token scope parsing is intentionally tolerant for stored credentials but
  wrong for user input (`handlers_me.go:257-273`). Validate every requested
  string against the vocabulary before converting to a set.
- Concurrent first sign-ins probe before upsert and both append an opening
  invoice (`handlers_auth.go:132-164`). Have the transactional upsert return
  `created bool`.
- `auth_error` is emitted in a redirect and never consumed by the SPA
  (`handlers_auth.go:236-240`). Parse it once at boot, map known codes to user
  text, remove it from browser history, and preserve unknown-code fallback.
- OIDC discovery stops after ten attempts even though the log promises future
  recovery (`cli/serve.go:170-184`). Retry with bounded backoff until context
  cancellation; use the existing errgroup.
- `reader --disable` fills omitted fields with create defaults and upserts them
  (`cli/reader.go:148-168`). Separate create and patch commands/paths or use
  presence-aware fields. Do not add a compatibility adapter.
- Inline Markdown code spans render as literal backticks in `Prose`. Extend the
  text tokenizer to return `text | code | ref` nodes, then render code with a
  semantic `<code>` while keeping refs as presentations.
- `termDescriptor.describe` queries marks with a space while `markKey` uses a
  NUL separator (`term.ts:18-25`). Call `markKey`; never duplicate key format.
- The free/member entitlement table claims browser-local notes and bookmarks,
  but no local persistence exists (`types.go:138-147`). This remains a product
  decision and must be asked before code changes.

## 7. Agentlogic as a downstream reference

Agentlogic has no open review findings, but it demonstrates two useful
patterns.

First, its core data pipeline normalizes every supported transcript into one
`Session`. The UI cannot tell whether a browser demo conversion or the server
produced it:

```text
raw agent transcript -> detection -> go-minitrace Session -> compile/project -> tiles
```

Second, `ChangesPanel` correctly handles a container with a nested control.
The row owns Enter/Space only when the row itself is the target
(`ChangesPanel.tsx:95-118`). This is better evidence for PBUI's event-ownership
primitive than an abstract hook proposal.

Agentlogic also nests a bound `WorldProvider` inside a tile when a transcript
binding overrides the ambient session. That pattern supports hyperblog's
placement-scope design: derive the effective address once at the tile boundary
instead of letting deep components choose between global and local identity.

## 8. Review matrix for all 38 live findings

This matrix is a compact index. The preceding sections explain the mechanisms
and the original ticket's design doc retains the full review text.

### 8.1 Turboproof: 12

| priority | file | finding | disposition |
|---|---|---|---|
| P1 | `pkg/filestore/store.go:199` | overlapping canonical roots alias one file | reject equal/ancestor roots in `New` |
| P2 | `pkg/filestore/store.go:328` | directory symlink listed as file | followed stat under explicit symlink policy |
| P2 | `pkg/filestore/store.go:480` | directory streamed by fingerprint | `info.IsDir` before compare branch |
| P2 | `pkg/filestore/store.go:521` | save replaces final symlink | write canonical content target |
| P2 | `pkg/server/handlers_files.go:82` | absent/null text truncates | presence-aware decode and EOF check |
| P1 | `pkg/server/handlers_files.go:117` | cross-origin simple POST mutates disk | media-type + origin mutation guard |
| P2 | `ui/src/apps/FilesApp.tsx:305` | one root error blanks all roots | per-root `RootState.failed` |
| P1 | `ui/src/apps/SaveControl.tsx:70` | deleted file 404 bypasses missing flow | typed HTTP error/result |
| P2 | `ui/src/hooks/fileTree.ts:49` | refresh discards loaded descendants | reuse pure subtree merge |
| P1 | `ui/src/store/renameBinding.ts:80` | occupied destination creates duplicate URI | preflight complete move set atomically |
| P2 | `ui/src/store/sync.tsx:149` | offline seed recorded as delivered | mark only after acknowledgement |
| P2 | `ui/src/store/sync.tsx:224` | transport failure treated as 404 | explicit ok/missing/failed result |

### 8.2 Hyperblog: 18

| priority | file | finding | disposition |
|---|---|---|---|
| P2 | `pkg/cli/reader.go:164` | disable rewrites omitted profile fields | separate update semantics |
| P2 | `pkg/cli/serve.go:179` | OIDC recovery stops permanently | context-lived retry loop |
| P2 | `pkg/glossary/markdown.go:130` | every ReadDir error means absent | suppress only not-exist |
| P2 | `pkg/glossary/markdown.go:299` | date checked by length | parse and canonical round-trip |
| P1 | `pkg/glossary/search.go:127` | paid-body substring oracle | search materialized reader corpus |
| P2 | `pkg/glossary/types.go:146` | entitlements claim unimplemented locality | product decision; ask first |
| P2 | `pkg/server/handlers_auth.go:136` | first-sign-in probe races | upsert returns created atomically |
| P2 | `pkg/server/handlers_auth.go:239` | auth error has no UI consumer | boot-time URL error adapter |
| P2 | `pkg/server/handlers_corpus.go:108` | nil series becomes null | normalize in reader projection |
| P2 | `pkg/server/handlers_me.go:260` | unknown requested scope silently dropped | validate request vocabulary |
| P1 | `pkg/server/handlers_workbenches.go:351` | private GETs cacheable across readers | private/no-store + merged Vary |
| P2 | `pkg/server/problem.go:155` | trailing JSON accepted | second decode must return EOF |
| P2 | `ui/src/App.tsx:155` | term accept ignores origin and layout intent | addressed accept verb and exhaustive interpreter |
| P2 | `ui/src/apps/ShellApps.tsx:225` | launcher re-offers existing singleton | availability from tree + registry |
| P1 | `ui/src/components/molecules/NoteEditor/NoteEditor.tsx:66` | close overwrites draft | one save with current draft and closed state |
| P2 | `ui/src/components/molecules/Prose/Prose.tsx:42` | inline code backticks literal | tokenizer node for code spans |
| P2 | `ui/src/pbui/descriptors/rest.ts:250` | swap-by-accept unhandled | `AcceptVerb` exhaustive switch |
| P2 | `ui/src/pbui/descriptors/term.ts:24` | mark key format duplicated incorrectly | call `markKey` |

### 8.3 PBUI: 8

| priority | file | finding | disposition |
|---|---|---|---|
| P2 | `FileBrowser.tsx:247` | no initial active descendant | initialize/synchronize to first actionable row |
| P2 | `FileBrowser.tsx:291` | sentinel focus points to removed node | move focus as cap lifts |
| P2 | `FileBrowser.tsx:314` | row DOM id collisions | reversible encoding |
| P2 | `FileBrowser.tsx:422` | focused sentinel has no ring | apply focused class/data consistently |
| P2 | `FileBrowser/index.ts:3` | `RootState` missing from barrel | export from both public barrels |
| P2 | `createPbui.tsx:387` | nested input triggers presentation activation | container event ownership guard |
| P2 | `createPbui.tsx:442` | composite row has no keyboard menu route | composite owns active-row menu command |
| P2 | `styles-wiring.test.ts:121` | guard misses plain `html {` | parse all root selectors or broaden tested regex |

The stylesheet guard should recognize `html`, `:root`, `:where(html)`, and
`:where(:root)`. Because CSS selectors can be comma-separated, a small selector
scan is safer than continuing to grow a regex around one spelling. At minimum,
mutation-test each of the four conventional forms.

## 9. Revised structural design

### Decision: require a real verb router at composition time

- **Context:** Optional `onPerform` allowed a completely inert product to look
  interactive. Hyperblog's install ref still begins as a no-op.
- **Options considered:** retain optional callback; require callback but keep
  the ref; move Provider under the layout owner.
- **Decision:** require `onPerform` and make the component owning composed
  layout/domain state render the Provider with the final function.
- **Rationale:** TypeScript catches absence; ownership removes the transient
  placeholder.
- **Consequences:** Stories provide explicit no-ops. Hyperblog composition is
  reorganized, not adapted.
- **Status:** proposed.

### Decision: materialize a reader-safe corpus

- **Context:** A tier parameter on `Search` is a check every read path must
  remember. A wrapper retaining the raw corpus can still bypass redaction.
- **Options considered:** add the missing check in Search; wrapper view over
  raw Corpus; materialized safe projection.
- **Decision:** `Corpus.ForTier` creates a normalized `ReaderCorpus`; all
  reader-facing methods operate on it.
- **Rationale:** Locked prose is absent from the value search receives. The
  wire shape and entitlement boundary become one constructor.
- **Consequences:** Per-request allocation remains. At this corpus size that is
  deliberately cheaper and safer than a tier cache.
- **Status:** proposed.

### Decision: partition verbs into layout, accept, and domain languages

- **Context:** Two partial switches with logging defaults cannot be exhaustive;
  accept commands contain asynchronous selection before their eventual effect.
- **Options considered:** one union plus defaults; two unions; three semantic
  groups.
- **Decision:** use `LayoutMutationVerb | AcceptVerb | DomainVerb`, with an
  exhaustive interpreter for each.
- **Rationale:** Pure reducers remain pure; accept orchestration is named; no
  verb can be added without every required interpreter compiling.
- **Consequences:** Some descriptor values gain placement addresses. Tests
  assert type guards and exhaustive behavior.
- **Status:** proposed.

### Decision: derive addressable tile scope once

- **Context:** Tiles legitimately need shared world services, but binding-aware
  addresses must beat ambient cursor fields. `bindings.term` is currently dead.
- **Options considered:** ban `useWorld`; pass entire World through props;
  derive a narrow `TileScope` at the placement boundary.
- **Decision:** pass `TileScope` and forbid direct cursor address reads in tile
  modules.
- **Rationale:** Enforces the actual invariant with a small surface and retains
  context for genuinely shared data.
- **Consequences:** Term, map, and reader consume scope. The registry's existing
  term-binding contract becomes real.
- **Status:** proposed.

### Decision: share event ownership, not keyboard state machines

- **Context:** FileBrowser, Presentation, and ChangesPanel all mishandled
  descendant keys, but their actual commands differ.
- **Options considered:** copy guards; one `useContainerKeys` hook; one pure
  event-ownership predicate.
- **Decision:** export/test a predicate and let each owner retain its own
  keyboard switch.
- **Rationale:** It retires the repeated rule without erasing domain-specific
  behavior.
- **Consequences:** Existing handlers get one early return. Composite menu
  routing remains an explicit FileBrowser/PBUI design.
- **Status:** proposed.

### Decision: represent remote absence separately from failure

- **Context:** `catch(() => null)` and a global error string convert transport
  failures into plausible domain values.
- **Options considered:** special error messages; exception-type checks at each
  caller; discriminated fetch result and per-resource state.
- **Decision:** APIs classify ok/missing/failed; UI state preserves that union.
- **Rationale:** Only a real 404 may trigger destructive detach/missing flows.
- **Consequences:** Call sites switch exhaustively. Retrying policy becomes
  explicit.
- **Status:** proposed.

## 10. Implementation order

### Phase 0: pin the evidence

1. Re-run the open-finding enumerator and commit a dated source snapshot if the
   count changes.
2. Add focused failing tests for each P1 before implementation.
3. For each new test, temporarily remove the fix and prove the test fails. The
   previous round found multiple tests that passed under the defect.

### Phase 1: security P1s

1. Hyperblog: implement `ReaderCorpus` and move corpus + search response
   construction onto it.
2. Turboproof: add the JSON mutation boundary to create/rename/write.
3. Hyperblog: add private workbench headers to list/get and tests for Cookie
   and Authorization variation.

### Phase 2: invariant P1s

1. Turboproof: reject overlapping roots at startup.
2. Turboproof: preflight rename destination ownership before rebinding.
3. Turboproof: route save 404 to missing state through typed HTTP results.
4. Hyperblog: make NoteEditor close once with the current draft.

### Phase 3: PBUI structural API

1. Fix the root-font guard and export `RootState`.
2. Make `onPerform` required and compile every consumer.
3. Add `eventBelongsToContainer`; adopt it in Presentation, FileBrowser, and
   agentlogic where appropriate.
4. Complete FileBrowser focus, id encoding, and sentinel behavior as one
   accessibility commit.
5. Add the composite active-row menu seam and keyboard tests.

### Phase 4: hyperblog interpreter and placement scope

1. Partition the verb types and delete logging defaults from exhaustive
   interpreters.
2. Move Provider composition under the real composed interpreter; remove the
   install ref.
3. Add addressed semantics for both accept verbs.
4. Introduce `TileScope`; make term, map, and reader consume term/post bindings.
5. Filter launcher singleton choices from the current tree.
6. Add one real-root composition test: open a menu, choose an action, and assert
   state changes.

### Phase 5: explicit errors and remaining P2s

1. Turboproof: per-root state, refresh merge, sync classifications, seed
   acknowledgement.
2. Turboproof: directory and symlink content semantics.
3. Hyperblog: corpus I/O/date/JSON validation and non-nil collections.
4. Hyperblog: scope vocabulary, atomic first sign-in, auth error UI, OIDC retry,
   reader update semantics, inline code, and mark key.
5. Ask for the entitlement product decision; implement only after an answer.

No backwards-compatibility adapter is proposed. These branches are already a
coordinated family migration, and silent dual semantics would recreate the
categories under review.

## 11. Testing and validation

### 11.1 PBUI

- Type-level fixture: `Provider` without `onPerform` fails compilation.
- Composition test: real Provider + Presentation + ObjectMenu dispatches a
  verb.
- Descendant tests: input, textarea, select, contenteditable, button, and link
  keys do not activate the container.
- FileBrowser tests: initial active descendant, collision pair
  `project:a/b`/`project:a:b`, sentinel activation focus, focused sentinel
  class, composite menu keyboard route.
- CSS mutation cases: all four root selector spellings.

### 11.2 Turboproof

- Pairwise equal and nested roots rejected after symlink resolution.
- Create/rename reject `text/plain` cross-origin requests and accept
  same-origin JSON and non-browser JSON.
- `{}`, `{"text":null}`, and two concatenated JSON objects do not write.
- File replaced by directory maps to the typed 409, not 500.
- File and directory symlinks remain confined and follow the documented
  content/namespace policy.
- Rename collision dispatches no partial rebind.
- One failed root leaves other roots usable.
- Refresh preserves expanded grandchildren.
- Network failure after 409/422 stays retryable; only 404 detaches.
- Offline seed is retried and marked only after server acknowledgement.

Run:

```bash
cd turboproof
GOWORK=off go test ./... -count=1
GOWORK=off go test ./pkg/filestore -race -count=20
cd ui && pnpm run test && pnpm run typecheck
```

### 11.3 Hyperblog

- Locked unique body word never affects search results.
- Locked title/dek still returns discoverable metadata.
- Member search still returns body hits and snippets.
- No series serializes as `[]`.
- Unreadable corpus directory fails startup; absent optional series succeeds.
- Invalid calendar dates and trailing JSON fail.
- Workbench list/get set merged `Vary` and private/no-store.
- Exhaustive verb tests cover every union member.
- Two term-bound placements render different terms despite one ambient cursor.
- Note close sends one mutation containing the current draft and `open=false`.
- Concurrent first sign-in appends one opening invoice.

Run:

```bash
cd hyperblog
GOWORK=off go test ./... -count=1 -race
cd ui && pnpm run test && pnpm run typecheck
```

### 11.4 Agentlogic

Agentlogic is a regression consumer for PBUI changes. Its current focused test
for the ChangesPanel child key behavior should remain. Rebuild it against the
new PBUI output, then run:

```bash
cd agentlogic
GOWORK=off go test ./... -count=1
cd ui && pnpm run test && pnpm run typecheck
```

### 11.5 Embedded bundle smoke tests

For each product, after its UI suite:

```bash
make ui
GOWORK=off go run ./cmd/<product> serve <scratch flags>
```

Use tmux for the server and `capture-pane` for logs. Use a scratch database and
fixture directory. The minimum product composition smoke is one real root, one
real menu action, and one observable state change.

## 12. Risks, alternatives, and open questions

### Risks

- `ReaderCorpus` duplicates slices and maps per request. The corpus is small and
  this is an intentional security trade. Measure before caching; a tier cache
  introduces shared mutable entitlement state.
- Symlink behavior is subtle. Tests must distinguish link entry operations from
  target content operations and must cover alias locks.
- Hyperblog's current layout is local React state even though the server already
  validates saved workbenches. Placement bindings do not survive reload until
  persistence is wired.
- React source-level architecture tests can become brittle. Restrict any cursor
  read scan to the precise ambient address expressions, not all `useWorld` use.
- Reorganizing the Provider changes many component tests. That is acceptable;
  adding an adapter around the old install ref is not.

### Alternatives rejected

- **Fix only the 38 lines:** leaves the bypass paths and guarantees the same
  categories return.
- **Tier checks in every handler:** the search defect is proof that repeated
  checks do not scale.
- **Hide locked posts from search entirely:** harms discovery and changes the
  product policy; safe title/dek matching is sufficient.
- **Ban all tile access to World:** large prop plumbing that does not target the
  actual address invariant.
- **One universal keyboard hook:** the three containers do not implement the
  same command language.
- **Cache errors as empty/null:** produces plausible but false state and loses
  recovery information.
- **Compatibility shims for old PBUI props:** prolong two semantic spellings and
  make migration completeness unprovable.

### Open questions requiring a product or operator answer

1. Are free-tier notes and bookmarks meant to be browser-local, or should the
   entitlement table be changed to match server-only persistence?
2. Should hyperblog's `term` binding pin only definition/map identity, or also
   the highlighted term inside a reader? The Go catalog comment says the latter;
   confirm before making it visible.
3. For an occupied turboproof rename destination, should the UI offer “close
   stale destination and continue,” or require the user to resolve it manually?
   Automatic text merging is not recommended.
4. Is following in-root symlinks an intentional supported feature? This review
   proposes a coherent follow-content policy because the current code already
   permits it. If the answer is no, reject final symlinks consistently instead
   of mixing behaviors.

## 13. File and API reference

### PBUI

- `src/presentation/types.ts` — reference and descriptor types.
- `src/presentation/createPbui.tsx` — Provider, Presentation, ObjectMenu,
  accept protocol, and current optional router.
- `src/components/organisms/FileBrowser/FileBrowser.tsx` — tree state machine,
  accessibility, row presentation seam.
- `src/chrome/shortcutRouting.ts` — existing pure keyboard routing patterns.
- `pkg/workbench` — validation and mutation semantics for saved workbenches.
- `pkg/workbenchapi` — canonical protobuf JSON transport.

### Turboproof

- `pkg/filestore/store.go` — root confinement, path locks, CRUD, fingerprints.
- `pkg/server/handlers_files.go` — rooted file HTTP API.
- `ui/src/api/client.ts` — workbench and file transport boundary.
- `ui/src/hooks/fileTree.ts` — transient tree state and lazy loading.
- `ui/src/store/renameBinding.ts` — disk rename to document rebinding.
- `ui/src/store/sync.tsx` — bootstrap, outbox, rebase, retry, SSE.
- `ui/src/apps/SaveControl.tsx` — fingerprint and conflict UI.
- `ui/src/state/filesTile.ts` — placement-addressed component-local verbs.
- `pkg/workbenchapp/catalog.go` — application and source-binding rules.

### Hyperblog

- `pkg/glossary/types.go` — domain values, tiers, entitlements.
- `pkg/glossary/index.go` — immutable derived corpus.
- `pkg/glossary/markdown.go` — authoring parser and validation.
- `pkg/glossary/search.go` — current search oracle.
- `pkg/server/handlers_corpus.go` — redaction and corpus/search wire APIs.
- `pkg/server/handlers_workbenches.go` — owner-scoped saved workbench API.
- `pkg/server/problem.go` — strict JSON helper.
- `ui/src/store/world.tsx` — ambient corpus, reader, cursor, and commands.
- `ui/src/appkit/registry.ts` — tile registration and binding props.
- `ui/src/model/paneTree.ts` — pure layout arithmetic.
- `ui/src/pbui/verbs.ts` — current flat verb language.
- `ui/src/App.tsx` and `ui/src/components/pages/Workbench/Workbench.tsx` — two
  partial interpreters and Provider installation.

### Agentlogic

- `ui/src/components/organisms/ChangesPanel/ChangesPanel.tsx` — correct nested
  control event ownership.
- `ui/src/components/pages/Workbench/Workbench.tsx` — ambient and bound worlds.
- `pkg/workbenchapp/catalog.go` — optional transcript bindings.

### Related ticket documents

- `design-doc/01-fix-the-categories-not-the-instances-a-design-for-the-38-open-findings.md`
  — original categorization and complete finding triage.
- `sources/01-open-findings-2026-08-03.txt` — API-derived review inventory.
- `../HANDOFF-PR-1--*/guide/01-intern-handoff-*.md` — family architecture and
  previous review round.
- `../PBUI-HARDEN-1--*/design-doc/01-six-defects-one-shape-*.md` — PBUI API
  hardening rationale.

## 14. Final review verdict

The branches are coherent, well documented, and unusually strong inside their
pure model and store boundaries. The failures cluster exactly where their
documentation says the system is compositional: the browser/server catalog,
raw/safe corpus, global/per-placement cursor, presentation/host event, and
disk/document identity boundaries.

The work should proceed. The P1s are real and reproducible by code inspection;
three have security consequences and four threaten identity or user work. The
best path is not 38 unrelated patches. It is security fixes first, followed by
types that separate safe from raw data, addressable from ambient state, missing
from failed fetches, and layout from domain commands. After that, the remaining
P2s are small because their categories no longer need to be remembered at each
call site.
