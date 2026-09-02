import { createPresentationRegistry, type PresentationDescriptor } from "@hyperslop-systems/pbui";
import { createLinkDescriptor, createPortDescriptor, createTileDescriptor, type LinkRef, type PortRef, type TileRef } from "@hyperslop-systems/pbui-workbench";
import type { CategoryValue, CustomerValue, DatumValue, Environment, FieldValue, LineItemValue, MetalValue, OrderValue, ProductValue, Values, WorkspaceValue } from "./types";

/*
 * Representation only (pbui 0.8.0): how each type labels, narrates and tones
 * itself. Verbs live in the action registry (`./actions.ts`).
 */

export const money = (n: number): string => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

const order: PresentationDescriptor<OrderValue, Environment> = {
  label: (order) => `#${order.id} · ${order.customer}`,
  describe: (order) => ({ presentationType: "order", ...order }),
  tone: "accent",
};

const customer: PresentationDescriptor<CustomerValue, Environment> = {
  label: (customer) => customer.name,
  describe: (customer) => ({ presentationType: "customer", ...customer }),
  tone: "neutral",
};

const product: PresentationDescriptor<ProductValue, Environment> = {
  label: (product) => product.name,
  describe: (product) => ({ presentationType: "product", ...product }),
  tone: "positive",
};

const lineItem: PresentationDescriptor<LineItemValue, Environment> = {
  label: (line, env) => `${line.qty} × ${env.host.product(line.productId)?.name ?? line.productId}`,
  describe: (line) => ({ presentationType: "lineItem", ...line }),
  tone: "neutral",
};

const datum: PresentationDescriptor<DatumValue, Environment> = {
  label: (datum) => {
    const shown = datum.values ? Object.entries(datum.values).map(([k, v]) => `${k} ${String(v)}`).join(" · ") : Object.values(datum.identity).map(String).join(" ");
    return `${datum.relation} ${shown}`.trim();
  },
  describe: (datum) => ({ presentationType: "datum", ...datum }),
  tone: "accent",
};

const category: PresentationDescriptor<CategoryValue, Environment> = {
  label: (category) => category.name,
  describe: (category) => ({ presentationType: "category", ...category }),
  tone: "neutral",
};

const metal: PresentationDescriptor<MetalValue, Environment> = {
  label: (metal) => metal.name,
  describe: (metal) => ({ presentationType: "metal", ...metal }),
  tone: "warning",
};

const field: PresentationDescriptor<FieldValue, Environment> = {
  label: (field) => `${field.relation}.${field.name}`,
  describe: (field) => ({ presentationType: "field", ...field }),
  tone: "neutral",
};

const workspace: PresentationDescriptor<WorkspaceValue, Environment> = {
  label: (workspace) => workspace.name,
  describe: (workspace) => ({ presentationType: "workspace", ...workspace }),
  tone: "neutral",
};

export const registry = createPresentationRegistry<Values, Environment>({
  order,
  customer,
  product,
  lineItem,
  datum,
  category,
  metal,
  field,
  tile: createTileDescriptor() as PresentationDescriptor<TileRef, Environment>,
  workspace,
  port: createPortDescriptor() as PresentationDescriptor<PortRef, Environment>,
  link: createLinkDescriptor() as PresentationDescriptor<LinkRef, Environment>,
});
