import { AppBody, Chip, TileHeader } from "@hyperslop-systems/pbui";
import { useEmitPort, usePort, type AppProps } from "@hyperslop-systems/pbui-workbench";
import { useMemo } from "react";
import type { Shop } from "../../createShop";
import { useHostRevision } from "../../host";
import { money } from "../../presentation/registry";
import type { CategoryValue, DatumValue } from "../../presentation/types";
import { orderValue } from "../../presentation/values";
import styles from "../tiles.module.css";

export interface OrdersTableProps extends AppProps {
  shop: Shop;
}

/**
 * The order book. Every row's id is an `<order>` presentation, so it has
 * the object menu and joins accept mode. Three ports:
 *
 * - `order` (out): a click presents the row (and drives the workspace's
 *   order context), a hover presents it as attended — what "Link to…" on a
 *   right-clicked row uses to know where the order came from;
 * - `selection` (inout): Shift-click toggles a row in the selection, which
 *   the tile emits as rows of `orders`; when the port shares a cell with a
 *   plot (Phase 5), the plot's brush arrives here and highlights rows;
 * - `filter` (in): a category narrows the rows to the orders that contain
 *   a product of that category — followed from a plot's or the catalog's
 *   `cat` port (scene 6).
 */
export function OrdersTable({ shop, view }: OrdersTableProps) {
  useHostRevision(shop.host);
  const { ObjectChip } = shop.pbui;
  const emit = useEmitPort(view, "order");
  const emitSelection = useEmitPort(view, "selection");
  const selection = usePort<DatumValue[]>(view, "selection");
  const filter = usePort<CategoryValue>(view, "filter");
  const selected = useMemo(() => new Set((selection.value ?? []).filter((d) => d.relation === "orders").map((d) => String(d.identity["id"]))), [selection.value]);
  const orders = useMemo(() => {
    const all = shop.host.rows("orders");
    if (!filter.value) return all;
    const products = new Set(shop.host.rows("products").filter((p) => p.categoryId === filter.value!.id).map((p) => p.id));
    const inCategory = new Set(shop.host.rows("line_items").filter((line) => products.has(line.productId)).map((line) => line.orderId));
    return all.filter((order) => inCategory.has(order.id));
  }, [shop.host, filter.value]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    emitSelection({ type: "datum", value: [...next].sort().map((orderId) => ({ relation: "orders", identity: { id: orderId } })) });
  };

  return (
    <div data-part="orders-table" className={styles.app}>
      <TileHeader
        title="orders"
        status={`${orders.length} orders · ${money(orders.reduce((n, order) => n + (order.status === "cancelled" ? 0 : order.total), 0))} booked${selected.size > 0 ? ` · ${selected.size} selected` : ""}`}
      >
        {filter.value ? <Chip label={`in ${filter.value.name}`} state="active" title={filter.badge.explanation} /> : null}
      </TileHeader>
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
                  data-selected={selected.has(order.id) || undefined}
                  className={styles.row}
                  onClick={(event) => {
                    // Shift-click toggles the SELECTION; a plain click presents the order.
                    if (event.shiftKey) {
                      event.preventDefault();
                      toggle(order.id);
                      return;
                    }
                    emit(reference);
                  }}
                  // A right-click PRESENTS the row too (capture phase: the presentation stops the bubble):
                  // "Link to…" from its menu then shows this order at once.
                  onContextMenuCapture={() => emit(reference)}
                  onPointerEnter={() => emit(reference, { attended: true })}
                >
                  <td>
                    <ObjectChip reference={reference} doc={`order #${order.id} for ${order.customer}`}>
                      #{order.id}
                    </ObjectChip>
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
