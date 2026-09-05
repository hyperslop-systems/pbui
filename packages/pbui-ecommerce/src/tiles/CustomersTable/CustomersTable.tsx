import { AppBody, TileHeader } from "@hyperslop-systems/pbui";
import { useEmitPort, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { Shop } from "../../createShop";
import { useHostRevision } from "../../host";
import { money } from "../../presentation/registry";
import { customerValue } from "../../presentation/values";
import styles from "../tiles.module.css";

export interface CustomersTableProps extends AppProps {
  shop: Shop;
}

/** Who buys, with what they have spent this summer. Each row emits its `<customer>` on click and as attended on hover. */
export function CustomersTable({ shop, view }: CustomersTableProps) {
  useHostRevision(shop.host);
  const { ObjectChip } = shop.pbui;
  const emit = useEmitPort(view, "customer");
  const customers = shop.host.rows("customers");
  return (
    <div data-part="customers-table" className={styles.app}>
      <TileHeader title="customers" status={`${customers.length} customers`} />
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
              const reference = { type: "customer" as const, value: customerValue(customer) };
              return (
                <tr key={customer.id} data-customer-id={customer.id} className={styles.row} onClick={() => emit(reference)} onContextMenuCapture={() => emit(reference)} onPointerEnter={() => emit(reference, { attended: true })}>
                  <td>
                    <ObjectChip reference={reference} doc={`${customer.name}, a ${customer.kind} customer in ${customer.city}`}>
                      {customer.name}
                    </ObjectChip>
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
