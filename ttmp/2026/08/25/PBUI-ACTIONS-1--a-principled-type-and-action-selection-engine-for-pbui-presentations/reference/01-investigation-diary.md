---
Title: Investigation diary
Ticket: PBUI-ACTIONS-1
Status: active
Topics:
    - pbui
    - frontend
    - design
    - architecture
    - research
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-workbench/src/tileDescriptor.ts
      Note: Concrete action generation and dynamic unavailability policy
    - Path: repo://packages/pbui-workbench/src/verbs.ts
      Note: Serializable verb data and effect-handler routing boundary
    - Path: repo://src/presentation/createPbui.tsx
      Note: Owns acceptance mode, conversions, gesture selection, menu rendering, and execution boundary
    - Path: repo://src/presentation/registry.ts
      Note: Implements current exact-key descriptor and action lookup
    - Path: repo://src/presentation/types.ts
      Note: Defines the current exact-type presentation/action contracts and availability invariant
ExternalSources: []
Summary: Chronological evidence, experiments, decisions, failures, and validation for the PBUI type-directed action-selection design.
LastUpdated: 2026-08-25T12:20:00-04:00
WhatFor: Resume or review the PBUI-ACTIONS-1 investigation without repeating its repository and literature discovery.
WhenToUse: Read before changing the proposed selection model or implementing the engine.
---


# Diary

## Goal

Capture the evidence-first investigation and design of a subtype-aware, contextual, composable action-selection engine for PBUI presentations, including the research lineage from presentation-based interfaces, CLIM, predicate dispatch, CLOS/AOP, and context-oriented programming.

## Step 1: Establish the ticket and locate the real subsystem

The first step created an isolated docmgr workspace and translated the broad request into six reviewable tasks. Repository discovery established that “type / action selection” is not one mechanism: PBUI currently divides it across presentation descriptors, typed acceptance and conversions, object-menu rendering, serializable workbench verbs, application availability predicates, and shortcut mode checks.

The repository root is a multi-repository workspace rather than a Git repository. All ticket and commit work therefore belongs in `pbui/`, whose branch already contains unrelated work that must remain untouched.

### Prompt Context

**User prompt (verbatim):** "Analyze the type / action selection mechanism in pbui/ , because I want to expand it to allow for richer interactions:

- subtyping
- potentially AOP style lambdas
- other interesting aspects that are brought up in common lisp clim or in the original paper
- action active / unactive based on modes or previous interactions of the user 
- ...

However, we want to ground this in the theoretical research that has been done since the 80ies, to have a more robust and streamlined and composable basis to build such a system. 

Create a new docmgr ticket and Create  a detailed analysis / design / theoretical foundations analysis that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

You can create experiments in the scripts/ folder of the ticket to analyze or show examples. You can search the web and download relevant resourcesin the sources folder of the ticket. You can launch subagents for research (if possible use gpt-5.6-luna agents).

Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.
Subagents should also keep their own diary.

commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Create a ticketed, source-backed architecture study of PBUI's present selection model, derive a principled extension from historical and modern dispatch research, demonstrate it with experiments, document an implementation path for an intern, commit the work incrementally, validate it, and deliver it to reMarkable.

**Inferred user intent:** Avoid accreting ad-hoc predicates and callback hooks onto PBUI; establish a coherent semantic core that can grow into subtype-, mode-, history-, and advice-aware interactions without becoming ambiguous or uninspectable.

### What I did

- Read the `ticket-research-docmgr-remarkable`, `docmgr`, and `diary` skill references completely.
- Ran `docmgr status --summary-only` and inspected existing ticket naming conventions.
- Created `PBUI-ACTIONS-1`, its design document, this diary, and six tasks.
- Inspected `src/presentation/{types,registry,createPbui}.tsx`, presentation tests, workbench verbs, tile descriptors, application availability, and shortcut routing.
- Queried the available MCP gateway for subagent tools.

### Why

- A proposal can only preserve PBUI's good invariants if it first identifies where those invariants currently live.
- Ticket creation before research ensures every source, experiment, and decision has a durable home.

### What worked

- `docmgr` resolved the workspace to `pbui/ttmp` even when invoked from the parent workspace.
- The code has unusually strong comments and behavioral tests, which expose both current semantics and historical defects.
- The presentation registry is small enough to model exactly while the workbench demonstrates the larger execution boundary.

### What didn't work

- `git status --short --branch` at `/home/manuel/workspaces/2026-08-20/add-pbui-agent` failed exactly with: `fatal: not a git repository (or any of the parent directories): .git`. The correction was to run Git commands in `pbui/`.
- Reading `pbui/AGENT.md` failed with `ENOENT`; only the workspace-level `AGENT.md` exists.
- The MCP search `subagent agent spawn research` returned `No tools matching "subagent agent spawn research"`. No subagent launcher, and therefore no gpt-5.6-luna worker or subagent diary, is available in this session.

