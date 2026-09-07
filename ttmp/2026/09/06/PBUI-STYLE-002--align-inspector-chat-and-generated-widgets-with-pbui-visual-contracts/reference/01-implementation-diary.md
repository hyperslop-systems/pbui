---
Title: Implementation diary
Ticket: PBUI-STYLE-002
Status: active
Topics:
    - pbui
    - frontend
    - design
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: ""
LastUpdated: 2026-09-06T20:52:52.92870571-04:00
WhatFor: ""
WhenToUse: ""
---

# Diary

## Goal

Implement the seven source-backed visual alignment candidates without changing domain contracts: inspectors/devtools; chat references; generated callouts; operational tiles; proposal/tool cards; select controls. Keep evidence, tested commits, and physical plan/start/done receipts in this ticket.

## Step 1: Ticket, physical plan and baseline

Created PBUI-STYLE-002 and grouped the work into three phases: P1 inspectors/devtools; P2 chat references, severity and cards; P3 operational panels, selects and integrated acceptance. Printed the overall plan and P1 START before implementation. Both commands reported `printed: yes`; receipts and generated layouts are under `various/slips/`.

Built current sandbox/chat Storybooks and ran their baseline typechecks and tests. Captured coordination, the running sandbox devtools, playground and pending proposal before edits. The sandbox fixture runs a local synthetic Counter program; it has no production service.

### Prompt Context

**User prompt (verbatim):** "Create a new ticket, implement, commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill). Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done."

**Assistant interpretation:** Implement the previously identified styling candidates in a new ticket with phased commits, detailed diary entries and physical receipts before/after each phase.

**Inferred user intent:** Turn the visual shortlist into reviewed, traceable improvements rather than another report.

### What I did
- Created ticket and three tasks; printed `01-plan` and `02-p1-start` via the skill's `work_slip.py`.
- Baseline: sandbox 224 tests/18 files; chat 241 tests/25 files; both typechecks and Storybook builds passed.
- Started owned loopback static servers in tmux `pbui-style002-sandbox` (16012), `pbui-style002-chat` (16013); reused existing workbench server 16011.
- Captured four baseline PNGs at viewport 1200×800. Workbench uses the previously built bdc2dca-era artifact; sandbox/chat were rebuilt this step.

### Why
- Separate behavior-bearing references and severity mappings from cosmetic recipes; compare real bounded fixtures rather than infer rendered correctness from token usage.

### What worked
- Existing Visual Audit stories already cover the running inspector/REPL/timeline; no new runtime mock was necessary.
- Physical printing succeeded before P1 implementation.

### What didn't work
- Playwright tool dynamic import failed: `TypeError [ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING]: A dynamic import callback was not specified.` Retried using only the supplied page object; captures succeeded.
- Guessed file reads returned `ENOENT` for `InspectorTile/InspectorTile.stories.tsx`, `components/layout/SectionLabel/SectionLabel.tsx`, and `ConnectionInspector/ConnectionInspector.test.tsx`. File discovery located the shared VisualAudit story and SectionLabel in foundation/Text.

### What I learned
- Inspector highlight is transient cross-view hover, not a persisted selection; do not describe or style it as durable selected state.
- SectionLabel is exported from Text, not a separate component folder.

### What was tricky to build
- A generic playground capture did not contain the inspector. Located `visual-audit-sandbox-devtools--all-devtools`, switched the inspector to tree mode, and captured that actual running state separately.

### What warrants a second pair of eyes
- Retain reference focus/activation semantics and user-supplied block/custom bodies in P2. Narrow tables must preserve all information rather than hide columns silently.

### What should be done in the future
- Complete all three phases and their start/done prints; verify awkward widths and collect a hashed screenshot catalogue.

### Code review instructions
- Start with the existing visual-style guide and phase tasks. Reproduce baseline with `pnpm --filter @hyperslop-systems/pbui-sandbox test` and the equivalent pbui-chat command.

### Technical details
- Story IDs: `visual-audit--coordination-inspector-content`, `visual-audit-sandbox-devtools--all-devtools`, `sandbox-devtools--playground`, `pbui-chat-proposalcard--pending`.
- Baseline logs: `/tmp/pbui-style002-{sandbox,chat}-baseline.log`; Storybook logs similarly named `*-story.log`.

