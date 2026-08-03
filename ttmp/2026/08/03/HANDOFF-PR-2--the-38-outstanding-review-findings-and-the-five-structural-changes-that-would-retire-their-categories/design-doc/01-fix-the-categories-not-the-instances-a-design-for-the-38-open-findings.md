---
Title: 'Fix the categories, not the instances: a design for the 38 open findings'
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
      Note: isEditableTarget, rowDomId, the sentinel — four open findings and refactoring R5.
    - Path: repo://src/presentation/createPbui.tsx
      Note: onPerform is optional at :263 — refactoring R1. Also two open findings.
    - Path: repo://ttmp/2026/08/03/HANDOFF-PR-1--pr-review-follow-ups-across-agentlogic-turboproof-and-hyperblog/guide/01-intern-handoff-the-three-open-prs-their-architecture-and-every-outstanding-finding.md
      Note: THE ARCHITECTURE. Read §1-§4 before anything here.
    - Path: repo://ttmp/2026/08/03/HANDOFF-PR-1--pr-review-follow-ups-across-agentlogic-turboproof-and-hyperblog/reference/01-diary.md
      Note: What was done in the previous round, and what went wrong doing it.
    - Path: ws://hyperblog/pkg/glossary/search.go
      Note: the P1 paywall oracle, and the reason R3 is worth doing structurally.
    - Path: ws://hyperblog/ui/src/pbui/verbs.ts
      Note: 24 verb kinds, one flat union, two partial interpreters — refactoring R2.
    - Path: ws://turboproof/ui/src/state/filesTile.ts
      Note: Extract<Verb, …> — the narrowing pattern hyperblog needs (R2).
ExternalSources:
    - https://github.com/hyperslop-systems/turboproof/pull/3
    - https://github.com/hyperslop-systems/hyperblog/pull/1
    - https://github.com/hyperslop-systems/agentlogic/pull/3
    - https://github.com/hyperslop-systems/pbui/pull/9
Summary: 38 review findings remain open across three PRs. Most fall into seven structural categories, and in nearly every case the correct abstraction already exists elsewhere in the same package. This is the argument for five refactorings that retire the categories, plus a triaged plan for the findings themselves.
LastUpdated: 2026-08-03T00:00:00Z
WhatFor: Hand the next round to somebody who has not been in this code.
WhenToUse: Read §1 and §2 first; §5 is the actual work plan.
---


# Fix the categories, not the instances

Welcome, and thank you for picking this up.

Four pull requests are open. One — **agentlogic #3** — came back from its
latest review clean. The other three carry **38 open findings**. CI is green
on all four, so nothing here is blocked on a build.

This document is in seven parts:

- **§1** is the one idea worth having before you start.
- **§2** is the seven categories the findings fall into.
- **§3** is the five refactorings, with file and symbol targets.
- **§4** is every open finding, triaged, with what I think of it.
- **§5** is what I would actually do, in order.
- **§6** is how to work here. **§7** is where everything lives.

**Read `HANDOFF-PR-1`'s guide first** — `ttmp/2026/08/03/HANDOFF-PR-1--…/guide/`.
It carries the architecture: what the three products are, how a PBUI product
is layered, the token contract, the workbench protocol. This document assumes
all of it. It is about an hour, and it is the difference between reading the
findings below as a list and reading them as a system.

---

## 1 · The one idea

The previous round fixed 21 findings. The next review found 27 more, several
of them in code written *during* that round. Before treating that as "more
bugs", look at what the defects actually were:

| the defect | the correct implementation that already existed | where it lives |
|---|---|---|
| `search` scans locked post bodies (P1) | `redactPost` | same package |
| `handleSetRead` skipped the tier check | the identical check in `handleMarkAllRead` | same file |
| `ListSessions` filtered only on `expires_at` | `Session.Expired(now, idle)` | same file |
| hyperblog's verbs fall through to `default: log` | `Extract<Verb, { kind: … }>` | turboproof, same family |
| `fileRoots` cached a failure as an empty list | `RootState = loading \| failed \| ready` | pbui, added last round |
| the launcher re-offers a singleton already present | `companionFor`'s registry check | the adjacent function |
| `createPbui` synthesises a click from a rename field | `isEditableTarget` | 200 lines away, same PR |

Seven defects; seven correct implementations sitting in the same package, the
same file, or — twice — a few hundred lines away in the same pull request.

