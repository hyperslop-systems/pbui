---
Title: Production-first PBUI hardening and prototype containment implementation guide
Ticket: PBUI-PROD-1
Status: complete
Topics:
    - pbui
    - frontend
    - backend
    - review
    - refactoring
    - onboarding
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/datalab-ui/src/components/pages/Workbench/WorkbenchProviders.test.tsx
      Note: Production datalab PBUI-to-Redux composition proof added in e903dbd.
    - Path: repo://src/presentation/createPbui.test.tsx
      Note: Provider migration and nested-input keyboard regression for e903dbd.
    - Path: repo://src/presentation/createPbui.tsx
      Note: Required verb router and nested-control event ownership implemented in e903dbd.
    - Path: repo://src/styles-wiring.test.ts
      Note: Exact root-selector parsing and spelling regression added in e903dbd.
    - Path: ws://agentlogic/ui/src/components/organisms/ChangesPanel/ChangesPanel.tsx
      Note: Existing production reference for container event ownership.
    - Path: ws://hyperblog/pkg/glossary/search.go
      Note: Tier gate now excludes locked bodies before matching (commit 08177a5).
    - Path: ws://hyperblog/pkg/server/handlers_workbenches.go
      Note: Owner-scoped JSON and SSE cache policy implemented in 08177a5.
    - Path: ws://hyperblog/ui/src/components/molecules/NoteEditor/NoteEditor.tsx
      Note: Blur-to-close now saves the current draft once in 08177a5.
    - Path: ws://turboproof/pkg/server/handlers_files.go
      Note: JSON, Origin, and required-text mutation boundary implemented in b7bd9fb.
    - Path: ws://turboproof/pkg/filestore/store.go
      Note: Canonical root separation and directory fingerprint classification implemented in b7bd9fb.
    - Path: ws://turboproof/ui/src/store/renameBinding.ts
      Note: Open-document destination preflight and post-await rebinding implemented in b7bd9fb.
ExternalSources: []
Summary: Intern-oriented architecture, code review, implementation record, and disposition of shared PBUI risks versus prototype findings.
LastUpdated: 2026-08-03T22:05:00-04:00
WhatFor: Explain the five-repository system, the production-first review policy, the fixes implemented in PBUI-PROD-1, and the work deliberately deferred.
WhenToUse: Read before changing PBUI presentation contracts, datalab verb routing, hyperblog reader boundaries, or turboproof file mutation and rename behavior.
---









# Production-first PBUI hardening and prototype containment implementation guide

## Executive Summary

This ticket turns the 38 findings in `HANDOFF-PR-2` into a product-lifetime
decision instead of treating every repository as equally mature. PBUI is a
shared UI system. Datalab and agentlogic are real applications. Hyperblog and
turboproof are prototypes that will be reshaped by future product work. That
changes the correct engineering order:

1. Fix shared contracts whose failure can silently break real applications.
2. Prove the contract through the real production consumer that actually uses
   it.
3. In prototypes, fix confidentiality, cross-origin mutation, and plausible
   data-loss hazards now.
4. Defer prototype-wide architecture, accessibility polish, and product
   completeness until the next feature creates a concrete design constraint.

Three focused code commits implement that boundary:

- `e903dbd` makes PBUI verb routing mandatory, contains keyboard activation,
  completes two small exports/guards, and proves datalab's real verb route.
- `08177a5` prevents locked hyperblog prose from acting as a search oracle,
  gives owner workbenches private cache semantics, and saves a note draft once.
- `b7bd9fb` protects turboproof file mutations, rejects ambiguous roots and
  directory fingerprints, and prevents an open-document rename collision.

The central lesson for an intern is that “important code” is not synonymous
with “code that deserves the largest refactor.” We chose the smallest change
that establishes a durable invariant at each trust or data boundary. The
remaining findings are recorded in the deferred register at the end of this
document; they have not been declared harmless.

## 1. System map

The five repositories participate at different layers:

