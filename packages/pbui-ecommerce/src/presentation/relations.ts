import type { PresentationRelation } from "@hyperslop-systems/pbui";
import type { ShopHost } from "../host";
import type { ShopFacts } from "./actions";
import type { Values } from "./types";
import { categoryValue, customerValue, productValue } from "./values";

/*
 * The shop's RELATIONS (design D7, canonical since PBUI-KERNEL-1 C5/C6):
 * one declaration, two readers by EXPOSURE. As acceptance-exposed relations
 * they let accept mode take an order where a customer is wanted ("show this
 * order as its customer"); as derivation-exposed relations they let a
 * `Derived` link term name the same conversion as a standing binding. Both
 * read the host's relations, so nothing here invents a second data path —
 * and nothing can drift, because there is one relation object.
 */
export function createShopRelations(host: ShopHost): PresentationRelation<Values, ShopFacts>[] {
  const exposure = { acceptance: true, derivation: { transport: "serializable" as const } };
  return [
    {
      id: "order.customer",
      from: "order",
      to: "customer",
      match: "subtypes",
      label: "its customer",
      exposure,
      apply: (reference) => {
        if (reference.type !== "order") return undefined;
        const customer = host.relations.orderCustomer(reference.value.id);
        return customer ? { type: "customer", value: customerValue(customer) } : undefined;
      },
    },
    {
      id: "lineItem.product",
      from: "lineItem",
      to: "product",
      match: "subtypes",
      label: "its product",
      exposure,
      apply: (reference) => {
        if (reference.type !== "lineItem") return undefined;
        const product = host.product(reference.value.productId);
        return product ? { type: "product", value: productValue(product, host) } : undefined;
      },
    },
    {
      id: "product.category",
      from: "product",
      to: "category",
      match: "subtypes",
      label: "its category",
      exposure,
      apply: (reference) => {
        if (reference.type !== "product") return undefined;
        const category = host.category(reference.value.categoryId);
        return category ? { type: "category", value: categoryValue(category) } : undefined;
      },
    },
  ];
}