### What I learned

- Current action discovery is descriptor-local and exact-type only: `actionsFor` performs one map lookup and calls one `actions` function.
- Availability is recomputed, explained, and represented by one optional `disabledBecause` field. This is an invariant to preserve, not regress to boolean-plus-reason pairs.
- PBUI already has one explicit mode (`accepting`) and one conversion chain, but mode arbitration is split between presentation state and shortcut routing.
- Workbench verbs are serializable data and are deliberately separated from effect handlers; this is the correct seam for tracing, agents, authorization, and advice.

### What was tricky to build

- The phrase “action selection” spans discovery (which actions exist), applicability (which are active), invocation choice (gesture/default/menu), argument acquisition (`accept`), and execution. Treating these as one callback would conceal the distinctions the design needs to preserve.

### What warrants a second pair of eyes

- Confirm that the investigation scope should include workbench application/shortcut policies as evidence but keep the proposed engine centered in `src/presentation`, rather than attempting to replace all PBUI policy registries at once.

### What should be done in the future

- Keep discovery, availability explanation, and execution revalidation separate in any implementation so menu-time state cannot authorize a stale action.

### Code review instructions

- Start with `src/presentation/types.ts`, then `registry.ts`, then the `ObjectMenu` and accept-flow sections in `createPbui.tsx`.
- Continue with `packages/pbui-workbench/src/tileDescriptor.ts`, `verbs.ts`, `apps.ts`, and `src/chrome/shortcutRouting.ts` to see downstream policy examples.

### Technical details

- Ticket root: `ttmp/2026/08/25/PBUI-ACTIONS-1--a-principled-type-and-action-selection-engine-for-pbui-presentations`.
- Initial branch state: `task/add-pbui-agent...wesen/task/add-pbui-agent [ahead 55]`.

## Step 2: Build the theoretical source corpus

This step assembled primary and near-primary sources rather than relying on modern summaries. The corpus spans Ciccarelli's 1981 working paper, CLIM's presentation and translator model, predicate dispatch's formal separation of applicability from overriding, and context-oriented programming's explicit activation mechanisms and scopes.

The sources already expose a useful synthesis: types constrain the candidate set; contextual predicates determine applicability; a declared specificity relation resolves overriding; command-table-like scopes control visibility; and execution advice should be composed after action resolution rather than hidden inside discovery callbacks.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Ground the architecture in traceable literature and retain local copies so future implementers can verify claims.

**Inferred user intent:** Make the eventual design defensible and teachable, not merely plausible TypeScript API invention.

### What I did

- Searched for the original presentation-based UI work, CLIM translator applicability and inheritance, predicate dispatch, CLOS method combination, AOP, context-oriented layer activation, command tables, and history-sensitive state models.
- Downloaded four PDFs and extracted layout-preserving text with `pdftotext -layout`.
- Extracted three CLIM reference pages to Markdown with `defuddle parse ... --md`.
- Searched source text for applicability, overriding, gesture, context, inheritance, activation scope, recognition, and command concepts.

### Why

- Local PDFs and extracted text provide stable evidence for detailed analysis and reMarkable bundling.
- The sources cover complementary layers: interface semantics, practical UI machinery, dispatch theory, and contextual adaptation.

### What worked

- Eugene C. Ciccarelli's *Presentation Based User Interfaces* (MIT AI Working Paper 219, July 1981) was available as a clean scan and text extraction.
- The 1998 predicate-dispatch paper states the key decomposition directly: applicability is guard satisfaction; overriding is logical implication.
- CLIM documents a concrete selection pipeline over command-table accessibility, source type, input-context target type, gesture, object parameter checks, and tester predicates.
- The 2023 context-oriented programming paper distinguishes activation mechanism from activation scope and catalogs imperative, implicit, and event-based activation.

### What didn't work

- The first broad source grep exceeded the tool's 50 KB output limit; the complete output was saved automatically to `/tmp/pi-bash-687ba4bea19633f2.log`. Subsequent reading must use narrower terms/ranges.
- General web results for “AOP lambdas” were mostly secondary framework tutorials. The design will rely on the established join-point/pointcut/advice vocabulary and CLOS method combination, while avoiding unsupported claims from low-quality sources.

### What I learned

- Ciccarelli's early model is broader than object menus: the interface is a presentation database semantically related to the application database, with user and system cooperating through presentation manipulation and recognition.
- CLIM presentation translators are relations from a source presentation type to an input-context target type under a gesture and command-table scope; translator testers add value/context predicates.
- Predicate dispatch warns against registration-order tie-breaking because it hides ambiguity and damages modularity.
- Context activation and scope are different questions: when a mode becomes active is not the same as which session, surface, object, or control-flow extent it affects.