> **The bug is almost never a missing idea. It is a second path that does not
> go through the idea.**

That matters for how you spend your time. Fixing 38 findings one at a time
leaves every second path intact, and the next review finds the third. The five
refactorings in §3 exist to delete the second paths; between them they retire —
not merely fix — about half the open list.

This is what `PBUI-HARDEN-1` was named for, one level up. That ticket's theme
was *"a sentence that asserts an invariant reads exactly like one that enforces
it."* The theme here is its sibling:

> **A check that must be remembered reads exactly like an invariant that is
> enforced, and costs the same to write.**

### 1.1 · A caution about my own work

Six of the new findings are defects in fixes I made last round. I name them
because they are the strongest evidence for the argument above, not as
ceremony:

- I fixed the editable-target bubbling in `FileBrowser`, then wrote the
  identical bug into `createPbui` in the same pull request.
- I made a singleton split into the launcher (H8), then let the launcher
  re-offer that same singleton.
- I added `aria-activedescendant` with a `rowDomId` that is not injective.
- I wrote the guard against a `rem` regression with a regex that misses that
  regression's most conventional spelling.

Every one is a *check I remembered once and forgot once*, inside a change
whose entire purpose was to make illegal states unrepresentable. Discipline did
not scale across two days and one developer. It will not scale across a team.

---

## 2 · The seven categories

Each has the shape, its instances, and what closes it. `R1`–`R5` point into §3.

### C1 · An ambient value read where an address was in hand

The largest cluster. A component holds a precise identity and instead reads a
global, a module-level slot, or "the most recent" value.

- `ReaderApp` wrote `_props` to discard `placementId` and read the global
  cursor *(fixed)*.
- `filesTile.ts` kept one module-level handler for a view that can mount twice
  *(fixed)*.
- `SourcePicker` built the archive request from the *selected* project rather
  than the clicked row's *(fixed)*.
- `renameBinding.ts:80` rebinds onto a URI a second document already holds
  **(open, P1)**.

The enabler is measurable: **11 of hyperblog's tiles can call `useWorld()`**.
When a context hands every component everything, the ambient read is the
shorter code path — and shorter wins.

**Closes it:** make the wide thing unreachable from the narrow scope (**R4**).
A tile that *cannot* see the global cursor makes this class unrepresentable
rather than merely fixed.

### C2 · One rule, N enforcement sites, N found by grep

- The tier check: present in `handleMarkAllRead` and `redactPost`, absent from
  `handleSetRead` *(fixed)* and from `search.go` **(open, P1)**.
- Session liveness: `GetSession` used the idle window, `ListSessions` did not
  *(fixed)*.
- Origin / content-type: applied to the WebSocket upgrade, absent from the
  file-mutating POSTs **(open, P1)**.
- `LinkActionProps.variant` promises three variants; the stylesheet implements
  two **(open)** — the reason agentlogic's sign-in link rendered as body text.

**Closes it:** stop expressing the rule as a check to repeat; express it as a
value you must hold (**R3**).

### C3 · The open union with a `default:` that logs

hyperblog has **24 verb kinds**, 16 cases in the domain interpreter (`App.tsx`)
and 8 in the layout one (`paneTree.ts`), and a `default:` branch that writes a
trace line. Neither switch can be exhaustive, because the union is split across
two interpreters and TypeScript only ever sees one of them.

Instances: `openLauncher` *(fixed)*, `swapTilesByAccept` **(open)**,
`linkTermByAccept` handled partially **(open)**.

turboproof already solved this — `FileVerb = Extract<Verb, { kind: "openFile" |
… }>` plus `isFileVerb`, after which its switch genuinely is exhaustive.

**Closes it:** **R2**. A `default:` that logs is a compile-time guarantee
traded for a runtime log line.

### C4 · The optional callback that silently does nothing

`onPerform?.(verb)` at `createPbui.tsx:263`. The Provider's entire purpose is
routing verbs, and it was constructible without a router — which is how
hyperblog shipped a product in which **every object-menu entry did nothing**.

`StepChip.onSeek?` is the same shape, unexploded.

**Closes it:** **R1**. A prop is optional because the *behaviour* is optional,
never because a story did not want to supply one.

### C5 · A `catch` that produces a plausible value

Every instance is `catch → default → indistinguishable from a real answer`:

