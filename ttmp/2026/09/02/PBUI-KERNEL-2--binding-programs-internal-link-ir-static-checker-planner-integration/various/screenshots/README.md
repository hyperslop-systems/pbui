# Screenshots — PBUI-KERNEL-2 (2026-09-02)

Captured with Playwright at 1400×900 against local dev servers after P4 (planners on the checker; IR internal). The pbui-workbench Storybook (`pnpm storybook` in `packages/pbui-workbench`, port 6008) and the gold-coin shop demo (`pnpm dev` in `packages/pbui-ecommerce/demo`, port 5176). Console errors: `favicon.ico` 404s, and one pre-existing React "setState in render" warning from the LinkLab's demo counter app.

| File | What it shows | Evidence for |
|---|---|---|
| `01-linklab-follow.png` | Workbench/LinkLab after "notes.subject → follow counter.count" and two counts: the notes badge reads `→ Counter A`, the port shows `<number> 2` | `planFollow` → `candidateTermOf(port.follow)` → `applyLinkVerb` persists the same term (P3) |
| `02-linklab-held.png` | After Pin and one more count: the counter is at 3, the notes port is held on `<number> 2`; the explanation reads "subject is held on <number>; resume follows Counter A" | Held value independent of upstream (§19.6); the suspended wire is named from the program's dependencies |
| `03-linklab-resumed.png` | After Resume: the port follows Counter A again and shows 3 | `resume(pin(b)) == b` at the document level; the link document is as before the pin |
| `04-shop-linked-order-detail.png` | Gold-coin shop after "Link to order detail · order" on order #88150: the detail's badge reads `→ orders`, the detail shows #88150 | The workbench's "Link to…" family plans through `planFollow`/`planBind`, both now on the checker |
| `05-shop-port-badge-menu.png` | Right-click on the detail's port badge: Pin available; Resume and Detach unavailable with "order detail · order is not held"; unlink policies; Derive through…; Show wiring | Planner operation policy (held / not held) stays in the planners after P4 |
| `06-shop-held-refusal-in-link-to.png` | After Pin, right-click on order #88151: "Link to order detail · order — order detail · order is held; resume or detach it first" | A refusal from operation policy rendered by the "Link to…" family's `statusOf(plan)`; type refusals never reach this menu because the family pre-filters targets by `reaches` |
