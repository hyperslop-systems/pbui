# Screenshots — PBUI-KERNEL-4 (2026-09-02)

Captured with Playwright at 1400×900 against the core pbui Storybook (`pnpm storybook` at the repo root, port 6006), story group `Presentation/Interaction (KERNEL-4)` added in P6. The three stories share one compiled presentation: a person with an always-available Open, an Email that goes unavailable when a directory lock is set, a hidden Audit rule, an admin-only Purge, and a note that fits a person through two acceptance relations. Console errors: `favicon.ico` 404 only.

| File | What it shows | Evidence for |
|---|---|---|
| `01-stale-row-menu-open.png` | Ada's menu open with Email and Open; the directory was locked from the console after the menu resolved | The row is a proposal resolved before the lock |
| `02-refusal-notice.png` | After clicking Email: no verb performed; the RefusalNotice reads “Email” is no longer available on Ada Lovelace — the directory is locked, with the hint and a dismiss | P4: fresh revalidation refuses, the runtime presents the refusal |
| `03-accept-chooser-open.png` | After “pick a person…” and a click on the note: the banner (ACCEPTING <person>) and the chooser with “the author” and “the person mentioned” | P2/P3: an ambiguous offer moves the machine to `choosing` under the same request |
| `04-chooser-escaped-request-kept.png` | After Escape on the chooser: the chooser is gone, the banner stays, nothing picked | The machine's rule: chooser Escape keeps the request |
| `05-chooser-option-settled.png` | After choosing “the person mentioned”: banner gone, “picked the person mentioned” | `choose` settles with that option's result |
| `06-explain-public.png` | `pbui.explain(menu query, "public")`: two rows (Email, Open) with availability; no trace, no hidden Audit, no admin Purge | P5: public disclosure is the menu |
| `07-explain-developer.png` | The same query under `developer`: each row with its trace entries (stage, result), and the other candidates below | P5: developer explains the same rows, with the trace |
