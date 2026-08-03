---
Title: Diary
Ticket: HANDOFF-PR-1
Status: active
Topics:
    - pbui
    - frontend
    - backend
    - review
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: ws://turboproof/pkg/filestore/store.go
      Note: pathLocks, readBounded and fingerprintAt — T1, T6, T10 (commit 2f4bc82)
    - Path: ws://turboproof/pkg/server/server.go
      Note: jsonEnvelope and bodyLimitFor — the file route's headroom, T7 (commit 2f4bc82)
ExternalSources:
    - https://github.com/hyperslop-systems/turboproof/pull/3
    - https://github.com/hyperslop-systems/hyperblog/pull/1
    - https://github.com/hyperslop-systems/agentlogic/pull/3
Summary: Working the 24 HANDOFF-PR-1 tasks — the 21 review findings and the CI failures across turboproof, hyperblog and agentlogic.
LastUpdated: 2026-08-03
WhatFor: Record what was done, what failed, and what the next person needs to know.
WhenToUse: Read before resuming HANDOFF-PR-1.
---

# Diary

## Goal

HANDOFF-PR-1 catalogued 21 review findings and 7 failing CI jobs across three
open product PRs, wrote them up for somebody else, and stopped there. This
diary covers doing them.

The guide document (`guide/01-intern-handoff-…`) is the design doc for this
work: it carries the architecture, the per-finding mechanism, and the order.
This file carries what actually happened, which is not the same thing.

## Step 1: turboproof's Go findings — T1, T6, T7, T10

The four Go-side findings in turboproof PR #3 all live in the file API, and
three of them are the same shape at different scales: a rule the server states
and does not enforce. `Write` documents itself as a compare-and-swap and is
three unjoined steps. `--files-max-bytes` advertises a cap and a second, lower
cap rejects the file first. `FingerprintOf` operates in a store whose whole
premise is a size bound, with no size bound.

I did the Go work first rather than the frontend P1s (T2–T5), against the
order in §8 of the guide. The reason is that T1 and T6 touch the same forty
lines and T7 depends on `filestore.MaxBytes()` existing; splitting them across
two sessions would have meant reading the same file twice. The frontend P1s
are next and are genuinely independent of these.

### Prompt Context

**User prompt (verbatim):** "Work on docmgr ticket HANDOFF-PR-1 and work on it keeping a detailed diary as you work (look at the diary skill), make sure to read the relevant design doc and diaries on what has been done on them, and commit at appropriate intervals"

**Assistant interpretation:** Stop handing the 24 tasks off and work them, in
the order the guide recommends, with a diary and periodic commits.

**Inferred user intent:** The intern is a device for organising the work, not
a person who is going to arrive. Get the defects fixed.

**Commit (code):** `2f4bc82` — "T1/T6/T7/T10: make the filestore's compare-and-swap actually atomic"

### What I did

- `pkg/filestore/store.go`: added `pathLocks`, a reference-counted map of
  per-path mutexes, and held one across the whole of `Write`, `Create` and
  `Delete`, and both endpoints of `Rename` in lexical order.
- Split `FingerprintOf` into a resolving wrapper and `fingerprintAt`, which
  hashes a file as a stream. `Write` calls the latter from inside its own
  lock, because the locks are plain mutexes and re-entering one would deadlock
  exactly the save the lock was added to protect.
- Moved `Read`'s size cap off the `stat` and onto the bytes (`readBounded`).
- `pkg/filestore/fingerprint.go`: extracted `formatFingerprint` so the
  streaming and in-memory fingerprints cannot spell the format differently.
- `pkg/server/server.go`: `jsonEnvelope`, `filesContentPath` and
  `bodyLimitFor`, so the file-write route gets a body limit sized for a
  full-size file wrapped in JSON.
- `pkg/filestore/store.go`: a scoped `#nosec G302` on the `0o644` in `Create`,
  with the reasoning written out.
- Four new tests: `TestWriteSerialisesConcurrentSaves`,
  `TestFingerprintOfRefusesAFileOverTheCap`,
  `TestTheStreamingFingerprintMatchesTheInMemoryOne`,
  `TestFileWritesGetJSONHeadroom`, `TestOtherRoutesKeepTheGlobalBodyLimit`.

### Why

T1 is data loss and it is not rare — see below. T6 is a hole in the memory
bound the operator configured. T7 makes the server contradict its own flag
help. T10 was blocking CI and needed a decision rather than a suppression.

### What worked

The reference-counted lock map answers the eviction question the guide flagged
as the design problem. `map[string]*sync.Mutex` keyed by client-supplied paths
grows without bound; counting acquisitions and deleting the entry at zero
bounds the map by operations **in flight**, so an idle server holds an empty
map regardless of how many distinct files it has ever served. No timer, no
sweeper, no cap to tune.

