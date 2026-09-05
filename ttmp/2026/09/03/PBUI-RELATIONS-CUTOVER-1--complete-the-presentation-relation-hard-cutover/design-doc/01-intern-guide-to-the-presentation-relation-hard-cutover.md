---
Title: Presentation-relation hard-cutover audit
Ticket: PBUI-RELATIONS-CUTOVER-1
Status: archived
Topics:
    - pbui
    - frontend
    - architecture
    - refactoring
    - onboarding
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources:
    - /tmp/pbui-improvements.md
Summary: Audit showing that PBUI-KERNEL-1 already completed the proposed presentation-translator-to-relation hard cutover, including Ecommerce and external consumers, so no second migration should be implemented.
LastUpdated: 2026-09-03T21:35:00-04:00
WhatFor: Prevent duplicate work based on the pre-cutover repository snapshot assessed in pbui-improvements.md.
WhenToUse: Consult when the old improvement list suggests that presentation translator compatibility still exists.
---

# Presentation-relation hard-cutover audit

## Conclusion

The proposed ticket was based on a stale recommendation in `/tmp/pbui-improvements.md`. Repository inspection shows that PBUI-KERNEL-1 already completed the hard cutover:

- `src/presentation/translators/` is deleted;
- `PresentationTranslator`, `relationFromTranslator`, `LegacyCreatePbuiOptions`, and `AcceptanceOption.translator` are absent;
- acceptance resolves exclusively through the canonical `RelationSystem`;
- links receive only `presentation.linkDeps(...)` and `relationEvaluation`;
- Ecommerce declares `PresentationRelation[]` in `packages/pbui-ecommerce/src/presentation/relations.ts` and uses the compiled presentation in `runtime.tsx` and `createShop.ts`;
- the KERNEL-1 diary records successful migration of Ecommerce, Datalab, Chat, rag-ttc, and hyperblog.

Only historical prose still uses “translator” to explain what a relation does. That is terminology, not a compatibility API or parallel interpreter.

## Decision

Do not create another migration or protective adapter. Archive this ticket as already satisfied and move to the next unimplemented recommendation: repository-wide dependency-DAG enforcement.

## Evidence

```bash
rg -n "PresentationTranslator|relationFromTranslator|LegacyCreatePbuiOptions|translators:|AcceptanceOption\.translator" \
  pbui rag-ttc hyperblog turboproof agentlogic --glob '*.{ts,tsx}'
# no semantic legacy matches
```

Canonical files:

- `src/presentation/relations/types.ts`
- `src/presentation/relations/system.ts`
- `src/presentation/acceptance/resolve.ts`
- `src/presentation/model/compile.ts`
- `packages/pbui-ecommerce/src/presentation/relations.ts`
- `packages/pbui-ecommerce/src/presentation/runtime.tsx`
- `ttmp/2026/09/02/PBUI-KERNEL-1--.../reference/01-investigation-diary.md`
