import { LINE_ITEMS, ORDERS } from "./orders";
import { PRODUCTS } from "./products";

/*
 * `daily_sales`: revenue per day per category, derived from the order book
 * (cancelled orders excluded). A separate table on purpose — it is what the
 * "revenue over time" and "revenue by category" plots draw, and its rows
 * are NOT orders: a selection on it is a selection of (date, category)
 * cells, which is why its `selection` port is not identity-compatible with
 * the orders table's (design §11.1, scene 5). The authority domain differs.
 */

export interface DailySales {
  /** `${date}:${categoryId}`, unique. */
  id: string;
  date: string;
  categoryId: string;
  metal: string;
  revenue: number;
  units: number;
  orders: number;
}

function build(): DailySales[] {
  const byOrder = new Map(ORDERS.map((order) => [order.id, order]));
  const byProduct = new Map(PRODUCTS.map((product) => [product.id, product]));
  const cells = new Map<string, DailySales>();
  for (const line of LINE_ITEMS) {
    const order = byOrder.get(line.orderId);
    const product = byProduct.get(line.productId);
    if (!order || !product || order.status === "cancelled") continue;
    const id = `${order.placedAt}:${product.categoryId}`;
    const cell = cells.get(id) ?? { id, date: order.placedAt, categoryId: product.categoryId, metal: product.metal, revenue: 0, units: 0, orders: 0 };
    cell.revenue = Math.round((cell.revenue + line.qty * line.unitPrice) * 100) / 100;
    cell.units += line.qty;
    cell.orders += 1;
    cells.set(id, cell);
  }
  return [...cells.values()].sort((a, b) => (a.date === b.date ? a.categoryId.localeCompare(b.categoryId) : a.date.localeCompare(b.date)));
}

export const DAILY_SALES: readonly DailySales[] = build();
