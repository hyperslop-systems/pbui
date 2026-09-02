import { AppBody, EmptyState, Text, Toolbar } from "@hyperslop-systems/pbui";
import type { AppProps } from "@hyperslop-systems/pbui-workbench";
import type { Shop } from "../../createShop";
import { useHostRevision } from "../../host";
import { money } from "../../presentation/registry";
import { customerValue, orderValue } from "../../presentation/values";
import styles from "../tiles.module.css";

export interface CustomerDetailProps extends AppProps {
  shop: Shop;
  /** Phase 1 only: the customer to show, until the `customer` in port exists. */
  preview?: string;
}

/** One customer and their orders; the orders are `<order>` presentations, so the loop closes. */
export function CustomerDetail({ shop, preview }: CustomerDetailProps) {
  useHostRevision(shop.host);
  const { Presentation } = shop.pbui;
  const customer = preview ? shop.host.customer(preview) : undefined;
  if (!customer) {
    return (
      <div data-part="customer-detail" className={styles.empty}>
        <EmptyState message="no customer yet" hint="link a customer in, or derive one from an order through order.customer" />
      </div>
    );
  }
  const orders = shop.host.relations.customerOrders(customer.id);
  const spent = orders.filter((order) => order.status !== "cancelled").reduce((n, order) => n + order.total, 0);
  return (
    <div data-part="customer-detail" className={styles.app}>
      <Toolbar tight>
        <Presentation reference={{ type: "customer", value: customerValue(customer) }} doc={customer.name} inComposite>
          <Text size="tiny" strong>
            {customer.name}
          </Text>
        </Presentation>
        <span className={styles.spacer} />
        <Text size="tiny" tone="faint">
          {customer.kind} · {customer.city}
        </Text>
      </Toolbar>
      <AppBody flush className={styles.body}>
        <div className={styles.detail}>
          <div className={styles.big}>{money(spent)}</div>
          <dl className={styles.facts}>
            <dt>since</dt>
            <dd>{customer.since}</dd>
            <dt>orders</dt>
            <dd>{orders.length}</dd>
          </dl>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>order</th>
                <th>placed</th>
                <th>status</th>
                <th className={styles.num}>total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Presentation reference={{ type: "order", value: orderValue(order) }} doc={`order #${order.id}`}>
                      #{order.id}
                    </Presentation>
                  </td>
                  <td>{order.placedAt}</td>
                  <td>{order.status}</td>
                  <td className={styles.num}>{money(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppBody>
    </div>
  );
}
