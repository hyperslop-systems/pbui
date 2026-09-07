---
Title: Coordinated package release and registry verification
Ticket: PBUI-STYLE-002
Status: complete
Topics:
    - pbui
    - frontend
    - design
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://.github/workflows/publish.yml
      Note: Guarded workflow publication and verification
    - Path: repo://package.json
      Note: Core 0.12.1
    - Path: repo://packages/pbui-chat/package.json
      Note: Chat 0.4.1
    - Path: repo://packages/pbui-editor/package.json
      Note: Editor 0.2.0 with SQL support
    - Path: repo://packages/pbui-sandbox/package.json
      Note: Sandbox 0.4.1
    - Path: repo://packages/pbui-workbench/package.json
      Note: Workbench 0.6.1
    - Path: repo://scripts/verify-published-package.mjs
      Note: Registry version tag and dependency readback
ExternalSources: []
Summary: ""
LastUpdated: 2026-09-06T22:35:58.691591842-04:00
WhatFor: ""
WhenToUse: ""
---


# Coordinated package release and registry verification

## Goal

Release the changed public package set to GitHub Packages latest without overwriting existing versions. Preserve immutable source provenance and verify published workspace dependency ranges.

## Step 1: Version set, immutable source and five dry runs

Compared the current tree with the successful prior publish workflow commits. Five published packages have unreleased changes: core, workbench, editor, sandbox and chat. Editor includes the previously unreleased SQL/MySQL language support and receives a minor version; the visual and compatible integration fixes receive patch versions. Unchanged protocol/core/domain packages are not republished.

The user had rebased the working branch after the original implementation report. Its current source commits have different hashes, while the new styling changes remain ahead of main. Pinned the actual release source with a new tag instead of relying on a moving branch. Added registry readback to the five existing workflows so a green real publication also establishes version, dist-tag and rewritten workspace ranges.

### Prompt Context

**User prompt (verbatim):** "Release the new package versions"

**Assistant interpretation:** Publish the changed package set using the repository's guarded release workflows.

**Inferred user intent:** Make the implemented styling and editor support installable by downstream consumers.

**Commit (code):** ed5b2a965fae6da1d8ec301c047b8b627547cb2b — "release: version visual alignment packages and verify registry readback"

### What I did
- Set PBUI 0.12.1, workbench 0.6.1, editor 0.2.0, sandbox 0.4.1 and chat 0.4.1.
- Regenerated the lockfile offline; no lockfile delta was necessary because local workspace references remain links. Frozen offline installation succeeded.
- Added `scripts/verify-published-package.mjs`, five Node tests, and a real-publication-only readback step to each workflow.
- Ran all five helper tests and actionlint successfully. Normal pre-push checks passed in 75 seconds; no hook bypass.
- Pushed branch and immutable tag `pbui-style-release-20260907` at ed5b2a9.
- Dispatched all five dry runs on that tag with `skip_existing=false`; every run passed and logged its expected new version.

### Why
- Core must be available before dependent publications; editor/workbench precede sandbox, then chat.
- GitHub Packages versions are immutable. A successful dry run is not proof of a published artifact, so the real path verifies registry metadata afterward.

### What worked
- GitHub Actions credentials installed private dependencies and completed all dry-run validation.
- Core workflow includes typecheck, tests, build, Storybook and clean tarball consumer validation.

### What didn't work
- Local `npm view @hyperslop-systems/pbui version --registry=https://npm.pkg.github.com` returned `E403` and `Permission permission_denied: The token provided does not match expected scopes.` Used existing workflow credentials; did not expose credentials or weaken registry permissions.
- `npm` reports the existing deprecated `always-auth` config warning; this is not a release failure.

### What I learned
- Main had merged the onboarding PR, not these newer styling commits. Publishing main would omit the requested changes.
- Workspace version bumps need not change pnpm-lock.yaml when the lockfile stores local link paths; packed manifests still need new semver ranges.

### What was tricky to build
- Registry metadata can lag immediately after publication. Readback retries ten times at six-second intervals, validates exact version/tag, and compares every workspace dependency against the source package versions. It never republishes to repair a verification error.

### What warrants a second pair of eyes
- Editor's minor version means existing consumers pinned to ^0.1 must opt into ^0.2 for SQL support. The newly published sandbox will require the new range.
- A real publish is externally visible and irreversible at that version; all runs use the same source tag and existing restricted-access registry.

### What should be done in the future
- Complete real publications in dependency order and record registry verification results below.

### Code review instructions
- Start with the five package manifests and the verification helper/tests. Inspect workflow run head SHA, publish notices and final JSON readback.
- Run `node --test scripts/verify-published-package.test.mjs` and actionlint on the changed publish workflows.

### Technical details

