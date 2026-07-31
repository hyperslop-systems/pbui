---
Title: 'Phase 3 diary: the protocol client layer'
Ticket: PBUI-UNIFY-001
Status: active
Topics:
    - pbui
    - frontend
    - design
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/workbench-protocol/src/client/apply.ts
      Note: The ported local applier (Go-authoritative semantics)
    - Path: repo://packages/workbench-protocol/src/client/builders.ts
      Note: Verb builders, query helpers, ClientConfig factory
    - Path: repo://packages/workbench-protocol/scripts/generate-fixtures.mjs
      Note: Regenerates the parity corpus through the TS applier
    - Path: repo://pkg/workbench/parity_fixtures_test.go
      Note: The Go half of the cross-language parity suite
ExternalSources: []
Summary: 'Implementation diary for Phase 3 of PBUI-UNIFY-001: porting the turboproof/agentlogic workbench mutation layer into @hyperslop-systems/workbench-protocol/client with a ClientConfig factory, and building the 26-fixture TS<->Go applier parity corpus asserted from both languages.'
LastUpdated: 2026-07-31T13:10:00-04:00
WhatFor: Records how the TypeScript mutation layer was extracted, which TS<->Go semantic differences were found and how they were resolved (Go authoritative), and how to regenerate and review the parity fixtures.
WhenToUse: Read when reviewing the Phase 3 changes, when adding a mutation arm to either applier, or when regenerating fixtures/mutations.
---

# Diary

## Goal

Create `@hyperslop-systems/workbench-protocol/client` — the shared, React-free TypeScript workbench-document mutation layer (local applier + verb builders + snapRatio) extracted from the per-product copies in turboproof and agentlogic, with product constants (source-binding key, launcher app id, bindable-document sniffing) moved into a `ClientConfig` factory. Then pin TS<->Go applier equivalence with one fixture corpus (`packages/workbench-protocol/fixtures/mutations/*.json`) asserted by tests in BOTH languages, per design DR-U5 / section 5.3 of the intern guide.

## Step 1: Port the mutation layer into `src/client/` with a ClientConfig factory

The first step was reading the three sources of truth side by side: turboproof's `ui/src/store/workbench.ts` (the superset TS copy), agentlogic's older copy (a diff confirmed the applier sections are byte-identical; turboproof only adds `linkViewIntoPlacement`, `splitWithApp`, and the binding-defaulting logic), and pbui's Go applier `pkg/workbench/mutation.go`. That reading surfaced real semantic drift between the TS copies and Go before any code was written, which shaped the port: the shared applier follows Go (the server is authoritative), not the historical TS behavior.

The port produced three source files plus an index under `packages/workbench-protocol/src/client/`, wired a `./client` export into the package, and bumped the package to 0.2.0.

### Prompt Context

**User prompt (verbatim):** "do the ticket, you can use subagents"

I am the Phase-3 subagent of that run: the orchestrator delegated Phase 3 of PBUI-UNIFY-001 to me with detailed instructions (read the design doc sections 4/5.1/5.3/6, create the client subpath, strip product constants into a `ClientConfig`, build cross-language parity fixtures, keep this diary, do not commit).

**Assistant interpretation:** Extract the pure TS mutation layer into `workbench-protocol/src/client/` exactly per DR-U5, with `createWorkbenchClient(config)` for the config-dependent verbs and plain exports for the rest.

**Inferred user intent:** Stop the per-product copy drift by making "the same applier" an import, and make TS<->Go applier divergence a build break instead of a runtime 422.

### What I did

