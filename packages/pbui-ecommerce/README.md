# @hyperslop-systems/pbui-ecommerce

The gold-coin shop as a PBUI workbench, and the first consumer of tile linking (ticket PBUI-LINK-1).

- `fixtures/` — the eight SKUs the chat demo already uses, verbatim, plus customers, a sixty-five order book with line items, and a daily sales series. Every row is plain JSON.
- `host.ts` — `ShopHost`, the data interface the tiles read through. The in-memory host answers from the fixtures; PBUI-DATALAB-1 implements the same interface over relation documents.
- `presentation/` — the shop's presentation values, descriptors, type graph (`inspectable` over every value), action registry and pbui instance.
- `apps.tsx` — seven applications, each declaring its **ports**: orders, customers, catalog, order detail, customer detail, inspector, plot.
- `plots/` — three seeded `hyperslop.plot` documents and the plot schema of each table.
- `ShopShell/` — the product shell: Provider, Surface with `<tile>` titles, launcher, object menu.
- `demo/` — a Vite app with local persistence.

```bash
pnpm --filter @hyperslop-systems/pbui-ecommerce storybook   # port 6012
pnpm --filter @hyperslop-systems/pbui-ecommerce-demo dev     # port 5176
```