- `fileRoots` cached `[]` from a failed fetch *(fixed)*.
- `getWorkbench(...).catch(() => null)` makes a transient network error
  indistinguishable from a 404 and detaches the workbench permanently
  **(open, `sync.tsx:224`)**.
- `fs.ReadDir` errors treated as "directory intentionally absent", so the
  server boots with a blank corpus **(open, `markdown.go:130`)**.

The cure was invented last round: `RootState = loading | failed | ready`, added
to `FileBrowser` because *"`undefined` meaning still-loading left failure
inexpressible."* It was applied to one prop while three other call sites kept
the collapsing form.

**Closes it:** generalise `RootState` to every fetch boundary. Not a new
pattern — the one already in the codebase, used once.

### C6 · A guard narrower than its claim

- `styles-wiring.test.ts:121` matches `:where(:root)` but not plain `html {`
  **(open)** — the guard against a *measured* 28% regression misses that
  regression's conventional spelling.
- `rowDomId` maps `project:a/b` and `project:a:b` to one DOM id **(open)**.
- Dates validated by `len(s) == 10`, so `2026-99-99` passes **(open)**.
- `renameMoves` needed an explicit separator test so `Mini` would not match
  `MiniProof` *(caught while writing it)*.

Shape: **a validator written against the example that motivated it rather than
against the input space.**

**Closes it:** two habits. Do not hand-roll what a library does correctly
(`time.Parse` with a round-trip, not a length check; a real encoder, not
`replace(/[^a-z]/g, "_")`). And for any function that *reduces* an input space,
state its injectivity as a test — `rowDomId` is a hash pretending it is not one.

### C7 · A container handler answering for its descendants

`FileBrowser`'s tree handler *(fixed)*, `createPbui`'s activation handler
**(open)**, `ChangesPanel`'s row handler *(fixed)*. Three sites, one rule,
fixed three times — and written fresh once *after* being fixed.

**Closes it:** **R5**.

---

## 3 · The five refactorings

Ordered by value retired ÷ cost. Each is smaller than the findings it retires.

### R1 · Make `onPerform` required — pbui

**Files:** `pbui/src/presentation/createPbui.tsx` — `PbuiProviderProps`, and
the call at `:263`.

Change `onPerform?:` to `onPerform:`. Stories and tests pass an explicit no-op.
Consider the same for `onAccept` after checking whether an accept-less Provider
is a real configuration.

**Retires:** C4. Cost: one line, plus the call sites the compiler names.

**This is the highest-value change in the document.** It converts the worst
defect of the last round — a product whose entire interaction model was inert —
into a build failure.

**Watch for:** `PbuiProvider` is re-exported by each product's
`pbui/runtime.tsx`, so the compiler will name every construction site including
stories. That is the point, not a complication.

### R2 · Split hyperblog's `Verb` union — hyperblog

**Files:** `hyperblog/ui/src/pbui/verbs.ts`; `ui/src/model/paneTree.ts`
(`applyLayoutVerb`); `ui/src/App.tsx` (the `perform` switch).

Split `Verb` into `LayoutVerb | DomainVerb`. `applyLayoutVerb` takes
`LayoutVerb`; `App`'s interpreter takes `DomainVerb`; both end with
`assertNever(verb)` and no `default:`. `Workbench.perform` narrows with an
`isLayoutVerb` guard, exactly as turboproof's `isFileVerb` does.

**Retires:** C3 — and directly closes `swapTilesByAccept` and the
`linkTermByAccept` gap, because the compiler will not let you leave them
unhandled.

**Read first:** `turboproof/ui/src/state/filesTile.ts:36-40` for the `Extract`
idiom, and the comment above `perform` in
`turboproof/ui/src/components/pages/Workbench.tsx` explaining that the file
plane is checked before the switch *"so the switch stays exhaustive"*. That
sentence is the design. hyperblog simply never adopted it.

### R3 · A tier-scoped corpus view — hyperblog

**Files:** `hyperblog/pkg/glossary/index.go` (`Corpus.Locked`, `TierRank`);
`pkg/glossary/search.go` (`Search`); `pkg/server/handlers_corpus.go`
(`redactPost`); `pkg/server/handlers_reading.go`.

Today `Corpus.Locked(postID, tier)` is a check every read path must remember,
and `search.go` is the path that forgot — with a **P1** consequence: search
scans locked bodies and returns exact match counts and paragraph ids, so a
caller can probe substrings and reconstruct withheld prose.