- Read the design doc (sections 2-6), turboproof's and agentlogic's `store/workbench.ts` (diffed them), `pkg/workbench/{mutation,model,errors,workbench_test}.go`, and the protocol package's `package.json`/`tsconfig.build.json`/existing `index.test.ts` (which documents the cwd-relative-fixture-path rule).
- Created `src/client/apply.ts`: `applyMutation` (clone-then-mutate, like both sources) covering **all 15 Go mutation arms**, not just the 9 the product copies had — including `workspaceCreate/Rename/Delete`, `viewClone`, `viewClose`, and a validating `documentDelete`. Errors are a structured `MutationError { code, path }` reusing the Go applier's exact error-code strings (`duplicate_id`, `unknown_view`, `invalid_position`, ...), so fixtures can assert the error class from both languages. Also `applyMutations` (batch, no validation) and private ports of Go's `removePlacement` (tuple-return shape), `removeViewPlacements`, `countViewPlacements`, `removeViewRecord`.
- Created `src/client/builders.ts`: `newId`, `leafNode`, `splitNode`; query helpers `findNode`, `leaves`, `viewsOfApp`, `placementCount`, `workspaceOfPlacement`, `workspaceTree`, plus `boundDocumentId(view, binding)` generalized to take the binding key. Config-independent verbs as plain exports: `splitPlacement(doc, placementId, direction, appId)` (app id is now a parameter — the source hard-coded `"launcher"`), `closePlacement`, `swapPlacements`, `dockPlacement` (+ `DockZone`), `resizeSplit`. Then `ClientConfig { sourceBinding, launcherAppId, isBindableDocument? }` and `createWorkbenchClient(config)` returning the config-dependent verbs: `boundDocumentId`, `defaultSourceDocumentId`, launcher-bound `splitPlacement(doc, id, direction)`, `replaceApp`, `linkViewIntoPlacement`, `splitWithApp`.
- Generalized turboproof's `defaultSourceDocumentId`: first follow a document some existing view already binds under `config.sourceBinding` (and which exists in `doc.documents`), else the first document for which `isBindableDocument(payload)` returns true (default: any document). This replaces the turboproof-specific `leanSourceOf` format sniff.
- Created `src/client/ratios.ts` (`SNAP_RATIOS`, `SNAP_TOLERANCE`, `snapRatio`) and `src/client/index.ts` re-exporting all three.
- Package wiring: `package.json` version 0.1.0 → 0.2.0, added `"./client": { types: "./dist/client/index.d.ts", import: "./dist/client/index.js" }` to `exports`. `tsconfig.build.json` needed no change: it includes `src/**/*.ts` and already excludes `src/**/*.test.ts`, so `dist/client/` builds test-free (verified by listing `dist/client`).
- `pnpm build` — clean on the first run.

### Why

- **Go-authoritative semantics (requirement 7 and DR-U5):** a mutation the client applies but the server 422s breaks the outbox contract. Where TS and Go disagreed (details in "What I learned"), the port takes Go's behavior.
- **All 15 arms instead of 9:** parity is supposed to be ONE test surface. Implementing only the arms the current UIs emit would leave `viewClone`/`viewClose`/workspace mutations forever "not this client's business" and reintroduce drift the day a product needs them. The extra arms are small, pure, and covered by fixtures.
- **`MutationError` with Go's codes:** lets rejection fixtures assert *which* rejection, not just "it threw", pinning error-class parity too.
- **Plain `splitPlacement` takes `appId`:** the orchestrator's design listed `splitPlacement` as config-independent, but the source version mints a `"launcher"` view. Making the app id a parameter keeps the plain export truly config-free; the factory provides the launcher-bound convenience with the original 3-argument signature.

### What worked

- The agentlogic-vs-turboproof diff confirmed the applier sections are identical, so a single port covers both products.
- `pnpm build` and `pnpm typecheck` passed on the first attempt; the generated schema names (`DocumentBindingsSchema`, oneof cases `setTitle`/`clearTitle`, `rootPlacement`, `fallbackViewId`) were verified by grep against `workbench_pb.ts` before writing, which avoided a compile-fix loop.

### What didn't work

- Nothing failed at the command level in this step — every build/typecheck run passed first try. The honest caveat: that is because the failure-prone part (schema field names, oneof case names, the vitest `import.meta.url` quirk) was checked by reading before writing, and because the "what didn't work" here lives in the *sources*: the TS copies' semantics silently disagreed with Go in four places (next section), which is precisely the drift this phase deletes.

### What I learned

The TS product copies and the Go applier genuinely disagreed. Per requirement 7 these are recorded precisely; **in every case the shared applier now follows Go**:

1. **Whitespace trimming.** Go trims `workbenchRename.name`, `workspaceCreate/Rename.name`, `viewConfigure.appId`, and `setTitle` values (`strings.TrimSpace`); the TS copies stored them verbatim. The port trims. (Residual edge: `strings.TrimSpace` and JS `String.prototype.trim` differ on exotic whitespace — U+0085 NEL is trimmed by Go but not by JS. Fixtures use ASCII padding; noted, not solved.)
2. **`placementSplit` with `PLACEMENT_POSITION_UNSPECIFIED`.** Go rejects it (`invalid_position`); the TS copies' ternary (`place === BEFORE ? ... : ...`) silently treated it — and any unknown enum value — as AFTER. The port rejects, and `reject-placement-split-unspecified-position.json` pins it.
3. **`documentDelete`.** Go errors on an unknown document (`unknown_document`) and on a document still referenced by any view binding (`document_in_use`); the TS copies deleted unconditionally. The port validates both; `reject-document-delete-bound.json` pins it.
4. **`documentPut` aliasing.** Go clones the incoming payload; the TS copies stored the caller's object by reference (a later caller-side edit would mutate the store). The port clones.
5. **Coverage.** The TS copies implemented 9 of Go's 15 arms and threw "not one this client applies" for the rest; the port implements all 15.

