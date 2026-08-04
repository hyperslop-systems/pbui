---
Title: Harden PBUI contracts and contain prototype security and data-loss risks
Ticket: PBUI-PROD-1
Status: complete
Topics:
    - pbui
    - frontend
    - backend
    - review
    - refactoring
    - onboarding
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: 'Production-first implementation ticket: harden shared PBUI contracts and production consumer coverage, fix contained confidentiality and data-integrity defects in hyperblog and turboproof, and explicitly defer prototype architecture and polish.'
LastUpdated: 2026-08-03T22:25:00-04:00
WhatFor: 'Ship the small shared, security, and data-loss fixes whose value survives the prototype lifecycle while recording the larger findings without prematurely redesigning prototypes.'
WhenToUse: 'Use the design guide to review the implementation boundary and the diary to reproduce commits and validation.'
---

# Harden PBUI contracts and contain prototype security and data-loss risks

## Overview

This ticket applies a product-lifetime filter to HANDOFF-PR-2. PBUI and datalab
are treated as shared/production infrastructure; agentlogic is a production
consumer of PBUI components but does not currently instantiate PBUI's
presentation runtime. Hyperblog and turboproof are prototypes, so this session
fixes only contained confidentiality, disk/data-loss, and invariant defects.
Larger prototype refactors and interaction polish are documented and deferred.

## Key Links

- [Production-first implementation guide](./design-doc/01-production-first-pbui-hardening-and-prototype-containment-implementation-guide.md)
- [Implementation diary](./reference/01-implementation-diary.md)
- [Phased task list](./tasks.md)
- [Originating HANDOFF-PR-2 review](../HANDOFF-PR-2--the-38-outstanding-review-findings-and-the-five-structural-changes-that-would-retire-their-categories/design-doc/02-intern-architecture-and-code-review-pbui-hyperblog-turboproof-and-agentlogic.md)

## Status

Current status: **complete**

## Topics

- pbui
- frontend
- backend
- security
- testing
- onboarding

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- design-doc/ - Architecture, design, and implementation guidance
- reference/ - Prompt packs, API contracts, context summaries
- playbooks/ - Command sequences and test procedures
- scripts/ - Temporary code and tooling
- various/ - Working notes and research
- archive/ - Deprecated or reference-only artifacts
