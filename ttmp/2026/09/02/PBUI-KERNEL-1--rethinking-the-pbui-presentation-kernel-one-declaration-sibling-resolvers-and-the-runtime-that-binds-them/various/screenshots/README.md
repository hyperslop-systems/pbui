# Screenshots — PBUI-KERNEL-1 (2026-09-02)

Every screen below runs on the post-cutover packages: one compiled presentation per product, `createPbui({ presentation, contextFor })`, fragments from pbui-workbench / pbui-chat / pbui-sandbox. Captured with Playwright at 1400×900 against local dev servers (vite / Storybook); no Go backends were running, so backend-dependent panels show their "not connected" states, which is expected. Console errors on every page: only `favicon.ico` 404s (and 502s from the absent backends).

| File | What it shows | Evidence for |
|---|---|---|
| `01-ecommerce-shop-workbench.png` | The gold-coin shop workbench (orders table, order detail, inspector) rendered from `createShopPresentation` | Phase 6: ecommerce on the workbench fragment + shop fragment; links from `presentation.linkDeps` |
| `02-ecommerce-order-menu.png` | Right-click on order #88150: "Show details…", "Link to inspector · subject", "Link to order detail · order" | The "Link to…" family declared on `inspectable` by the workbench fragment, resolving over the one graph |
| `03-chat-demo-workbench.png` | pbui-chat demo shell (conversation, inspector, watchlist, trace) on `demoPresentation` | Phase 6: chat fragment (C18) + 13 product types compiled once |
| `04-chat-demo-tile-menu.png` | Right-click on a tile title: six workbench rows through `project`, plus the demo's two agent rows | Workbench tile rules and product rules on one `tile` subject, ambiguity-free |
| `05-storybook-help-card.png` | Core `Presentation/PBUI Protocol › WithContextualHelp` story: hover card with meaning, details, and the LIVE actions row | Phase 5: help and actions are one declaration; help enabled by renderers only |
| `06-ragttc-workbench.png` | rag-ttc workbench (campaigns, inspector, watchlist, trace) on `workbenchPresentation` against the local pbui build | Phase 6 external: 41 domain types + workbench fragment + chat fragment (`unresolved`) |
| `07-ragttc-tile-menu.png` | Right-click on the campaigns tile: the workbench fragment's six rows with "Duplicate" unavailable and explaining itself | Availability reasons survive the cutover; the fragment's rules on a product whose tile value is a `TileRef` |
| `08-hyperblog-reader-tile.png` | hyperblog `Applications/Tiles › Reader` story: a post with term presentations | Phase 6 external: ten declared types, closed world |
| `09-hyperblog-term-menu.png` | Right-click on the term "load factor": Inspect, Focus, Open beside… (accept a term), Bookmark | The descriptor-actions bridge family on `anyDeclaredType` over the closed graph |
