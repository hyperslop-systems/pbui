import { Chip, EmptyState, SelectInput, Text, Toolbar } from "@hyperslop-systems/pbui";
import type { AppProps } from "@hyperslop-systems/pbui-workbench";
import { useMemo, useState } from "react";
import { chat } from "../../chat";
import { CATEGORIES, isLowStock, METAL_IDS, PRODUCTS, productReference, type WorldProduct } from "../../world";
import styles from "./InventoryApp.module.css";

const ALL = "";

/**
 * The eight-SKU table: an ordinary, duplicable data tile.
 *
 * The point of it is the `sku` cell. Every one is a `<product>` presentation,
 * so a tile the AGENT placed joins accept mode, the object menu and the
 * mouse-doc line with no code beyond the wrapper — the same object the model
 * writes as `[[product:2049|…]]` in its prose. A tile that printed the id as
 * text would look identical and participate in nothing.
 *
 * The two filters are `useState`, not chat-store state, and that is the
 * duplicable half of the demo: two inventory tiles side by side filter
 * independently, which is the visible difference between this app and the
 * singleton metals board.
 */
export function InventoryApp({ placementId }: AppProps) {
  const [metal, setMetal] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);

  const rows = useMemo(
    () =>
      PRODUCTS.filter(
        (product) => (metal === ALL || product.metal === metal) && (categoryId === ALL || product.categoryId === categoryId),
      ),
    [metal, categoryId],
  );

  return (
    <div data-part="inventory-app" className={styles.app}>
      <Toolbar tight>
        <SelectInput
          accessibleName="metal"
          size="tiny"
          value={metal}
          onValueChange={setMetal}
          placeholder="metal · all"
          options={METAL_IDS.map((id) => ({ value: id, label: id }))}
        />
        <SelectInput
          accessibleName="category"
          size="tiny"
          value={categoryId}
          onValueChange={setCategoryId}
          placeholder="category · all"
          options={Object.entries(CATEGORIES).map(([id, category]) => ({ value: id, label: category.name }))}
        />
        <span className={styles.spacer} />
        <Text size="tiny" tone="faint">
          {rows.length} of {PRODUCTS.length} SKUs
        </Text>
      </Toolbar>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState message="no SKU matches both filters" hint="the shop stocks gold, silver and platinum only" />
        </div>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">sku</th>
                <th scope="col">name</th>
                <th scope="col" data-numeric="true">
                  qty
                </th>
                <th scope="col" data-numeric="true">
                  floor
                </th>
                <th scope="col" data-numeric="true">
                  cost
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => (
                <Row key={product.id} product={product} placementId={placementId} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ product, placementId }: { product: WorldProduct; placementId: string }) {
  const low = isLowStock(product);
  return (
    <tr>
      <td>
        {/* `inComposite`: the row owns the tab stop. Without it every SKU cell
            is its own `role="button"` tab stop and Tab walks the table cell by
            cell instead of past it. */}
        <chat.pbui.Presentation
          reference={productReference(product)}
          inComposite
          testId={`inventory-${placementId}-${product.id}`}
        >
          <span className={styles.sku}>{product.id}</span>
        </chat.pbui.Presentation>
      </td>
      <td className={styles.name}>
        <Text size="small" truncate title={product.name}>
          {product.name}
        </Text>
        {low && <Chip label="low" tone="var(--pbui-tone-proposal)" />}
      </td>
      <td data-numeric="true">{product.qty}</td>
      <td data-numeric="true">{product.reorderAt}</td>
      <td data-numeric="true">{product.cost.toFixed(2)}</td>
    </tr>
  );
}
