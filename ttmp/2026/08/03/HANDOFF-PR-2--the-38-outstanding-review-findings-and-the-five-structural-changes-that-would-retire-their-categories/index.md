---
Title: The 38 outstanding review findings, and the five structural changes that would retire their categories
Ticket: HANDOFF-PR-2
Status: active
Topics:
    - pbui
    - frontend
    - backend
    - review
    - onboarding
    - refactoring
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: 'Architecture and code-review handoff for 38 unresolved findings across pbui, turboproof, hyperblog, and agentlogic, including an intern guide, evidence diary, and category-level remediation design.'
LastUpdated: 2026-08-03T19:29:46.145495805-04:00
WhatFor: 'Understand the four-repository PBUI family and implement the 38 review findings at their owning architectural boundaries.'
WhenToUse: 'Begin with the intern guide for architecture, then use the original finding design and tasks for implementation sequencing.'
---

# The 38 outstanding review findings, and the five structural changes that would retire their categories

## Overview

This ticket captures the verified set of 38 unresolved review findings across
pbui, turboproof, hyperblog, and agentlogic. Its documents explain the shared
presentation and workbench protocols, the product-specific runtime and storage
boundaries, and six structural decisions intended to retire recurring defect
categories. The review and delivery work is complete; the 38 code changes remain
open and are tracked in `tasks.md`.

## Key Links

- [Intern architecture and code review](./design-doc/02-intern-architecture-and-code-review-pbui-hyperblog-turboproof-and-agentlogic.md)
- [Original 38-finding structural design](./design-doc/01-fix-the-categories-not-the-instances-a-design-for-the-38-open-findings.md)
- [Investigation diary](./reference/01-investigation-diary.md)
- [Open-finding source snapshot](./sources/01-open-findings-2026-08-03.txt)
- [Implementation tasks](./tasks.md)

## Status

Current status: **active**

## Topics

- pbui
- frontend
- backend
- review
- onboarding
- refactoring

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- design-doc/ - Architecture, review, and remediation design documents
- reference/ - Prompt packs, API contracts, context summaries
- playbooks/ - Command sequences and test procedures
- scripts/ - Temporary code and tooling
- various/ - Working notes and research
- archive/ - Deprecated or reference-only artifacts
