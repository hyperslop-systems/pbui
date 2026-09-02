import { AppBody, Chip, Text, Toolbar } from "@hyperslop-systems/pbui";
import type { AppProps } from "@hyperslop-systems/pbui-workbench";
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
 * from one table, and a category click can drive an orders filter.
 */
export function ProductCatalog({ shop }: ProductCatalogProps) {
  useHostRevision(shop.host);
  const { Presentation } = shop.pbui;
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
              return (
                <tr key={product.id} data-product-id={product.id}>
                  <td>{product.id}</td>
                  <td>
                    <Presentation reference={{ type: "product", value: productValue(product, shop.host) }} doc={`${product.name}, ${product.qty} in stock`}>
                      {product.name}
                    </Presentation>
                  </td>
                  <td>
                    {category ? (
                      <Presentation reference={{ type: "category", value: categoryValue(category) }} doc={`the ${category.name} category`}>
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
