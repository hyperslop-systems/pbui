# Changelog

## 2026-08-03

- Initial workspace created


## 2026-08-03

Phase 1 complete: src/styles.css now ships (it never had), its pre-shipping muted-text bug fixed before it could regress every menu, a :where(:root) typographic baseline added because pbui defined --pbui-font and never applied it, all four stylesheets assembled into one export, and agentlogic's Storybook drift fixed and guarded (pbui 7098054, agentlogic c23a8af)

### Related Files

- /home/manuel/workspaces/2026-07-30/transcript-agent/agentlogic/ui/src/styles-parity.test.ts — Storybook and the product must load the same foundation
- /home/manuel/workspaces/2026-07-30/transcript-agent/pbui/src/index.ts — The import order is the cascade; parts files sit below the re-exports so they win ties at (0,1,0)
- /home/manuel/workspaces/2026-07-30/transcript-agent/pbui/src/styles-wiring.test.ts — No stylesheet is orphaned — the guard that would have caught styles.css


## 2026-08-03

Documentation brought to 0.4.0: both playbooks, the README, TURBOPROOF-5's defect report (§8 resolution note) and AGENTLOGIC-UI-2's re-scoped gaps. Fixed pnpm consumer:smoke, which P5.1 had broken and which is the pre-publish gate (commits 4edc7a8, a59c7ce)

### Related Files

- /home/manuel/workspaces/2026-07-30/transcript-agent/pbui/scripts/consumer-smoke.mjs — The only check that compiles against the published package shape rather than src/

