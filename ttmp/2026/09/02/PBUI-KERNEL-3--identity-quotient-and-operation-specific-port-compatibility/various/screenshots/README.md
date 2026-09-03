# Screenshots — PBUI-KERNEL-3 (2026-09-02)

Captured with Playwright at 1400×900 against the pbui-workbench Storybook (`pnpm storybook` in `packages/pbui-workbench`, port 6008), story `Workbench/IdentityLab` added in P5. Three pickers each own an inout `selection` port; Picker A and Picker B share a contract (authority `orders`), Sales has authority `daily_sales`. No console errors.

| File | What it shows | Evidence for |
|---|---|---|
| `01-identitylab-private-values.png` | A picked 2, B picked 3, each reads its own value; no cells | The baseline: three ports, no declarations, `quotientOf` reports no cells |
| `02-identitylab-shared-cell.png` | After "A ≡ B": both badges read `≡ selection · σ1`, both show 2 (`prefer-left`), the panel lists cell σ1 with both members and `cellByPort` | `planIdentityAdd` through `canShareCell`; the quotient a snapshot exposes (P4) |
| `03-identitylab-write-through-cell.png` | B picks 1; A shows 1 too | A member writes the shared cell (`useEmitPort` routes through the alias) |
| `04-identitylab-incompatible-refused.png` | "A ≡ Sales" is refused: "different authority domain: orders vs daily_sales"; cells unchanged | `canShareCell`'s protocol projection, reported by field; flow would have allowed this pair |
| `05-identitylab-split-history.png` | After "leave · history": A shows 2 and B shows 3 again, no cells, no declarations | `identity.remove` with the history split policy restores the pre-merge private values |