```text
                       shared npm package
                  +-------------------------+
                  |          PBUI           |
                  | components, chrome,     |
                  | presentation protocol   |
                  +------------+------------+
                               |
               +---------------+----------------+
               |                                |
      presentation consumer              component consumer
               |                                |
       +-------v-------+                +-------v--------+
       |    datalab    |                |   agentlogic   |
       | verbs -> RTK  |                | app chrome and |
       | state/effects |                | components     |
       +---------------+                +----------------+

       +-----------------------+        +-----------------------+
       | hyperblog prototype   |        | turboproof prototype  |
       | corpus + tier search  |        | HTTP -> filestore     |
       | owner workbenches     |        | workbench documents   |
       | React question notes  |        | Lean/editor binding   |
       +-----------------------+        +-----------------------+
```

PBUI does not own product state. Its presentation subsystem turns a typed
reference into a menu and emits a typed, serialisable verb. A host application
must interpret the verb. Datalab implements this full protocol. Agentlogic
currently consumes PBUI's components and CSS but does not construct a
`createPbui` runtime. Hyperblog and turboproof are independent applications
that happen to consume PBUI while also owning server-side trust boundaries.

This distinction matters in tests. A datalab composition test can and should
prove `Presentation -> Verb -> Redux`. Inventing a `PbuiProvider` in agentlogic
would test an architecture the product does not have. Agentlogic instead
belongs in shared-component regression validation.

## 2. How findings were prioritized

We used two axes: consequence and expected lifetime.

| Consequence | Durable shared/production code | Prototype code |
|---|---|---|
| Confidentiality/security | Fix now | Fix now |
| Data loss or namespace ambiguity | Fix now | Fix now when bounded |
| Silent integration failure | Fix and prove composition | Fix only if cheap/active |
| Broad architecture | Design deliberately | Defer to feature pressure |
| Accessibility/polish | Ticket for production path | Usually defer |

The decision procedure can be expressed as pseudocode:

```text
for finding in review_findings:
    if finding.crosses_security_boundary:
        FIX_NOW
    else if finding.can_lose_or_misbind_user_data and finding.has_bounded_fix:
        FIX_NOW
    else if finding.is_shared_contract and finding.affects_real_consumer:
        FIX_NOW_WITH_COMPOSITION_TEST
    else if finding.repository_is_prototype:
        DOCUMENT_AND_DEFER
    else:
        FILE_FOCUSED_PRODUCTION_TICKET
```

This is not a numerical severity score. A wide refactor can have a high
theoretical payoff and still be the wrong next change when the product model is
about to move. Conversely, a six-line content-type check is worth doing in a
prototype because it closes a browser-to-disk mutation path without constraining
the future architecture.

## Problem Statement

The earlier handoff correctly enumerated problems but did not know the product
lifetime of each repository. Without that information, its structural changes
read like a single backlog. Applying them indiscriminately would create three
risks:

- production applications could retain silent shared-contract failures while
  effort went into prototype polish;
- prototype code could acquire abstractions for a product shape that will soon
  change; and
- security and data-integrity defects could be dismissed merely because the
  surrounding application is a prototype.

The immediate concrete problems selected for this ticket were:

- PBUI allowed a provider with no `onPerform`, so menus appeared functional but
  commands vanished.
- PBUI's presentation keyboard handler could activate when Enter or Space
  belonged to a nested interactive child.
- Datalab lacked a composition proof across PBUI's provider boundary.
- A locked hyperblog post's body could affect search hit existence and metadata
  even when its snippet was hidden.
- Owner-scoped hyperblog workbench responses lacked explicit private/no-store
  cache policy.
- Closing a hyperblog question could blur-save and click-save competing values.
- Turboproof's POST mutation endpoints accepted browser-simple content types and
  did not reject a foreign `Origin`.
- A missing/null PUT `text` value was indistinguishable from an intentional
  empty file.
- Equal, nested, or symlink-aliased turboproof roots described one disk
  namespace through multiple logical identities.
- Fingerprinting a directory streamed it until an unrelated read error instead
  of returning the domain error.
- A rename could rebind one open document onto a URI already owned by another.

## 3. PBUI presentation architecture

### 3.1 The protocol

`createPbui<Values, Environment, Verb>` in
`src/presentation/createPbui.tsx` constructs a typed React context. Its three
generic parameters are deliberately separate:

- `Values` describes references that can be presented.
- `Environment` provides late-bound product data used by descriptors.
- `Verb` is a serialisable request for product behavior.

The important public APIs are:

