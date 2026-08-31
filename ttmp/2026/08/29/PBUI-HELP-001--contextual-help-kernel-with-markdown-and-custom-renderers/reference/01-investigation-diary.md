---
Title: Investigation Diary
Ticket: PBUI-HELP-001
Status: active
Topics:
    - frontend
    - pbui
    - design
    - architecture
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: /home/manuel/workspaces/2026-08-24/use-optkit/pbui/ttmp/2026/08/29/PBUI-HELP-001--contextual-help-kernel-with-markdown-and-custom-renderers/design-doc/01-intern-guide-to-the-pbui-contextual-help-kernel.md
      Note: |-
        Primary design and implementation handoff produced by this investigation
        Primary implementation handoff produced by the investigation
ExternalSources: []
Summary: Chronological investigation record for the PBUI contextual help kernel design and frontend handoff.
LastUpdated: 2026-08-29T12:12:00-04:00
WhatFor: Understand how the proposed help kernel was derived from the current PBUI action resolver and runtime.
WhenToUse: Read before implementing or reviewing PBUI-HELP-001.
---


# Diary

## Goal

Record the evidence, decisions, implementation boundaries, validation, and delivery of the PBUI contextual help kernel handoff.

## Step 1: Map the current action selection and presentation runtime

The investigation replaced the earlier conceptual description with the current pbui 0.9.0 implementation. PBUI has one pure action kernel whose front half matches a typed subject through the nominal type graph, active scope stack, condition algebra, named predicates, and immutable product snapshot. Its second half partitions candidates by action ID and selects one implementation through type distance, scope distance, and priority.

Help should reuse the first half and stop before action competition or verb binding. This is the smallest way to ensure a field, job, or document receives help under the same contextual facts that govern its actions.

### Prompt Context

**User prompt (verbatim):** "cool, createa  new ticket, and Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

We'll hand it off to our frontend colleague to implement."

**Assistant interpretation:** Create a new pbui ticket containing an implementation-ready intern guide for a simple sibling contextual-help kernel with Markdown and custom renderers, then validate and deliver it to reMarkable.

**Inferred user intent:** Give the frontend colleague a precise, evidence-backed handoff that can be implemented without rediscovering PBUI's action and presentation architecture.

### What I did
- Inspected `actions/types.ts`, `conditions.ts`, `typeGraph.ts`, `resolve.ts`, `define.ts`, and `registry.ts`.
- Identified the reusable matcher boundary before action-ID partitioning and verb binding.
- Inspected `createPbui.tsx` Provider state, lazy primary resolution, hover/focus handlers, menu behavior, nested Presentation handling, composites, and effect boundary.
- Inspected Datalab's production action registry, snapshot derivation, and runtime composition.
- Inspected pbui-workbench action fragments.
- Inspected pbui-chat's bounded Markdown parser and renderer.
- Confirmed the core package currently has no Markdown runtime dependency.
- Created PBUI-HELP-001, two docs, and five implementation tasks.

### Why
- The guide must distinguish what can be reused from what is action-specific.
- Help integration touches event ownership, accessibility, SVG/composite markup, and lazy resolution; component-only design would miss those constraints.

### What worked
- The action resolver has a clear extraction point: type/scope/condition matching precedes action competition.
- Existing exact/inherited rule contexts and product snapshots already provide the required payload typing.
- pbui-chat provides a proven small Markdown subset that avoids raw HTML and a new dependency.

### What didn't work
- The repository has no `AGENT.md` at its root; investigation proceeded from source, package docs, playbooks, and tests.
- Two pre-existing untracked PBUI-ACTIONS-PORT ticket directories and a modified vocabulary file are present. They were treated as unrelated user work and were not edited or staged by this ticket workflow.

### What I learned
- `ActionInvocation` does not need a new `help` value in the first release. Help can request the existing `introspection` snapshot and use its own registry.
- Action availability has override semantics that additive help should not inherit. Help only includes rules whose condition/test is available.
- `Presentation` already resolves primary actions lazily on hover, focus, or click; help should preserve that render-cost boundary.

