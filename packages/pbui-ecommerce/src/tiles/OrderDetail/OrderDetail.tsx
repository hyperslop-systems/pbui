import { AppBody, EmptyState, Text, Toolbar } from "@hyperslop-systems/pbui";
import type { AppProps } from "@hyperslop-systems/pbui-workbench";
import type { Shop } from "../../createShop";
import { useHostRevision } from "../../host";
import { money } from "../../presentation/registry";
import { customerValue, lineItemValue, orderValue, productValue } from "../../presentation/values";
import styles from "../tiles.module.css";

export interface OrderDetailProps extends AppProps {
  shop: Shop;
  /**
   * Phase 1 only: the order to show, until the `order` in port exists
   * (Phase 2's `usePort(view, "order")`). Stories pass it; the workbench
   * never does, so a placed detail tile reads as "waiting" until linked.
   */
  preview?: string;
}

/**
 * One order: its facts and its line items. The customer and every line's
 * product are presentations of their own, which is what lets a customer
 * detail be DERIVED from this tile's order (Phase 6) and a product be sent
 * to the inspector from here.
 */
export function OrderDetail({ shop, preview }: OrderDetailProps) {
  useHostRevision(shop.host);
  const { Presentation } = shop.pbui;
  const order = preview ? shop.host.order(preview) : undefined;
  if (!order) {
    return (
      <div data-part="order-detail" className={styles.empty}>
        <EmptyState message="no order yet" hint="click an order in a table and choose “Link to order detail”, or let it follow the workspace's current order" />
      </div>
    );
  }
  const customer = shop.host.relations.orderCustomer(order.id);
  const lines = shop.host.relations.orderLineItems(order.id);
  return (
    <div data-part="order-detail" className={styles.app}>
      <Toolbar tight>
        <Presentation reference={{ type: "order", value: orderValue(order) }} doc={`order #${order.id}`} inComposite>
          <Text size="tiny" strong>
            order #{order.id}
          </Text>
        </Presentation>
        <span className={styles.spacer} />
        <Text size="tiny" tone="faint">
          {order.status} · {order.placedAt}
        </Text>
      </Toolbar>
      <AppBody flush className={styles.body}>
        <div className={styles.detail}>
          <div className={styles.big}>{money(order.total)}</div>
          <dl className={styles.facts}>
            <dt>customer</dt>
            <dd>
              {customer ? (
                <Presentation reference={{ type: "customer", value: customerValue(customer) }} doc={`${customer.name}, ${customer.kind}`}>
                  {customer.name}
                </Presentation>
              ) : (
                order.customer
              )}
            </dd>
            <dt>placed</dt>
            <dd>{order.placedAt}</dd>
            <dt>status</dt>
            <dd>{order.status}</dd>
            <dt>units</dt>
            <dd>{order.items}</dd>
          </dl>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>line</th>
                <th className={styles.num}>qty</th>
                <th className={styles.num}>unit</th>
                <th className={styles.num}>amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const product = shop.host.product(line.productId);
                return (
                  <tr key={line.id}>
                    <td>
                      <Presentation reference={{ type: "lineItem", value: lineItemValue(line) }} doc={`${line.qty} × ${product?.name ?? line.productId}`} inComposite>
                        {product ? (
                          <Presentation reference={{ type: "product", value: productValue(product, shop.host) }} doc={product.name}>
                            {product.name}
                          </Presentation>
                        ) : (
                          line.productId
                        )}
                      </Presentation>
                    </td>
                    <td className={styles.num}>{line.qty}</td>
                    <td className={styles.num}>{money(line.unitPrice)}</td>
                    <td className={styles.num}>{money(line.qty * line.unitPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AppBody>
    </div>
  );
}
