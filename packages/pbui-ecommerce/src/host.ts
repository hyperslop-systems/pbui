import { useSyncExternalStore } from "react";
import { CATEGORIES, CUSTOMERS, DAILY_SALES, LINE_ITEMS, METALS, ORDERS, PRODUCTS } from "./fixtures";
import type { Category, Customer, DailySales, LineItem, Metal, Order, Product } from "./fixtures";

/*
 * The shop host: the data half of the product, as an INTERFACE.
 *
 * Tiles read tables and follow relations through this object and nothing
 * else; the fixture host below answers from memory. PBUI-DATALAB-1 will
 * implement the same interface over relation documents and DuckDB, which is
 * the proof (design §11.3, risk §13.1) that the tiles' port declarations are
 * a contract and not a fixture. Keep it small and keep it JSON: every value
 * that crosses it may end up held in a link document.
 */

/** The table names a `table` document slot may name. */
export const TABLES = ["products", "customers", "orders", "line_items", "daily_sales", "categories", "metals"] as const;
export type TableName = (typeof TABLES)[number];

export interface TableRows {
  products: Product;
  customers: Customer;
  orders: Order;
  line_items: LineItem;
  daily_sales: DailySales;
  categories: Category;
  metals: Metal;
}

/** The identity field of each table: what makes a row itself, for plots and for `datum` references. */
export const IDENTITY_FIELDS: Readonly<Record<TableName, string>> = {
  products: "id",
  customers: "id",
  orders: "id",
  line_items: "id",
  daily_sales: "id",
  categories: "id",
  metals: "id",
};

export interface ShopHost {
  rows<T extends TableName>(table: T): readonly TableRows[T][];
  /** Any table by name, untyped: what a plot tile over a `table` slot reads. */
  rowsOf(table: string): readonly Record<string, unknown>[] | null;
  product(id: string): Product | undefined;
  customer(id: string): Customer | undefined;
  order(id: string): Order | undefined;
  category(id: string): Category | undefined;
  metal(id: string): Metal | undefined;
  /** The relations the demo derives through (design §11.1); each is a named translator in Phase 6. */
  relations: {
    orderCustomer(orderId: string): Customer | undefined;
    orderLineItems(orderId: string): readonly LineItem[];
    customerOrders(customerId: string): readonly Order[];
    productOrders(productId: string): readonly Order[];
  };
  /** Bumps when any table changes; the fixture host never does, a live host will. */
  revision(): number;
  subscribe(listener: () => void): () => void;
}

export interface ShopData {
  products: readonly Product[];
  customers: readonly Customer[];
  orders: readonly Order[];
  lineItems: readonly LineItem[];
  dailySales: readonly DailySales[];
  categories: readonly Category[];
  metals: readonly Metal[];
}

export const FIXTURES: ShopData = {
  products: PRODUCTS,
  customers: CUSTOMERS,
  orders: ORDERS,
  lineItems: LINE_ITEMS,
  dailySales: DAILY_SALES,
  categories: CATEGORIES,
  metals: METALS,
};

export function createShopHost(data: ShopData = FIXTURES): ShopHost {
  const tables: { [T in TableName]: readonly TableRows[T][] } = {
    products: data.products,
    customers: data.customers,
    orders: data.orders,
    line_items: data.lineItems,
    daily_sales: data.dailySales,
    categories: data.categories,
    metals: data.metals,
  };
  const products = new Map(data.products.map((row) => [row.id, row]));
  const customers = new Map(data.customers.map((row) => [row.id, row]));
  const orders = new Map(data.orders.map((row) => [row.id, row]));
  const categories = new Map(data.categories.map((row) => [row.id, row]));
  const metals = new Map(data.metals.map((row) => [row.id, row]));
  const linesByOrder = new Map<string, LineItem[]>();
  for (const line of data.lineItems) {
    const list = linesByOrder.get(line.orderId) ?? [];
    list.push(line);
    linesByOrder.set(line.orderId, list);
  }
  const listeners = new Set<() => void>();
  const revision = 1;

  return {
    rows: (table) => tables[table],
    rowsOf: (table) => ((TABLES as readonly string[]).includes(table) ? (tables[table as TableName] as unknown as readonly Record<string, unknown>[]) : null),
    product: (id) => products.get(id),
    customer: (id) => customers.get(id),
    order: (id) => orders.get(id),
    category: (id) => categories.get(id),
    metal: (id) => metals.get(id),
    relations: {
      orderCustomer: (orderId) => {
        const order = orders.get(orderId);
        return order ? customers.get(order.customerId) : undefined;
      },
      orderLineItems: (orderId) => linesByOrder.get(orderId) ?? [],
      customerOrders: (customerId) => data.orders.filter((order) => order.customerId === customerId),
      productOrders: (productId) => {
        const ids = new Set(data.lineItems.filter((line) => line.productId === productId).map((line) => line.orderId));
        return data.orders.filter((order) => ids.has(order.id));
      },
    },
    revision: () => revision,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Re-render when the host's revision changes; a tile over a live host reads through this. */
export function useHostRevision(host: ShopHost): number {
  return useSyncExternalStore(host.subscribe, host.revision, host.revision);
}
