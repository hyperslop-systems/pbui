import type { PresentationReference, PresentationTranslator, RelationDefinition, SerializableReference } from "@hyperslop-systems/pbui";
import type { ShopHost } from "../host";
import type { ShopFacts } from "./actions";
import type { Values } from "./types";
import { categoryValue, customerValue, productValue } from "./values";

/*
 * The shop's RELATIONS (design D7): one registry, two readers. As
 * `PresentationTranslator`s they let accept mode take an order where a
 * customer is wanted ("show this order as its customer"); as the kernel's
 * `relations` they let a `Derived` term name the same conversion as a
 * standing binding. Both are the host's relations, so nothing here invents
 * a second data path.
 */

export interface ShopRelation extends RelationDefinition {
  apply(reference: SerializableReference, host: ShopHost): SerializableReference | undefined;
}

export function createShopRelations(host: ShopHost): ShopRelation[] {
  return [
    {
      id: "order.customer",
      from: "order",
      to: "customer",
      label: "its customer",
      apply: (reference) => {
        if (reference.type !== "order") return undefined;
        const customer = host.relations.orderCustomer((reference.value as { id: string }).id);
        return customer ? { type: "customer", value: customerValue(customer) } : undefined;
      },
    },
    {
      id: "lineItem.product",
      from: "lineItem",
      to: "product",
      label: "its product",
      apply: (reference) => {
        if (reference.type !== "lineItem") return undefined;
        const product = host.product((reference.value as { productId: string }).productId);
        return product ? { type: "product", value: productValue(product, host) } : undefined;
      },
    },
    {
      id: "product.category",
      from: "product",
      to: "category",
      label: "its category",
      apply: (reference) => {
        if (reference.type !== "product") return undefined;
        const category = host.category((reference.value as { categoryId: string }).categoryId);
        return category ? { type: "category", value: categoryValue(category) } : undefined;
      },
    },
  ];
}

/** The same relations as typed accept translators, so accept mode and derived bindings agree by construction. */
export function shopTranslators(relations: readonly ShopRelation[], host: ShopHost): PresentationTranslator<Values, ShopFacts>[] {
  return relations.map((relation) => ({
    id: relation.id,
    from: relation.from,
    to: relation.to,
    match: "subtypes" as const,
    translate: (reference) => relation.apply(reference as unknown as SerializableReference, host) as PresentationReference<Values> | undefined,
  }));
}
