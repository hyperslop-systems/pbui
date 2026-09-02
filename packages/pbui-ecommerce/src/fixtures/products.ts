/*
 * The gold-coin shop's catalogue.
 *
 * The eight SKUs are VERBATIM the chat demo's world (`packages/pbui-chat/demo/
 * src/world.ts`), which is itself a mirror of the Go chat server's
 * `pkg/chatserver/demo/data.go`. Ids, names, quantities and prices must not
 * drift: the chat demo will consume this package (design D11), and the Go
 * resolver answers `[[product:2049]]` with these numbers. Everything ELSE in
 * this directory — customers, the full order book, line items, the sales
 * series — is new and lives only here.
 *
 * Every row is plain JSON (design D4): a port may hold or pin any of them.
 */

export interface Product {
  id: string;
  name: string;
  /** A category ID, not a name; see `CATEGORIES`. */
  categoryId: string;
  metal: string;
  qty: number;
  reorderAt: number;
  price: number;
  cost: number;
  /** Twelve buckets, not thirty: the Go fixture samples the month. */
  sold30d: number[];
  lastOrder: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Metal {
  id: string;
  name: string;
  spotUsd: number;
  /** Percent of the shop's stock value held in this metal. */
  shareOfStockValue: number;
}

export const PRODUCTS: readonly Product[] = [
  { id: "2049", name: "1oz American Gold Eagle 2024", categoryId: "7", metal: "gold", qty: 3, reorderAt: 5, price: 2410, cost: 2201.18, sold30d: [3, 4, 6, 9, 12, 9, 6, 4, 3, 4, 6, 9], lastOrder: "88213" },
  { id: "2051", name: "1/2oz American Gold Eagle 2024", categoryId: "7", metal: "gold", qty: 1, reorderAt: 4, price: 1260, cost: 1150.5, sold30d: [1, 2, 2, 3, 2, 1, 2, 3, 4, 2, 1, 2], lastOrder: "88201" },
  { id: "2077", name: "1/10oz American Gold Eagle 2024", categoryId: "7", metal: "gold", qty: 0, reorderAt: 10, price: 265, cost: 238.9, sold30d: [8, 7, 9, 12, 10, 8, 6, 5, 4, 3, 2, 1], lastOrder: "88190" },
  { id: "3110", name: "1oz Canadian Gold Maple 2024", categoryId: "8", metal: "gold", qty: 14, reorderAt: 5, price: 2395, cost: 2190, sold30d: [2, 3, 3, 4, 5, 4, 3, 3, 4, 5, 6, 5], lastOrder: "88210" },
  { id: "2301", name: "1oz American Gold Buffalo 2024", categoryId: "9", metal: "gold", qty: 7, reorderAt: 5, price: 2430, cost: 2220, sold30d: [1, 1, 2, 2, 3, 2, 2, 1, 2, 3, 3, 2], lastOrder: "88177" },
  { id: "4001", name: "1oz American Silver Eagle 2024", categoryId: "10", metal: "silver", qty: 420, reorderAt: 100, price: 36.5, cost: 31.2, sold30d: [40, 45, 50, 38, 42, 55, 60, 48, 44, 41, 39, 52], lastOrder: "88214" },
  { id: "4002", name: "1oz Silver Maple 2024", categoryId: "11", metal: "silver", qty: 85, reorderAt: 100, price: 35.9, cost: 30.8, sold30d: [20, 22, 25, 18, 21, 27, 30, 24, 22, 20, 19, 26], lastOrder: "88209" },
  { id: "5001", name: "1oz Platinum Eagle 2024", categoryId: "12", metal: "platinum", qty: 2, reorderAt: 3, price: 1120, cost: 1040, sold30d: [0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0], lastOrder: "88150" },
];

export const CATEGORIES: readonly Category[] = [
  { id: "7", name: "American Gold Eagles" },
  { id: "8", name: "Canadian Gold Maples" },
  { id: "9", name: "American Gold Buffalos" },
  { id: "10", name: "American Silver Eagles" },
  { id: "11", name: "Canadian Silver Maples" },
  { id: "12", name: "Platinum Eagles" },
];

/** Three metals and no palladium: the Go resolver knows exactly these. */
export const METALS: readonly Metal[] = [
  { id: "gold", name: "gold", spotUsd: 2298.4, shareOfStockValue: 61 },
  { id: "silver", name: "silver", spotUsd: 27.1, shareOfStockValue: 26 },
  { id: "platinum", name: "platinum", spotUsd: 972.0, shareOfStockValue: 13 },
];

export function isLowStock(product: Product): boolean {
  return product.qty <= product.reorderAt;
}
