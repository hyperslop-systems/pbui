---
Title: 'Intern handoff: the three open PRs, their architecture, and every outstanding finding'
Ticket: HANDOFF-PR-1
Status: active
Topics:
    - pbui
    - frontend
    - backend
    - review
    - onboarding
DocType: guide
Intent: long-term
Owners: []
RelatedFiles:
    - Path: ws://turboproof/pkg/filestore/store.go
      Note: Write/Fingerprint — the TOCTOU race (T1) and the unbounded read (T6)
    - Path: ws://turboproof/ui/src/state/filesTile.ts
      Note: a module-level `handler` singleton that two placements overwrite (T2)
    - Path: ws://turboproof/ui/src/apps/FilesApp.tsx
      Note: rename does not rebind descendants (T3) and writes a stale ref (T4)
    - Path: ws://turboproof/ui/src/store/slice.ts
      Note: `rejected` drops the whole refused prefix, including valid edits (T5)
    - Path: ws://hyperblog/ui/src/apps/ReaderApp.tsx
      Note: discards placementId, so two readers share one cursor (H1)
    - Path: ws://hyperblog/pkg/store/store.go
      Note: the database file inherits the umask; it holds emails and ID tokens (H3)
    - Path: ws://hyperblog/pkg/server/handlers_reading.go
      Note: PUT read-mark skips the tier check the rest of the paywall enforces (H4)
    - Path: ws://agentlogic/ui/src/components/pages/SourcePicker/SourcePicker.tsx
      Note: the archive request is built from the CURRENT project, not the row's (A1)
    - Path: repo://src/presentation/createPbui.tsx
      Note: the presentation protocol every product's descriptors bind to
    - Path: repo://docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md
      Note: read §3, §4 and §6 before touching any product's UI
ExternalSources:
    - https://github.com/hyperslop-systems/agentlogic/pull/3
    - https://github.com/hyperslop-systems/turboproof/pull/3
    - https://github.com/hyperslop-systems/hyperblog/pull/1
Summary: 'Everything needed to pick up the three open product PRs: what the family architecture is and why, how a PBUI product is layered, then all 21 review findings and the CI failures with the file, the symbol, the mechanism, and how to verify each fix.'
LastUpdated: 2026-08-03
WhatFor: Hand the three open PRs to somebody who has not seen this codebase.
WhenToUse: Read §1-§4 once, then work §5-§7 in the order given in §8.
---

# Intern handoff: three open PRs

Welcome. Three pull requests are open and reviewed, with **21 review findings
and 7 failing CI jobs** between them. None is blocked on a decision; all of
them are yours.

This document is in three parts. §1–§4 are the architecture — read them once,
in order, before touching anything, because most of the findings are only
comprehensible against them. §5–§7 are the findings, one per issue, each with
the file, the symbol, what actually goes wrong, and how to know you have fixed
it. §8 is how to work here.

**A fourth PR, `pbui#9`, is green and ready.** It is the library all three
products depend on, and its ticket (`PBUI-HARDEN-1`, in `pbui/ttmp/2026/08/03/`)
is worth reading, because several findings below are the product-side shadow of
what it fixed.

---

## 1 · What these three things are

Three separate products that share one design system and one interaction model.

| | what it is | the interesting part |
|---|---|---|
| **agentlogic** | a workbench for reading coding-agent transcripts | takes a forty-minute agent session and makes it navigable |
| **turboproof** | a Lean 4 proof workbench | an LSP session, a file tree and a proof state, all live |
| **hyperblog** | a subscription blog | the cursor is a glossary TERM, not a page |

Each is **one Go binary** serving an HTTP API and an embedded React workbench.
There is no separate frontend deployment: `ui/` builds into `pkg/webui/dist`,
which is committed and embedded with `go:embed`.

> **Internalise this now:** after `make ui`, a running server still serves the
> PREVIOUS bundle until the Go binary is rebuilt — and a build not committed
> alongside its source means the repository ships a bundle that does not match
> the code beside it. Both have bitten people here.

### 1.1 · PBUI, the shared library

`pbui` is a domain-neutral React library for **presenting typed objects and
exposing descriptor-defined actions**. The idea comes from CLIM and the
Symbolics Genera environment: anything on screen is a *presentation* of a typed
object, and right-clicking it offers the verbs that apply to that type.

