---
Title: Visual alignment capture catalogue
Ticket: PBUI-STYLE-002
Status: complete
DocType: reference
Topics: [pbui, frontend, design]
---

# Capture catalogue

Original PNGs live in this ticket. SHA256, dimensions, source state and loopback story URLs are in [manifest.json](manifest.json). Timestamps are filesystem mtime proxies, not embedded capture metadata.

All captures use synthetic fixtures. Counter/devtools execute a local eval-engine program. Chat auto-connect is disabled but metadata PATCH requests receive 501 from the static server. Images do not prove backend authorization, persistence, or complete accessibility.

Run `scripts/01-browser-acceptance.js` through the Playwright tool for geometry, disclosure/filter, keyboard and forced-colors assertions. It expects rebuilt Storybooks on ports 16011–16014. Then rerun this catalogue script.

| Image | Dimensions | Source / state |
|---|---|---|
| [coordination-after.png](coordination-after.png) | 1200×800 | cf4cf5a |
| [coordination-before.png](coordination-before.png) | 1200×800 | bdc2dca baseline |
| [coordination-narrow.png](coordination-narrow.png) | 1200×800 | cf4cf5a |
| [devtools-after.png](devtools-after.png) | 1200×800 | cf4cf5a; tree tab; increment fired |
| [devtools-before-textarea-fix.png](devtools-before-textarea-fix.png) | 1200×800 | P1 intermediate; stale core dist / textarea overflow |
| [devtools-before.png](devtools-before.png) | 1200×800 | bdc2dca baseline; tree tab |
| [devtools-narrow-before-textarea-fix.png](devtools-narrow-before-textarea-fix.png) | 1200×800 | P1 intermediate; stale core dist / textarea overflow |
| [devtools-narrow.png](devtools-narrow.png) | 1200×800 | cf4cf5a; tree tab; increment fired |
| [events-narrow-after.png](events-narrow-after.png) | 1200×800 | 46e3a30 |
| [events-narrow-before.png](events-narrow-before.png) | 1200×800 | 5e4970e + new P3 fixtures, before style edits |
| [events-wide-after.png](events-wide-after.png) | 1200×800 | 46e3a30 |
| [final-coordination-inspector.png](final-coordination-inspector.png) | 1200×800 | 46e3a30; final dependency rebuild |
| [final-sandbox-repl.png](final-sandbox-repl.png) | 1200×800 | 46e3a30; final dependency rebuild; state tab |
| [generated-severities.png](generated-severities.png) | 1200×800 | 5e4970e |
| [proposal-after.png](proposal-after.png) | 1200×800 | 5e4970e |
| [proposal-approved-after.png](proposal-approved-after.png) | 1200×800 | 5e4970e; Approve clicked |
| [proposal-before.png](proposal-before.png) | 1200×800 | bdc2dca baseline |
| [proposal-narrow.png](proposal-narrow.png) | 1200×800 | 5e4970e |
| [reference-chip.png](reference-chip.png) | 1200×800 | 5e4970e |
| [runs-narrow-after.png](runs-narrow-after.png) | 1200×800 | 46e3a30 |
| [runs-narrow-before.png](runs-narrow-before.png) | 1200×800 | 5e4970e + new P3 fixtures, before style edits |
| [runs-wide-after.png](runs-wide-after.png) | 1200×800 | 46e3a30 |
| [sandbox-before.png](sandbox-before.png) | 1200×800 | bdc2dca baseline |
| [select-after.png](select-after.png) | 1200×800 | 46e3a30; after |
| [select-before.png](select-before.png) | 1200×800 | 5e4970e + comparison fixture |
| [select-forced-colors.png](select-forced-colors.png) | 1200×800 | 46e3a30; forced-colors |
| [select-keyboard.png](select-keyboard.png) | 1200×800 | 46e3a30; keyboard |
| [tool-narrow.png](tool-narrow.png) | 1200×800 | 5e4970e |
| [tools-filtered-expanded.png](tools-filtered-expanded.png) | 1200×800 | 46e3a30; failed filter, input disclosure open |
| [tools-narrow-after.png](tools-narrow-after.png) | 1200×800 | 46e3a30 |
| [tools-narrow-before.png](tools-narrow-before.png) | 1200×800 | 5e4970e + new P3 fixtures, before style edits |
| [tools-wide-after.png](tools-wide-after.png) | 1200×800 | 46e3a30 |
| [trace-narrow-after.png](trace-narrow-after.png) | 1200×800 | 46e3a30 |
| [trace-narrow-before.png](trace-narrow-before.png) | 1200×800 | 5e4970e + new P3 fixtures, before style edits |
| [trace-wide-after.png](trace-wide-after.png) | 1200×800 | 46e3a30 |