Introduce `func (c *Corpus) For(tier string) *ReaderView`, returning a view
whose posts already have `Body == nil` where the tier does not reach. Searching
prose you were not given then becomes a **compile error**, not a missed check.

**Retires:** C2 for the paywall — the rule this product most needs to get
right — and subsumes any future endpoint nobody has written yet.

**Watch for:** `redactPost` sets `Body = nil` *on a copy* and returns 402;
preserve both properties. `TierRank` fails closed (`-1` for an unknown tier),
so `ReaderView` must inherit that, and
`TestLockedComparesRanksAndFailsClosed` should keep passing unchanged.

### R4 · Scope the world away from tiles — hyperblog

**Files:** `hyperblog/ui/src/store/world.tsx` (`useWorld`);
`ui/src/appkit/registry.ts` (`TileProps`); the 11 tiles under `ui/src/apps/`.

A tile should receive what it may read through `TileProps` and should not be
able to reach the global cursor. The mechanism can be as light as a second
context provided around each tile whose presence makes `useWorld()` throw, or
as thorough as passing a narrowed `TileWorld`.

**Retires:** C1 — the largest cluster, and the one that produced H1, T2 and A1
independently in three products.

**This is the largest of the five and the one I am least sure about.** Eleven
tiles read `useWorld()` and most legitimately need most of it. It may be that
the right scope is much narrower than "no global access" — plausibly only
`cursor` is dangerous, because only `cursor` has a per-placement alternative.
**Start by reading all 11 call sites and deciding what actually needs scoping.
Do not begin with the refactor.**

### R5 · One container-keys hook — pbui

**Files:** `pbui/src/components/organisms/FileBrowser/FileBrowser.tsx`
(`isEditableTarget`, `onKeyDown`); `pbui/src/presentation/createPbui.tsx:387`;
downstream `agentlogic/ui/src/components/organisms/ChangesPanel`.

Export one hook — `useContainerKeys({ onActivate })` or similar — with the
"not from an interactive descendant" guard baked in, and adopt it at all three
sites.

**Retires:** C7, including the open `createPbui.tsx:387` finding.

---

## 4 · Every open finding, triaged

38 total: turboproof 12, hyperblog 18, pbui 8, agentlogic 0. The **round**
column is which review raised it. **mine** marks code written during the
previous round — those are regressions, not discoveries.

### 4.1 · The four I would do first, regardless of everything else

| repo | file:line | why first |
|---|---|---|
| hyperblog | `pkg/glossary/search.go:127` | **P1, paywall bypass.** Not a missed flag — an *oracle*. Arbitrary two-character substrings return match counts against locked prose, so the withheld text is recoverable by adaptive probing. The most serious finding on any of the four PRs. Fix under **R3**. |
| turboproof | `pkg/server/handlers_files.go:117` | **P1, CSRF on disk mutation.** Create and rename decode JSON with no `Content-Type` or `Origin` check, so a hostile page can create or rename paths in the exposed project despite the loopback bind. The WebSocket upgrade already has the origin policy — C2 again. |
| hyperblog | `pkg/server/handlers_workbenches.go:351` | **P1, cross-reader leak.** No `Cache-Control: private, no-store` or `Vary` on owner-private GETs. Deployment-shaped: reading the handler tells you nothing is wrong, and the consequence is one reader's workbench served to another. One shared response helper covers both endpoints. |
| turboproof | `ui/src/store/renameBinding.ts:80` | **P1, mine.** My `renameMoves` fixed the *descendants* end of the one-document-per-URI invariant and opened the *destination* end. Rename onto a path whose buffer is still open, and two documents hold one URI. |

### 4.2 · turboproof #3 — 12 open

