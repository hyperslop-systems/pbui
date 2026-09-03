import { AppBody, Chip, Text, Toolbar } from "@hyperslop-systems/pbui";
import { useEmitPort, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { Shop } from "../../createShop";
import { isLowStock } from "../../fixtures";
import { useHostRevision } from "../../host";
import { money } from "../../presentation/registry";
import { categoryValue, metalValue, productValue } from "../../presentation/values";
import styles from "../tiles.module.css";

export interface ProductCatalogProps extends AppProps {
  shop: Shop;
}

/**
 * The eight SKUs. Three presentation types per row — the product, its
 * category, its metal — so "Link to…" has three kinds of thing to offer
 * from one table. A row click emits the product; a click on the category
 * cell emits the category through the `cat` port (what an orders filter
 * follows in scene 6).
 */
export function ProductCatalog({ shop, view }: ProductCatalogProps) {
  useHostRevision(shop.host);
  const { Presentation } = shop.pbui;
  const emitProduct = useEmitPort(view, "product");
  const emitCategory = useEmitPort(view, "cat");
  const products = shop.host.rows("products");
  const low = products.filter(isLowStock).length;
  return (
    <div data-part="product-catalog" className={styles.app}>
      <Toolbar tight>
        <Text size="tiny" strong>
          catalog
        </Text>
        <span className={styles.spacer} />
        <Text size="tiny" tone="faint">
          {products.length} SKUs · {low} at or under the floor
        </Text>
      </Toolbar>
      <AppBody flush className={styles.body}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>sku</th>
              <th>product</th>
              <th>category</th>
              <th>metal</th>
              <th className={styles.num}>stock</th>
              <th className={styles.num}>floor</th>
              <th className={styles.num}>price</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const category = shop.host.category(product.categoryId);
              const metal = shop.host.metal(product.metal);
              const reference = { type: "product" as const, value: productValue(product, shop.host) };
              const categoryReference = category ? { type: "category" as const, value: categoryValue(category) } : null;
              return (
                <tr key={product.id} data-product-id={product.id} className={styles.row} onClick={() => emitProduct(reference)} onContextMenuCapture={() => emitProduct(reference)} onPointerEnter={() => emitProduct(reference, { attended: true })}>
                  <td>{product.id}</td>
                  <td>
                    <Presentation reference={reference} doc={`${product.name}, ${product.qty} in stock`}>
                      {product.name}
                    </Presentation>
                  </td>
                  <td
                    onClick={(event) => {
                      if (!categoryReference) return;
                      event.stopPropagation();
                      emitCategory(categoryReference);
                    }}
                    onPointerEnter={() => categoryReference && emitCategory(categoryReference, { attended: true })}
                  >
                    {categoryReference && category ? (
                      <Presentation reference={categoryReference} doc={`the ${category.name} category`}>
                        {category.name}
                      </Presentation>
                    ) : (
                      product.categoryId
                    )}
                  </td>
                  <td>
                    {metal ? (
                      <Presentation reference={{ type: "metal", value: metalValue(metal) }} doc={`${metal.name}, spot ${money(metal.spotUsd)}/oz`}>
                        {metal.name}
                      </Presentation>
                    ) : (
                      product.metal
                    )}
                  </td>
                  <td className={styles.num}>
                    {product.qty}
                    {isLowStock(product) ? <Chip label={product.qty === 0 ? "out" : "low"} state="stale" title="at or under the reorder floor" /> : null}
                  </td>
                  <td className={styles.num}>{product.reorderAt}</td>
                  <td className={styles.num}>{money(product.price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AppBody>
    </div>
  );
}
