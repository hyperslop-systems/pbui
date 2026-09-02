import { documentSlotPort } from "@hyperslop-systems/pbui";
import { defineApp, type AppDescriptor, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { Shop } from "./createShop";
import { PLOT_SLOT, TABLE_SLOT, readPlotDocument } from "./document";
import { INSPECTABLE } from "./presentation/types";
import { CustomerDetail } from "./tiles/CustomerDetail";
import { CustomersTable } from "./tiles/CustomersTable";
import { Inspector } from "./tiles/Inspector";
import { OrderDetail } from "./tiles/OrderDetail";
import { OrdersTable } from "./tiles/OrdersTable";
import { ProductCatalog } from "./tiles/ProductCatalog";
import { ShopPlot } from "./tiles/ShopPlot";

/*
 * The shop's applications, each with its PORTS (PBUI-LINK-1 §11.1).
 *
 * The declarations are the whole point of this package: every later phase
 * links, pins, routes, shares or derives THROUGH them. Read them as the
 * contract PBUI-DATALAB-1's tiles will re-declare over real relations.
 *
 *   orders / customers / products   tables; each EMITS the row you click
 *                                   (`order`, `customer`, `product`) and
 *                                   shares a `selection` of its own rows
 *   order-detail / customer-detail  one record; an INPUT with an ambient
 *                                   fallback, so an unlinked detail follows
 *                                   the workspace's current order/customer
 *   inspector                       anything `inspectable`, by reachability
 *   plot                            a `hyperslop.plot` document over a table;
 *                                   emits the activated `datum` and the
 *                                   clicked `cat`, shares a `selection`
 */

export const SHOP_GROUP = "GOLD COIN SHOP";

export const APP_IDS = {
  orders: "orders",
  customers: "customers",
  products: "products",
  orderDetail: "order-detail",
  customerDetail: "customer-detail",
  inspector: "inspector",
  plot: "plot",
} as const;

/** Context keys the detail tiles fall back to when nothing is linked in (design §6.2 `fallbackContext`). */
export const CONTEXTS = {
  order: "workspace.order",
  customer: "workspace.customer",
  inspected: "workspace.inspected",
} as const;

/** The authority domain of a plot's table slot: the table's name (`table:orders` → `orders`), else the slot value itself. */
function tableAuthority(tableId: string | undefined): string {
  if (!tableId) return "plot";
  return tableId.startsWith("table:") ? tableId.slice("table:".length) : tableId;
}

export function createShopApps(shop: Shop): AppDescriptor[] {
  return [
    defineApp({
      id: APP_IDS.orders,
      title: "orders",
      tone: "var(--pbui-cat-1)",
      singleton: false,
      group: SHOP_GROUP,
      blurb: "the order book; click a row to emit it, hover to attend it",
      ports: [
        { name: "order", direction: "out", contract: { valueType: "order", semanticRole: "order.current" }, doc: "the order you clicked; hovering emits it as attended", drivesContext: CONTEXTS.order },
        { name: "selection", direction: "inout", contract: { valueType: "datum", semanticRole: "selection", cardinality: "many", authorityDomain: "orders" }, doc: "the selected orders, as rows" },
        { name: "filter", direction: "in", contract: { valueType: "category", semanticRole: "filter" }, doc: "a category that narrows the rows" },
      ],
      Component: (props: AppProps) => <OrdersTable {...props} shop={shop} />,
    }),
    defineApp({
      id: APP_IDS.customers,
      title: "customers",
      tone: "var(--pbui-cat-2)",
      singleton: false,
      group: SHOP_GROUP,
      blurb: "who buys; click a row to emit the customer",
      ports: [
        { name: "customer", direction: "out", contract: { valueType: "customer", semanticRole: "customer.current" }, doc: "the customer you clicked", drivesContext: CONTEXTS.customer },
        { name: "selection", direction: "inout", contract: { valueType: "datum", semanticRole: "selection", cardinality: "many", authorityDomain: "customers" }, doc: "the selected customers, as rows" },
      ],
      Component: (props: AppProps) => <CustomersTable {...props} shop={shop} />,
    }),
    defineApp({
      id: APP_IDS.products,
      title: "catalog",
      tone: "var(--pbui-cat-3)",
      singleton: false,
      group: SHOP_GROUP,
      blurb: "the eight SKUs, with stock against the reorder floor",
      ports: [
        { name: "product", direction: "out", contract: { valueType: "product", semanticRole: "product.current" }, doc: "the SKU you clicked" },
        { name: "cat", direction: "out", contract: { valueType: "category", semanticRole: "category.current" }, doc: "the category you clicked" },
        { name: "selection", direction: "inout", contract: { valueType: "datum", semanticRole: "selection", cardinality: "many", authorityDomain: "products" }, doc: "the selected SKUs, as rows" },
      ],
      Component: (props: AppProps) => <ProductCatalog {...props} shop={shop} />,
    }),
    defineApp({
      id: APP_IDS.orderDetail,
      title: "order detail",
      tone: "var(--pbui-cat-1)",
      singleton: false,
      group: SHOP_GROUP,
      blurb: "one order: its facts and line items; follows the workspace's order until linked",
      ports: [{ name: "order", direction: "in", contract: { valueType: "order", semanticRole: "order.detail" }, doc: "the order shown", fallbackContext: CONTEXTS.order, onSourceClose: "freeze" }],
      Component: (props: AppProps) => <OrderDetail {...props} shop={shop} />,
    }),
    defineApp({
      id: APP_IDS.customerDetail,
      title: "customer detail",
      tone: "var(--pbui-cat-2)",
      singleton: false,
      group: SHOP_GROUP,
      blurb: "one customer and their orders; typically derived from an order through order.customer",
      ports: [{ name: "customer", direction: "in", contract: { valueType: "customer", semanticRole: "customer.detail" }, doc: "the customer shown", fallbackContext: CONTEXTS.customer, onSourceClose: "freeze" }],
      Component: (props: AppProps) => <CustomerDetail {...props} shop={shop} />,
    }),
    defineApp({
      id: APP_IDS.inspector,
      title: "inspector",
      tone: "var(--pbui-selected)",
      singleton: false,
      group: SHOP_GROUP,
      blurb: "whatever was last inspected or linked in, as data",
      ports: [{ name: "subject", direction: "in", contract: { valueType: INSPECTABLE, semanticRole: "subject" }, doc: "anything inspectable: an order, a customer, a SKU, a mark, a category, a metal", fallbackContext: CONTEXTS.inspected, onSourceClose: "clear" }],
      Component: (props: AppProps) => <Inspector {...props} shop={shop} />,
    }),
    defineApp({
      id: APP_IDS.plot,
      title: "plot",
      tone: "var(--pbui-cat-4)",
      singleton: false,
      duplicable: false,
      group: SHOP_GROUP,
      blurb: "a plot document over one of the shop's tables",
      ports: [
        documentSlotPort(PLOT_SLOT, "the hyperslop.plot document this tile draws"),
        documentSlotPort(TABLE_SLOT, "the table the plot draws rows from"),
        {
          name: "selection",
          direction: "inout",
          contract: { valueType: "datum", semanticRole: "selection", cardinality: "many", authorityDomain: "plot" },
          doc: "the brushed marks, as rows of the plot's table",
          // Q7: the authority is the table this VIEW draws — orders for the orders plot, daily_sales for the revenue
          // plots — so an orders table's selection is identity-compatible with the former and not the latter.
          refineContract: (view) => ({ authorityDomain: tableAuthority(view.documents[TABLE_SLOT]) }),
        },
        { name: "datum", direction: "out", contract: { valueType: "datum", semanticRole: "datum.current" }, doc: "the mark you clicked" },
        { name: "cat", direction: "out", contract: { valueType: "category", semanticRole: "category.current" }, doc: "the category of the bar or legend entry you clicked" },
      ],
      titleFor: (view) => {
        const id = view.documents[PLOT_SLOT];
        return id ? `plot · ${id}` : "plot";
      },
      Component: (props: AppProps) => <ShopPlot {...props} shop={shop} />,
    }),
  ];
}

/** The plot document a plot view draws, if the workbench holds it. */
export { readPlotDocument };