| sev | round | file:line | symbol | note |
|---|---|---|---|---|
| P1 | 2 | `ui/src/store/renameBinding.ts:80` | `renameAndRebind` | **mine.** Detect an existing destination document and merge/reveal it, or refuse the rename. |
| P1 | 2 | `pkg/server/handlers_files.go:117` | `handleCreateFile`, `handleRenameFile` | See §4.1. |
| P1 | 1 | `pkg/filestore/store.go:199` | `New`, `resolve` | Overlapping roots alias one physical file to two URIs → competing Lean sessions. `New` already rejects a missing or file-valued root at startup; rejecting overlapping canonical roots there is cheap and makes it an error the operator sees before the first request. Prefer that to canonicalising document identity, which touches the persisted URI. |
| P1 | 1 | `ui/src/apps/SaveControl.tsx:70` | the save `catch` | A 404 is the *expected* answer once the file is gone. The `missing` flow already exists; this strands a buffer that has somewhere to go. **C5.** |
| P2 | 2 | `pkg/filestore/store.go:480` | `Write` | **mine.** `os.Stat` says the path exists, `fingerprintAt` streams a directory, EISDIR becomes a 500 instead of the existing `ErrIsDirectory`. One `info.IsDir()` check before the precondition path. |
| P2 | 1 | `pkg/filestore/store.go:521` | `Write` | Nasty. Reads and the fingerprint follow an in-root symlink; `os.Rename` targets the unresolved name, so a save silently converts the link to a regular file. **The per-path lock I added does not help** — it keys on the unresolved path, the same path the rename gets wrong. Of the two remedies offered, prefer resolving the final path for writes; rejecting symlinks removes something that appears to work. |
| P2 | 2 | `pkg/filestore/store.go:328` | `List` | `DirEntry.Info()` describes the link, so an in-root directory symlink lists as a file and cannot be expanded — while `resolve` explicitly permits it. Adjacent to the above; do them together. |
| P2 | 2 | `pkg/server/handlers_files.go:82` | `handlePutFileContent` | `{}` and `{"text":null}` decode to `""` and truncate the file. Presence-aware decode (`*string`). |
| P2 | 2 | `ui/src/apps/FilesApp.tsx:305` | the `tree.error` branch | One global error replaces the whole browser even when other roots loaded. **The code already says this**: the comment above `rootStates` records that per-root failure "belongs in a turboproof change rather than in the pbui migration". This is that change. |
| P2 | 1 | `ui/src/hooks/fileTree.ts:49` | `reloadChildren` | Refresh grafts fresh nodes over loaded subtrees, so expanded descendants go empty. `reloadRoots` already merges — copy it. **C2.** |
| P2 | 2 | `ui/src/store/sync.tsx:224` | the 422 recovery | `.catch(() => null)` conflates a transient failure with a real 404 and detaches permanently. Only a genuine not-found should detach. **C5.** |
| P2 | 2 | `ui/src/store/sync.tsx:149` | the seeding effect | Seeds recorded while offline are lost on reload and never retried. Record the seed only once acknowledged. |

### 4.3 · hyperblog #1 — 18 open

