---
Title: Investigation diary
Ticket: PBUI-KERNEL-1
Status: active
Topics:
    - pbui
    - actions
    - design
    - architecture
    - frontend
    - onboarding
    - refactoring
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://src/presentation/createPbui.tsx
      Note: Context value, engine construction, accept state, returned instance read with nl -ba
    - Path: repo://src/presentation/help/machine.ts
      Note: Invariants quoted for D9
    - Path: repo://src/presentation/index.ts
      Note: The export surface read first; the four-resolvers framing
ExternalSources: []
Summary: 'Chronological record of the PBUI-KERNEL-1 analysis: how the presentation kernel was mapped part by part, how the six consumers and the seven prior tickets were surveyed for duplication and open backlog, and how the consolidation guide was produced and delivered.'
LastUpdated: 2026-09-02T14:45:00-04:00
WhatFor: Continue or review the kernel consolidation analysis without re-deriving the evidence.
WhenToUse: Before starting Phase 0 of the guide, or when checking why a decision cites a file or a prior ticket.
---


# Diary

## Goal

Capture how the whole presentation kernel was mapped (references, descriptors, graph, facts, the four resolvers, the runtime, the page protocol), how consumer wiring and prior-ticket backlogs were gathered as evidence, and how the consolidation design and its decision records were derived, validated and uploaded.

## Step 1: Map the kernel, survey consumers and prior tickets, write the guide

The request came after two review conversations on PBUI-FACETS-1 in which the user asked what registries exist besides actions and what each declaration (graph, scopes, predicates, descriptors, contributions, translators, help) is for. The answers showed a pattern: four sound resolvers, one runtime, and a product-facing declaration assembled by hand in every product with the same shape and different literals. The user then asked for a separate ticket to analyze, design and rethink the kernel as a whole.

The investigation had two halves. I read the core layer myself with line anchors: the export surface, the context value and returned instance of `createPbui`, the engine construction and accept state, the escape-surface stack and focus helpers, the help machine's header and events, the registry's validation, the id helpers, the vocabulary generator, and the Presentation props. In parallel, an explorer agent surveyed every consumer's wiring (datalab-ui, the chat demo, workbench fragments, sandbox, plotscript, ecommerce, editor, core stories) and the seven prior tickets (ACTIONS-1/2/3/PORT, HELP-001/002, HARDEN-1) for open tasks, invariants, deferrals and follow-ups, returning file:line evidence. The guide's §3.11 consumer table, §4.1 duplication list and §4.2 backlog table are that survey, checked against the files I had read.

### Prompt Context

**User prompt (verbatim):** "Ok, create a separate ticket to analyze, design, rethink the PBUI kernel.

Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable."

**Assistant interpretation:** Create ticket PBUI-KERNEL-1; write an intern-level guide that maps every part of the presentation kernel with evidence, records what consumers duplicate and what prior tickets left open, proposes a consolidation (one declaration, sibling resolvers kept, a snapshot helper, one condition system, a runtime that surfaces refusals and explains itself, the link kernel fed from the same object), with decision records, phases and tests; keep a diary; validate; upload.

**Inferred user intent:** Have one place that explains the kernel end to end and a plan to remove the accumulated wiring duplication without touching resolution semantics, before more consumers (facets, turboproof, agentlogic) are built on it.

**Commit (code):** none — documentation only.

### What I did

- Created the ticket and two documents with `docmgr ticket create-ticket` / `docmgr doc add`.
- Inventoried `src/presentation`, `src/surfaces.ts`, `src/focus.ts`, `src/chrome` with `wc -l` (13,375 lines including chrome and tests; 24 test files, 224 tests under `src/presentation`).
- Read with line numbers: `presentation/index.ts`, `actions/index.ts`, `links/index.ts` (export surfaces); `createPbui.tsx:279-332` (context value), `:334-400` (engine construction, Provider state), `:455-500` (accept flow), `:1255-1283` (returned instance), `:196-278` (Presentation props); `surfaces.ts`, `focus.ts`; `help/machine.ts:1-90`; `actions/vocabulary.ts:56-108`; `actions/registry.ts:68-160`; `actions/ids.ts`; `Pbui.stories.tsx` wiring lines; `packages/pbui-workbench/src/actions.ts:1-70`.
- Delegated the consumer and prior-ticket survey to an explorer agent (Part A: eight packages and the core stories; Part B: seven tickets), which reported file:line evidence, the duplication list, the ACTIONS-3 Phase C items with status, the ACTIONS-2 five identities and pitfalls, ACTIONS-1's invariants and validation rules, HELP-001's deferred list, HELP-002's invariants and follow-ups, ACTIONS-PORT's unchecked tasks and a factual error in its design doc, HARDEN-1's root causes, and the playbook's stale sections.
- Wrote the guide (§0–§14): executive summary; problem and the meaning of "rethink"; current state in eleven evidence subsections plus the consumer table; gap analysis (duplication, backlog table, what must not change); design (kernel object, snapshot helper, one condition system, runtime taking the kernel with `onRefuse`, click ladder as a function and accept flow as a machine, introspection, vocabulary, link kernel from the kernel object, fragments, consumers after); nine decision records; pseudocode for construction, the click/perform flow, the accept machine and introspection; three diagrams; eight phases; tests; risks and open questions; reading order; glossary.