| Package | Version | Successful dry-run ID |
|---|---|---|
| PBUI | 0.12.1 | 34077086318 |
| Workbench | 0.6.1 | 34077087449 |
| Editor | 0.2.0 | 34077088641 |
| Sandbox | 0.4.1 | 34077089795 |
| Chat | 0.4.1 | 34077091306 |

Run URLs use `https://github.com/hyperslop-systems/pbui/actions/runs/<ID>`.

Real publication command: `gh workflow run <workflow> --ref pbui-style-release-20260907 -f npm_tag=latest -f dry_run=false -f skip_existing=false -f confirm_latest_publish=CONFIRM_LATEST`.

## Step 2: Real publications and registry readback

Published the complete five-package set to the restricted GitHub Packages registry under latest. Core completed first, followed by workbench/editor, then sandbox, then chat. Every real workflow completed successfully at the same source SHA and returned a registry readback confirming its exact version, latest tag and workspace dependency ranges.

The last readback completed at 2026-09-07T02:46:54Z for chat 0.4.1. Publication did not depend on local registry access, and no existing immutable version was replaced. The receipt collector independently checks all ten workflow conclusions/source hashes and extracts the five JSON readbacks into the ticket.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Complete real publication only after successful dry runs, and retain proof of the registry result.

**Inferred user intent:** Make the new versions available for downstream installation with a coherent dependency set.

### What I did
- Published PBUI 0.12.1, Workbench 0.6.1, Editor 0.2.0, Sandbox 0.4.1 and Chat 0.4.1 to latest.
- Verified all packages' exact version/tag and rewritten workspace dependency ranges in the real workflows.
- Collected run metadata/readbacks in `various/validation/12-release-receipts.json` using the ticket-owned `scripts/05-collect-release-receipts.py`.
- Updated the change-inventory script to the rebased equivalents now preserved by the source tag, and included the release checkpoint.

### Why
- A successful upload message alone does not validate dependency metadata. In particular, sandbox must resolve editor ^0.2.0 and workbench ^0.6.1, while chat must resolve sandbox ^0.4.1.

### What worked
- Five dry runs and five real workflows passed; all ten reference ed5b2a965fae6da1d8ec301c047b8b627547cb2b.
- Registry readbacks show core ^0.12.1 across dependents, editor ^0.2.0 in sandbox, and sandbox ^0.4.1 in chat.
- Editor readback includes @codemirror/lang-sql 6.10.0.

### What didn't work
- No real publication failed. GitHub emits an existing Actions Node-runtime deprecation annotation; publishing and readback still completed.
- The repository still reports one high-severity dependency alert on its default branch. This release does not claim vulnerability remediation.

### What I learned
- Historical implementation hashes were rewritten by the user's rebase: cf4cf5a → d948d61, 5e4970e → 9c6bc6d, 46e3a30 → b390455, and final docs 509bce4 → e087b1e. Capture labels retain their original history; reproduction uses the release tag's reachable commits.

### What was tricky to build
- Avoided allowing a moving branch to alter later packages in the sequence. Both dry and real dispatches used the same tag, and the collector rejects any unexpected workflow head SHA.

### What warrants a second pair of eyes
- The source branch and tag are pushed, but these newer commits have not been merged into main as part of this release. Downstream consumers should use the verified versions, not assume main currently contains the entire release.
- Local registry credentials still need suitable read scopes for installation outside CI.

### What should be done in the future
- Consumers pinned to older editor/workbench versions can now upgrade deliberately. Merge the release/source branch through normal review when ready.

### Code review instructions
- Inspect `12-release-receipts.json` and the linked runs below. Rerun the read-only collector to verify workflow evidence.
- Compare packed dependency ranges in the readback with the source tag's manifests. Do not move the source tag or try to republish the same versions.

### Technical details

| Package | Published latest | Real publication run |
|---|---|---|
| @hyperslop-systems/pbui | 0.12.1 | [34077167380](https://github.com/hyperslop-systems/pbui/actions/runs/34077167380) |
| @hyperslop-systems/pbui-workbench | 0.6.1 | [34077248099](https://github.com/hyperslop-systems/pbui/actions/runs/34077248099) |
| @hyperslop-systems/pbui-editor | 0.2.0 | [34077249611](https://github.com/hyperslop-systems/pbui/actions/runs/34077249611) |
| @hyperslop-systems/pbui-sandbox | 0.4.1 | [34077323964](https://github.com/hyperslop-systems/pbui/actions/runs/34077323964) |
| @hyperslop-systems/pbui-chat | 0.4.1 | [34077377586](https://github.com/hyperslop-systems/pbui/actions/runs/34077377586) |

Registry: `https://npm.pkg.github.com`. Source tag: `pbui-style-release-20260907`. Package access remains restricted.
