import { AppBody, EmptyState, KeyValueList, TileHeader } from "@hyperslop-systems/pbui";
import { usePort, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { Shop } from "../../createShop";
import { useHostRevision } from "../../host";
import { money } from "../../presentation/registry";
import type { OrderValue } from "../../presentation/types";
import { customerValue, lineItemValue, orderValue, productValue } from "../../presentation/values";
import styles from "../tiles.module.css";

export interface OrderDetailProps extends AppProps {
  shop: Shop;
}

/**
 * One order: its facts and its line items, read through the tile's `order`
 * in port. The port's term decides where the order comes from — the
 * workspace's current order by default, a followed table, a held value —
 * and the tile never knows which; it reads the port and re-renders when
 * the port's value changes. The customer and every line's product are
 * presentations of their own, which is what lets a customer detail be
 * DERIVED from this tile's order (Phase 6) and a product be sent to the
 * inspector from here.
 */
export function OrderDetail({ shop, view }: OrderDetailProps) {
  useHostRevision(shop.host);
  const { Presentation } = shop.pbui;
  const port = usePort<OrderValue>(view, "order");
  // The port carries the order as it was presented; the host has the facts as they are now.
  const order = port.value ? (shop.host.order(port.value.id) ?? null) : null;
  if (!order) {
    const why = port.evaluation.kind === "error" ? port.evaluation.diagnostic.message : port.badge.explanation;
    return (
      <div data-part="order-detail" className={styles.empty}>
        <EmptyState message={port.value ? `order #${port.value.id} is not in this shop` : "no order yet"} hint={`${why}. Click an order in a table, or right-click one and choose “Link to order detail”.`} />
      </div>
    );
  }
  const customer = shop.host.relations.orderCustomer(order.id);
  const lines = shop.host.relations.orderLineItems(order.id);
  return (
    <div data-part="order-detail" className={styles.app}>
      <TileHeader
        title={
          <Presentation reference={{ type: "order", value: orderValue(order) }} doc={`order #${order.id}`} inComposite>
            order #{order.id}
          </Presentation>
        }
        status={`${order.status} · ${order.placedAt}`}
      />
      <AppBody flush className={styles.body}>
        <div className={styles.detail}>
          <div className={styles.big}>{money(order.total)}</div>
          <KeyValueList
            items={[
              {
                key: "customer",
                value: customer ? (
                  <Presentation reference={{ type: "customer", value: customerValue(customer) }} doc={`${customer.name}, ${customer.kind}`}>
                    {customer.name}
                  </Presentation>
                ) : (
                  order.customer
                ),
              },
              { key: "placed", value: order.placedAt },
              { key: "status", value: order.status },
              { key: "units", value: order.items },
            ]}
          />
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
