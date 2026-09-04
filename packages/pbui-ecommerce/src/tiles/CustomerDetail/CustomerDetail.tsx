import { AppBody, EmptyState, KeyValueList, TileHeader } from "@hyperslop-systems/pbui";
import { usePort, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { Shop } from "../../createShop";
import { useHostRevision } from "../../host";
import { money } from "../../presentation/registry";
import type { CustomerValue } from "../../presentation/types";
import { customerValue, orderValue } from "../../presentation/values";
import styles from "../tiles.module.css";

export interface CustomerDetailProps extends AppProps {
  shop: Shop;
}

/** One customer and their orders, read through the `customer` in port; the orders are `<order>` presentations, so the loop closes. */
export function CustomerDetail({ shop, view }: CustomerDetailProps) {
  useHostRevision(shop.host);
  const { Presentation } = shop.pbui;
  const port = usePort<CustomerValue>(view, "customer");
  const customer = port.value ? (shop.host.customer(port.value.id) ?? null) : null;
  if (!customer) {
    return (
      <div data-part="customer-detail" className={styles.empty}>
        <EmptyState message="no customer yet" hint={`${port.badge.explanation}. Click a customer, or right-click one and choose “Link to customer detail”.`} />
      </div>
    );
  }
  const orders = shop.host.relations.customerOrders(customer.id);
  const spent = orders.filter((order) => order.status !== "cancelled").reduce((n, order) => n + order.total, 0);
  return (
    <div data-part="customer-detail" className={styles.app}>
      <TileHeader
        title={
          <Presentation reference={{ type: "customer", value: customerValue(customer) }} doc={customer.name} inComposite>
            {customer.name}
          </Presentation>
        }
        status={`${customer.kind} · ${customer.city}`}
      />
      <AppBody flush className={styles.body}>
        <div className={styles.detail}>
          <div className={styles.big}>{money(spent)}</div>
          <KeyValueList
            items={[
              { key: "since", value: customer.since },
              { key: "orders", value: orders.length },
            ]}
          />
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
