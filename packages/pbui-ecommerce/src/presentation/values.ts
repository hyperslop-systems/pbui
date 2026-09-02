import type { Category, Customer, LineItem, Metal, Order, Product } from "../fixtures";
import type { ShopHost } from "../host";
import type { CategoryValue, CustomerValue, LineItemValue, MetalValue, OrderValue, ProductValue } from "./types";

/*
 * The ONLY place a tile spells out a presentation value, because the shape
 * has to match what the descriptor reads and a mismatch is silent. Every
 * builder returns plain JSON (design D4).
 */

/** How a value is named in a badge or a menu row (the kernel's `label` dep). */
export function labelReference(reference: { type: string; value: unknown }): string {
  const v = reference.value as Record<string, unknown> | null;
  switch (reference.type) {
    case "order":
      return `#${String(v?.id ?? "?")}`;
    case "customer":
    case "product":
    case "category":
    case "metal":
      return String(v?.name ?? v?.id ?? reference.type);
    case "lineItem":
      return `${String(v?.qty ?? "?")} × ${String(v?.productId ?? "?")}`;
    case "datum": {
      const identity = (v?.identity as Record<string, unknown> | undefined) ?? {};
      return `${String(v?.relation ?? "datum")} ${Object.values(identity).map(String).join(" ")}`.trim();
    }
    default:
      return `<${reference.type}>`;
  }
}

export function orderValue(order: Order): OrderValue {
  return { id: order.id, customerId: order.customerId, customer: order.customer, placedAt: order.placedAt, status: order.status, items: order.items, total: order.total };
}

export function customerValue(customer: Customer): CustomerValue {
  return { id: customer.id, name: customer.name, kind: customer.kind, city: customer.city };
}

export function productValue(product: Product, host: ShopHost): ProductValue {
  return {
    id: product.id,
    name: product.name,
    metal: product.metal,
    categoryId: product.categoryId,
    category: host.category(product.categoryId)?.name ?? product.categoryId,
    price: product.price,
    stock: product.qty,
    reorderPoint: product.reorderAt,
  };
}

export function lineItemValue(line: LineItem): LineItemValue {
  return { id: line.id, orderId: line.orderId, productId: line.productId, qty: line.qty, unitPrice: line.unitPrice };
}

export function categoryValue(category: Category): CategoryValue {
  return { id: category.id, name: category.name };
}

export function metalValue(metal: Metal): MetalValue {
  return { id: metal.id, name: metal.name, spotUsd: metal.spotUsd };
}
