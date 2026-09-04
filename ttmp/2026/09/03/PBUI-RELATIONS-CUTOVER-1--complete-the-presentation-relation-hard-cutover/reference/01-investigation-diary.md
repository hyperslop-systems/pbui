---
Title: Investigation diary
Ticket: PBUI-RELATIONS-CUTOVER-1
Status: archived
Topics:
    - pbui
    - frontend
    - architecture
    - refactoring
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources:
    - /tmp/pbui-improvements.md
Summary: Records why the proposed relation migration was archived after evidence showed PBUI-KERNEL-1 had already completed it.
LastUpdated: 2026-09-03T21:35:00-04:00
WhatFor: Preserve the stale-recommendation audit and redirect future work to the next real gap.
WhenToUse: Read when resuming PBUI-RELATIONS-CUTOVER-1 or reconciling pbui-improvements.md with current code.
---

# Diary

## Goal

Determine whether the proposed presentation-relation hard cutover still exists as implementation work.

## Step 1: Audit the recommendation against current code

I created the proposed ticket, then inspected the canonical relation subsystem, package exports, Ecommerce, prior KERNEL-1 documentation, commit history, and external-consumer migration record before writing an implementation plan. The evidence showed that the recommendation described work already completed by PBUI-KERNEL-1.

Rather than invent a second migration, this ticket records the no-op conclusion and redirects the requested detailed design to repository-wide dependency-DAG enforcement, the next unimplemented item in the source assessment.

### Prompt Context

**User prompt (verbatim):** "create the new docmgr ticket, and Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Create the next improvement ticket and produce an evidence-backed intern implementation guide and reMarkable delivery.

**Inferred user intent:** Continue the remaining repository cleanup without compatibility layers or unnecessary defensive architecture.

### What I did

- Created the ticket and initial task list.
- Ran semantic legacy-symbol searches across PBUI and sibling consumers.
- Read the canonical relation, acceptance, model projection, and Ecommerce relation wiring.
- Read KERNEL-1 completion evidence and commit history.
- Reclassified this ticket as already satisfied and selected dependency-DAG enforcement as the actual next work.

### Why

- `/tmp/pbui-improvements.md` predates the KERNEL-1 hard cutover.
- A design based on stale architecture would duplicate tested production behavior.

### What worked

- The old guide contains an exact legacy-symbol completion grep and completion checklist.
- Current Ecommerce has one canonical relation declaration consumed by acceptance and derivation.

### What didn't work

- The initial assumption that Ecommerce still used translator compatibility was false; only historical comments use the word “translator.”

### What I learned

- Improvement lists must be rebased after each large cutover.
- The next real gap is global dependency-DAG enforcement, not relation migration.

### What was tricky to build

- Product-domain methods such as `host.relations.orderCustomer()` are data access, not presentation compatibility. They should not be mistaken for duplicate relation declarations.

### What warrants a second pair of eyes

- Confirm that historical “translator” wording can remain explanatory; it has no runtime effect.

### What should be done in the future

- Implement dependency-DAG enforcement next.

### Code review instructions

- Compare `packages/pbui-ecommerce/src/presentation/relations.ts` with `src/presentation/model/compile.ts`.
- Run the legacy-symbol grep in the audit document.

### Technical details

```text
Declared relation → compiled RelationSystem → acceptance projection
                                    └───────→ linkDeps derivation projection
```
