import type { PresentationReference } from "@hyperslop-systems/pbui";
import type { CategoryValue, MetalValue, OrderValue, ProductValue, Values } from "./pbui/types";

/*
 * The gold-coin shop's world, as the browser sees it.
 *
 * # This file is a MIRROR of pkg/chatserver/demo/data.go, and nothing enforces that
 *
 * The Go package is the source of truth: it is what the scripted engine
 * resolves `[[product:2049]]` against, so a number that disagrees here shows
 * up as a tile and a chat message quoting different stock for the same SKU —
 * the most confusing possible bug, because both halves look authoritative.
 *
 * The vocabulary has a generator for exactly this reason (`pnpm vocab` writes
 * pkg/chatserver/demo/vocabulary.json from src/pbui/vocabulary.ts, and a Go
 * test fails when they disagree). The world has no such guard yet, in either
 * direction. Until it does: change data.go first, then this file, and keep
 * the field names identical to the Go struct tags below so a future generator
 * is a transcription rather than a redesign.
 *
 * # Why a fixture at all rather than an HTTP fetch
 *
 * The demo tiles must render with the engine disconnected — `make chat-serve`
 * has no model, and the workbench is often opened before the socket is up. A
 * tile that shows an empty table until a fetch lands teaches the reader that
 * the tile is broken, not that the server is slow.
 */

