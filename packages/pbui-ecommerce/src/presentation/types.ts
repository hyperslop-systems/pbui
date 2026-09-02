import type { LinkRef, PortRef, TileRef, WorkbenchLinks } from "@hyperslop-systems/pbui-workbench";
import type { ShopHost } from "../host";

/*
 * The shop's presentation values: what a `<order>`, `<customer>`, … reference
 * carries. Every value is plain JSON (design D4): a datum is `{ relation,
 * identity }`, never a row object, so a port may hold or pin any of them and
 * the link document stays serializable. Values are FLAT — the id is a field
 * of the value, not a wrapper around it — because nothing here crosses a
 * wire that needs provenance.
 */

export type JsonPrimitive = null | boolean | number | string;

export type OrderValue = {
  id: string;
  customerId: string;
  customer: string;
  placedAt: string;
  status: string;
  items: number;
  total: number;
};

export type CustomerValue = {
  id: string;
  name: string;
  kind: string;
  city: string;
};

export type ProductValue = {
  id: string;
  name: string;
  metal: string;
  categoryId: string;
  category: string;
  price: number;
  stock: number;
  reorderPoint: number;
};

export type LineItemValue = {
  id: string;
  orderId: string;
  productId: string;
  qty: number;
  unitPrice: number;
};

/** A mark's row identity: which table, which identity-field values. Plot's `DatumIdentity` shape, JSON-only. */
export type DatumValue = {
  relation: string;
  identity: Record<string, JsonPrimitive>;
  /** The semantic values the mark showed (x, y, colour…), for the label. */
  values?: Record<string, JsonPrimitive>;
};

export type CategoryValue = { id: string; name: string };
export type MetalValue = { id: string; name: string; spotUsd: number };
export type FieldValue = { relation: string; name: string };
export type WorkspaceValue = { id: string; name: string };

export interface Values {
  order: OrderValue;
  customer: CustomerValue;
  product: ProductValue;
  lineItem: LineItemValue;
  datum: DatumValue;
  category: CategoryValue;
  metal: MetalValue;
  field: FieldValue;
  tile: TileRef;
  workspace: WorkspaceValue;
  /** A binding badge (PBUI-LINK-1): the port it stands for, with its state. */
  port: PortRef;
  /** A wire in connect mode (PBUI-LINK-1 Phase 3). */
  link: LinkRef;
}

export type ShopType = keyof Values;

/** What descriptors and rules may read beyond the reference itself. */
export interface Environment {
  host: ShopHost;
  /** The workbench's link facilities, once a workbench exists; what `snapshotFor` reads link facts from. */
  links?: WorkbenchLinks;
}

/** The abstract type every shop value descends from: what an inspector's `subject` port accepts. */
export const INSPECTABLE = "inspectable";