## Step 2: P1 inspector density and bounded devtool controls

Aligned the coordination inspector with the shared small/tiny type scale, structural SectionLabel headings, hair/grid separators and wrapping fixed-layout tables. The sandbox inspector now delegates its scrolling region to AppBody; its square tree rows distinguish a cross-view hover target with a neutral edge rather than pretending it is a durable selection. Timeline/REPL separators now use the internal-grid role.

Added narrow native-coordination and running-devtool stories. Browser measurements caught a shared TextArea sizing bug: 100% content width plus padding/borders widened the REPL by six pixels. Fixed border-box sizing in the atom instead of hiding overflow in the REPL. Narrow/wide REPL widths now equal scroll widths (278/580px respectively), and firing increment still updates the actual Counter to 1.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Complete P1 with behavior-preserving shared recipes, real narrow captures and a tested checkpoint.

**Inferred user intent:** Establish a visibly coherent, bounded inspector/devtool family.

**Commit (code):** cf4cf5a — "style: align inspector density and bound devtool controls"

### What I did
- Changed CoordinationInspector CSS/headings; added two behavior tests and a narrow linked-workbench story.
- Changed InspectorTile AppBody/tree marker, TimelineTile separators, ReplTile bounded help/separators, and TextArea border-box sizing.
- Extended the existing running devtool grid rather than duplicating host setup; corrected its stale fallback border token.
- Ran core 868 tests/52 files, workbench 139/32 and sandbox 224/18; workbench/sandbox typechecks; core production build and both Storybook builds.
- Compared 1200×800 captures. Coordination at 275px had equal client/scroll widths; sandbox inspector/timeline/REPL at 278px remained bounded.

### Why
- Preserve native coordination facts and sandbox evaluation behavior while reducing visual recipes and handling small allocations correctly.

### What worked
- All final tests passed; native show-wiring action remains available; running sandbox increment still changes Counter state.
- The existing inspector tests continue to cover apply/reset, hover, fire and instance resolution.

### What didn't work
- Initial new workbench test: `AssertionError: expected null to be truthy` at `CoordinationInspector.test.tsx:26`, querying nonexistent `[data-part="wiring-scene"]`. Used the actual `[data-part="tile-frame-overlay"]` from the established wiring mount tests; both new tests pass.
- First post-fix browser rebuild still showed 284px scroll width in a 278px REPL. Sandbox consumes core dist; rebuilding only sandbox did not consume the edited atom. Ran `pnpm build` in core, then rebuilt sandbox Storybook; width became 278/278. Pre-fix screenshots are retained separately.
- A guessed TextArea test path returned ENOENT; existing core suite and browser geometry provided current coverage.

### What I learned
- A package-local Storybook rebuild is not sufficient after editing a dependency consumed from dist.
- The REPL help needs a bounded scroll region to leave the explicit input/run controls reachable at short heights.

### What was tricky to build
- Apparent REPL overflow originated in the shared textarea, not the REPL's flex body. DOM bounding boxes isolated the escaping textarea; border-box fixed both horizontal overflow and the scrollbar's lost vertical space. No clipping workaround was added.

### What warrants a second pair of eyes
- Fixed-layout coordination columns deliberately wrap labels/identifiers. Review legibility for unusually long real port titles.
- Core TextArea sizing affects every consumer; final acceptance reruns downstream suites.

### What should be done in the future
- P2/P3 remain; preserve the narrow stories and reproduce geometry after dependency rebuilds.

### Code review instructions
- Start at CoordinationInspector and InspectorTile, then TextArea.module.css. Compare `devtools-narrow-before-textarea-fix.png` with `devtools-narrow.png`.
- Run `pnpm test`, `pnpm --filter @hyperslop-systems/pbui-workbench test`, and sandbox equivalent. Rebuild core before downstream Storybooks.

### Technical details
- Capture IDs: `workbench-coordinationinspector--narrow`, `visual-audit-sandbox-devtools--narrow-devtools`.
- P1 logs: `/tmp/pbui-style002-p1-{core,workbench,sandbox}.log`, `*-core-build.log`, `*-wb-story.log`, `*-sb-story.log`.

