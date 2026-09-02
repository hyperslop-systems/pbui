import { AppBody, Chip, Text, Toolbar } from "@hyperslop-systems/pbui";
import { useEmitPort, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { Shop } from "../../createShop";
import { useHostRevision } from "../../host";
import { money } from "../../presentation/registry";
import { orderValue } from "../../presentation/values";
import styles from "../tiles.module.css";

export interface OrdersTableProps extends AppProps {
  shop: Shop;
}

/**
 * The order book. Every row's id is an `<order>` presentation, so it has
 * the object menu and joins accept mode. The tile EMITS through its `order`
 * out port: a click presents the row (and drives the workspace's order
 * context), a hover presents it as attended — which is what "Link to…" on
 * a right-clicked row uses to know where the order came from, and what Pin
 * freezes when the pointer had to leave the table to reach a badge.
 */
export function OrdersTable({ shop, view }: OrdersTableProps) {
  useHostRevision(shop.host);
  const { Presentation } = shop.pbui;
  const emit = useEmitPort(view, "order");
  const orders = shop.host.rows("orders");
  return (
    <div data-part="orders-table" className={styles.app}>
      <Toolbar tight>
        <Text size="tiny" strong>
          orders
        </Text>
        <span className={styles.spacer} />
        <Text size="tiny" tone="faint">
          {orders.length} orders · {money(orders.reduce((n, order) => n + (order.status === "cancelled" ? 0 : order.total), 0))} booked
        </Text>
      </Toolbar>
      <AppBody flush className={styles.body}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>order</th>
              <th>placed</th>
              <th>customer</th>
              <th>status</th>
              <th className={styles.num}>units</th>
              <th className={styles.num}>total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const reference = { type: "order" as const, value: orderValue(order) };
              return (
                <tr
                  key={order.id}
                  data-order-id={order.id}
                  className={styles.row}
                  onClick={() => emit(reference)}
                  // A right-click PRESENTS the row too (capture phase: the presentation stops the bubble):
                  // "Link to…" from its menu then shows this order at once.
                  onContextMenuCapture={() => emit(reference)}
                  onPointerEnter={() => emit(reference, { attended: true })}
                >
                  <td>
                    <Presentation reference={reference} doc={`order #${order.id} for ${order.customer}`}>
                      #{order.id}
                    </Presentation>
                  </td>
                  <td>{order.placedAt}</td>
                  <td>{order.customer}</td>
                  <td>
                    <Chip label={order.status} {...(order.status === "cancelled" ? { state: "disabled" as const } : order.status === "hold" ? { state: "stale" as const } : {})} />
                  </td>
                  <td className={styles.num}>{order.items}</td>
                  <td className={styles.num}>{money(order.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AppBody>
    </div>
  );
}