### What didn't work

I destroyed my own T7 change while verifying it. To mutation-test I edited
`server.go` in place, ran the test, and then ran `git checkout
pkg/server/server.go` to undo the mutation — which reverted the file to HEAD,
i.e. threw away the fix as well as the mutation. The filestore mutation a few
minutes earlier had used a `cp` backup and restored correctly; I got sloppy on
the second one because the first had been easy.

The rule that follows: **restore from a backup you made, never from `git
checkout`, when the file contains uncommitted work.** `git checkout` does not
know which of the two edits you meant.

### What I learned

**The T1 race was not a window, it was the default.** I expected to need
repetition and `-race` to see it. With the lock removed, the test reported
`4 of 4 writers succeeded from one base fingerprint` on round 0 — every
concurrent save wins. The compare and the rename are separated by a `MkdirAll`,
a `CreateTemp`, a write, a `Chmod` and a `Close`; that is milliseconds of
filesystem work, so any two saves that overlap at all overlap there. Two
browser tabs on the same file would have hit this reliably, not occasionally.

**Six is the worst case for JSON escaping, not a guess.** A byte becomes at
most `\u00XX`. I nearly wrote `2x` reasoning about quotes and backslashes,
which would have held for every plausible Lean file and failed on a pathological
one — and a limit that holds only for plausible content is not a limit.

### What was tricky to build

The re-entrancy hazard in `Write`. `Write` needs the current fingerprint, and
the obvious call is `s.FingerprintOf(...)` — which is what it already did. Once
`Write` holds the path lock, that call must not take it again: Go mutexes are
not reentrant, so the save would deadlock against itself, on the happy path,
on every overwrite. The symptom would have been a hung request rather than an
error. Splitting the function into a locking wrapper and a non-locking
`fingerprintAt` makes the constraint visible at both call sites, and the
comment on `fingerprintAt` says why it must stay that way.

The second sharp edge: `fingerprintAt` streams, so it cannot call
`Fingerprint([]byte)`, so the wire format ended up written twice. That format
round-trips between the two — `Read` hands the client a `Fingerprint` of a
byte slice and the client hands it back to `Write`, which compares it against
`fingerprintAt`'s stream. One character of drift turns every save into a false
conflict. `formatFingerprint` is now the only place it is spelled, and
`TestTheStreamingFingerprintMatchesTheInMemoryOne` pins the agreement.

### What warrants a second pair of eyes

- **The lock ordering in `Rename`.** `holdBoth` sorts the two paths, which is
  the standard fix for the A→B / B→A deadlock. It is short enough to verify by
  reading, and it is the kind of thing that is wrong silently.
- **`filesBody` widens a memory bound by 6x on one route.** I believe this is
  right — `MaxBytesReader` is a transport guard and `filestore` still enforces
  the real cap on the decoded text — but it is a deliberate loosening and
  should be agreed with rather than skimmed.
- **What the locks do NOT cover**, documented on `pathLocks`: a second process
  writing the same file, and a directory rename racing a write to a file
  inside it (different keys). Both are real; neither is what two tabs do.

### What should be done in the future

- T9 (Windows URIs) is still open and is a question rather than a task.
- The per-path locks are in-process. If turboproof ever runs more than one
  server against one project directory, the fingerprint check narrows the
  window and nothing closes it. That is a design note, not a todo.

### Code review instructions

Start at `pathLocks` in `pkg/filestore/store.go` — the doc comment carries the
whole argument, including the eviction reasoning and the explicit list of what
it does not protect. Then `Write`, for the two lines that use it, and
`fingerprintAt` for the re-entrancy note.

Then `jsonEnvelope` and `bodyLimitFor` in `pkg/server/server.go`.

```bash
cd turboproof
GOWORK=off go test ./... -count=1
GOWORK=off go test ./pkg/filestore/ -count=1 -race
GOWORK=off gosec -exclude=G101,G304,G301,G306,G204 -exclude-dir=.history -exclude-dir=ttmp ./...
```

To see the defects: delete `defer s.paths.hold(full)()` from `Write` and run
`TestWriteSerialisesConcurrentSaves` (fails on round 0); delete the `size >
s.maxBytes` check in `fingerprintAt` and run
`TestFingerprintOfRefusesAFileOverTheCap`; set `filesBody: maxBody` and run
`TestFileWritesGetJSONHeadroom`. All three were verified that way.

### Technical details

The eviction scheme, which is the only non-obvious part:

```go
func (p *pathLocks) hold(path string) func() {
    p.mu.Lock()
    entry, ok := p.locks[path]
    if !ok { entry = &pathLock{}; p.locks[path] = entry }
    entry.refs++                 // registered BEFORE the contended lock
    p.mu.Unlock()

    entry.mu.Lock()              // may block; the map lock is not held
    return func() {
        entry.mu.Unlock()
        p.mu.Lock()
        entry.refs--
        if entry.refs == 0 { delete(p.locks, path) }
        p.mu.Unlock()
    }
}
```

