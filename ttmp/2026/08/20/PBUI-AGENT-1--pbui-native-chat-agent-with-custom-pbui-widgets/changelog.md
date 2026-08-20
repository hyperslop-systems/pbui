# Changelog

## 2026-08-20

- Initial workspace created


## 2026-08-20

Added design-doc/01 feature showcase: 22 features with ASCII mock-ups, demo script, and build tiers


## 2026-08-20

Added design-doc/02: architecture and protocol for the PBUI-native chat agent (contract, Go plugin, TS package, sequences, trust, placement, tiered plan, open decisions); filled index overview; seeded Tier 0 tasks


## 2026-08-20

Go implementation landed (commits 6b0a960..dfe42fa): chat proto, pkg/pbuichat plugin+tools, pkg/chatserver with scripted engine and e2e tests, pkg/chatui SPA embed, cmd/pbui-chat, devctl dev/dev-real/prod profiles, Makefile chat-* targets


## 2026-08-20

TS package + demo committed (a7960e4); prod devctl profile verified in a browser; real runtime (gpt-5-nano-low) verified after plugin-order and WrapSink fixes (086c82c)