A product supplies four things; pbui supplies the rest:

```
PresentationValues   the object vocabulary            { post: Post, term: Term }
Environment          what a descriptor may read       { cursorTerm, readable }
Verb                 every action, as serialisable DATA
descriptors/         one file per type: label, describe, actions
```

The critical rule, worth stating because breaking it is subtle: **verbs are
data, never closures.** `actions(value, environment)` is pure, so a test can
assert the exact verb with no store, provider or DOM. A descriptor that closes
over a dispatch function looks fine and destroys that property.

Read `pbui/src/presentation/createPbui.tsx`. It is ~550 lines and it is the
whole protocol: `Provider`, `Presentation`, `ObjectMenu`, `MouseDocLine`,
`AcceptBanner`, and the accept flow — a command asking for an object, which the
user satisfies by clicking one.

### 1.2 · The workbench shell

All three render a tiling workbench: a tree of panes, each holding one *tile*
(an application). Tiles are registered browser-side and validated server-side.

```
ui/src/appkit/registry.ts      what the browser can mount
pkg/workbenchapp/catalog.go    what the server accepts in a saved layout
```

Those two lists must agree. hyperblog now has tests on both sides against a
shared fixture; **agentlogic and turboproof do not**, which is §7.4.

A tile is a *singleton* if only one may exist. Most are, because most answer
"what is the cursor?" and that has one answer. The exceptions matter:
hyperblog's `reader` and turboproof's editor exist precisely so you can have
two side by side showing different things. **Several findings below are the
same bug — a tile that should be per-placement reading global state instead.**

---

## 2 · How a PBUI product is layered

```
ui/src/
  components/         atoms → molecules → organisms → pages
  apps/               the tiles; each self-registers on import
  pbui/               the product's binding: types, verbs, registry, descriptors/
  model/              pure functions; no React, no fetch
  state/ or store/    Redux, or a hand-rolled world
  styles/             reset.css, tokens.css, app.css
```

Two conventions are enforced, and you will be asked about them in review:

- **One component per folder**, with `Name.tsx`, `Name.stories.tsx`,
  `index.ts`, and `Name.module.css` *only if it has styles*.
- **Organisms do no data fetching.** Props in, callbacks out; the container (a
  tile in `apps/`) fetches and passes down. This is what makes every state a
  story rather than a server configuration.

`pbui/docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md` is the
reference — §3 (imports), §4 (tokens), §6 (descriptors). It is long, and it is
the fastest way to stop being surprised.

### 2.1 · The token contract, in one paragraph

pbui components read CSS custom properties (`--pbui-ink`, `--pbui-space-4`).
Since 0.3.0 pbui ships a default for every one, wrapped in `:where(:root)` so
it carries **zero specificity** and a product's own `:root` block wins
regardless of import order. Your `tokens.css` is therefore the DIFFERENCE
between your product and pbui — never a copy of the palette.

Why this matters more than it sounds: an undefined custom property does not
fall back, it invalidates the **entire declaration** at computed-value time,
silently. `border: var(--pbui-border-hair)` with the token missing is not a
thin border, it is no border. agentlogic once shipped `var(--pbui-ink-faint)`
— a typo for `--pbui-faint` — and a resize grip never rendered at all, for
weeks, with nothing reporting it.

---

## 3 · The one idea behind most of these findings

`pbui#9` was a ticket called *"make the illegal states unrepresentable"*. It
found six defects reducing to two root causes, and the second is the one you
will keep meeting:

> **A sentence that asserts an invariant reads exactly like one that enforces
> it, and costs nothing to write.**

Already found and fixed, so you recognise the shape:

- `FileBrowser` documented *"Left collapses or climbs"* and only collapsed.
- agentlogic's Storybook config said *"exactly as main.tsx loads it"* and
  loaded four of six stylesheets, so every story reviewed the product in the
  wrong CSS — for the duration of an entire component refactor.
- hyperblog's `corpus.ts` named a test file, `parseRefs.test.ts`, that did not
  exist. So did `registry.ts` and `catalog.go`, for a fixture and a test that
  also did not exist, **each comment lending the other credibility**.
