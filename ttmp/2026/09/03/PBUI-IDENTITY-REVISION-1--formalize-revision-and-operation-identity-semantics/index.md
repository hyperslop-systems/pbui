---
Title: Formalize revision and operation identity semantics
Ticket: PBUI-IDENTITY-REVISION-1
Status: complete
Topics:
    - architecture
    - pbui
    - workbench
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://ttmp/2026/09/03/PBUI-IDENTITY-REVISION-1--formalize-revision-and-operation-identity-semantics/design-doc/01-intern-guide-to-revision-and-operation-identity-semantics.md
      Note: Primary intern implementation guide
    - Path: repo://ttmp/2026/09/03/PBUI-IDENTITY-REVISION-1--formalize-revision-and-operation-identity-semantics/reference/01-investigation-diary.md
      Note: Chronological investigation and implementation diary
    - Path: repo://ttmp/2026/09/03/PBUI-IDENTITY-REVISION-1--formalize-revision-and-operation-identity-semantics/reference/03-full-validation-output.txt
      Note: Raw full-repository validation transcript
    - Path: repo://ttmp/2026/09/03/PBUI-IDENTITY-REVISION-1--formalize-revision-and-operation-identity-semantics/reference/04-hard-cutover-audit.txt
      Note: No-legacy source and built-declaration audit
    - Path: repo://ttmp/2026/09/03/PBUI-IDENTITY-REVISION-1--formalize-revision-and-operation-identity-semantics/reference/05-validation-summary.md
      Note: Validation command matrix and failure triage
ExternalSources:
    - /tmp/pbui-improvements.md
Summary: Ticket hub for separating Workbench local and server revisions from idempotent operation identity and replacing the sync loop's 32-bit request hash.
LastUpdated: 2026-09-03T23:19:27.074901521-04:00
WhatFor: Track the evidence, design, hard cutover, tests, and delivery for PBUI revision and operation identity semantics.
WhenToUse: Start here before implementing or reviewing PBUI-IDENTITY-REVISION-1 or changing Workbench synchronization identity.
---



# Formalize revision and operation identity semantics

## Objective

Make the Workbench concurrency vocabulary visible in TypeScript and replace the sync loop’s collision-prone 32-bit request key with a collision-resistant operation identity.

The implementation is intentionally bounded. It brands the identities whose accidental interchange is a current correctness risk:

- local Workbench installation revision;
- opaque server revision;
- idempotent synchronization operation ID.

Other repository identities—presentation semantic revisions, Chat event/effect IDs, Datalab analysis generations, and PlotScript tickets—remain in their owning subsystems. They are inventoried and named, not forced into one universal framework.

## Deliverables

- [Intern implementation guide](design-doc/01-intern-guide-to-revision-and-operation-identity-semantics.md)
- [Investigation diary](reference/01-investigation-diary.md)
- [Identity inventory](reference/02-identity-semantics-inventory.json)
- [Full validation output](reference/03-full-validation-output.txt)
- [Hard-cutover audit](reference/04-hard-cutover-audit.txt)
- [Validation summary](reference/05-validation-summary.md)
- [Tasks](tasks.md)
- [Changelog](changelog.md)

## Phases

```text
P0 inventory meanings
→ P1 brand Workbench identities
→ P2 replace FNV request hash
→ P3 migrate sync consumers
→ P4 prove retry/replay laws
→ P5 validate, document, and deliver
```

## Status

**Complete.** The hard cutover passes 250 focused core tests, 860 root tests, 1,565 child-package tests, all typechecks/builds, packed boundaries/consumers, Storybook builds, and Go CI parity. Docmgr validation is clean, the final implementation bundle is uploaded to reMarkable, and every thermal phase receipt is printed.
