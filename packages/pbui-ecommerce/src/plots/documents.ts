import type { PlotDocument } from "@hyperslop-systems/plot";
import { composition, geom, layer, plot, position, presentation, scale, stat, value, variable } from "@hyperslop-systems/plot/author";
import type { FieldId, LayerId, PlotId, VariableId, VariableSpec } from "@hyperslop-systems/plot";
import type { TableName } from "../host";

/*
 * The seeded plots: three `hyperslop.plot` documents, each over one table.
 * They ride in the workbench document as `DocumentPayload`s (see
 * `../document.ts`), so a plot tile is a view OF a plot document beside a
 * table document — the plotscript shape, without the script.
 */

export interface SeededPlot {
  document: PlotDocument;
  table: TableName;
  /** The launcher title. */
  name: string;
}

const f = (column: string) => `field:${column}` as FieldId;
const v = (id: string) => id as VariableId;
const l = (id: string) => id as LayerId;
const variables = (map: Record<string, VariableSpec>) => map as unknown as PlotDocument["variables"];

/** Revenue per (day, category) cell, coloured by metal. Every mark is one `daily_sales` row. */
export const REVENUE_BY_DAY: SeededPlot = {
  name: "revenue by day",
  table: "daily_sales",
  document: plot({
    id: "revenue-by-day" as PlotId,
    description: "Revenue per day and category over the summer, coloured by metal.",
    variables: variables({
      date: variable.field(f("date"), { label: "Date" }),
      revenue: variable.field(f("revenue"), { label: "Revenue" }),
      metal: variable.field(f("metal"), { label: "Metal" }),
    }),
    composition: composition.cartesian({ x: value.variable(v("date")), y: value.variable(v("revenue")), groups: [value.variable(v("metal"))] }),
    scales: { x: scale.temporal(), y: scale.linear({ zero: true }), color: scale.categorical() },
    layers: [layer({ id: l("cells"), mapping: { color: value.variable(v("metal")) }, stat: stat.identity(), geom: geom.point({ radius: 3 }), position: position.identity() })],
    presentation: presentation.compact({ padding: 8 }),
  }),
};

/** Revenue stacked per category; a bar segment is one `daily_sales` cell. Clicking one emits `cat`. */
export const REVENUE_BY_CATEGORY: SeededPlot = {
  name: "revenue by category",
  table: "daily_sales",
  document: plot({
    id: "revenue-by-category" as PlotId,
    description: "Summer revenue per category, stacked from the daily cells, coloured by metal.",
    variables: variables({
      category: variable.field(f("categoryId"), { label: "Category" }),
      revenue: variable.field(f("revenue"), { label: "Revenue" }),
      metal: variable.field(f("metal"), { label: "Metal" }),
    }),
    composition: composition.cartesian({ x: value.variable(v("category")), y: value.variable(v("revenue")), groups: [value.variable(v("metal"))] }),
    scales: { x: scale.band(), y: scale.linear({ zero: true }), color: scale.categorical() },
    layers: [layer({ id: l("bars"), mapping: { color: value.variable(v("metal")) }, stat: stat.identity(), geom: geom.bar(), position: position.stack() })],
    presentation: presentation.compact({ padding: 8 }),
  }),
};

/** Order value stacked per status; a bar segment is one ORDER, which is what makes it identity-compatible with the orders table's selection. */
export const ORDERS_BY_STATUS: SeededPlot = {
  name: "orders by status",
  table: "orders",
  document: plot({
    id: "orders-by-status" as PlotId,
    description: "Order value per status; every segment is one order.",
    variables: variables({
      status: variable.field(f("status"), { label: "Status" }),
      total: variable.field(f("total"), { label: "Order total" }),
    }),
    composition: composition.cartesian({ x: value.variable(v("status")), y: value.variable(v("total")) }),
    scales: { x: scale.band(), y: scale.linear({ zero: true }) },
    layers: [layer({ id: l("orders"), stat: stat.identity(), geom: geom.bar(), position: position.stack() })],
    presentation: presentation.compact({ padding: 8 }),
  }),
};

export const SEEDED_PLOTS: readonly SeededPlot[] = [REVENUE_BY_DAY, REVENUE_BY_CATEGORY, ORDERS_BY_STATUS];