- `FileBrowser.onCreate` was declared, documented and called by nothing;
  turboproof implemented it end to end and shipped a feature with no way to
  reach it.

When you fix something below, the companion question is always *"what would
have caught this?"* — and the answer is a test, not a better comment.

The first root cause is worth knowing too: **a field whose meaning depends on
another field should not be a separate field.** `disabled` + `disabledReason`
became `disabledBecause`; `onActivate` + `activateDoc` became `activate`. If
you find yourself writing a prop that is only read inside a branch testing
another prop, that is the pattern.

---

## 4 · Getting set up

```bash
cd <product>/ui && pnpm install     # NODE_AUTH_TOKEN from Vault for .npmrc
pnpm run test && pnpm exec tsc --noEmit
pnpm run storybook                  # agentlogic 6007, turboproof 6008, hyperblog 6009

cd <product> && GOWORK=off go test ./...
```

`GOWORK=off` matters: these repositories sit in one `go.work` and the Go tests
are per-module.

**turboproof consumes pbui through a `link:` override**, so a change in `pbui/`
reaches it immediately — and pbui's TypeScript types come from `dist/`, so
**run `pnpm run build` in pbui before typechecking turboproof** or you will
read a stale answer. That cost real time three times in one session.

To see a product end to end:

```bash
make ui && GOWORK=off go build -o /tmp/x ./cmd/<product> && /tmp/x serve --listen :8080
```

That is the only thing that tests the EMBEDDED bundle. Storybook does not.

---

## 5 · turboproof PR #3 — nine findings, five of them P1

https://github.com/hyperslop-systems/turboproof/pull/3

The heaviest of the three. Six of the nine live in `pkg/filestore/store.go`,
`ui/src/apps/FilesApp.tsx` and the store slice; read those first.

**Architecture you need.** turboproof holds an LSP session against a Lean
project. Files are addressed by `file://` URI, and that URI is the key for the
Lean session, the document store and the save controls. **A document's identity
IS its URI** — which is why the rename findings are serious: a rename that does
not rewrite URIs leaves a live session pointed at a path that no longer exists.

### T1 · [P1] `Write` has a TOCTOU race — `pkg/filestore/store.go:329`

`Write` checks the caller's fingerprint against the file on disk, then later
calls `os.Rename` to replace it. Two tabs saving different text with the same
valid fingerprint both pass the check before either renames; both return
success and the second silently overwrites the first.

Needs per-path serialisation or an atomic compare-and-swap. A
`map[string]*sync.Mutex` keyed by cleaned absolute path is the obvious start;
the design question is eviction, because an unbounded map keyed by
user-supplied paths is its own problem.

**Verify:** start two `Write` calls with the same base fingerprint and assert
exactly one succeeds. Run it `go test -race -count=20`.

### T2 · [P1] One module-level handler for a view that can mount twice — `ui/src/state/filesTile.ts:40`

```ts
let handler: ((verb: FileVerb) => void) | null = null;
```

`registerFilesTile` overwrites this on every mount. The files view is a
singleton *view*, but a view can be linked into two panes, and then two
`FilesApp` components mount and the second registration wins. A rename verb
from one tree opens the inline control in the other.

The comment above `performFileVerb` says a verb with no tile mounted is
"unreachable in practice". True — and it is the two-tiles case that is not
handled. Key handlers by placement id, or lift the tree state so both share it.

**Verify:** render two `FilesApp`s and assert a verb addressed to placement A
does not reach B.

### T3 · [P1] Renaming a directory orphans its open descendants — `ui/src/apps/FilesApp.tsx:191`

The rename path looks a document up by exact URI. A directory rename moves
every descendant on disk while each open child keeps its old URI, so its Lean
session and every subsequent save target a path that no longer exists. Needs a
prefix rewrite over document URIs and file-sync keys.

**Verify:** open a file two levels down, rename the containing directory,
assert the document's URI changed and a save still lands.

### T4 · [P1] Renaming writes back a stale document — `ui/src/apps/FilesApp.tsx:199`

`ref` comes from the render that started the async rename. If the user types
while the request is in flight, the resulting `documentPut` writes the OLD text
back with the new URI, losing the edits. Re-read the document from the store
after `renameFile` resolves and update only the rename-related fields.

