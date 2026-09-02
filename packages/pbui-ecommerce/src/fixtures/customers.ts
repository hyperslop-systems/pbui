/*
 * Who buys from the shop. The first four are the customers the chat demo's
 * four orders name (by display name, which stays the join key that world
 * uses); the rest give the order book somewhere to go.
 */

export type CustomerKind = "retail" | "dealer" | "fund";

export interface Customer {
  id: string;
  name: string;
  kind: CustomerKind;
  city: string;
  /** ISO date of the first order. */
  since: string;
}

export const CUSTOMERS: readonly Customer[] = [
  { id: "c-alvarez", name: "J. Alvarez", kind: "retail", city: "Austin", since: "2024-11-03" },
  { id: "c-northgate", name: "Northgate Capital", kind: "fund", city: "Boston", since: "2023-02-14" },
  { id: "c-okafor", name: "M. Okafor", kind: "retail", city: "Chicago", since: "2025-06-21" },
  { id: "c-nguyen", name: "T. Nguyen", kind: "retail", city: "San Jose", since: "2025-01-09" },
  { id: "c-harbor", name: "Harbor Coin & Bullion", kind: "dealer", city: "Seattle", since: "2022-08-30" },
  { id: "c-lindqvist", name: "E. Lindqvist", kind: "retail", city: "Minneapolis", since: "2026-03-02" },
  { id: "c-patel", name: "R. Patel", kind: "retail", city: "Edison", since: "2025-09-17" },
  { id: "c-summit", name: "Summit Precious Metals", kind: "dealer", city: "Denver", since: "2023-10-05" },
  { id: "c-brennan", name: "K. Brennan", kind: "retail", city: "Portland", since: "2026-05-11" },
  { id: "c-castellano", name: "Castellano Family Trust", kind: "fund", city: "Miami", since: "2024-04-22" },
  { id: "c-yamada", name: "S. Yamada", kind: "retail", city: "Honolulu", since: "2025-12-01" },
  { id: "c-oakridge", name: "Oakridge Numismatics", kind: "dealer", city: "Nashville", since: "2024-07-19" },
];
