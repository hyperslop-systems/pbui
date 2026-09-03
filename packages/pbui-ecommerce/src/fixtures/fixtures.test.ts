import { describe, expect, it } from "vitest";
import { createShopHost, FIXTURES, TABLES } from "../host";
import { ANCHOR_ORDER_IDS, CUSTOMERS, DAILY_SALES, LINE_ITEMS, ORDERS, PRODUCTS } from "./index";

/*
 * Two things the fixtures promise: every value is plain JSON (design D4 — a
 * port may hold or pin any row), and the world is consistent (every foreign
 * key resolves, the chat demo's four orders read exactly as its SKU tile
 * quotes them).
 */

describe("every fixture row is plain JSON (D4)", () => {
  const host = createShopHost();
  for (const table of TABLES) {
    it(`${table} survives JSON.parse(JSON.stringify(row)) unchanged`, () => {
      const rows = host.rows(table);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(JSON.parse(JSON.stringify(row))).toEqual(row);
    });
  }
});

describe("the order book", () => {
  it("has sixty-five orders with distinct ids in chronological-ish order", () => {
    expect(ORDERS).toHaveLength(65);
    expect(new Set(ORDERS.map((order) => order.id)).size).toBe(65);
    expect(ORDERS[0]?.id).toBe("88150");
    expect(ORDERS.at(-1)?.id).toBe("88214");
  });

  it("keeps the chat demo's four orders exactly", () => {
    const byId = new Map(ORDERS.map((order) => [order.id, order]));
    expect(byId.get("88213")).toMatchObject({ customer: "J. Alvarez", total: 7230, items: 3, placedAt: "2026-08-18", status: "shipped" });
    expect(byId.get("88214")).toMatchObject({ customer: "Northgate Capital", total: 14600, items: 400, placedAt: "2026-08-19", status: "paid" });
    expect(byId.get("88201")).toMatchObject({ customer: "M. Okafor", total: 1260, items: 1, placedAt: "2026-08-12", status: "shipped" });
    expect(byId.get("88190")).toMatchObject({ customer: "T. Nguyen", total: 795, items: 3, placedAt: "2026-08-05", status: "shipped" });
  });

  it("resolves every foreign key", () => {
    const customers = new Set(CUSTOMERS.map((customer) => customer.id));
    const products = new Set(PRODUCTS.map((product) => product.id));
    const orders = new Set(ORDERS.map((order) => order.id));
    for (const order of ORDERS) expect(customers.has(order.customerId), `order ${order.id} customer`).toBe(true);
    for (const line of LINE_ITEMS) {
      expect(products.has(line.productId), `line ${line.id} product`).toBe(true);
      expect(orders.has(line.orderId), `line ${line.id} order`).toBe(true);
    }
    for (const product of PRODUCTS) expect(orders.has(product.lastOrder), `product ${product.id} lastOrder`).toBe(true);
    for (const id of ANCHOR_ORDER_IDS) expect(orders.has(id)).toBe(true);
  });

  it("totals and item counts agree with the line items", () => {
    const host = createShopHost();
    for (const order of ORDERS) {
      const lines = host.relations.orderLineItems(order.id);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.reduce((n, line) => n + line.qty, 0)).toBe(order.items);
      expect(Math.round(lines.reduce((n, line) => n + line.qty * line.unitPrice, 0) * 100) / 100).toBe(order.total);
    }
  });

  it("is the same book on every load", () => {
    // The generator is seeded: a second import must not reshuffle the world.
    const again = createShopHost(FIXTURES);
    expect(again.rows("orders")).toEqual(ORDERS);
  });
});

describe("daily sales", () => {
  it("excludes cancelled orders and sums the rest", () => {
    const cancelled = new Set(ORDERS.filter((order) => order.status === "cancelled").map((order) => order.id));
    const expected = Math.round(LINE_ITEMS.filter((line) => !cancelled.has(line.orderId)).reduce((n, line) => n + line.qty * line.unitPrice, 0) * 100) / 100;
    const actual = Math.round(DAILY_SALES.reduce((n, cell) => n + cell.revenue, 0) * 100) / 100;
    expect(actual).toBe(expected);
    expect(cancelled.size).toBeGreaterThan(0);
  });
});

describe("relations", () => {
  const host = createShopHost();
  it("walk both ways", () => {
    expect(host.relations.orderCustomer("88213")?.name).toBe("J. Alvarez");
    expect(host.relations.customerOrders("c-alvarez").map((order) => order.id)).toContain("88213");
    expect(host.relations.productOrders("4001").map((order) => order.id)).toContain("88214");
    expect(host.rowsOf("nope")).toBeNull();
    expect(host.rowsOf("metals")).toHaveLength(3);
  });
});
