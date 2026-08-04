# Changelog

## 2026-08-03

- Initial workspace created


## 2026-08-03 - Shared PBUI contract and production composition

Made PBUI verb routing required, gated keyboard activation by event ownership, added datalab's real PBUI-to-Redux composition test, exported FileBrowser RootState, and repaired the root-selector wiring guard (commit e903dbd).

### Related Files

- /home/manuel/workspaces/2026-07-30/transcript-agent/pbui/packages/datalab-ui/src/components/pages/Workbench/WorkbenchProviders.test.tsx — Production datalab PBUI-to-Redux composition proof added in e903dbd.
- /home/manuel/workspaces/2026-07-30/transcript-agent/pbui/src/presentation/createPbui.tsx — Required verb router and nested-control event ownership implemented in e903dbd.


## 2026-08-03 - Hyperblog confidentiality and draft containment

Excluded locked prose before search matching, marked owner-scoped workbench responses private/no-store with credential Vary, and made question close persist the current draft once; full Go/UI/typecheck verification passed (commit 08177a5).

### Related Files

- /home/manuel/workspaces/2026-07-30/transcript-agent/hyperblog/pkg/glossary/search.go — Tier gate now excludes locked bodies before matching (commit 08177a5).
- /home/manuel/workspaces/2026-07-30/transcript-agent/hyperblog/ui/src/components/molecules/NoteEditor/NoteEditor.tsx — Blur-to-close now saves the current draft once in 08177a5.


## 2026-08-03 - Turboproof mutation and document identity containment

Required JSON/same-origin create and rename requests, rejected missing PUT text, separated canonical roots, classified directory fingerprints, and preflighted open-document rename destinations; full Go/UI/typecheck and pre-commit quality checks passed (commit b7bd9fb).

### Related Files

- /home/manuel/workspaces/2026-07-30/transcript-agent/turboproof/pkg/server/handlers_files.go — Browser-to-disk mutation guard and required PUT text implemented in b7bd9fb.
- /home/manuel/workspaces/2026-07-30/transcript-agent/turboproof/pkg/filestore/store.go — Canonical root overlap and directory fingerprint guards implemented in b7bd9fb.
- /home/manuel/workspaces/2026-07-30/transcript-agent/turboproof/ui/src/store/renameBinding.ts — Destination URI preflight and current-state rebinding implemented in b7bd9fb.


## 2026-08-03 - Review package delivered

Completed the 800-line architecture/code-review guide and strict implementation diary, passed docmgr doctor with warnings treated as failures, committed the package as 2669316, and uploaded the five-document PDF bundle to `/ai/2026/08/03/PBUI-PROD-1`.
