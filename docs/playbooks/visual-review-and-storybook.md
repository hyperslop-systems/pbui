# Visual review and Storybook

Use this playbook to approve appearance and interaction after building or refactoring a panel. Typechecking, a story build and a screenshot answer different questions. Record which evidence you actually obtained.

## 1. Establish the reference

Choose an existing component/story that demonstrates the same visual role. Turboproof and Datalab are useful product references, but shared core components define the reusable contract. Inspect both source and rendered output before copying a domain component.

Record reference story/URL, revision, viewport, data state and loaded theme/font. Capture the initial target state before modifying it. For a structure-only refactor, unexpected pixel changes are regressions. For an intentional redesign, identify the intended visual differences rather than requiring pixel equality to the old design.

Crop reference excerpts only for readability and label them as crops. An isolated Goals story is not a full-shell screenshot; a source-panel screenshot is not table-runtime evidence. Never include credentials or private production data. Prefer synthetic, wire-shaped fixtures checked against types/contracts. Sanitized captured data requires deliberate review and provenance; “real data” is not permission to commit secrets.

## 2. Separate two kinds of stories

**Pure panel stories** pass DTOs and callbacks. Controlled inputs need a local Live/Demo wrapper so they can be edited. Use these to reach awkward states without a backend.

**Native integration stories** mount a real registry, document, workbench surface and bounded host. Mount the product presentation provider where interactions need it. Use these to inspect title bars, menus, focus ownership and layout. A hand-drawn frame is acceptable for an isolated panel but cannot prove native wiring or persistence.

The compiled [StyledPanel stories](../../packages/pbui-workbench/src/stories/StyledPanel/StyledPanel.stories.tsx) demonstrate both. They share a host decorator within that example. Do not assume there is a universal `withHost` API in every package; inspect each preview and reuse its existing decorators before adding one.

## 3. Minimum state matrix

| Region | Required review states |
|---|---|
| Input/control | Default, editable, disabled with reason, keyboard focus, relevant variants |
| Panel | Populated, empty, loading, error, unavailable/locked where meaningful |
| Layout | Narrow width, short height, long values, overflow, nested composition if supported |
| Data table | Exact values, null versus empty, duplicate labels if supported, truncation and row detail |
| Theme | Default, intentional override, portal surfaces if themed, structural slot if offered |
| Integration | Visible entry points, native chrome, focus/shortcut ownership, stable state while rearranging |

Only promise unstyled coverage when the package actually has an isolated unstyled entry point. Do not add a fake `unstyled` prop or call a two-token override unstyled mode. A state is useful when a reviewer can identify a defect, not just because it adds another row count.

Use existing package sidebar prefixes. Workbench examples live under `Workbench/...`; Datalab's layer prefixes are checked by its own tests. Do not impose a new naming scheme that contradicts an existing package's enforced convention.

## 4. Review in a browser

1. Set the viewport explicitly; browser/tool restarts may reset it.
2. Wait for the intended state and fonts, not just initial DOM presence.
3. Inspect labels, disabled reasons, focus outlines, clipping and both scroll axes.
4. Exercise keyboard and visible buttons. On Apple platforms use Command for Mod; elsewhere Control. Test focus inside and outside the workbench, and while another dialog is open.
5. Inspect the browser console. Fail on unexpected errors. Record expected HTTP/auth/fixture errors by cause; do not accept all console errors globally.
6. Compare matched states against the reference. Describe the actual change: missing border restored, label retained, value no longer widens pane, editor no longer clipped.
7. Save the final screenshot with revision, viewport, story/route and limitations.

A large viewport can make a defect disappear without fixing it. A narrow screenshot must actually exercise narrow layout. A successful DOM query does not prove visible geometry, and a screenshot does not prove authorization or side-effect ordering.

## 5. Automated checks and their limits

Run the affected package's typecheck, tests, production build and Storybook build. A source example must participate in those checks, not live as uncompiled Markdown alone. Test controlled editing, explicit action dispatch and disabled behavior; use real browser checks for layout and portals.

Existing useful guards include core token/stylesheet tests, workbench phantom-token/raw-control/component-folder tests, and Datalab's layer/story tests. Verify the current test files rather than repeating historical counts. Source grep checks need narrow documented exemptions and cannot prove accessibility by themselves.

For consumer stylesheet parity, extract the shared import list from each entry point and compare it; separately review declared feature-specific differences. For package portability, use a clean consumer install/build, not just a sibling `link:` checkout. The root `consumer:smoke` covers core; do not extrapolate it to every package.

## 6. Review receipt

Copy this into the PR/diary and fill it with actual evidence:

```text
Change and revision:
Reference and revision:
Runtime/story stylesheet foundation and intentional differences:
Viewport/font/theme/data state:
Pure-panel states inspected:
Native integration gestures inspected:
Commands and results:
Console errors investigated or absent:
Before/after screenshot paths:
Intentional appearance changes:
Not tested / remaining limitations:
```

Commit targeted changes at working checkpoints. Keep secrets, real dumps, generated bundles and temporary validation stores out of the commit. If a checkpoint fails, record the exact error and corrective commit rather than describing the whole history as continuously green.