| sev | round | file:line | symbol | note |
|---|---|---|---|---|
| P1 | 2 | `pkg/glossary/search.go:127` | `Search` | See §4.1. **R3.** |
| P1 | 1 | `pkg/server/handlers_workbenches.go:351` | the shared response helper | See §4.1. |
| P1 | 1 | `ui/src/components/molecules/NoteEditor/NoteEditor.tsx:66` | the close-question click | Blur submits the draft, the click then submits the stale `note.body`; the reader's own words are overwritten in the component whose job is to keep them. Reordered responses reopen the question instead — same defect, opposite symptom. Close using the current draft, one save. |
| P2 | 2 | `ui/src/apps/ShellApps.tsx:225` | `LauncherApp` rows | **mine.** A singleton splits into the launcher (H8), and the launcher re-offers that singleton. The fix belongs beside `companionFor` in `model/paneTree.ts` — both answer "what may this pane become?", and having *one* function answer it is the C2-shaped fix. |
| P2 | 2 | `ui/src/pbui/descriptors/rest.ts:250` | `tileDescriptor` | `swapTilesByAccept` is unhandled. Newly *reachable*, not newly broken — before `onPerform` was wired nothing in the menu worked. **R2 closes it.** |
| P2 | 2 | `ui/src/App.tsx:155` | `linkTermByAccept` | Sets the global cursor and ignores `fromTermId`, so the advertised side-by-side comparison never happens. **R2** makes it visible; the fix needs the per-placement binding from H1. |
| P2 | 2 | `pkg/cli/serve.go:179` | the discovery goroutine | After ten failed attempts the goroutine returns and sign-in is dead until restart — while the log says "until it returns". Retry at a bounded interval while the context lives. |
| P2 | 1 | `pkg/server/handlers_auth.go:136` | first-sign-in probe | Two concurrent sign-ins both see no user and both write a "signed up" ledger entry. Have the upsert report whether its insert won. |
| P2 | 1 | `pkg/server/handlers_auth.go:239` | `redirectAuthError` | The server builds a machine-readable `auth_error` and no UI code reads it — a contract with one participant. The fix is on the UI side; the server half already works. |
| P2 | 2 | `pkg/server/handlers_corpus.go:108` | the corpus response | Nil `Series` serialises as `null`; the frontend calls `.map` and the whole workbench fails to boot instead of showing the empty state. Normalise to `[]`. |
| P2 | 2 | `pkg/server/handlers_me.go:260` | `ParseScopes` use | A misspelled scope is silently dropped and a narrower token returned with 201. Validate input against the vocabulary before using the tolerant parser, which exists for *stored* credentials. |
| P2 | 1 | `pkg/server/problem.go:155` | the decode helper | Trailing JSON is accepted. The same file already refuses unknown fields (`TestAnUnknownRequestFieldIsRefused`), so this is an inconsistency inside one decoder. Second decode requiring `io.EOF`. |
| P2 | 1 | `pkg/glossary/markdown.go:130` | the three `fs.ReadDir` calls | Every error becomes "intentionally absent" and the server boots blank. Suppress only not-exist. **C5.** |
| P2 | 1 | `pkg/glossary/markdown.go:299` | the date check | `len == 10`. `Date.parse` then renders `NaNy ago` and the lexical index reorders. Parse with `2006-01-02` and require a canonical round trip. **C6.** |
| P2 | 2 | `pkg/glossary/types.go:146` | the membership table | The product advertises a free/member distinction (browser-local vs synced state) that is not implemented. **A product decision, not a code fix — ask before doing either.** |
| P2 | 2 | `pkg/cli/reader.go:164` | `reader --disable` | Omitted fields are filled with creation defaults, so a lockout silently rewrites email, name and tier. Distinguish omitted-on-update from absent-on-create. |
| P2 | 2 | `ui/src/components/molecules/Prose/Prose.tsx:42` | the text branch | Inline Markdown backticks render verbatim; the embedded corpus already contains them. |
| P2 | 2 | `ui/src/pbui/descriptors/term.ts:24` | `describe` | Bookmark sets are keyed by `markKey` (NUL separator) and queried with a space, so "Inspect object" always reports `bookmarked: false`. `markAction` already uses `markKey`. **C2, one line.** |

### 4.4 · pbui #9 — 8 open, all P2, six of them mine

Four are `FileBrowser` accessibility follow-ups on work I added last round.
Do them **together, as one commit** — they are one half-finished feature
rather than four bugs.

| round | file:line | symbol | note |
|---|---|---|---|
| 2 | `FileBrowser.tsx:247` | `focusedKey` init | **mine.** With `selectedId === null` there is no active descendant until the first ArrowDown, and that ArrowDown skips row 0. My test only asserted the attribute *after* ArrowDown — a guard narrower than its claim (**C6**), in the test for the feature. |
| 2 | `FileBrowser.tsx:314` | `rowDomId` | **mine.** Not injective: `project:a/b` and `project:a:b` collide. Encode rather than collapse. |
| 2 | `FileBrowser.tsx:291` | show-more activation | **mine.** Focus is left on a sentinel that no longer exists; the next key jumps to the top of the tree. |
| 2 | `FileBrowser.tsx:422` | the sentinel row | **mine.** No `rowFocused` class, so the focus ring vanishes exactly when Enter would reveal thousands of rows. |
| 2 | `createPbui.tsx:387` | keyboard activation | **mine.** The Enter/Space click synthesis needs the same editable-descendant guard the tree got. **R5.** |
| 2 | `createPbui.tsx:442` | `inComposite` | **mine.** Yielding the tab stop left no keyboard route to a composite row's object menu, so presentation verbs are mouse-only there. Needs a container-owned way to open the active row's menu — design this together with R5. |
| 2 | `styles-wiring.test.ts:121` | the root-font guard | **mine.** Matches `:where(:root)` but not plain `html {`. **C6.** One-line regex fix; do it first, it is free. |
| 2 | `FileBrowser/index.ts:3` | the barrel | `RootState` is not exported, so a consumer cannot name the loading/failed/ready contract the `trees` prop is written in. Propagate through the organisms barrel alongside `FileNode`. |

---

## 5 · What I would do, in order

