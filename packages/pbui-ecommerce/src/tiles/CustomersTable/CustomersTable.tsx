import { AppBody, Text, Toolbar } from "@hyperslop-systems/pbui";
import type { AppProps } from "@hyperslop-systems/pbui-workbench";
import type { Shop } from "../../createShop";
import { useHostRevision } from "../../host";
import { money } from "../../presentation/registry";
import { customerValue } from "../../presentation/values";
import styles from "../tiles.module.css";

export interface CustomersTableProps extends AppProps {
  shop: Shop;
}

/** Who buys, with what they have spent this summer. Each name is a `<customer>` presentation. */
export function CustomersTable({ shop }: CustomersTableProps) {
  useHostRevision(shop.host);
  const { Presentation } = shop.pbui;
  const customers = shop.host.rows("customers");
  return (
    <div data-part="customers-table" className={styles.app}>
      <Toolbar tight>
        <Text size="tiny" strong>
          customers
        </Text>
        <span className={styles.spacer} />
        <Text size="tiny" tone="faint">
          {customers.length} customers
        </Text>
      </Toolbar>
      <AppBody flush className={styles.body}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>customer</th>
              <th>kind</th>
              <th>city</th>
              <th>since</th>
              <th className={styles.num}>orders</th>
              <th className={styles.num}>spent</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => {
              const orders = shop.host.relations.customerOrders(customer.id).filter((order) => order.status !== "cancelled");
              return (
                <tr key={customer.id} data-customer-id={customer.id}>
                  <td>
                    <Presentation reference={{ type: "customer", value: customerValue(customer) }} doc={`${customer.name}, a ${customer.kind} customer in ${customer.city}`}>
                      {customer.name}
                    </Presentation>
                  </td>
                  <td>{customer.kind}</td>
                  <td>{customer.city}</td>
                  <td>{customer.since}</td>
                  <td className={styles.num}>{orders.length}</td>
                  <td className={styles.num}>{money(orders.reduce((n, order) => n + order.total, 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AppBody>
    </div>
  );
}