```ts
interface CreatePbuiOptions<Values, Environment, Verb> {
  registry: PresentationRegistry<Values, Environment, Verb>;
  defaultEnvironment: Environment;
  conversions?: PresentationConversion<Values>[];
}

interface PbuiProviderProps<Values, Environment, Verb> {
  children: ReactNode;
  environment?: Environment;
  onPerform: (verb: Verb) => void | Promise<void>; // required
  onAccept?: (reference: PresentationReference<Values> | null) => void;
}
```

A descriptor creates menu items but does not import a reducer or service. The
runtime sends the selected verb through `perform`, and the host's required
`onPerform` is the effect boundary:

```text
reference
   |
   v
PresentationRegistry --(environment)--> label + menu items
                                             |
                                             v
                                         typed Verb
                                             |
                                      Provider.onPerform
                                             |
                           +-----------------+----------------+
                           |                                  |
                       Redux action                        service call
```

Before `e903dbd`, `onPerform?` encoded a state that was visually valid but
behaviorally broken. Making it required is an intentional source-level API
break. Every controlled provider was migrated in the same change. No default
no-op or compatibility adapter was added because either would preserve the
silent failure.

### 3.2 Event ownership

React keyboard events bubble. Therefore, a container that renders with button
semantics must distinguish “the container is activated” from “a child control
was activated.” The local rule is:

```ts
if (event.target !== event.currentTarget) return;
if (event.key !== "Enter" && event.key !== " ") return;
event.preventDefault();
activateOrOpenMenu();
```

`target` is the deepest element that originated the event. `currentTarget` is
the element whose handler is currently running. Equality means the
presentation owns the keystroke. This same shape already exists in
`agentlogic/ui/src/components/organisms/ChangesPanel/ChangesPanel.tsx:95`.
That file is evidence for the rule, but not a reason to introduce a generic
hook: editable fields, composite widgets, and nested buttons can require
different containment semantics.

### 3.3 Datalab is the real presentation consumer

`packages/datalab-ui/src/components/pages/Workbench/WorkbenchProviders.tsx`
creates the actual effect boundary:

```text
PBUI menu emits Verb
        |
        v
perform(verb)
        |
        +-- read latest { world, layout }
        +-- actionsForVerb(verb, state, environment)
        +-- dispatch every returned RTK action/thunk
        |
        v
Redux store changes
```

The environment is memoized, but its methods read `store.getState().world`
when invoked. This avoids freezing descriptors to a render-time snapshot. The
new composition test mounts the real `WorkbenchProviders`, uses a PBUI control
to perform `watch`, and observes the resulting Redux state. That test covers a
failure no isolated unit can see: a valid verb, valid mapper, and valid reducer
still accomplish nothing if the provider omits or misroutes the callback.

Agentlogic, by contrast, imports PBUI atoms, organisms, application body, and
CSS. Search of its source shows no `createPbui` or `PbuiProvider`. Its relevant
contract is component and style compatibility, not presentation verb routing.

### 3.4 Small shared contract completions

The same PBUI commit included two bounded fixes:

- `RootState` is exported through both FileBrowser public barrels. Consumers
  no longer have to reach into an internal store module for a public state type.
- `src/styles-wiring.test.ts` parses selector lists and recognizes exact
  `html`, `:root`, `:where(html)`, and `:where(:root)` root blocks. It rejects
  `html body`, avoiding a regex that accepted a descendant as a root selector.

These are appropriate opportunistic fixes because they clarify existing public
contracts without choosing a new architecture.

## 4. Hyperblog containment architecture

### 4.1 Reader search is an information boundary

`pkg/glossary/search.go` searches terms and posts using conjunctive substring
matching. A post result contains more than its snippet:

```go
type PostHit struct {
    ID          string
    Hits        int
    Snippet     string
    ParagraphID string
    Score       int
}
```

Redacting only `Snippet` is insufficient. If unavailable body text can decide
whether the result exists, increase `Hits`, identify a paragraph, or alter
`Score`, repeated queries become a substring oracle over paid prose.

The fixed order is:

```text
is body available to reader tier?
    |
    +-- no  --> do not inspect body at all
    |           title/dek may still produce a public discovery result
    |
    +-- yes --> match paragraphs, count hits, choose paragraph/snippet
```

In pseudocode:

```text
for post in corpus.posts:
    matched_body = []
    if readerTier >= post.tier:
        matched_body = paragraphs_matching_all_words(post.body)

    public_match = matches(post.title) or matches(post.dek)
    if not public_match and matched_body is empty:
        continue

    emit result derived only from public fields + matched_body
```

This is a minimal confidentiality fix. It does not implement the deferred
`ReaderCorpus` projection. A future projection would be useful when many
features need the same entitlement-filtered view, but building it for a single
search seam would expand prototype architecture today.

### 4.2 Owner workbench cache semantics

Hyperblog exposes owner-scoped workbench JSON and an SSE stream in
`pkg/server/handlers_workbenches.go`. Authentication protects request-time
access; cache directives protect response reuse. Both responses now set:

```http
Cache-Control: private, no-store
Vary: Cookie, Authorization
```

`private` forbids shared-cache storage, `no-store` asks all caches not to retain
the response, and `Vary` identifies both supported credential transports. The
policy is defense in depth; it does not replace handler authorization.

### 4.3 Note close is one compound command

`NoteEditor.tsx` holds an unsaved local `draft`. Clicking the close control also
causes the textarea to blur. If blur and click independently persist/close,
event ordering can save twice or close using the stale `note.body` rather than
the current draft.

The interaction is now modeled as one command:

```text
blur textarea
   |
   +-- relatedTarget is [data-note-close] --> ignore blur save
   |
   +-- anything else ---------------------> ordinary blur save

click close
   |
   +-- save(draft ?? note.body, open=false) exactly once
```

Using `relatedTarget` makes the event relationship explicit. A native
React/jsdom regression verifies the browser event sequence while mounting the
real hyperblog PBUI provider.

## 5. Turboproof containment architecture

### 5.1 Request path from browser to disk

Turboproof exposes a file API over a configured set of roots:

```text
React file tree / editor
        |
        v
HTTP file handlers (validation + problem responses)
        |
        v
filestore (root confinement + locks + CAS writes)
        |
        v
filesystem / Lean project
```

The server and filestore have different responsibilities. The server validates
HTTP representation and browser provenance. The filestore validates logical
root/path identity, confinement, type, size, and optimistic-concurrency rules.
Keeping both layers matters because the filestore is callable outside HTTP and
the HTTP server should reject bad requests before touching disk.

### 5.2 Browser mutation guard

Create and rename use POST, which can be issued as a browser “simple request”
with a form-like content type. `requireFileMutationJSON` now runs before JSON
decoding or store calls:

```text
Content-Type parses to application/json?
    no  -> 415 problem; stop
    yes -> inspect optional Origin

Origin absent?
    yes -> permit local/non-browser client
    no  -> scheme is http/https AND origin host equals request Host?
              no  -> 403 problem; stop
              yes -> decode and mutate
```

Requiring `application/json` forces a cross-origin browser to preflight; this
server grants no CORS permission. The explicit `Origin` check is a second
boundary. Non-browser tools remain usable because they commonly omit Origin.

The API behavior implemented in `pkg/server/handlers_files.go` is:

| Endpoint behavior | Result |
|---|---|
| create/rename with non-JSON content type | `415` problem response |
| create/rename with foreign Origin | `403` problem response |
| create/rename with same Origin or no Origin | continue to validation |
| PUT `{}` or `{"text": null}` | `400`, existing file unchanged |
| PUT `{"text": ""}` | intentional empty write |

The pointer field `Text *string` distinguishes absent/null from the empty
string. It intentionally treats JSON null and absence alike; both fail before
`Store.Write`.

Deployment caveat: direct comparison with `r.Host` assumes the externally
visible host is preserved. Before placing turboproof behind a reverse proxy,
decide which proxy is trusted and normalize the external origin at that
boundary. Do not blindly trust arbitrary `X-Forwarded-Host` input.

### 5.3 One filesystem namespace, one logical root

Each filestore root becomes an absolute, symlink-resolved directory. Allowing
equal or nested roots gives the same file two logical identities:

```text
root "project"  -> /work/demo
root "src"      -> /work/demo/src

project:src/Main.lean == src:Main.lean
```

That ambiguity breaks locks, fingerprints, open-document URIs, and rename
reasoning. `filestore.New` now rejects equality or containment in either
direction after canonicalization. A symlink alias is therefore rejected too.