### T5 · [P1] A rejected batch discards valid edits — `ui/src/store/slice.ts:214`

```ts
const remaining = (state.outbox as unknown as Mutation[]).slice(action.payload.count);
```

The reducer slices away the whole refused prefix. When an invalid mutation
shares a batch with the user's typing — two tabs racing to seed the singleton
files view is the real case — a 422 drops both the duplicate seed and the typed
text.

The comment directly above says everything queued behind the refused prefix
"is still the user's work and is replayed". That is true of what comes *after*
the prefix and not of what shares it. Isolate the refused mutation instead.

### T6 · [P2] `Fingerprint` reads the whole file — `pkg/filestore/store.go:277`

`os.ReadFile` with no size cap. If a file is externally replaced with something
larger than `files-max-bytes`, saving loads all of it into memory. Hash through
a bounded reader, or reject oversized files before reading.

### T7 · [P2] The JSON body limit is smaller than the file limit — `pkg/cli/serve.go:104`

`files-max-bytes` and the global JSON body limit are both 1 MiB by default, but
a PUT wraps the text in JSON and escaping adds more. A file valid under the
advertised cap is rejected by `MaxBytesReader` as a malformed body. Give this
route headroom, or enforce the cap on the decoded text.

### T8 · [P2] File-root discovery caches its own failure — `ui/src/state/fileRoots.ts:29`

A transient failure on `/v1/files/roots` becomes `[]` and is cached
permanently, so documents mount under untranslated `file://project/...` URIs
and save controls never recognise them as file-backed — until a full reload.
Do not cache a failure as a successful empty result.

### T9 · [P1] Windows roots produce invalid URIs — `ui/src/model/fileRefs.ts:80`

`encodePath` splits on `/` only, so `C:\proofs` becomes
`file://C%3A%5Cproofs/...` instead of `file:///C:/proofs/...`. Every project
file then opens under an unusable URI on Windows.

**Ask before spending long on this** — it depends whether Windows is a
supported target. It is a genuine bug either way.

### T10 · CI: GoSec G302 — `pkg/filestore/store.go:383`

```go
os.OpenFile(full, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
```

Expects `0600` or less. Decide deliberately: these are a user's project files
in a directory they chose, so `0644` may well be right and the rule wants a
scoped `#nosec` with a stated reason. Do not blanket-exclude G302 in the
workflow — that turns off the check for the whole repository.

---

## 6 · hyperblog PR #1 — nine findings, six red jobs that are one problem

https://github.com/hyperslop-systems/hyperblog/pull/1

**Architecture you need.** Three rules, load-bearing throughout:

- **The cursor is a term, not a page.** Most tiles answer "what is the cursor?"
  and are singletons; `reader` is not, because two readers side by side on
  different posts is the point of the product.
- **Backlinks are derived, never stored.** `pkg/glossary` builds the index from
  the corpus at boot; nothing writes a link.
- **The whole corpus loads on boot.** Markdown with YAML front matter, parsed
  with goldmark. A glossary that fits in memory can be traversed rather than
  queried.

The paywall lives in one function: `redactPost` in
`pkg/server/handlers_corpus.go` sets `post.Body = nil` **on a copy** and returns
`402 Payment Required` — distinct from 403, because "not allowed" and "not
paid" are different answers. `TierRank` fails closed, returning `-1` for an
unknown tier, so a typo denies rather than grants.

### H1 · [P1] Both readers share one cursor — `ui/src/apps/ReaderApp.tsx:19`

```ts
export function ReaderApp(_props: TileProps): ReactNode {
  const { corpus, cursor, reading } = world;
  const post = corpus.postById.get(cursor.postId);
```

`placementId` is discarded — note the underscore — and the post comes from the
global cursor. So the second reader, the one thing the product exists for,
shows the same post as the first.

This is the deepest finding in the three PRs, because the fix is a design
decision: a post binding per placement. **Start from the server, which already
models this**: `pkg/workbenchapp/catalog.go` declares `postBinding` and
`termBinding` for the reader in `DocumentBindings`, and the browser ignores
them. Compare with how turboproof and `datalab-ui` bind documents to
placements. That is most of the answer.

### H2 · [P1] "Sign out everywhere" is a GET against a POST route — `ui/src/api/client.ts:316`