## Step 3: P2 object references, cards and severity

Default inline chat references now use the product's ObjectChip, with the original wire label, focus capture, documentation and activation forwarding intact. Custom children and block references remain presentations rather than being coerced into chip labels. Composer, watchlist and widget reference collections no longer redraw the same Chip recipe; a badge slot preserves their existing type metadata.

ProposalCard now has one shared Surface frame, a Toolbar header and KeyValueList facts. ToolCard also composes Surface/Toolbar. The proposal remains an interactive group rather than a Callout live region, and its explicit decision controls remain unchanged. Generated sandbox danger notices now retain danger styling and alert semantics instead of becoming warnings.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement P2 without changing reference behavior, wire schema or proposal decision ownership.

**Inferred user intent:** Reuse shared visual components while keeping meaningful interaction and severity distinctions.

**Commit (code):** 5e4970e — "style: compose chat object chips cards and semantic notices"

### What I did
- Added four RefPresentation regression cases for default chip, focus/click/Enter, custom inline/block bodies and default block behavior.
- Added two proposal decision cases including disabled state/reasons and exact large decimal strings.
- Added five generated severity cases: omitted/neutral → info, positive → ok, warning → warning, danger → danger/alert.
- Added reference, tool-card, narrow proposal and generated-notice stories; captured six figures including the actual clicked approved state.
- Chat: 247 tests/27 files; sandbox: 229/18; both typechecks and Storybook builds passed.

### Why
- Product-bound ObjectChip owns object identity appearance; inert Chip still owns state markers. A proposal is not a passive announcement, so using Callout merely to borrow its border would change semantics.

### What worked
- Chat regression suite passed on the first P2 run. New activation test confirms click and Enter invoke the host exactly once each.
- Browser narrow proposal and tool-card client/scroll widths match at 275px; all four generated notices are bounded, and danger has role alert.
- Clicking Approve in the seeded story disabled both decision buttons.

### What didn't work
- Initial sandbox fixture incorrectly used core's `info` as a wire variant. Typecheck reported `error TS2322` and `Type '"info"' is not assignable to type 'UICalloutVariant | undefined'.` Read the contract and changed fixture/test input to `neutral`; did not widen the wire contract.
- Static chat fixtures attempt `PATCH /api/chat/sessions/story`, receiving `501 (Unsupported method ('PATCH'))` from the loopback Python server; this was also present during baseline capture. Auto-connect off does not mean zero metadata HTTP. Favicon requests produce 404. No successful backend operation is claimed.
- Capture viewport dimensions changed between navigations during the first batch. Recaptured all P2 figures with an explicit 1200×800 resize immediately before capture; final dimensions are recorded in the catalogue.

### What I learned
- A shared ObjectChip can preserve wire-specific label resolution by supplying the existing label as its text child; arbitrary JSX must stay on the custom Presentation branch.
- Core callout vocabulary and sandbox wire vocabulary intentionally differ at neutral/positive; severity translation is a typed boundary.

### What was tricky to build
- Replacing every RefPresentation body would have turned JSX into ObjectChip text and broken block rendering. Limited default substitution to non-block nullish children, factored common forwarding props, and tested the untouched paths explicitly.

### What warrants a second pair of eyes
- Default reference tone now comes from the bound product presentation rather than local chat tone reconstruction; inspect unusual custom product descriptors.
- Proposal exact fields are display strings, not numeric conversions. Its local callback fixture does not prove backend approval authorization.

### What should be done in the future
- Complete P3 and final dependency rebuilds. Separately isolate DemoChat metadata persistence if completely network-silent stories are required.

### Code review instructions
- Start with RefPresentation's default/custom branch and its tests, then the three simplified call sites. Review ProposalCard's single Surface and KeyValueList before comparing screenshots.
- Run chat/sandbox typecheck and tests; open `pbui-chat-proposalcard--narrow-long-fields` and `sandbox-generated-notices--severity-matrix`.

### Technical details
- P2 logs: `/tmp/pbui-style002-p2-{chat,sandbox}.log` and corresponding `*-story.log`.
- Receipts `03-p1-done` and `04-p2-start` both reported `printed: yes` before P2 implementation.