### What was tricky to build

- “The original paper” can refer to Ciccarelli's 1981 working paper or expanded 1984 thesis. The corpus uses the 1981 primary paper for origin claims and CLIM sources for the mature type/action mechanism; the report will state this distinction explicitly.

### What warrants a second pair of eyes

- Review every theoretical claim against the stored extracts and clearly label PBUI design synthesis as proposed rather than attributing it directly to CLIM or predicate dispatch.

### What should be done in the future

- Preserve source URLs and bibliographic metadata in the design document so the corpus can be refreshed if archived URLs move.

### Code review instructions

- Read `sources/01-presentation-based-user-interfaces.txt` for conceptual origins, `sources/03-guided-tour-of-clim.txt` plus `05`–`07` for practical mechanics, `sources/02-predicate-dispatching-ecoop98.txt` for dispatch semantics, and `sources/04-context-oriented-layer-activation.txt` for mode scope.

### Technical details

- Download commands used `curl -L --fail --silent --show-error`.
- Text extraction used `pdftotext -layout` to retain page/column context.
- HTML extraction used `defuddle parse URL --md | fold -w 110 -s` because Defuddle may emit single-line Markdown.
- Ticket/corpus commit: `5e9f927a70af3e0bfb93a64355efb6cf7594b9cf` — “PBUI-ACTIONS-1: establish action-selection research corpus”.

## Step 3: Derive and exercise the proposed selection kernel

This step turned the repository and literature observations into a concrete semantic design. The report separates classification, discovery, applicability, override, invocation, translation, and execution; it then defines a nominal type graph, independent action rules, immutable context snapshots, explicit scopes and modes, typed translators, deterministic resolution, explanation traces, and execution-only advice.

A dependency-free JavaScript experiment exercises the most consequential rules before production code exists. It confirms inherited action accumulation, subtype-specific override, mode/history-driven explained availability, deterministic advice nesting, and registration-time ambiguity reporting.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Produce both a rigorous intern-facing design and a small executable model that makes its dispatch claims falsifiable.

**Inferred user intent:** Make future implementation start from tested semantics rather than API aesthetics.

### What I did

- Wrote the primary analysis/design/implementation guide with current-state evidence, theoretical foundations, API sketches, ASCII diagrams, pseudocode, decision records, migration examples, phased file guidance, validation rules, tests, performance analysis, risks, and open questions.
- Created `scripts/01-selection-kernel.mjs` and captured its output in `scripts/01-selection-kernel.output.txt`.
- Ran the experiment with Node and added assertions for subtype override, review-mode availability, mode activation, absence of unexpected runtime ambiguity, and detection of an intentional registration conflict.

### Why

- The design's key claim is a separation of applicability and specificity; an executable miniature makes accidental registration-order semantics visible.
- Advice ordering is easy to describe ambiguously, so the experiment records the exact nesting contract.

### What worked

- `image-file` correctly inherited rules from `document` and `file`.
- The `file.open` rule won over `document.open` for action identity `open` by smaller type distance.
- Review mode produced `unavailable — review mode is read-only` for delete while making annotate available.
- Advice executed as `around-enter -> before -> handler -> after -> around-exit`.
- Two same-action/same-type plugin declarations produced a diagnostic naming both rules.

### What didn't work

- N/A. The experiment executed successfully on the first run. The script was then strengthened with an explicit conflicting-registry demonstration and rerun successfully.

### What I learned

- Action identity must be separate from rule identity: inherited declarations only compete when they implement the same conceptual action.
- Menu order and override order must remain independent; otherwise a cosmetic reorder changes semantics.
- Context-driven modes should alter availability, not synthesize virtual subtypes.
- AOP-style behavior is tractable when the only join point is resolved verb execution and `around` advice receives explicit `proceed`.

### What was tricky to build

- Arbitrary JavaScript predicates cannot provide a computable logical implication relation. The solution is deliberately hybrid: nominal type-vector specificity and declared scope precedence determine override; structured conditions and optional testers determine applicability; testers never establish precedence.
- Multiple inheritance creates incomparable maxima. The design does not conceal these with array order; it requires a concrete override, explicit declared priority, or an ambiguity diagnostic.

### What warrants a second pair of eyes

- Review the proposed pointwise ordering for multi-subject dispatch versus CLOS-style lexicographic ordering.
- Review whether Phase 1 should permit multiple inheritance or start with one parent plus later interfaces.
- Confirm that `hidden` has sufficiently narrow policy reasons and cannot become a convenience for suppressing useful disabled explanations.
- Verify that execution outcomes can be introduced without losing workbench handlers' current truthful boolean result.

