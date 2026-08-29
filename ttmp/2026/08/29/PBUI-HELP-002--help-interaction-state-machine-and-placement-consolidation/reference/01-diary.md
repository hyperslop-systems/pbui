---
Title: Diary
Ticket: PBUI-HELP-002
Status: active
Topics:
    - frontend
    - pbui
    - design
    - architecture
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources:
    - https://github.com/hyperslop-systems/pbui/pull/20
Summary: Implementation diary for the help surface state machine consolidation.
LastUpdated: 2026-08-29T19:10:00-04:00
WhatFor: Record the formalization and rebuild of the help hover/close/placement behavior so reviewers can follow the model and its verification.
WhenToUse: Read when reviewing PBUI-HELP-002 or continuing the machine work.
---

# Diary

## Goal

Capture the consolidation of the PBUI contextual-help surface behavior — scattered across six event-handler locations and patched through four PR #20 review rounds — into one pure, fuzz-tested state machine (`helpSurfaceStep`) plus a pure placement function (`placeHelpCard`), absorbing the two open review findings structurally.

## Step 1: Ticket, formal design doc, reMarkable

Created PBUI-HELP-002 with five tasks, wrote the intern guide (design-doc/01) end to end — system context, the seven-findings evidence table, the full formal model (3 surface states × 10-event alphabet, transition table, mermaid state diagram), placement geometry rules, five invariants, the plausible-sequence fuzz harness design, runtime wiring map, file/test/phase plans — and uploaded it to reMarkable.

### Prompt Context

**User prompt (verbatim):** "Create a new docmgr ticket and Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.
 to address these issues and do consolidation based around sound printciples. 

Then implement."

**Assistant interpretation:** Open PBUI-HELP-002; write an intern-grade design doc formalizing the help hover/close/placement behavior (the "step back" agreed in the preceding discussion) with prose, bullets, pseudocode, diagrams, API and file references; store it in the ticket; upload to reMarkable; then implement the consolidation.

**Inferred user intent:** Stop the drip of review-round point patches by making the interaction model explicit, verified, and teachable — then rebuild on it.

### What I did
- `docmgr ticket create PBUI-HELP-002`, five tasks (jbo1, 698v, ewpw, 5cge, 555f), design doc + this diary via `docmgr doc add`.
- Wrote design-doc/01 (~13 sections): the transition table in §4.5 is the core artifact — both open PR #20 round-4 findings appear as single cells (`menu-opened` from `armed`; placement is §5 and out of the table by design).
- `remarquee upload bundle … --remote-dir /ai/2026/08/29/PBUI-HELP-002` → "OK: uploaded PBUI-HELP-002 Help Surface State Machine.pdf".
- Printed the plan slip (5 phases) and the P1 split.

### Why
- The doc IS the spec the tests will encode: table tests named after cells, a fuzz harness asserting I1–I4 per step, placement containment as a property. Review then targets the model, not interleavings.

### What worked
- The seven prior findings mapped cleanly onto four invariants — nothing needed a special case, which is decent evidence the model is the right size.

### What didn't work
- N/A this step.

### What was tricky to build
- **Keeping the machine command-free.** Early sketches had a command vocabulary (`armTimer`, `show`, `hide`); realizing resolution is synchronous-and-pure let `deps.resolve` move INTO the step function (house precedent: `matchContext` takes its predicate map), and the single timer became effects-as-state-sync — `armed` ⟹ timer running — leaving `step` as just `(state, event, deps) → state`.

### What warrants a second pair of eyes
- §4.5's `focus` row allows re-resolving on an already-open anchor (fresh facts on refocus) — confirm that's wanted rather than a stay-put.
- The decision to keep blur from disarming a pointer arm (current code cancels; the table deliberately doesn't) — documented in the table's blur row.

### What should be done in the future
- §13 records the deferred items: close-on-scroll, click-ladder and accept-flow machines, transient-surface protocol convergence, datalab shortcut table validation.

### Code review instructions
- Read design-doc/01 §§4–7 (model), then §8 (wiring) against `createPbui.tsx` as it is today.

### Technical details
- reMarkable path: `/ai/2026/08/29/PBUI-HELP-002/PBUI-HELP-002 Help Surface State Machine.pdf`.
