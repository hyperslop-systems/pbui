---
Title: Implementation diary
Ticket: PBUI-PROD-1
Status: active
Topics:
    - pbui
    - frontend
    - backend
    - security
    - testing
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: 'Chronological implementation record for production-first PBUI hardening and contained hyperblog and turboproof security/data-integrity fixes.'
LastUpdated: 2026-08-03T21:15:00-04:00
WhatFor: 'Preserve the evidence, commands, failures, commits, and review instructions needed to audit or continue PBUI-PROD-1.'
WhenToUse: 'Read before reviewing, resuming, or extending the implementation.'
---

# Diary

## Goal

Implement the small shared-contract, production-integration, confidentiality,
and data-integrity fixes selected from HANDOFF-PR-2, while explicitly leaving
prototype-wide architecture and polish for future feature work. Keep every
change test-backed, commit it at a coherent repository boundary, and deliver an
intern-oriented implementation guide to reMarkable.

## Step 1: Recut the review by product lifetime

The earlier review intentionally described every known correctness gap. This
step converted that inventory into a shipping boundary based on the user's new
information: PBUI, datalab, and agentlogic deserve durable production contracts;
hyperblog and turboproof need only cheap, security-sensitive, or data-loss fixes
now. That distinction prevents prototype polish from displacing shared-library
correctness.

The code trace corrected one assumption from the prioritization discussion.
Datalab instantiates the PBUI presentation runtime and owns a real verb router;
agentlogic imports PBUI visual components but does not instantiate `createPbui`.
Agentlogic therefore needs regression validation for shared component changes,
not an artificial presentation-router test for an API it does not use.

### Prompt Context

**User prompt (verbatim):** "Ok, let's create a new docmgr ticket to address and at least document these issues. Then Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.


Make phases and tasks for the issues we will address in this session, and then implement them. Keep a detailed diaruy as you work, using the diary format skill, and commit at appropriate intervals."

**Assistant interpretation:** Create a new structured ticket, document the
production-first disposition in enough depth for an intern, implement the
selected fix-now tranche across the controlled repositories, preserve a strict
diary, commit coherent steps, verify everything, and upload the final package.

**Inferred user intent:** Spend engineering effort where it will survive: make
shared PBUI and real consumers safer, contain serious prototype risks, and
avoid gold-plating prototype architecture.

### What I did

- Created ticket `PBUI-PROD-1` with a design document, diary, phased tasks,
  changelog, and index.
- Re-read provider call sites, presentation keyboard handling, FileBrowser
  exports, stylesheet guard, datalab's real `WorkbenchProviders`, agentlogic's
  PBUI imports, hyperblog search/cache/editor paths, and turboproof's HTTP,
  filestore, and rename-binding paths.
- Established four implementation phases and a separate deferred register.
- Committed the preceding HANDOFF-PR-2 documentation separately as `b259185`
  (`docs: add intern review for outstanding findings`) before beginning this
  ticket.

### Why

- A required callback is useful only if every controlled composition is
  migrated atomically.
- A production composition test must exercise a real composition; inventing an
  agentlogic presentation provider would test a system that does not exist.
- Prototype fixes should be narrow enough that later product work can replace
  them without first undoing speculative architecture.

### What worked

- All five repositories began clean after the prior documentation commit.
- The existing tests expose clear seams for every selected behavior: PBUI uses
  jsdom, datalab can opt one test into jsdom, hyperblog has a server harness,
  and turboproof already separates filestore, server, and rename-binding tests.

### What didn't work

The first attempt to stage the prior HANDOFF documentation failed because this
workspace is a Git worktree whose administrative directory is outside the
writable sandbox:

```text
fatal: Unable to create '/home/manuel/code/wesen/hyperslop-systems/pbui/.git/worktrees/pbui2/index.lock': Read-only file system
```

The same intentional stage-and-commit operation succeeded with approved Git
write access. No unrelated files were staged.

### What I learned

- Most live PBUI findings are keyboard/accessibility findings, but the optional
  `onPerform` contract has the larger production blast radius because it permits
  commands to disappear silently.
- Agentlogic already implements the correct nested-control event-ownership
  predicate in `ChangesPanel`; that is evidence for a small shared rule, not for
  a universal keyboard hook.
- The selected prototype fixes align with existing seams and do not require the
  deferred corpus, verb-language, tile-scope, symlink, or synchronization
  redesigns.

### What was tricky to build

The difficult part was the boundary, not code. “Real app uses PBUI” does not
mean “real app uses every PBUI subsystem.” Searching actual imports and provider
construction prevented an invalid agentlogic test requirement. The session
keeps agentlogic in the verification matrix while limiting presentation-router
composition coverage to datalab, the real consumer.

### What warrants a second pair of eyes

- Confirm the fix-now/deferred split matches expected deployment of both
  prototypes. If either prototype is internet-facing, its wider auth and
  operational findings should be promoted.
- Review the exact semantics of turboproof's same-origin check behind any
  reverse proxy before deployment.

### What should be done in the future

- Promote the deferred PBUI FileBrowser ticket when datalab or agentlogic adopts
  the component.
- Revisit prototype architecture only alongside feature work that needs it.

### Code review instructions

- Begin with `tasks.md`, then read the design guide's scope and decision records.
- Compare the selected list to HANDOFF-PR-2; every omitted finding must appear
  in the deferred register rather than disappearing.
- Validate repository status before each focused commit.

### Technical details

Reviewed starting commits:

```text
pbui       b259185 (after committing the prior HANDOFF documentation)
datalab    71015a5
agentlogic d6c0e91
hyperblog  e622489
turboproof e9de793
```