The ordering matters: `refs++` happens under the map lock and before
`entry.mu.Lock()` blocks, so a waiter is counted while it waits and the entry
cannot be deleted out from under it.

## Related

- `guide/01-intern-handoff-…` — the findings, the architecture, the order.
- `pbui/ttmp/2026/08/03/PBUI-HARDEN-1/` — the library-side ticket several of
  these findings shadow.

## Step 2: turboproof's frontend findings — T2, T3, T4, T5, T8, T9

Six findings, five of them P1, and the thing they have in common is that none
of them looks like a bug from the outside. A rename that opens the wrong
inline field. A directory rename that leaves the tile looking fine. A save
that quietly restores the text from thirty seconds ago. A 422 that discards a
paragraph along with the mutation that deserved it. A root list that decides,
once, that this server has no roots. In every case the operation reports
success.

That is what makes them expensive: there is no error to search for, no stack
to read, and by the time the user notices, the evidence is the absence of
something. The tests below are correspondingly specific — each one names the
observation the user would eventually make.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Continue through the ticket in the guide's
order: turboproof's frontend P1s next.

**Inferred user intent:** As Step 1.

**Commit (code):** `c798f7c` — "T2-T5: the four P1 frontend findings, all of them silent data loss"; `e9de793` — "T8/T9: a failed root fetch is not an answer, and a Windows root is not a host"

### What I did

- **T2**: `state/filesTile.ts` keeps a `Map` keyed by placement instead of one
  slot; every file verb in `pbui/verbs.ts` gained `placementId`, sourced from
  the `FileRef` the row was rendered with; `FilesApp` takes `AppProps`.
- **T3**: `renameMoves` in `model/fileRefs.ts` — a rename is a prefix rewrite
  over open documents, with the file case as its degenerate form.
- **T4**: `store/renameBinding.ts` — `renameAndRebind`, which re-reads the
  document after the request resolves.
- **T5**: `slice.rejected` keeps a multi-entry batch and sets `isolating`;
  `sync.tsx` sends one mutation per request while it is set; `flushed` clears
  it when the outbox drains.
- **T8**: `state/fileRoots.ts` caches successes only, and retries a failure
  with backoff.
- **T9**: `absoluteFileUri` in `model/fileRefs.ts`.
- Tests: `filesTile.test.ts`, `descriptors/file.test.ts`, `fileRoots.test.ts`,
  `renameBinding.test.ts`, plus additions to `fileRefs.test.ts` and a rewrite
  of the `rejected` block in `seed.test.ts`. 131 pass.
- `make ui`, so the committed bundle matches the source beside it.

### Why

They are the P1 half of turboproof's review, and five of the six lose the
user's work.

### What worked

**Splitting T2 into two halves and testing both.** The routing table and the
verb's address are separate defects, and either one alone leaves the bug
standing: a perfectly keyed table routing an unaddressed verb is still a coin
flip. Testing them separately meant the mutation run could show five failures
across two files rather than one ambiguous red.

**Giving T4 a seam.** The property is "read the document AFTER the await", and
correct and incorrect code have identical types and an identical call
sequence. `renameAndRebind` takes `rename` and `currentDocument` as
parameters, so the test resolves the request with the document changed
underneath. Without that there is no honest test — only one that resolves
immediately and passes either way.

**Verifying T7 against the real binary.** A 1 MiB file of quotes — ~2 MiB once
JSON-escaped — now returns 200 through the actual server. The unit test says
the same thing, but this is the one that would have caught a middleware
ordering mistake.

### What didn't work

**The T5 test failed twice, and both failures were the test being wrong in
ways worth recording.**

First: I asserted that dropping one refused mutation leaves the outbox one
shorter. It leaves it two shorter, because the `placementSplit` queued behind
the refused `viewCreate` names a view id that no longer exists, so the replay
drops it as well. That cascade is correct — it is the outbox doing its job —
and my expectation was simply a worse description of the system than the code.

Second, and more interesting: I fed the LOCAL document back into
`rejected` while simulating the isolating loop. The local document already
contained the replayed duplicate, so replaying on top of it produced a THIRD
files tile. The real sync layer refetches the authoritative document from the
server before dispatching `rejected` — which is exactly why it does that. The
test now tracks a separate `serverDoc`, and says so in a comment, because the
mistake is easy and the symptom (a count of 3) is baffling until you see it.

**I lost an uncommitted fix to `git checkout`** — recorded under Step 1, and
this step used `cp` backups throughout.

### What I learned