/** One SKU. Field-for-field `demo.Product` in pkg/chatserver/demo/data.go. */
export interface WorldProduct {
  id: string;
  name: string;
  /** The `category` field in Go: a category ID, not a name. */
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

export interface WorldCategory {
  name: string;
  products: number;
}

export interface WorldMetal {
  name: string;
  spotUsd: number;
  /** Percent of the shop's stock value held in this metal; the metals board's bar. */
  shareOfStockValue: number;
}

export interface WorldOrder {
  customer: string;
  total: number;
  items: number;
  placedAt: string;
  status: string;
}

/**
 * `demo.Products`. Quantities are chosen so that "low stock" questions have a
 * clear answer — 2077 is out, 2051 and 5001 are under their floor — which is
 * what makes the inventory tile's low-stock chips worth showing at all.
 */
export const PRODUCTS: readonly WorldProduct[] = [
  { id: "2049", name: "1oz American Gold Eagle 2024", categoryId: "7", metal: "gold", qty: 3, reorderAt: 5, price: 2410, cost: 2201.18, sold30d: [3, 4, 6, 9, 12, 9, 6, 4, 3, 4, 6, 9], lastOrder: "88213" },
  { id: "2051", name: "1/2oz American Gold Eagle 2024", categoryId: "7", metal: "gold", qty: 1, reorderAt: 4, price: 1260, cost: 1150.5, sold30d: [1, 2, 2, 3, 2, 1, 2, 3, 4, 2, 1, 2], lastOrder: "88201" },
  { id: "2077", name: "1/10oz American Gold Eagle 2024", categoryId: "7", metal: "gold", qty: 0, reorderAt: 10, price: 265, cost: 238.9, sold30d: [8, 7, 9, 12, 10, 8, 6, 5, 4, 3, 2, 1], lastOrder: "88190" },
  { id: "3110", name: "1oz Canadian Gold Maple 2024", categoryId: "8", metal: "gold", qty: 14, reorderAt: 5, price: 2395, cost: 2190, sold30d: [2, 3, 3, 4, 5, 4, 3, 3, 4, 5, 6, 5], lastOrder: "88210" },
  { id: "2301", name: "1oz American Gold Buffalo 2024", categoryId: "9", metal: "gold", qty: 7, reorderAt: 5, price: 2430, cost: 2220, sold30d: [1, 1, 2, 2, 3, 2, 2, 1, 2, 3, 3, 2], lastOrder: "88177" },
  { id: "4001", name: "1oz American Silver Eagle 2024", categoryId: "10", metal: "silver", qty: 420, reorderAt: 100, price: 36.5, cost: 31.2, sold30d: [40, 45, 50, 38, 42, 55, 60, 48, 44, 41, 39, 52], lastOrder: "88214" },
  { id: "4002", name: "1oz Silver Maple 2024", categoryId: "11", metal: "silver", qty: 85, reorderAt: 100, price: 35.9, cost: 30.8, sold30d: [20, 22, 25, 18, 21, 27, 30, 24, 22, 20, 19, 26], lastOrder: "88209" },
  { id: "5001", name: "1oz Platinum Eagle 2024", categoryId: "12", metal: "platinum", qty: 2, reorderAt: 3, price: 1120, cost: 1040, sold30d: [0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0], lastOrder: "88150" },
];

/** `demo.Categories`. */
export const CATEGORIES: Readonly<Record<string, WorldCategory>> = {
  "7": { name: "American Gold Eagles", products: 3 },
  "8": { name: "Canadian Gold Maples", products: 1 },
  "9": { name: "American Gold Buffalos", products: 1 },
  "10": { name: "American Silver Eagles", products: 1 },
  "11": { name: "Canadian Silver Maples", products: 1 },
  "12": { name: "Platinum Eagles", products: 1 },
};

/**
 * `demo.Metals` — three of them, and no palladium. The board draws what the
 * server can resolve; a fourth row here would give the agent a `[[metal:…]]`
 * the resolver answers with `<unresolved>`.
 */
export const METALS: Readonly<Record<string, WorldMetal>> = {
  gold: { name: "gold", spotUsd: 2298.4, shareOfStockValue: 61 },
  silver: { name: "silver", spotUsd: 27.1, shareOfStockValue: 26 },
  platinum: { name: "platinum", spotUsd: 972.0, shareOfStockValue: 13 },
};

/** The order ids `WorldProduct.lastOrder` points at. `demo.Orders`. */
export const ORDERS: Readonly<Record<string, WorldOrder>> = {
  "88213": { customer: "J. Alvarez", total: 7230, items: 3, placedAt: "2026-08-18", status: "shipped" },
  "88214": { customer: "Northgate Capital", total: 14600, items: 400, placedAt: "2026-08-19", status: "paid" },
  "88201": { customer: "M. Okafor", total: 1260, items: 1, placedAt: "2026-08-12", status: "shipped" },
  "88190": { customer: "T. Nguyen", total: 795, items: 3, placedAt: "2026-08-05", status: "shipped" },
};

/** `demo.ProductByID`. */
export function productById(id: string): WorldProduct | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

/** `demo.LowStock`: at or below the reorder threshold. */
export function lowStock(): WorldProduct[] {
  return PRODUCTS.filter(isLowStock);
}

export function isLowStock(product: WorldProduct): boolean {
  return product.qty <= product.reorderAt;
}

/** The metal ids in board order — richest metal first, as the Go map's spot prices rank them. */
export const METAL_IDS: readonly string[] = ["gold", "silver", "platinum"];

/*
 * ---- references ---------------------------------------------------------
 *
 * The four builders below are the ONLY place a tile spells out a presentation
 * value, because the shape has to match what the descriptor in
 * src/pbui/descriptors/ reads and a mismatch is silent: `label()` falls back
 * to `product 2049` and the menu's "Keep only this category" quietly disables
 * itself. Nothing throws. Keeping the shapes here means one place to fix.
 */

/** `<product>`. `ProductValue.stock`/`reorderPoint` are the Go `qty`/`reorderAt`. */
export function productReference(product: WorldProduct): PresentationReference<Values> {
  const value: ProductValue = {
    name: product.name,
    sku: product.id,
    metal: product.metal,
    categoryId: product.categoryId,
    price: product.price,
    stock: product.qty,
    reorderPoint: product.reorderAt,
    ...(CATEGORIES[product.categoryId] ? { category: CATEGORIES[product.categoryId]!.name } : {}),
  };
  return { type: "product", value: { type: "product", id: product.id, value } };
}

/**
 * `<metal>`. No `tableId`: the metals board is not one of the chat's widget
 * tables, so "Keep only this metal" must stay disabled with its honest reason
 * rather than filtering a table that is not on screen.
 */
export function metalReference(id: string): PresentationReference<Values> {
  const metal = METALS[id];
  const value: MetalValue = { name: metal?.name ?? id, unit: "oz", ...(metal ? { spot: metal.spotUsd } : {}) };
  return { type: "metal", value: { type: "metal", id, value } };
}

/** `<category>`. Same `tableId` reasoning as `metalReference`. */
export function categoryReference(id: string): PresentationReference<Values> {
  const category = CATEGORIES[id];
  const value: CategoryValue = { name: category?.name ?? `category ${id}`, ...(category ? { count: category.products } : {}) };
  return { type: "category", value: { type: "category", id, value } };
}

/** `<order>`, for the SKU tile's "last sold on" line. */
export function orderReference(id: string): PresentationReference<Values> {
  const order = ORDERS[id];
  const value: OrderValue = order
    ? { customer: order.customer, total: order.total, status: order.status, placedAt: order.placedAt, items: order.items }
    : {};
  return { type: "order", value: { type: "order", id, value } };
}