### Why

- The resolvers must not change (ACTIONS-3's "changes what surrounds the kernel, not the kernel"); the guide therefore separates the fence (§4.3, §10) from the design, and every phase's exit criterion is the Phase 0 goldens.
- The consolidation items already had names in ACTIONS-3 Phase C and HELP-002 §13; the guide's job was to give them a puller (facets, turboproof, the two-graph and empty-graph findings) and one shape rather than six separate helpers.
- Decision records exist for each place a future reader might re-litigate: merging resolvers, compatibility on `createPbui`, derived revisions, the `datalab-ui` freeze, the page protocol, machines versus functions.

### What worked

- Reading the export lists first (`index.ts` files) gave the kernel's public surface in three commands and made the "four resolvers over one facts type" framing obvious.
- The explorer agent's per-package table surfaced two findings I would not have looked for: the shop builds the type graph twice (`createShop.ts:48`), and the workbench's link handlers default to an empty graph (`handlers.ts:90`), which silently makes every type isolated.
- HELP-002's machine header (`machine.ts:1-33`) is a complete statement of the pattern the runtime's remaining policy should follow; quoting its invariants made D9 short.

### What didn't work

- N/A for the analysis. One tooling note: `grep --include=*.tsx` is rejected by zsh's glob handling in this shell; `rg` with `-g` was used instead.

### What I learned

- `predicates` is accepted by two registries and declared by no product; the acceptance path hardcodes an empty map (`createPbui.tsx:357, 371`). ACTIONS-3 C1 is a two-line change once the kernel object owns the map.
- Revisions are computed five different ways across consumers, each with the same "moves iff facts move" comment; the convention is real but unenforced.
- The PBUI-LINK-1 guide's §6.5 sketched `LinkSnapshot extends SelectionSnapshot`; the implementation kept them separate, and the KERNEL-1 design keeps that (D6) while unifying the deps.
- ACTIONS-PORT exists as two ticket directories and its design doc claims `createWorkbench` owns `createPbui`, which is not true at HEAD; both are Phase 6 hygiene items.

### What was tricky to build

- **Drawing the line between kernel and page protocol.** `surfaces.ts`, `focus.ts` and input modality are module globals shared by packages that never see a `PresentationKernel`; folding them in would have made the kernel object own DOM coordination. HELP-002 §13's rule ("a third machine") gave the criterion, recorded as D8.
- **Choosing the size of the runtime refactor.** The click ladder has no state and the accept flow has; a function for one and a machine for the other (D9) keeps the change proportional and reuses the help machine's test harness shape.
- **The `datalab-ui` freeze.** D3's hard cutover changes `createPbui`'s signature, and `datalab-ui` is frozen by LINK-1 D10. D7 records the exception (three call sites, goldens as the fence) and asks the user to confirm it.

### What warrants a second pair of eyes

- D7 (touching frozen `datalab-ui`) and D3 (no compatibility path on `createPbui`).
- The `factsFor` return shape (open question 2) and whether introspection is a Provider prop (open question 3).
- Sequencing with PBUI-FACETS-1 (open question 5): facets should read `kernel.translators` rather than a separate `FacetDeps`.

### What should be done in the future

- Phase 0 goldens across the five callers, then Phase 1 on a branch.
- Confirm D7 with the user before Phase 6; then rewrite the playbook's §6 and merge the ACTIONS-PORT directories.

### Code review instructions

- Check each `path:line` in §3 and §12 against `/home/manuel/workspaces/2026-09-01/add-plot-editor/pbui`.
- `docmgr doctor --ticket PBUI-KERNEL-1 --stale-after 30`; `remarquee cloud ls /ai/2026/09/02/PBUI-KERNEL-1 --long --non-interactive`.
- No code changed; nothing to run.

### Technical details

Commands that mapped the kernel:

```bash
find src/presentation src/surfaces.ts src/focus.ts src/chrome -type f -name "*.ts*" | xargs wc -l | sort -k2
rg -c "^\s*(it|test)\(" src/presentation --glob '*.test.ts*'
grep -v "^\s*$" src/presentation/index.ts src/presentation/actions/index.ts
nl -ba src/presentation/createPbui.tsx | sed -n 279,340p
nl -ba src/presentation/createPbui.tsx | sed -n 1255,1283p
nl -ba src/presentation/actions/registry.ts | sed -n 68,160p
rg -n "export function create[A-Za-z]*Registry|export interface [A-Za-z]*Registry\b" src packages/*/src -g '!*test*'
```

Ticket creation:

```bash
docmgr ticket create-ticket --ticket PBUI-KERNEL-1 \
  --title "Rethinking the pbui presentation kernel: one declaration, sibling resolvers, and the runtime that binds them" \
  --topics pbui,actions,design,architecture,frontend,onboarding,refactoring
docmgr doc add --ticket PBUI-KERNEL-1 --doc-type design-doc --title "The pbui presentation kernel: intern analysis, design, and implementation guide for its consolidation"
docmgr doc add --ticket PBUI-KERNEL-1 --doc-type reference --title "Investigation diary"
```
