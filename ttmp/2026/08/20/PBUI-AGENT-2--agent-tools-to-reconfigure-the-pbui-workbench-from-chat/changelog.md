# Changelog

## 2026-08-20

- Initial workspace created


## 2026-08-20

Opened the ticket and wrote design-doc/01, a 1300-line intern guide: analysis of the three systems and the five gaps, the three-layer tool surface (declarative LayoutSpec / verbs as data / raw MutationBatch), the safety envelope (limits, policy via pbui_propose, snapshot undo), a five-tier implementation plan with pseudocode, four demo tile types, four sequences, twelve failure modes, and full API and file references. Key finding: pbui-workbench exposes no workspace verbs at all, so the headline gesture is blocked on ~80 lines there rather than on anything in the agent; and no new wire types are needed because the frontend-tool manifest bridge already carries browser tools to the model.


## 2026-08-20

Uploaded design-doc/01 to reMarkable at /ai/2026/08/20/PBUI-AGENT-2


## 2026-08-20

Discovered PBUI-WORKBENCH-2 (unify the four product shells around pbui-workbench) after writing the guide; it owns the workspace-verb gap from the products' side. Rewrote guide Tier 0 from an implementation plan into a dependency and requirements list on its Phase 1, aligned the naming (workspace.select, not workspace.switch), adopted its onRejected as the R9 fix and createTileDescriptor as the G7 fix, added the three verbs its 5.C brings (tile.replace, tile.link, view.rebind) plus workspace.clone to the agent surface, and recorded D15: sequence WORKBENCH-2 Phase 1 first, start this ticket at Tier 1.


## 2026-08-20

B3: four demo tile types (inventory, sku, metals, notes) plus demo/src/world.ts, a TS mirror of pkg/chatserver/demo/data.go, registered beside createChatApps(chat). inventory proves a duplicable data tile whose rows are <product> presentations; sku proves doc-binding and titleFor; metals proves singletons and linked placements; notes is the first caller of documentPut/documentDelete and the WorkbenchDocument.documents map. Deviations from guide §7 and open risks (undeclared @bufbuild/protobuf in demo/package.json, world.ts drift) recorded in reference/01-diary.md Step 1. (commit 531df03)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/demo/src/apps/NotesApp/NotesApp.tsx — documentPut/documentDelete, the debounce and cap, and the document_in_use demonstration
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/demo/src/apps/createDemoApps.ts — The four AppDescriptors
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/demo/src/workbench.ts — The one-line registration
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/demo/src/world.ts — Hand-written mirror of data.go; nothing enforces the correspondence — see the diary for two ranked fixes


## 2026-08-20

B0-B3 landed (13734a1, 1c65426, 531df03, 455c756, 668759d, dfbab54). B0: specOf and describeWorkbench. B1: six browser-side workbench tools, all going through the product router so an agent's rearrangement lands in the trace beside a human's. B2: tile/workspace/app presentation types, twenty workbench verb kinds spelled as pbui-workbench spells them, the tile descriptor from createTileDescriptor, and a prompt section gated on the vocabulary. B3 (subagent): four demo tile types and a TS mirror of the Go demo world. Right-clicking a tile bar now offers the same verbs the chrome buttons perform, which completes PBUI-WORKBENCH-2 Phase 2's acceptance gesture.


## 2026-08-20

Addressed the PR #11 review (84f175e): six findings, all real. Two P1s — performWorkbenchVerb discarded every handler refusal so the agent was told refused changes had applied, and isApproved never saw the operation so one approval authorised every confirm-policy verb. Plus openView de-duplicating globally while going to a view locally, the generic perform tool validating no ids at all, application availability being honoured by the launcher and not by the agent, and workbench_apply being advertised while unimplemented. 25 new tests.


## 2026-08-20

Step 5: addressed PR #11 follow-up review by centralizing high-level policy enforcement, requiring exact raw-batch approval, and separating committed mutations from post-commit hook failures (commits 1be63cf, af8262e)

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/tools/workbenchTools.ts — Policy and raw approval redesign
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-workbench/src/store.ts — Honest post-commit failure semantics