`window.location.assign` issues a GET; `Server.routes` registers only
`POST /v1/auth/logout`. The user gets a 405 and neither the local session nor
the identity-provider session is revoked. Use a same-origin form submission so
the provider redirect still works.

Security-relevant: the user is told they signed out everywhere, and did not.

### H3 · [P1] The database is world-readable — `pkg/store/store.go:104`

```go
if err := os.MkdirAll(filepath.Dir(absolute), 0o700); err != nil {
```

The *directory* is 0700; the file is not. With a pre-existing directory —
including the default working directory — SQLite creates it under the umask,
so 0644 with the common `022`. That file holds reader emails, notes, and
plaintext OIDC ID tokens. Pre-create it with `0600` before `sql.Open`.

### H4 · [P2] Read-marks skip the tier check — `pkg/server/handlers_reading.go:141`

`PUT /v1/reading/read/{id}` checks only that the post exists. A free reader can
mark a members-only post read; after subscribing, the post is already absent
from their unread digest. The mark-all endpoint and the UI both forbid this —
this one handler does not.

Apply the tier check to PUT and leave DELETE unguarded, so a stale mark can
still be cleared.

### H5 · [P2] The OIDC provider is published across a data race — `pkg/server/server.go:211`

`runServe` starts discovery in a goroutine while the server is already
accepting requests, then assigns the provider interface. `handleMe`,
`oidcConfigured`, login, callback and logout read it concurrently. An interface
value is two words; unsynchronised publication is a real race, not a
theoretical one. Use `atomic.Pointer`, or finish discovery before serving.
Confirm with `go test -race`.

### H6 · [P2] A negative TTL creates a non-expiring token — `pkg/server/handlers_me.go:268`

Negative `ttlDays` leaves `lifetime` at zero, and zero means "never expires" by
contract. Very large positive values overflow `time.Duration` and go negative
before `CreateAPIToken` checks. Reject negatives and cap the conversion.

### H7 · [P2] The launcher verb goes nowhere — `ui/src/components/pages/Workbench/Workbench.tsx:168`

`tileDescriptor` emits `openLauncher`; this switch has no case; `App`'s default
branch logs `verb_unhandled`. No initial workspace contains a launcher and the
launcher rows do not dispatch `replaceView`, so there is **no working path to
change a pane's view** in the shipped product.

### H8 · [P2] Splitting can create illegal layouts — `ui/src/components/pages/Workbench/Workbench.tsx:147`

The split control duplicates any tile's app id without consulting the registry,
though every entry except `reader` is a singleton. The server-side validator
rejects such a layout once persisted. Consult `tile(id)?.singleton` first —
`ui/src/appkit/registry.test.ts` now pins that `reader` is the only
non-singleton, so the fact is available and tested.

### H9 · [P2] The session list shows dead sessions — `pkg/store/accounts.go:320`

`GetSession` refuses a credential idle past `SessionIdle`, but the list query
filters only on `expires_at`. A session that stopped working stays listed for
up to sixteen days on the account's security view.

### H10 · CI: six red jobs, one cause

```
role "hyperblog-private-dependencies" could not be found
```

`.github/actions/setup-private-go` requests a Vault role that was never
created. Everything downstream fails for that reason. **This is
infrastructure, not code** — ask first; you probably do not have the Vault
permissions, and the fix is to provision the role the way the other three
repositories have it.

Two are separate:

- **Dependency Review** — "not supported on this repository". Needs the
  dependency graph enabled in repository settings.
- **Go Vulnerability Check** — resolves
  `github.com/hyperslop-systems/pbui v0.0.0-20260802174601-c865ea5ed11e`, a
  pseudo-version pointing at an unmerged commit. It resolves itself when
  `pbui#9` merges to `main`. **Do not chase it.**

---

## 7 · agentlogic PR #3 — three findings, CI green

https://github.com/hyperslop-systems/agentlogic/pull/3

**Architecture you need.** agentlogic ingests a Claude Code session file,
normalises it with `go-minitrace`, and renders it as tiles: a run deck, a
timeline, a conversation, a diff panel, a context-window meter. The interesting
model work is in `pkg/index` and `ui/src/model`.

