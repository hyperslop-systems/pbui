# Tasks

## TODO

- [x] P1.1 Wire src/styles.css into the bundle so its zero-specificity fallbacks actually ship <!-- t:xn8u -->
- [x] P1.2 Refresh styles.css's stale header (it predates tokens.css) and drop fallback vars that tokens.css now defaults <!-- t:fuxo -->
- [x] P1.3 Make the styles.css export self-sufficient so a consumer cannot miss one of the four stylesheets <!-- t:scvm -->
- [x] P1.4 Add a test that every data-part pbui renders has a rule in the shipped CSS <!-- t:nmwa -->
- [x] P1.5 Fix agentlogic's Storybook preview: it imports 4 stylesheets where the app imports 6 <!-- t:c62z -->
- [x] P2.1 Guard the object-menu reason on disabled, not on the reason being set (createPbui.tsx) <!-- t:bcaw -->
- [x] P2.2 Guard SelectInput's option reason the same way (latent copy of the same defect) <!-- t:ca5y -->
- [x] P2.3 Regression tests: an enabled action with a reason shows its description and no reason text <!-- t:b23m -->
- [x] P3.1 Merge PresentationAction.disabled/disabledReason into disabledBecause <!-- t:3026 -->
- [x] P3.2 Merge SelectOption.disabled/reason into disabledBecause <!-- t:1eqd -->
- [x] P3.3 Merge FileDropZone.disabled/disabledReason into disabledBecause <!-- t:5533 -->
- [x] P3.4 Merge Presentation.onActivate/activateDoc into activate?: { doc, run } <!-- t:9n74 -->
- [x] P3.5 Merge FileBrowser.renamingId/onRenameStateChange into rename?: { id, onChange } <!-- t:hbjp -->
- [x] P3.6 Migrate consumers: hyperblog (10 sites), turboproof (5), datalab-ui (adapter collapses to a passthrough) <!-- t:ynqy -->
- [x] P4.1 Stop swallowing the host's click when onActivate/activate is present <!-- t:9ops -->
- [x] P4.2 Guard against Presentation-nested-in-Presentation double-handling <!-- t:9q22 -->
- [x] P4.3 Give FileBrowser's roving focus a controlled surface so renderRow can restore it <!-- t:48tg -->
- [x] P4.4 Fix pbui's own WithPresentation story, which demonstrates the bug <!-- t:1x06 -->
- [x] P4.5 Test: click a directory label through a Presentation, assert toggle AND focus <!-- t:vvk6 -->
- [x] P5.1 Rename label -> accessibleName on the graphics/region components <!-- t:wmu3 -->
- [ ] P5.2 Give the four form controls a label that actually renders <!-- t:98ci -->
- [x] P5.3 Migrate consumers and restore any text that was silently dropped <!-- t:tpwe -->
- [x] P6.1 FileBrowser.onCreate: declared and never called (issue 4) <!-- t:usab -->
- [x] P6.2 role=button nested in role=treeitem (issue 5) <!-- t:hg10 -->
- [x] P6.3 Duplicate-React dev-time guard and a Vite preset (issue 1) <!-- t:rgny -->
- [x] P6.4 FileBrowser: trees cannot express a failed root; emptyState claims three surfaces and serves one <!-- t:ivj0 -->
- [x] P6.5 Publish 0.4.0 and bump the four products <!-- t:upc2 -->
