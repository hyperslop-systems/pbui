---
Title: Investigation diary
Ticket: PBUI-FACETS-1
Status: active
Topics:
    - pbui
    - actions
    - design
    - architecture
    - frontend
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-ecommerce/src/tiles/OrderDetail/OrderDetail.tsx
      Note: The motivating nesting
    - Path: repo://src/presentation/actions/resolve.ts
      Note: Header invariants quoted in the decision records
    - Path: repo://src/presentation/createPbui.tsx
      Note: The menu body read with nl -ba to confirm the flat row list
    - Path: repo://src/presentation/translators/resolve.ts
      Note: Subtype satisfaction bypasses translators; why widened values were rejected
ExternalSources: []
Summary: 'Chronological record of the PBUI-FACETS-1 analysis: how the question "can one presentation carry the actions of a related object" was investigated against the action kernel, the translator registry, the menu path and the link kernel, and how the facet design was derived and delivered.'
LastUpdated: 2026-09-02T11:40:00-04:00
WhatFor: Continue or review the facet analysis without re-deriving the evidence.
WhenToUse: Before starting Phase 0 of the guide, or when checking why a decision cites a file.
---


# Diary

## Goal

Capture how the question behind PBUI-FACETS-1 was studied: which files establish that a reference has one type, why graph subtyping cannot merge menus, where relations are already consulted (accept mode, the link kernel's derive) and where they are not (the object menu, the primary click, follow, show), and how the design guide was assembled, validated and uploaded.

## Step 1: Study the kernel, answer the question, create the ticket, write the guide

The request followed directly from PBUI-LINK-1: in the gold-coin shop's order detail, a line item is rendered with a product presentation nested inside it so that the product's actions are reachable, and the user asked whether the action system could be extended so one presentation offers both objects' actions with the menus merged. The investigation read the action kernel's contracts, the resolver, the registry, fresh revalidation, the React runtime's menu and click paths, the translator registry and accept resolution, the shared context matcher, the help resolver, the vocabulary, the link kernel's relation use, and the shop's declarations, with line numbers.

The answer became the guide's design: a reference keeps one type; a translator may opt in as a facet edge; a new pure module derives the subject's facets (depth one) and runs the unchanged resolver once per facet; the menu shows one section per facet; the envelope records `via`; revalidation re-derives the facet. The alternatives (graph subtyping with widened values, composite references, per-rule `via` annotations) are recorded as decision records with the reasons they lost.

### Prompt Context

**User prompt (verbatim):** "Now study what it would take to extend the actions system to allow a presentation to represent multiple types, for example a line item in an order can actually also be used to interact with its underlying catalog item, without having to use two different presentations, merging the actions.

Study, and make a list of suggestions on how to extend the actions / presentation system"

then: "Create a new docmgr ticket and Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable."

**Assistant interpretation:** First, study the kernel and give a ranked list of extensions in the conversation. Then turn that study into a docmgr ticket with an intern-level guide (current state with file references, gap analysis, design with API sketches and pseudocode, decision records, phases, tests, risks), keep a diary, validate with doctor, and upload the bundle to reMarkable.

**Inferred user intent:** Decide, with evidence, whether "a presentation with several types" is a type-graph change, a reference-shape change, or a resolution-time projection, and have a plan an engineer can execute without re-deriving the kernel.

**Commit (code):** none — documentation only.

### What I did

- Read with line numbers: `src/presentation/types.ts` (reference shape, descriptor), `actions/types.ts` (query, snapshot, exact vs inherited contexts, `primary`, contributions, `ResolvedAction`, `PerformEnvelope`), `actions/typeGraph.ts` (header rule and API), `actions/resolve.ts` (collection via `matchContext`, family expansion, partition, ladder, ambiguity, hidden, sort), `actions/registry.ts` (validation, `listReachable`, `vocabulary`), `actions/perform.ts` (`evaluateFresh` codes), `actions/define.ts`, `actions/explain.ts`, `actions/conditions.ts`, `actions/vocabulary.ts`, `context/{types,match}.ts`, `help/resolve.ts`, `translators/{types,resolve}.ts`, `createPbui.tsx` (options, `resolve`, `performAction`, `Presentation.primaryFor`, click contract, mouse-doc, `ObjectMenu`).
- Read the consumers: `packages/pbui-ecommerce/src/presentation/{types,actions,relations}.ts`, `runtime.tsx`, `tiles/OrderDetail/OrderDetail.tsx`; `packages/pbui-workbench/src/links/contributions.ts` (the "Link to…" family's reachability filter); `src/presentation/links/{plan,resolveShow,snapshot}.ts`; `packages/datalab-ui/src/pbui/actions.ts` (abstract `inspectable`/`watchable`); `packages/pbui-chat/src/tools/acceptTool.tsx`.
- Searched prior tickets (`PBUI-ACTIONS-1/2/3`, `PBUI-HELP-001`) for "facet", "multi", "role"; found only the incomparable-ancestor ambiguity discussion in ACTIONS-1 §, no prior multi-type design.
- Answered the user's first question in the conversation with a ranked list (facets via translators first; graph subtyping and widened values as rejected alternatives).
- Created the ticket with `docmgr ticket create-ticket --ticket PBUI-FACETS-1 …` and the two documents with `docmgr doc add`.
- Wrote the guide (§0–§14): executive summary, problem and the three readings of "merge", current state with twelve evidence subsections, gap table, design (declaration, `deriveFacets`, `resolveWithFacets`, `evaluateFreshFaceted`, primary click, menu, envelope, agent, link kernel, shop), eight decision records, pseudocode for six flows, three diagrams, six phases, tests, risks and open questions, reading order, glossary.

### Why

- The user's phrase "represent multiple types" invites a type-system answer; the evidence (the graph never converts payloads; exact rules match one concrete type) shows that the type graph cannot deliver the product's exact rules on a line item. Recording that with line references prevents the design from being re-litigated as "just add a parent".
- The translator registry already has ids, endpoints, scopes, conditions, priority and a chooser, and PBUI-LINK-1 D7 already made it the single relation registry for derive. Building facets on it keeps one registry for three readers (accept, menu, links).

### What worked

- `grep -n` on `createPbui.tsx` for `resolve(`, `performAction`, `primaryFor`, `ObjectMenu` gave the exact seams in a 1,283-line file without reading it whole; `nl -ba … | sed -n` on the menu body confirmed the flat row list keyed by `candidateId`.
- The resolver's own header comments (`resolve.ts:23-40`) state the invariants the facet module must preserve; quoting them made the decision records short.
- The shop's `relations.ts` already builds translators and kernel relations from one list, so the "one registry, three readers" design needed no new product code beyond a `facet` label.

### What didn't work

- N/A for the analysis itself. One shell pattern to avoid: a `grep` alternation containing `\"` inside double quotes needed single-quoted patterns to reach zsh intact.

### What I learned

- `InheritedRuleContext.subject` is the ORIGINAL reference by design (`actions/types.ts:71-79`); the exact/inherited factories only narrow at the type level (`define.ts`), so any "act as another type" mechanism must produce a real reference of that type.
- `resolveAcceptance` returns the original reference for subtype satisfaction and only then consults translators (`translators/resolve.ts:42-48`); declaring `lineItem` a subtype of `product` would therefore bypass `lineItem.product` in accept mode.
- The help kernel is additive over the same matcher, so facet help is a fan-out with no shadowing policy.
- `resolveShow` uses graph distance only; the PBUI-LINK-1 guide's "+100 through a translator" was proposed but not built, which is now Phase 4 of this ticket.

### What was tricky to build

- **Naming the identity of a facet row.** The same rule (`shop.inspect`) resolves for the subject and for the product facet with the same candidate id. Prefixing ids inside the resolver would have changed every trace consumer; the guide instead keeps candidate ids per resolution and adds a `rowId` and `facet.relation` on the faceted row, with revalidation locating the fresh facet by relation id first (D4).
- **Where the click goes.** A product rule marked `primary` must not fire on a line's bare click. The rule "facets never derive for `primary` or `accept`" (D3) is the smallest statement that keeps "the click acts on what you clicked" true.
- **Shadowing.** Merging subject and facet rows into one action partition would let type distance decide between two different objects, which is meaningless. The guide keeps both rows by default and offers `subject-wins` per edge with a trace entry (D6).

### What warrants a second pair of eyes

- Whether inline sections or submenus are the right menu shape for more than two facets (open question 1).
- The order detail has no output port for line items, so the Phase 4 pointer scenario needs a source (open question 3).
- Which chat tool should return faceted rows to the agent (open question 6).

### What should be done in the future

- Phase 0 goldens, then Phase 1 in core, on a branch.
- Confirm D3 and D6 with the user before Phase 2.

### Code review instructions

- Check each `path:line` in the guide's §3 and §12 against the workspace at `/home/manuel/workspaces/2026-09-01/add-plot-editor/pbui`.
- `docmgr doctor --ticket PBUI-FACETS-1 --stale-after 30`; `remarquee cloud ls /ai/2026/09/02/PBUI-FACETS-1 --long --non-interactive`.
- No code changed; nothing to run.

### Technical details

Commands that located the seams:

```bash
grep -n "resolve(\|performAction\|primaryFor\|function ObjectMenu" src/presentation/createPbui.tsx
grep -n "^export function\|partitions\|byDistance\|byScope\|byPriority\|ambiguities.push" src/presentation/actions/resolve.ts
nl -ba src/presentation/createPbui.tsx | sed -n 883,1000p
nl -ba src/presentation/actions/registry.ts | sed -n 160,258p
grep -n "reaches(\|\"type\")" src/presentation/links/plan.ts
nl -ba packages/pbui-ecommerce/src/tiles/OrderDetail/OrderDetail.tsx | sed -n 84,98p
```

Ticket creation:

```bash
docmgr ticket create-ticket --ticket PBUI-FACETS-1 \
  --title "Facets: acting on a presentation as the things it relates to (merging menus across types)" \
  --topics pbui,actions,design,architecture,frontend,onboarding
docmgr doc add --ticket PBUI-FACETS-1 --doc-type design-doc --title "Facets in the pbui action kernel: intern analysis, design, and implementation guide"
docmgr doc add --ticket PBUI-FACETS-1 --doc-type reference --title "Investigation diary"
```