### A1 · [P2] The transcript is fetched from the wrong project — `ui/src/components/pages/SourcePicker/SourcePicker.tsx:216`

When the user changes or clears the project selection, the empty-project effect
returns without clearing the visible rows and in-flight requests are not
cancelled, so stale rows stay on screen. This callback builds the archive
request from the CURRENT `project`, so clicking a stale row fetches from the
wrong project — a 404, or worse, a same-named transcript from elsewhere.

Carry `TranscriptVersion.project` in the panel choice and use it here, **as the
previous implementation did**. That phrase matters: this is a regression the
refactor introduced, so `git log -p` on this file shows you the shape that
worked.

### A2 · [P2] `LinkAction variant="raised"` is not a thing — `ui/src/components/pages/DevicePage/DevicePage.tsx:91`

pbui's `LinkAction` ships `bare` and `framed` only. An unsupported value is
filtered out and the link keeps just its root class, so the primary sign-in
action on the device-pairing page — and the identical one in `SourcePicker` —
lost its border, padding, background and weight.

Use a supported variant. If `raised` is genuinely wanted, that is a pbui change
and an issue there, not a local override here.

> Worth pausing on: this is the token contract's sibling. An unsupported
> *variant* fails silently exactly like an undefined token, and only a person
> looking at the screen finds out.

### A3 · [P2] Nested chip keyboard events are swallowed — `ui/src/components/organisms/ChangesPanel/ChangesPanel.tsx:98`

Enter or Space on a focused `StepChip` bubbles to the row handler, which calls
`preventDefault()` and runs only `onSelectEdit`. The chip's own `onSeek` never
fires, so keyboard users still cannot move the playhead from the chip — the
behaviour this extraction was supposed to restore. Handle the keys only when
the row itself is `event.target`.

**This is the same defect pbui#9 fixed in `FileBrowser`**, where every keystroke
inside the rename field bubbled into the tree's handler and pressing Delete
deleted the file being renamed. The fix there is
`if (isEditableTarget(event.target)) return;` at the top of `onKeyDown`. Read
`pbui/src/components/organisms/FileBrowser/FileBrowser.tsx` before writing
this; the shape transfers, though here the guard is "is the target this row"
rather than "is the target editable".

### 7.4 · One task that is not a review comment

hyperblog now has tests asserting its tile registry and its Go catalog agree
(`ui/src/appkit/registry.test.ts`, `pkg/workbenchapp/catalog_test.go`, against
a generated `registry.fixture.json`). **agentlogic and turboproof have the same
two lists and no such test.** Porting it is about half an hour each, and it is
the kind of guard that pays for itself the first time somebody adds a tile.

---

## 8 · How to work here

**Order.** turboproof's P1s first (T1–T5): they are data-loss bugs and they
cluster in two files. Then hyperblog H1–H3. Then the P2s. agentlogic's three
are small and good for a first day.

**One PR per product**, pushed to the existing branches. Do not mix products.

**Every fix gets a test that fails without it.** Then delete the fix, watch the
test fail, and put it back. This is not ceremony: a test written after a fix
passes for the wrong reason more often than you would think. In `pbui#9` one
such test used a stand-in wrapper and would have passed with the bug present —
it went green on the first try, which was the tell.

**Verify in a browser when the finding is visual.** Storybook is the fast path;
the real binary is the honest one. Several defects here were found only by
looking: a chip drawing its border twice, a tile with no border in Storybook
and a border in the product.

**Keep a diary.** `docmgr doc add --ticket <T> --doc-type reference --title
Diary`; the format is in the diary skill. Record what did NOT work — that is
the part nobody else can reconstruct, and this codebase's documentation is
unusually good because people did.

**Ask early about:** T9 (is Windows supported?), T10 (the `#nosec` decision),
H1 (per-placement binding is a design choice), H10 (Vault permissions).

**When stuck**, the ticket workspaces under each repo's `ttmp/` carry design
docs and diaries for everything above. `PBUI-HARDEN-1` in `pbui/ttmp/2026/08/03/`
is the most recent and most relevant; its diary runs to eight steps and is
frank about what went wrong.

Good luck. Every one of these is a real defect found by reading carefully, and
the reviewer was right every time — which is worth remembering when you
disagree with a review comment. Check it first.