```text
for candidate in configured_roots:
    canonical = Abs(EvalSymlinks(candidate.dir))
    for existing in accepted_roots:
        if contains(existing, canonical) or contains(canonical, existing):
            error "roots overlap"
```

This does not define the full deferred symlink policy for files created or
retargeted after startup. It closes the configured-root identity hole without
pretending to solve all filesystem races.

### 5.4 Fingerprints represent files, not arbitrary streams

`Store.fingerprintAt` streams at most `maxBytes + 1` bytes into a SHA-256 digest
and returns a shortened size/digest identity. It is used by optimistic
concurrency, so domain classification must precede streaming. The method now
calls `handle.Stat()` and returns `ErrIsDirectory` for a directory. This yields
the same stable API error regardless of operating-system directory-read
behavior.

### 5.5 Rename has two time domains

`ui/src/store/renameBinding.ts` bridges disk state and mutable Redux document
state. It must inspect state at two different times:

```text
T0: current document snapshot
    compute every URI moved by file/directory rename
    reject if a destination belongs to an unrelated open document

T1: await server rename

T2: re-read current document
    preserve text typed while request was in flight
    update each moved source URI/display name
    move each file-sync fingerprint entry
```

The preflight prevents a known destination document from being rebound over.
The post-await read prevents stale captured text from overwriting user typing.
Directory renames use `renameMoves`, so all open descendants and their sync
keys move together.

A residual race remains: another document can open the destination after T0
and before T2. Solving that requires a synchronization/state-machine design,
not another local condition. It belongs to the deferred turboproof architecture
ticket if the prototype becomes a durable multi-operation editor.

## 6. Implemented invariants and regression evidence

The most useful way to review the changes is by invariant:

| Invariant | Primary implementation | Regression boundary |
|---|---|---|
| Every PBUI provider names a verb sink | `src/presentation/createPbui.tsx` | TypeScript plus provider tests/stories |
| A presentation handles only its own key event | same | nested input jsdom test |
| Datalab verbs reach real Redux state | `WorkbenchProviders.tsx` | production composition test |
| Locked prose contributes no search signal | `hyperblog/pkg/glossary/search.go` | corpus and HTTP search tests |
| Owner workbenches are not reusable cache content | `handlers_workbenches.go` | JSON and SSE header tests |
| Close persists the current draft once | `NoteEditor.tsx` | native React/jsdom interaction test |
| Invalid/foreign POST cannot reach disk | `handlers_files.go` | HTTP plus no-mutation assertions |
| Missing text cannot truncate a file | same | existing contents preserved assertion |
| Configured roots never overlap canonically | `filestore/store.go` | equal/nested/symlink table tests |
| Directory fingerprint has a domain error | same | `errors.Is(ErrIsDirectory)` test |
| Rename cannot target another open URI | `renameBinding.ts` | server spy remains uncalled |

## 7. Design decisions

### DR-1: Prioritize by blast radius and product lifetime

Shared and production contracts come first. Prototype work is limited to
security, data loss, and cheap high-confidence correctness. This avoids both
neglect and gold-plating.

### DR-2: Require `onPerform`; do not add a compatibility no-op

A no-op makes migration easy by preserving the defect. All controlled call
sites were migrated atomically, and TypeScript now reports future omissions.

### DR-3: Keep event ownership local

The `target === currentTarget` predicate is used where a semantic container has
interactive descendants. We did not introduce a universal hook because a tree,
textbox, and nested button have different keyboard ownership rules.

### DR-4: Gate unavailable content before matching

Output redaction is too late when result existence and ranking are observable.
The body is excluded from computation for an under-tier reader.

### DR-5: Treat close as one editor command

The click target suppresses the blur branch, and close owns the single final
save. This replaces reliance on incidental browser event order.

### DR-6: Validate HTTP provenance before decoding mutation intent

Content type and Origin are checked before store calls. The filestore remains
responsible for filesystem safety; the HTTP handler is responsible for browser
request safety.

### DR-7: Reject overlapping canonical roots

Multiple logical names for one path are prohibited at startup. We chose
rejection over alias normalization because aliases would leak complexity into
locks, URIs, and client identity.

### DR-8: Preflight identity, re-read content

