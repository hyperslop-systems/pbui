# Tasks

Phases follow design-doc/02 §18 after the 2026-09-02 split (§0.1). Phases 8–10 live in PBUI-KERNEL-2/3/4.

## Research and design (done)

- [x] Map the kernel (core reads with line anchors) and survey consumers + prior tickets <!-- t:mj9s -->
- [x] Write the intern guide (current state, gaps, design, decisions, phases, tests) <!-- t:u9zf -->
- [x] Write diary step 1 <!-- t:a4n7 -->
- [x] Relate files, changelog, doctor <!-- t:fdth -->
- [x] Upload the guide + diary bundle to reMarkable <!-- t:y10y -->
- [x] Import and evaluate the composable-kernel research report and patch <!-- t:hn4v -->
- [x] Write the clean-cutover composable-kernel intern guide from the imported report and validated patch <!-- t:hcb4 -->
- [x] Validate and upload the clean-cutover guide and investigation diary to reMarkable <!-- t:u74f -->
- [x] Confirm D3 (hard cutover of createPbui) and D7 (mechanical change to frozen datalab-ui) with the user — both yes, C16/C17 <!-- t:7b5t -->
- [x] Redo the external consumer inventory (rag-ttc, hyperblog, turboproof, agentlogic) and fold it into §3.13.1, Phase 6, §20.3 <!-- t:inv1 -->
- [x] Split phases 8–10 into PBUI-KERNEL-2/3/4 <!-- t:spl1 -->

## Phase 0: Baseline inventory and characterization

- [x] Root typecheck + test + recursive typecheck green (331 tests) <!-- t:p0a -->
- [x] Golden fixtures for every consumer: menus, acceptance, help, vocabulary <!-- t:69bw -->
- [x] Record revision formulas per product <!-- t:p0c -->
- [x] Print plan slip <!-- t:p0d -->

## Phase 1: Shared predicates and selector

- [x] Apply sources/pbui-composable-kernel.patch; green <!-- t:p1a -->
- [x] One predicate registry shared by actions/help/relations <!-- t:4h96 -->
- [x] Explicit universal subject (`anyDeclaredType`); nullable scope provenance; no synthetic `__unscoped__` <!-- t:p1c -->
- [x] Final names in context/ (selector, no matchContext/ContextTarget aliases) <!-- t:p1d -->

## Phase 2: Canonical relation system

- [x] Relation exposure metadata; discovery filtered by interpreter <!-- t:p2a -->
- [x] Abstract codomain allowed; abstract/undeclared runtime output rejected <!-- t:p2b -->
- [x] Composition validation (acyclic, endpoint compatibility, inferred from/to) <!-- t:p2c -->
- [x] Relation vocabulary projection; scenario + property tests <!-- t:p2d -->

## Phase 3: Compiled model and fragments

- [x] `model/` replaces `kernel/`: definePresentation().fragment/create <!-- t:p3a -->
- [x] Fragment merge with origin tracking; duplicate/conflict diagnostics <!-- t:p3b -->
- [x] Closed-world cross-validation; strict descriptor completeness <!-- t:p3c -->
- [x] `snapshot(input)` with explicit revision / defaultActiveScopes / activeScopes validation <!-- t:4a96 -->
- [x] Static vocabulary + diagnostics() <!-- t:p3e -->

## Phase 4: Acceptance over relations

- [ ] translators/ → acceptance/; `AcceptanceOption.relation` <!-- t:p4a -->
- [ ] Delete PresentationTranslator, relationFromTranslator, old resolver branch <!-- t:p4b -->

## Phase 5: Runtime strict cutover

- [ ] createPbui({ presentation, defaultEnvironment, contextFor }); delete option bag <!-- t:ucdo -->
- [ ] `onRefuse` required on Provider <!-- t:p5b -->
- [ ] Instance exposes `presentation`; no `registry`/`kernel` aliases <!-- t:p5c -->
- [ ] Core stories, runtime tests, consumer-smoke migrated <!-- t:p5d -->

## Phase 6: Consumer and fragment cutover

- [ ] pbui-workbench: createWorkbenchPresentationFragment; createWorkbench/defineApp stable <!-- t:p6a -->
- [ ] pbui-chat: createChatPresentationFragment; presentation.descriptors; demo migrated <!-- t:p6b -->
- [ ] pbui-ecommerce: canonical relations, one graph, linkDeps from model <!-- t:p6c -->
- [ ] pbui-sandbox: fragment; anyDeclaredType <!-- t:p6d -->
- [ ] datalab-ui: mechanical migration (C17) <!-- t:p6e -->
- [ ] rag-ttc apps/workbench/web migrated against local pbui; vocabulary golden regenerated <!-- t:p6f -->
- [ ] hyperblog ui migrated (declared types, anyDeclaredType, relations) <!-- t:p6g -->
- [ ] Legacy-symbol grep across pbui/, rag-ttc/, hyperblog/ returns nothing <!-- t:krqf -->

## Phase 7: Link projection and dependency cleanup

- [ ] model.linkDeps: derivation-exposed relations only; serializable output check <!-- t:gpsg -->
- [ ] Remove empty-graph fallback and ecommerce's second graph <!-- t:p7b -->

## Phase 11: Release and deletion audit

- [ ] §20 checklist walked; README/playbook/link docs updated; doc 01 marked superseded <!-- t:p11 -->
- [ ] Screenshots (Storybook, ecommerce, rag-ttc, hyperblog) filed under various/screenshots and linked from the diary <!-- t:shot -->

## Parked

- [ ] Per-type order on inherited rules (first guide C5) <!-- t:rawd -->
- [ ] Turboproof upgrade 0.6.0 → post-KERNEL-1 (own ticket in that repo) <!-- t:tp1 -->