**"Singleton application" and "one instance on screen" are different claims,
and the code conflated them in a comment.** `filesTile.ts` reasoned: files is
a singleton app, therefore at most one files tile exists, therefore a module
slot has one owner. The second step does not follow — a singleton VIEW can be
linked into two panes, which is what linking is FOR. The comment was
confident, specific and wrong, and it is the reason nobody looked.

**The T1 race and the T5 batch are the same mistake at different layers.**
Both take a set of things that happened to arrive together and treat that
coincidence as meaning. Two saves overlap in time, so one silently wins; one
invalid mutation shares a 400 ms debounce window with the user's typing, so
both are discarded. In each case the fix is to stop treating co-arrival as
identity.

**A percent-encoded prefix comparison is a trap I nearly walked into.**
`renameMoves` compares in (root, path) space. Comparing uris would have been
one line shorter and wrong whenever a directory name needed encoding — the
same path can encode more than one way, so the match would silently miss and
leave the document orphaned, which is the very bug being fixed.

### What was tricky to build

**T5's termination argument.** The server reports a code and never an index,
so the client cannot know which entry of a batch was refused. The obvious
fixes are both wrong: replaying the batch rebuilds what was just refused and
the flush loop sends it forever, and dropping the batch is the bug. Isolating
works because it changes the question — send one at a time, and the next 422
is unambiguous. It terminates because every 422 while isolating removes
exactly one entry, and `flushed` clears the flag on an empty outbox so
batching resumes.

The cost, which should be understood before this is approved: between the
rejection and the isolating flush that finds the offender, the local document
CONTAINS the invalid state — the duplicate tile is briefly on screen. That is
one round trip, self-correcting, and it buys back work that was previously
lost for good. I think that trade is right; it is a trade.

**T9's three shapes.** `file://` + path is correct only by accident on POSIX,
because the leading `/` reads as an empty authority. Drive letters have no
leading separator, and UNC paths have a real authority. Getting one of the
three right and the other two wrong is easy and silent.

### What warrants a second pair of eyes

- **T5's isolating window** — the transient invalid state described above.
- **`FileRef.placementId`.** Putting the placement on the presented VALUE is
  arguably impure: the same file in two panes is one file and two values. The
  alternative is the `Environment`, and pbui carries exactly one per Provider
  while the Provider wraps the whole workbench, so it cannot vary per tile.
  The value keeps `actions()` pure and the verb serialisable; the reasoning is
  on the field. If this is wrong, it is wrong in pbui's shape, not here.
- **T8's retry loop.** Backoff caps at 30s and never stops. That is right for
  a workbench meant to stay live across a server restart, and it is a timer
  that outlives every component.
- **T9 is untested against Lean on Windows** and says so in the code.

### What should be done in the future

- Nothing outstanding in turboproof: T1–T10 are all done.
- If Windows becomes a release target, verify `absoluteFileUri` against a real
  Lean server before believing it.

### Code review instructions

Start with `state/filesTile.ts` — the header explains the singleton confusion
and is the shortest route into T2. Then `model/fileRefs.ts renameMoves` (T3,
T9) and `store/renameBinding.ts` (T4). `slice.rejected` (T5) is the one to
read slowly; its doc comment carries the termination argument.

```bash
cd turboproof/ui && pnpm exec vitest run && pnpm exec tsc --noEmit
cd .. && make ui && GOWORK=off go test ./... -count=1
```

To see each defect, revert the fix and run the named test:

| finding | revert | test that goes red |
|---|---|---|
| T2 | route to the last-registered handler | `filesTile.test.ts` (3), `descriptors/file.test.ts` (2) |
| T3 | drop the `startsWith(from + "/")` branch | `fileRefs.test.ts` (3) |
| T4 | read `currentDocument()` before the await | `renameBinding.test.ts` (4) |
| T5 | `slice(action.payload.count)` unconditionally | `seed.test.ts` (2) |
| T8 | `cached = []` in the catch | `fileRoots.test.ts` (3) |
| T9 | `file://${encodePath(root.path)}` | `fileRefs.test.ts` (1) |

All six were verified this way.

### Technical details

The two halves of T2, which is the part worth copying elsewhere:

```ts
// the address, on the value the row presented
verb: { kind: "renameFile", placementId: file.placementId, nodeId: file.nodeId }

// the table, keyed by the same thing
export function performFileVerb(verb: FileVerb): void {
  handlers.get(verb.placementId)?.(verb);
}
```

The disposer checks identity before deleting, because React mounts the next
instance before unmounting the previous one under StrictMode:

```ts
return () => {
  if (handlers.get(placementId) === next) handlers.delete(placementId);
};
```

Without that, the stale disposer removes the live registration and the tile
silently stops responding to its own menu — a failure indistinguishable from
the bug being fixed.