Rename destination ownership is a precondition checked before disk mutation.
Editable document data is read after the await. One snapshot cannot safely
serve both purposes.

## Alternatives Considered

- **Fix all 38 findings now.** Rejected because it would prioritize prototype
  structural polish above shared production contracts and would design against
  speculative future requirements.
- **Leave all prototype findings alone.** Rejected because prototype status
  does not make content or disk mutation boundaries safe, nor does it make lost
  drafts acceptable when the fix is local.
- **Keep `onPerform` optional and warn at runtime.** Rejected because the
  failure is statically knowable and every controlled provider can be migrated.
- **Add a backwards-compatible default router.** Rejected because it would
  deliberately retain silent verb loss.
- **Create a universal keyboard-containment hook.** Deferred because the
  predicate depends on widget semantics; two similar call sites are evidence
  for a rule, not yet a stable abstraction.
- **Build hyperblog `ReaderCorpus` now.** Deferred until more than one feature
  needs an entitlement-filtered projection.
- **Trust only CORS preflight in turboproof.** Rejected in favor of an explicit
  Origin check as a small second boundary.
- **Automatically merge overlapping roots.** Rejected because it changes
  configured identity and does not define which public root name wins.
- **Solve all rename races locally.** Rejected because cross-await workbench
  coordination requires a broader synchronization state machine.

## Proposed Solution

The solution was implemented in four phases rather than left as a proposal:

1. Harden PBUI's provider and keyboard contract and prove datalab composition.
2. Contain hyperblog confidentiality, private caching, and note-close risks.
3. Contain turboproof browser-to-disk and document-identity risks.
4. Preserve the architecture, implementation evidence, and deferred work in
   this ticket and deliver it as a reMarkable bundle.

No new compatibility layers, package boundaries, or product-wide abstractions
were introduced. Each change is at the narrowest layer that owns the invariant.

## 8. Code-review guidance for an intern

Read the code in dependency order, not repository order:

1. Start with `src/presentation/createPbui.tsx:25-54` and
   `:159-183` to understand the generic protocol and provider contract.
2. Read datalab's `WorkbenchProviders.tsx:27-72` to see how an application
   supplies environment and effects.
3. Read agentlogic's `ChangesPanel.tsx:86-120` as a second example of event
   ownership, while noting it is not a presentation-runtime consumer.
4. Read hyperblog's `Search` from `search.go:41-159`; trace every output field
   backward to decide whether locked data can influence it.
5. Read turboproof from outside inward: HTTP handler, `Store.resolve`/`Write`,
   then `renameAndRebind` across the asynchronous client boundary.

For every review, ask these questions:

- What is the authoritative identity: reference ID, URI, root/path, or disk
  inode/path?
- Which state is a render-time snapshot and which must be read after an await?
- Can unavailable data affect an observable even when not directly rendered?
- Does invalid input return before the first stateful operation?
- Is a test proving a helper, a layer boundary, or the real composition?
- Would an abstraction be reused by known product work, or is it speculation?

Do not infer safety from a green unit suite alone. The datalab test exists
because component, mapper, and reducer unit tests cannot prove their provider
composition. Conversely, do not demand an end-to-end test for a pure canonical
root relation when a table-driven filestore test precisely owns that rule.

## 9. API references

### PBUI

- `createPbui(options)` returns the typed provider, presentation component, and
  hooks bound to one registry/environment/verb language.
- `PbuiProviderProps.onPerform(verb)` is now mandatory.
- `PbuiContextValue.perform(verb)` is the descriptor/menu-facing verb sink.
- `PresentationProps.inComposite` removes standalone button/tab-stop semantics
  when a composite widget owns navigation.

### Hyperblog

- `(*Corpus).Search(query, readerTier) Results` accepts the reader tier as an
  explicit input and must derive results only from data available at that tier.
- Workbench JSON/SSE handlers return owner data with private/no-store headers.
- `NoteEditor` treats `onSave(body, open)` as the persistence command; close
  passes the current draft and `false` exactly once.

### Turboproof

- POST create/rename require `Content-Type: application/json` and, when present,
  a same-host HTTP(S) `Origin`.
- PUT content requires a non-null JSON `text` member; empty string is valid.
- `filestore.New(roots, maxBytes)` rejects canonical root overlap.
- `Store.FingerprintOf(ctx, root, path)` returns `ErrIsDirectory` for a
  directory.
