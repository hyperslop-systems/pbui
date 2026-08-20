# Changelog

## 2026-08-20

- Initial workspace created


## 2026-08-20

Opened the ticket and wrote design-doc/01, a 1300-line intern guide: analysis of the three systems and the five gaps, the three-layer tool surface (declarative LayoutSpec / verbs as data / raw MutationBatch), the safety envelope (limits, policy via pbui_propose, snapshot undo), a five-tier implementation plan with pseudocode, four demo tile types, four sequences, twelve failure modes, and full API and file references. Key finding: pbui-workbench exposes no workspace verbs at all, so the headline gesture is blocked on ~80 lines there rather than on anything in the agent; and no new wire types are needed because the frontend-tool manifest bridge already carries browser tools to the model.


## 2026-08-20

Uploaded design-doc/01 to reMarkable at /ai/2026/08/20/PBUI-AGENT-2


## 2026-08-20

Discovered PBUI-WORKBENCH-2 (unify the four product shells around pbui-workbench) after writing the guide; it owns the workspace-verb gap from the products' side. Rewrote guide Tier 0 from an implementation plan into a dependency and requirements list on its Phase 1, aligned the naming (workspace.select, not workspace.switch), adopted its onRejected as the R9 fix and createTileDescriptor as the G7 fix, added the three verbs its 5.C brings (tile.replace, tile.link, view.rebind) plus workspace.clone to the agent surface, and recorded D15: sequence WORKBENCH-2 Phase 1 first, start this ticket at Tier 1.