1. **The `styles-wiring.test.ts` regex** — one line, free, and it currently
   protects nothing against the likeliest spelling of a measured regression.
2. **R1, `onPerform` required.** One line plus whatever the compiler names.
   Highest value per character in the document.
3. **The three security P1s** — `search.go:127` (via **R3**),
   `handlers_files.go:117`, `handlers_workbenches.go:351`. These are the only
   findings with a security consequence; they should not wait behind
   refactoring work.
4. **R2, split hyperblog's verb union.** Closes two open findings by making
   them uncompilable, and prevents the category.
5. **My six regressions** — `renameBinding.ts:80`, `store.go:480`,
   `ShellApps.tsx:225`, and the four `FileBrowser` accessibility items as one
   commit. Small, and two of them undercut fixes the previous round was
   supposed to deliver.
6. **R5, the container-keys hook**, adopted at all three sites.
7. **The remaining P2s**, cheapest first. Several are one-liners
   (`term.ts:24`, `handlers_corpus.go:108`).
8. **R4 last**, and only after reading all 11 `useWorld()` call sites and
   deciding whether the right scope is narrower than the one I proposed.

**Ask before starting** on `pkg/glossary/types.go:146` — the free/member
entitlement mismatch is a product decision, and either answer is a real change.

---

## 6 · How to work here

**One PR per product**, pushed to the existing branches. All four are green;
keep them that way.

**Every fix gets a test that fails without it.** Then delete the fix, watch the
test fail, and put it back. This is not ceremony — the mutation step caught
**two of my own tests passing for the wrong reason** last round, one of them a
test of the direction that had never been broken. The tell is not always "green
on the first try"; sometimes it is "green under the mutation too".

**Verify in a browser when the finding is visual.** The worst defect of the
last round — a product where every menu entry did nothing — was found by
clicking one menu entry, after 25 passing tests, a clean `tsc`, five Storybook
stories and a sixteen-finding review had all passed over it. Storybook is the
fast path; the real binary is the honest one:

```bash
make ui && GOWORK=off go build -o /tmp/x ./cmd/<product> && /tmp/x serve --addr :8080
```

**Consider one composition smoke test per product** — mount the real root,
perform one gesture, assert something happened. Not a suite; one test. That is
the cheapest possible guard against the entire class of "wire never connected".

**Derive your task list from the API, not by hand.** The previous handoff said
"21 findings" when `gh api …/pulls/N/comments` says 32, and 11 went unaddressed
because of it. The enumeration script is in this ticket's `scripts/`.

**Keep a diary** — `docmgr doc add --ticket HANDOFF-PR-2 --doc-type reference
--title Diary`. Record what did *not* work; that is the part nobody else can
reconstruct.

---

## 7 · Where everything is

| what | where |
|---|---|
| the architecture | `pbui/ttmp/2026/08/03/HANDOFF-PR-1--…/guide/01-intern-handoff-….md` §1–§4 |
| what happened last round | `…/HANDOFF-PR-1--…/reference/01-diary.md` — four steps, frank about what went wrong |
| the library-side ticket | `pbui/ttmp/2026/08/03/PBUI-HARDEN-1--…/design-doc/01-six-defects-one-shape-….md` |
| the family playbook | `pbui/docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md` — §3 imports, §4 tokens, §6 descriptors |
| hyperblog's own guide | `hyperblog/ttmp/2026/08/02/HYPERBLOG-1--…/design/01-hyperblog-an-intern-s-guide-to-the-whole-system.md` |
| turboproof's | `turboproof/ttmp/2026/07/31/TURBOPROOF-1--…/` |
| the presentation protocol | `pbui/src/presentation/createPbui.tsx` — ~550 lines, the whole thing |

Branches: `turboproof/task/lint-private-module`,
`hyperblog/task/transcript-agent`, `agentlogic/task/agentlogic-ui-1`,
`pbui/task/pbui-api-hardening`.

Setup, including the thing that costs people an afternoon: turboproof consumes
pbui through a `link:` override and pbui's types come from `dist/`, so **run
`pnpm run build` in pbui before typechecking turboproof**. `GOWORK=off` on
every Go command; these repositories share one `go.work` and the tests are
per-module.

---

Good luck. Every one of these was found by reading carefully, and the reviewer
has been right every time — which is worth remembering when you disagree with a
comment. Check it first.