- `renameAndRebind(deps, root, from, to)` returns `null` on success or a user
  message without dispatching partial rebinds on preflight/server failure.

## Implementation Plan

Implementation is complete in the three code commits listed in the executive
summary. The operational sequence for a future continuation is:

```text
PBUI source/test -> PBUI typecheck/test/build
                 -> datalab composition/full suite/typecheck
                 -> agentlogic component suite/typecheck

hyperblog Go boundary tests + React interaction tests
                 -> full Go/UI/typecheck

turboproof filestore/server tests + rename test
                 -> full Go/UI/typecheck/lint
```

Build PBUI before validating a workspace consumer so generated declarations
represent the changed required prop. Standalone prototype installations may
resolve their own installed PBUI version; their call sites must be inspected
explicitly rather than treating a standalone typecheck as migration evidence.

## 10. Deferred register and recommended tickets

### File as a focused production ticket

PBUI FileBrowser accessibility should be a real follow-up because it will
survive product evolution and can affect datalab/agentlogic if they adopt the
organism. Scope it as one keyboard/focus model, including:

- initial active descendant;
- reversible, collision-free DOM row IDs;
- focus transfer when a virtualized active row becomes a sentinel; and
- visible focus indication for the sentinel.

Composite-row menu keyboard behavior should be designed alongside that work,
not patched independently.

### Defer until hyperblog feature work

- reader-corpus projection across discovery/search/reader;
- one typed three-language verb model rather than parallel menu/action forms;
- per-placement `TileScope` ownership;
- entitlement/discovery/launcher behavior;
- Markdown and CLI polish.

Promote authentication/entitlement work immediately if hyperblog becomes
internet-facing or carries real paid content. Otherwise, address each structural
item when a feature needs its boundary.

### Defer until turboproof feature work

- a complete symlink identity and retargeting policy;
- explicit client synchronization states for save/rename/open races;
- resilient file-tree refresh and partial failure behavior;
- broader IDE/product polish.

Promote the synchronization ticket when turboproof supports durable user
projects, multiple simultaneous operations, or multiple clients. The local
preflight implemented here is not a substitute for that future state machine.

### Leave as-is for now

Low-impact prototype naming, layout, launcher, Markdown, and CLI findings can
remain in the existing handoff rather than becoming standalone tickets. Filing
dozens of speculative tickets would create false backlog precision. They should
be re-evaluated when their owning feature is next changed.

## Open Questions

- Will turboproof be deployed behind a reverse proxy, and if so, what trusted
  mechanism defines its external host for same-origin validation?
- Will either prototype become internet-facing before its next architecture
  pass? If yes, promote its auth/entitlement and operational findings.
- Which production application will first adopt PBUI FileBrowser? That consumer
  should participate in the accessibility ticket's composition tests.
- Does hyperblog intend public title/dek discovery for locked posts? This ticket
  preserves that existing behavior while hiding body-derived observables.
- When turboproof becomes durable, what transaction or state machine owns the
  T0-to-T2 rename race across disk and open documents?

## References

- Parent review:
  `ttmp/2026/08/03/HANDOFF-PR-2--the-38-outstanding-review-findings-and-the-five-structural-changes-that-would-retire-their-categories/`
- This ticket's `tasks.md`, `changelog.md`, and
  `reference/01-implementation-diary.md`.
- PBUI implementation: `src/presentation/createPbui.tsx`,
  `src/presentation/createPbui.test.tsx`, and `src/styles-wiring.test.ts`.
- Datalab composition:
  `packages/datalab-ui/src/components/pages/Workbench/WorkbenchProviders.tsx`
  and its adjacent test.
- Agentlogic event-ownership reference:
  `agentlogic/ui/src/components/organisms/ChangesPanel/ChangesPanel.tsx`.
- Hyperblog boundaries: `pkg/glossary/search.go`,
  `pkg/server/handlers_workbenches.go`, and
  `ui/src/components/molecules/NoteEditor/NoteEditor.tsx`.
- Turboproof boundaries: `pkg/server/handlers_files.go`,
  `pkg/filestore/store.go`, and `ui/src/store/renameBinding.ts`.