### What should be done in the future

- Before implementation, answer the action-ID namespace and local-callback portability questions in the report's Open Questions section.
- Keep direct translator edges in the first version; only add path search with explicit costs after concrete use cases exist.

### Code review instructions

- Start with the report's Sections 5–8 for semantic contracts, then Section 14 for phased implementation.
- Run `node ttmp/2026/08/25/PBUI-ACTIONS-1--a-principled-type-and-action-selection-engine-for-pbui-presentations/scripts/01-selection-kernel.mjs` and compare with the captured output.
- Cross-check repository claims using the line references in Section 20.

### Technical details

- The report is approximately 66 KB of Markdown and deliberately uses text diagrams rather than renderer-dependent Mermaid.
- The experiment has no package dependencies and performs assertion-based self-validation.
- Design/experiment commit: `f996a1538ada3b03ab7f8a46977eb4c9c9d184a8` — “PBUI-ACTIONS-1: design contextual subtype action selection”.

## Step 4: Validate, package, and deliver

The final step tightened ticket navigation, validated frontmatter and vocabulary, reran the executable experiment against its captured output, and delivered the design plus diary as one reMarkable PDF with a level-two table of contents.

Validation initially found three topic slugs that were used by the new ticket but absent from the repository vocabulary. Adding precise shared definitions for `architecture`, `design`, and `research` removed the warnings rather than weakening or ignoring validation.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Complete ticket bookkeeping and produce a verified, readable reMarkable artifact after a dry run.

**Inferred user intent:** Leave both the repository and reading device with a durable, reviewable handoff rather than an unvalidated draft.

### What I did

- Validated both authored documents with `docmgr validate frontmatter --suggest-fixes`.
- Ran `docmgr doctor --ticket PBUI-ACTIONS-1 --stale-after 30`.
- Added missing vocabulary entries for `architecture`, `design`, and `research` with concrete descriptions.
- Replaced the generated index placeholders with an overview, deliverable links, reading order, and status guidance.
- Dry-ran and then uploaded a bundle containing the design guide and investigation diary.

### Why

- A clean doctor result ensures the ticket remains discoverable through repository vocabulary.
- Bundle delivery gives the reviewer one PDF with navigation while retaining the complete Markdown and sources in Git.

### What worked

- Both document frontmatters validated as `Frontmatter OK`.
- The dry run listed both intended documents, the bundle name, and `/ai/2026/08/25/PBUI-ACTIONS-1` as the destination.
- The real upload returned exactly: `OK: uploaded PBUI ACTIONS 1 Type Directed Action Selection.pdf -> /ai/2026/08/25/PBUI-ACTIONS-1`.

### What didn't work

- The first doctor run reported `unknown_topics` for `architecture`, `design`, and `research` across three documents. The suggested remediation was followed with:
  - `docmgr vocab add --category topics --slug architecture --description "Software architecture, boundaries, contracts, and system organization"`
  - `docmgr vocab add --category topics --slug design --description "Technical design proposals, decisions, and implementation guidance"`
  - `docmgr vocab add --category topics --slug research --description "Evidence-backed theoretical or technology investigation"`

### What I learned

- Ticket creation accepts topic names before vocabulary validation, so doctor remains a required final gate.
- reMarkable bundle generation handles the long Markdown report without renderer-dependent diagrams because the report uses plain text diagrams and conventional fenced code.

### What was tricky to build

- The ticket-research workflow requests dry-run and verification, while the current reMarkable skill explicitly says not to issue a routine cloud listing after a successful `OK: uploaded` response. The workflow used the mandatory dry run and treated the upload's explicit success line as verification, avoiding an unnecessary expensive cloud call.

### What warrants a second pair of eyes

- Open the uploaded PDF and spot-check long code/API blocks if visual pagination quality matters; the CLI confirmed generation/upload, not human typographic review on the device.
- Review the new global vocabulary descriptions for consistency with future tickets.

### What should be done in the future

- If the report changes materially, upload under a new name or use `--force` only after deciding whether existing reMarkable annotations may be discarded.

### Code review instructions

- Begin at the ticket `index.md` and follow its reading order.
- Run `docmgr doctor --ticket PBUI-ACTIONS-1 --stale-after 30` and the selection-kernel output diff command recorded in the changelog workflow.
- Verify delivery from the recorded `OK: uploaded` line; do not delete or overwrite the remote artifact casually because annotations may exist.

### Technical details

- Bundle: `PBUI ACTIONS 1 Type Directed Action Selection.pdf`.
- Remote directory: `/ai/2026/08/25/PBUI-ACTIONS-1`.
- Bundle inputs: the primary design guide and this investigation diary.
- ToC depth: 2.