Also: Go's `removePlacement` recurses into *both* children (removing every match), the TS copies short-circuit on the first; identical on valid trees (node ids are unique) so the port keeps Go's shape for faithfulness rather than behavior.

### What was tricky to build

- The `ClientConfig` boundary. `linkViewIntoPlacement` looks config-independent but isn't (it garbage-collects *launcher* views), while `closePlacement` looks product-y but isn't (pure placement-count logic). The rule that settled it: a verb goes in the factory iff its behavior reads `sourceBinding`, `launcherAppId`, or bindability; everything else is a plain export.
- Choosing the error contract. Plain `Error` (the sources) would have made rejection fixtures assert only "threw"; duplicating Go's `ValidationError` shape as `MutationError` cost ~15 lines and bought code-level assertions in both languages.

### What warrants a second pair of eyes

- **The trimming alignment is a behavior change for agentlogic/turboproof** once they migrate onto this package (Phase 4): a rename to `"  x  "` now stores `"x"` locally, as the server always did. This *removes* a local/server disagreement, but reviewers should confirm no product test depends on untrimmed local state.
- **`viewConfigure.appId` semantics:** protobuf-es gives `appId: string | undefined` for the optional field; the port (like the sources) treats `undefined` as "leave unchanged" and any present string (including `""`) as an overwrite, matching Go's `value.AppId != nil` check. Worth a glance from someone who knows whether any caller sends `""` deliberately.
- The `isBindableDocument` default of "any document" — turboproof will pass its lean-source sniff explicitly; a product that forgets the predicate binds the first document of *any* format. That is the documented default, but it is a foot-gun of the permissive kind.

### What should be done in the future

- Phase 4: agentlogic and turboproof delete their `store/workbench.ts` applier+builders and import from `@hyperslop-systems/workbench-protocol/client`, constructing `createWorkbenchClient({ sourceBinding: "source", launcherAppId: "launcher", isBindableDocument: leanSource sniff })` (turboproof) / their equivalents.
- When a new mutation arm lands in the proto: implement in `pkg/workbench/mutation.go` AND `src/client/apply.ts`, add a fixture entry to `scripts/generate-fixtures.mjs`, regenerate, and both parity suites enforce it.
- Consider exporting a `defaultWorkbench`-style seeded-document helper later; it was deliberately left in the products (it is product content, like the runtime file).

### Code review instructions

- `packages/workbench-protocol/src/client/apply.ts` — diff arm-by-arm against `pkg/workbench/mutation.go` (they are ordered the same way) rather than against turboproof's copy; the four deliberate divergences from the TS sources are listed above.
- `packages/workbench-protocol/src/client/builders.ts` — diff against turboproof `ui/src/store/workbench.ts` lines 353-636; the only intended changes are the config parameterization and `splitPlacement`'s `appId` argument.
- Verify: `cd packages/workbench-protocol && pnpm build && pnpm typecheck && pnpm vitest run`.

### Technical details

- New files: `src/client/{apply,builders,ratios,index}.ts`; modified: `packages/workbench-protocol/package.json` (version 0.2.0, `./client` export).
- The client subpath imports types via `../index.js` (the package root), so `dist/client/*.js` resolves against `dist/index.js` without a second copy of the generated code.

## Step 2: The cross-language parity corpus and both test suites

With the applier ported, the second half was making DR-U5's promise real: one fixture directory, asserted from both languages. The corpus is *generated through the TS applier* (a deliberate choice — hand-writing 26 expected documents would itself drift) and then *verified against Go* by a test that runs the pure `applyMutation` on the same files.

Everything passed on the first cross-language run, which is the actual result of Step 1's alignment work: had the port kept the TS copies' semantics, `workbench-rename-trims`, `reject-placement-split-unspecified-position`, and `reject-document-delete-bound` would all have failed on the Go side.

### Prompt Context

**User prompt (verbatim):** "do the ticket, you can use subagents"