### What was tricky to build
- “Reuse action selection” cannot mean calling `resolveActions` and converting actions into help. That would expose only winning action implementations and lose independent explanatory rules. The correct reuse boundary is the contextual matcher before action partitioning.
- A generic Markdown feature must not import pbui-chat back into pbui core. The generic parser subset should move or be reproduced in core, while chat-specific `[[type:id|label]]` mentions remain in pbui-chat.

### What warrants a second pair of eyes
- Whether the matcher should return rejected diagnostics or only matched provenance in its first extraction.
- Whether action traces can remain byte-identical after refactoring to `matchContext`.
- Whether `introspection` snapshots contain all facts the first product help rules need.
- The exact pointer delay and surface-stack integration for ContextHelp.

### What should be done in the future
- Implement the five ticket tasks in order, preserving action and Datalab golden behavior at every phase.

### Code review instructions
- Start with §§2, 6, and 12 of the guide.
- Compare the proposed matcher directly with the first half of `src/presentation/actions/resolve.ts`.
- Review the accessibility and no-help compatibility tests before runtime integration.

### Technical details
- PBUI package version inspected: 0.9.0.
- Action precedence remains type distance → scope index → priority → ambiguity.
- Help composition is additive and deterministically ordered; it has no action partition or verb.

## Step 2: Validate and deliver the frontend handoff

The implementation guide, diary, ticket index, tasks, changelog, and source relations were validated as one ticket. The guide and diary were then rendered into one reMarkable PDF with a level-two table of contents, uploaded, and verified in the cloud destination.

All five production tasks remain unchecked. This delivery completes design and handoff work, not implementation.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Validate the ticket package and deliver the implementation guide to the frontend colleague's reading environment.

**Inferred user intent:** Leave a navigable, auditable handoff with concrete implementation checkpoints and no ambiguity about what is already built.

### What I did
- Replaced the unavailable `accessibility` vocabulary topic with the valid `architecture` topic while retaining accessibility requirements in the guide.
- Filled the ticket index summary, purpose, usage, and overview.
- Related the guide to six authoritative source files and the diary to the guide.
- Ran frontmatter validation for both documents.
- Ran ticket-scoped `docmgr doctor`; all checks passed.
- Ran a reMarkable bundle dry-run.
- Corrected one PDF-rendering failure, uploaded the guide/diary bundle, and verified the cloud listing.

### Why
- The frontend colleague needs a structurally valid ticket and one readable document rather than disconnected source notes.

### What worked
- Frontmatter validation passed.
- `docmgr doctor --ticket PBUI-HELP-001 --stale-after 30` reported all checks passed.
- The dry-run listed the guide first and diary second.
- Cloud verification shows `PBUI-HELP-001 Contextual Help Kernel` at `/ai/2026/08/29/PBUI-HELP-001`.

### What didn't work
- The first real upload failed with:
  `pandoc failed: Error producing PDF.`
  `! Undefined control sequence.`
  `l.1832 remarkable.\n`
- The verbatim prompt had been stored with literal backslash-n characters instead of actual blank lines. They were replaced with real line breaks; the second render and upload succeeded.

### What I learned
- Literal `\\n` sequences in prose can be interpreted as LaTeX commands by the PDF pipeline. Verbatim prompts should preserve actual line breaks.

### What was tricky to build
- The ticket had to remain isolated from pre-existing untracked PBUI-ACTIONS-PORT directories and a modified shared vocabulary file. Only the PBUI-HELP-001 directory belongs to this handoff.

### What warrants a second pair of eyes
- Review the proposed `introspection` snapshot adapter before implementation.
- Confirm the bounded Markdown subset is sufficient for the first product example.
- Confirm the v1 tooltip remains non-interactive; clickable actions require different focus semantics.

### What should be done in the future
- The frontend colleague should implement tasks `adx6`, `w3lr`, `gq7b`, `cshp`, and `6xny` in order.

### Code review instructions
- Begin with the guide's executive summary, §§6–12, implementation phases, and review checklist.
- Re-run action tests and Datalab menu goldens immediately after extracting the shared matcher.

### Technical details
- Remote directory: `/ai/2026/08/29/PBUI-HELP-001`.
- Verified document: `PBUI-HELP-001 Contextual Help Kernel`.
- No production source code was modified.
