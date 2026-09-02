# Changelog

## 2026-09-02

- Initial workspace created


## 2026-09-02

Step 1: mapped the presentation kernel, surveyed six consumers and seven prior tickets, wrote the consolidation guide (14 sections, 9 decision records, 8 phases) and diary step 1

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/presentation/actions/registry.ts — The registry the kernel object builds on
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/presentation/createPbui.tsx — The runtime the design changes


## 2026-09-02

Step 2: imported and evaluated the composable-kernel report and patch without applying them to the active branch; patch applies cleanly, root typecheck and 347 tests pass, recursive workspace typecheck passes

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/02/PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-runtime-that-binds-them/sources/PBUI-Composable-Kernel-Research-Report.md — Byte-identical imported research report
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/02/PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-runtime-that-binds-them/sources/pbui-composable-kernel.patch — Byte-identical imported implementation patch


## 2026-09-02

Step 3: wrote the authoritative 25-section clean-cutover composable-kernel intern guide, superseded the original API plan, validated the ticket, and uploaded the guide + diary bundle to reMarkable

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/02/PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-runtime-that-binds-them/design-doc/02-clean-cutover-composable-pbui-presentation-semantics-kernel-intern-analysis-design-and-implementation-guide.md — Authoritative clean-cutover architecture, APIs, decisions, phases, tests, and release guide
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/02/PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-runtime-that-binds-them/reference/01-investigation-diary.md — Step 3 authoring rationale, review risks, validation, and reMarkable delivery evidence


## 2026-09-02

Step 4: assessed the guide, redid the consumer inventory (rag-ttc primary, hyperblog open-world, turboproof/agentlogic out), confirmed C16/C17, added C18, split Phases 8–10 into PBUI-KERNEL-2/3/4 (commit 312bffd)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/02/PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-runtime-that-binds-them/design-doc/02-clean-cutover-composable-pbui-presentation-semantics-kernel-intern-analysis-design-and-implementation-guide.md — §0.1, §3.13.1, C16–C18, Phase 6 rewritten


## 2026-09-02

Step 5 / Phase 1: applied the prototype patch (d2ee0c2); one selector substrate with explicit anyDeclaredType, nullable scope provenance, closed type world; no matchContext/ContextTarget aliases (commit 0007f6f)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/presentation/actions/typeGraph.ts — Closed world — undeclared subject types throw
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/presentation/context/selector.ts — The shared selector: selectorOf, matchSelector, requireScoped


## 2026-09-02

Step 6 / Phase 2: relation exposure, exposed(interpreter) discovery filter, abstract codomains with concrete outputs, unreachable-private diagnostic (commit 0309a70)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/presentation/relations/system.ts — Exposure normalization, filtered discovery, output validation


## 2026-09-02

Step 7 / Phase 3: model/ replaces kernel/ — fragments with origin tracking, explicit context input, known/default/active scopes, strict descriptors, diagnostics, vocabulary, linkDeps projection; createPbui takes { presentation, contextFor } (commit 94f6cb1)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/presentation/model/compile.ts — The compiler: fragment merge, closed-world validation, snapshot, linkDeps


## 2026-09-02

Step 8 / Phase 4: acceptance/ over relations, AcceptanceOption.relation, translator resolver deleted, AcceptableType admits abstract requests (commit 7ba3b3d)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/presentation/acceptance/resolve.ts — Acceptance over acceptance-exposed relations


## 2026-09-02

Step 9 / Phase 5: strict createPbui({ presentation, contextFor }), onRefuse required, legacy option bag and adapters deleted, core tests/stories/smoke migrated (commit 9102723)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/presentation/createPbui.tsx — The strict runtime assembly

