import { Button, EmptyState, Meter, Sparkline, Stack, Text, Toolbar } from "@hyperslop-systems/pbui";
import type { AppProps } from "@hyperslop-systems/pbui-workbench";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import { chat } from "../../chat";
import { categoryReference, isLowStock, metalReference, orderReference, productById, productReference } from "../../world";
import styles from "./SkuApp.module.css";

/**
 * The binding key: `view.documents.product` names the SKU this tile is a view
 * OF. Exported because the workbench tools and `titleFor` both spell it, and
 * a second literal `"product"` somewhere is the way "go to the existing tile"
 * silently becomes "open a second one".
 */
export const SKU_BINDING = "product";

/** The title of one bound view: `2049 · 1oz American Gold Eagle 2024`. */
export function skuTitle(view: AppView): string {
  if (view.title) return view.title;
  const id = view.documents[SKU_BINDING] ?? "";
  const product = id ? productById(id) : undefined;
  return product ? `${product.id} · ${product.name}` : `SKU ${id}`.trim();
}

/**
 * One SKU as a tile — the doc-bound half of the demo.
 *
 * The tile holds no state at all: everything it draws is a function of
 * `view.documents.product`, which is why `openView("sku", {product: "2049"})`
 * twice can go to the existing tile instead of minting a second one, and why
 * `duplicable: false` is correct — splitting this tile LINKS a second
 * placement of the same view rather than cloning a detail panel.
 */
export function SkuApp({ view }: AppProps) {
  const pbui = chat.pbui.usePbui();
  const productId = view.documents[SKU_BINDING] ?? "";
  const product = productId ? productById(productId) : undefined;

  if (!product) {
    return (
      <div className={styles.app}>
        <EmptyState
          message={productId ? `SKU ${productId} is not in the catalogue` : "this tile names no SKU"}
          hint="open one from a product's object menu, or ask the agent to open it"
        />
      </div>
    );
  }

  const reference = productReference(product);
  const low = isLowStock(product);
  const sold = product.sold30d.reduce((total, n) => total + n, 0);

  return (
    <div data-part="sku-app" className={styles.app}>
      <Stack gap={3}>
        <div className={styles.row}>
          <Text size="tiny" tone="faint" className={styles.rowLabel}>
            stock
          </Text>
          {/* Filled by qty against the floor, so a SHORT bar means trouble —
              which is why `alarm` is off: it reddens a FULL bar, and a full
              bar here means the shelf is stocked. The danger token on the
              fill is the signal instead. */}
          <Meter
            fraction={product.reorderAt === 0 ? 1 : product.qty / product.reorderAt}
            tone={low ? "var(--pbui-danger)" : "var(--pbui-tone-product)"}
            accessibleName={`stock ${product.qty} against a floor of ${product.reorderAt}`}
            value={`${product.qty} / ${product.reorderAt}`}
          />
        </div>

        <div className={styles.row}>
          <Text size="tiny" tone="faint" className={styles.rowLabel}>
            30-day
          </Text>
          <Sparkline
            points={product.sold30d}
            accessibleName={`units sold over the last 30 days, ${sold} in total`}
            tone="var(--pbui-tone-product)"
            width={160}
          />
          <Text size="tiny" tone="faint">
            sold {sold}
          </Text>
        </div>

        <div className={styles.facts}>
          <Text size="small">cost {product.cost.toFixed(2)}</Text>
          <Text size="tiny" tone="faint">
            ·
          </Text>
          {/* Metal and category are objects, not strings: the same menu the
              agent's `[[metal:gold]]` opens. */}
          <chat.pbui.Presentation reference={metalReference(product.metal)} inComposite>
            <span className={styles.fact}>{product.metal}</span>
          </chat.pbui.Presentation>
          <Text size="tiny" tone="faint">
            ·
          </Text>
          <chat.pbui.Presentation reference={categoryReference(product.categoryId)} inComposite>
            <span className={styles.fact}>{product.categoryId}</span>
          </chat.pbui.Presentation>
          <Text size="tiny" tone="faint">
            ·
          </Text>
          <chat.pbui.Presentation reference={orderReference(product.lastOrder)} inComposite>
            <span className={styles.fact}>last order {product.lastOrder}</span>
          </chat.pbui.Presentation>
        </div>

        <Toolbar tight>
          <Button variant="framed" size="tiny" onClick={() => void pbui.perform({ kind: "watch", ref: reference.value })}>
            Watch
          </Button>
          {/* The same verb the product's object menu offers, so the tile and
              the menu cannot drift into two different reorder flows. */}
          <Button variant="framed" size="tiny" tone="danger" onClick={() => void pbui.perform({ kind: "reorder", productId: product.id })}>
            Draft a reorder
          </Button>
        </Toolbar>
      </Stack>
    </div>
  );
}