(As above — I am the Phase-3 subagent; this step covers the orchestrator's requirements 3-6: fixtures, TS parity test, Go parity test, everything green.)

**Assistant interpretation:** Build ≥10 protojson fixtures `{name, document, mutation, expected}` (rejections as `{error: true, errorCode}`), round-tripped through the TS applier first, then asserted by `src/client/applierParity.test.ts` (cwd-relative reads) and a new `pkg/workbench/parity_fixtures_test.go` using the lowest-level pure Go applier.

**Inferred user intent:** Make "adding a mutation arm" a two-implementations-one-fixture workflow where either side failing the shared fixture is a build break.

### What I did

- Wrote `packages/workbench-protocol/scripts/generate-fixtures.mjs`: 26 fixture definitions as protojson literals (a shared base document — one workspace, `split-root` over `placement-a`/`placement-b`, views `view-chart`+`view-launcher`, one payload `document-1` — plus single-leaf / two-workspace / unused-document variants). Each literal is parsed with `fromJson(..., { ignoreUnknownFields: false })` (strict, so typos in the literals fail generation), applied via the built `dist/client` applier, and written with `expected = toJson(...)`. Rejection fixtures assert the thrown `MutationError.code` during generation and are written with `{ "error": true, "errorCode": ... }` instead of `expected`.
- Corpus coverage (26 files): every green arm — workbenchRename (trim-pinning), workspaceCreate/Rename/Delete, documentPut, documentDelete-unused, viewCreate, viewConfigure (appId+replaceDocuments, setTitle-trims, clearTitle), viewClone, viewDelete, viewClose (collapse-to-sibling and emptied-tree-gets-fallback-leaf-keeping-root-id), placementReplace, placementSplit BEFORE and AFTER, placementClose (parent-split collapse), splitResize — plus 7 rejections: duplicate view id, view still placed, last placement, UNSPECIFIED split position, bound document delete, last workspace, unknown split.
- `src/client/applierParity.test.ts`: reads `fixtures/mutations` **cwd-relative** (the package's vitest quirk: never `new URL(import.meta.url)` — the existing `index.test.ts` documents the same rule), strict-parses document+mutation, asserts `toJson(apply(...))` deep-equals `expected`, asserts rejections throw `MutationError` with the fixture's code, and additionally asserts the input document is never mutated. Also a guard that the corpus has ≥10 entries.
- `src/client/client.test.ts`: 13 behavior tests for the factory and config-independent verbs (defaultSourceDocumentId follows-the-crowd and bindability fallback, replaceApp's three cases, splitWithApp binding, launcher GC in linkViewIntoPlacement, closePlacement view deletion, swap/dock/resize, snapRatio).
- `pkg/workbench/parity_fixtures_test.go` (package `workbench`, so it reaches the unexported pure `applyMutation` — deliberately below `ApplyMutations`, whose `Validate` pass needs a catalog and is not what the TS layer mirrors): reads `../../packages/workbench-protocol/fixtures/mutations`, strict `protojson.Unmarshal`, `Clone` + `applyMutation`, `proto.Equal` against the expected document; rejections assert `ValidationError.Code == errorCode`. Fails if fewer than 10 fixtures are found.
- Green runs: `pnpm build` (clean), `pnpm typecheck` (clean), `pnpm vitest run` → **3 files, 43 tests passed** (27 parity incl. the corpus-size guard, 13 client, 3 preexisting schema tests). `go test ./pkg/workbench/...` → **ok**, with `-run TestApplierParityFixtures -v` confirming **26/26 subtests PASS**. `gofmt -l pkg/workbench/` → no output.

### Why

- **Generator instead of hand-written expected documents:** the expected side must be exactly what the TS applier produces, or the suite tests the fixture author instead of the applier. Generating through TS and asserting from Go is the "round-trip TS first, verify against Go" order the orchestrator required.
- **Pure `applyMutation` on the Go side, not `ApplyMutations`:** the batch API validates the whole graph against an `ApplicationCatalog`/`DocumentValidator`; the TS layer deliberately does not mirror that pass (documented in `apply.ts`'s header). Testing at the same altitude on both sides is what makes "JSON-equal" meaningful. Using the in-package unexported function also avoided inventing permissive catalog fakes for fixtures whose app ids ("chart", "table", "launcher") are corpus-local.
- **`proto.Equal` instead of byte comparison in Go:** protojson output formatting (key order, spacing) differs between languages; message equality is the actual contract.
- **`errorCode` in rejection fixtures:** `{"error": true}` alone would pass if both sides rejected for *different* reasons; the code pins the reason.

### What worked

- The entire cross-language suite passed on the first execution — 26/26 in Go and 27/27 in TS — because the semantic alignment was done by source-reading in Step 1 rather than debugged through fixture failures.
- The strict `fromJson`/`protojson` parses caught nothing, i.e. the protojson literals (enum names `DIRECTION_ROW`, `PLACEMENT_POSITION_AFTER`, oneof field names) were written correctly against the schema grep from Step 1.

### What didn't work

- No command failed in this step either; recording that honestly rather than inventing drama. Two anticipated failure modes that were designed around, so they never fired: (a) the vitest `import.meta.url` quirk — the generator (plain node, where `import.meta.url` works fine) uses it, the vitest test uses cwd-relative paths only; (b) UNSPECIFIED-position encoding — protojson omits a zero-valued enum field, so the rejection fixture simply omits `place`, and both parsers agree it is UNSPECIFIED.

### What I learned

- Go's `viewClose` fallback shape is subtle and now pinned by `view-close-empty-tree-gets-fallback.json`: when a workspace tree empties entirely, the replacement leaf keeps the *old root node's id* (Go captures `rootID` before removal). A naive port that minted a fresh id would produce an id-diverging document that only a cross-language fixture would ever catch.
- `placementSplit`'s "target BECOMES the split, its copy moves down keeping its id" shape means the fixture's expected tree has the *same* placement id one level deeper — both appliers agree because both were written to that shape deliberately (the turboproof comment says as much).
- protobuf-es `toJson` and Go `protojson` agree on omission of empty maps/default scalars, so `toEqual`-on-JSON (TS) and `proto.Equal` (Go) are equivalent assertions for this corpus.

### What was tricky to build

- Fixture-document minimalism vs. arm coverage: one base document couldn't serve `viewDelete` (needs an unplaced view), `workspaceDelete` (needs two workspaces), or `documentDelete` (needs an unbound document). Three small variants (`singleLeafDocument`, `twoWorkspaceDocument`, `unusedDocumentDocument`) built by object spread over the base keep every fixture readable while staying at 2 views / 1-2 workspaces.
- Keeping the corpus honest about what it does NOT cover: applier-level fixtures cannot express `ApplyMutations`' post-batch validation (limits, catalog, credential sniff). The Go test's doc comment states this explicitly so nobody mistakes green parity for full server acceptance.

### What warrants a second pair of eyes

- **Fixture path coupling:** `pkg/workbench/parity_fixtures_test.go` reaches into `packages/workbench-protocol/fixtures/mutations` by relative path (same pattern as the existing `TestSharedFixtures` → `contracts/`). If the package ever moves, the Go test breaks loudly (ReadDir error), which is intended — but a reviewer should bless the direction of the dependency (Go tests reading from the npm package dir).
- **Fixtures are not shipped in the npm tarball** (`files: ["dist"]`). Intentional — they are a repo-internal test contract like `contracts/` — but if a downstream consumer ever wants to run parity against its own fork of the applier, shipping them would need a `files` addition.
- The corpus asserts single mutations only; multi-mutation batches (e.g. dock = split+close) are covered behaviorally in `client.test.ts` via `applyMutations` but not cross-language. If batch-order semantics ever matter server-side, add batch fixtures.

### What should be done in the future

- Wire `node scripts/generate-fixtures.mjs` into a CI check (regenerate + `git diff --exit-code fixtures/`) the way `gen/go` is checked in `ci.yml`, so the corpus cannot go stale against the TS applier.
- When agentlogic/turboproof adopt the package (Phase 4), delete their local applier tests that this corpus supersedes.

### Code review instructions

- Regenerate and confirm stability: `cd packages/workbench-protocol && pnpm build && node scripts/generate-fixtures.mjs && git diff -- fixtures/` (should be empty).
- Run both halves: `pnpm vitest run` (43 tests) and, from the repo root, `go test ./pkg/workbench/ -run TestApplierParityFixtures -v` (26 subtests).
- Read `reject-placement-split-unspecified-position.json` and `workbench-rename-trims.json` first — they are the fixtures that encode the TS-copies-vs-Go divergences and would have failed before this port.

### Technical details

- New files: `packages/workbench-protocol/fixtures/mutations/*.json` (26), `packages/workbench-protocol/scripts/generate-fixtures.mjs`, `packages/workbench-protocol/src/client/{applierParity,client}.test.ts`, `pkg/workbench/parity_fixtures_test.go`.
- Fixture shape: `{ "name", "document", "mutation", "expected" }` protojson; rejections `{ "name", "document", "mutation", "error": true, "errorCode" }`.
- Test counts: TS 43 passed (3 files); Go `ok` with 26 parity subtests; `gofmt -l` clean; `pnpm build`/`typecheck` clean; nothing committed (orchestrator commits).
