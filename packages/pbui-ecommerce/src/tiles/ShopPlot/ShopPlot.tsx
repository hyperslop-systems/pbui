import { AppBody, EmptyState, Text, Toolbar } from "@hyperslop-systems/pbui";
import { useEmitPort, useWorkbench, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { InteractionTargetRecord, PlotEvent } from "@hyperslop-systems/plot";
import { ResponsivePlot } from "@hyperslop-systems/plot/react";
import { useMemo } from "react";
import type { Shop } from "../../createShop";
import { PLOT_SLOT, TABLE_SLOT, readPlotDocument, readTableName } from "../../document";
import { useHostRevision, type TableName } from "../../host";
import { plotDataFor, SCHEMAS } from "../../plots/schemas";
import type { DatumValue, JsonPrimitive } from "../../presentation/types";
import { categoryValue } from "../../presentation/values";
import styles from "../tiles.module.css";

export interface ShopPlotProps extends AppProps {
  shop: Shop;
  /** Observe the plot's events beside the ports (stories, tests). */
  onEvent?: (event: PlotEvent) => void;
}

/** A mark's row identity as the `datum` port emits it: which table, which identity-field values, what the mark showed. */
function datumOf(table: TableName, target: InteractionTargetRecord): DatumValue | null {
  const identity = target.identities[0];
  if (!identity || identity.kind !== "source") return null;
  const record: Record<string, JsonPrimitive> = {};
  identity.fields.forEach((field, index) => {
    record[String(field).replace(/^field:/, "")] = identity.values[index] ?? null;
  });
  const values: Record<string, JsonPrimitive> = {};
  for (const [key, value] of Object.entries(target.semanticValues)) if (value !== undefined) values[key] = value;
  return { relation: table, identity: record, values };
}

/**
 * A `hyperslop.plot` document over one of the host's tables. Two document
 * slots: the plot and the table. The rows never enter the workbench
 * document — they come from the host at render time — which is the rule
 * PBUI-DATALAB-1 keeps when the host is DuckDB. The plot's events become
 * port emissions: activating a mark emits `datum` (and hovering attends
 * it); clicking a legend entry or a bar whose category is known emits `cat`.
 */
export function ShopPlot({ shop, view, onEvent }: ShopPlotProps) {
  const workbench = useWorkbench();
  const doc = workbench.useDocument();
  const revision = useHostRevision(shop.host);
  const emitDatum = useEmitPort(view, "datum");
  const emitCategory = useEmitPort(view, "cat");
  const plotId = view.documents[PLOT_SLOT] ?? "";
  const tableId = view.documents[TABLE_SLOT] ?? "";
  const plot = plotId ? readPlotDocument(doc, plotId) : null;
  const table = tableId ? readTableName(doc, tableId) : null;
  const data = useMemo(() => (table ? plotDataFor(shop.host, table) : null), [shop.host, table, revision]);

  if (!plotId || !tableId) return <EmptyState message="this tile names no plot or no table" hint={`bind view.documents.${PLOT_SLOT} and view.documents.${TABLE_SLOT}`} />;
  if (!plot) return <EmptyState message={`no plot "${plotId}" in this workbench`} hint="seed one, or open a plot from the launcher" />;
  if (!table || !data) return <EmptyState message={`no table "${tableId}" in this workbench`} hint="the table document names one of the host's tables" />;

  const categoryOf = (target: InteractionTargetRecord): string | null => {
    const value = target.semanticValues["category" as never] ?? target.semanticValues["categoryId" as never];
    return typeof value === "string" ? value : null;
  };

  const handle = (event: PlotEvent) => {
    onEvent?.(event);
    if (event.kind === "activate" && event.target.target.kind === "mark") {
      const datum = datumOf(table, event.target);
      if (datum) emitDatum({ type: "datum", value: datum });
      const categoryId = categoryOf(event.target);
      const category = categoryId ? shop.host.category(categoryId) : undefined;
      if (category) emitCategory({ type: "category", value: categoryValue(category) });
    } else if (event.kind === "hover" && event.target?.target.kind === "mark") {
      const datum = datumOf(table, event.target);
      if (datum) emitDatum({ type: "datum", value: datum }, { attended: true });
    } else if (event.kind === "activate" && event.target.target.kind === "legend") {
      const category = shop.host.category(String(event.target.target.value));
      if (category) emitCategory({ type: "category", value: categoryValue(category) });
    }
  };

  return (
    <div data-part="shop-plot" className={styles.app}>
      <Toolbar tight>
        <Text size="tiny" strong truncate>
          {plot.description ?? plot.id}
        </Text>
        <span className={styles.spacer} />
        <Text size="tiny" tone="faint">
          {data.coverage.rowCount} rows of {table}
        </Text>
      </Toolbar>
      <AppBody flush className={styles.body}>
        <ResponsivePlot
          document={plot}
          schema={SCHEMAS[table]}
          data={data}
          theme="embedded"
          resizeDelayMs={80}
          brush="xy"
          className={styles.plot}
          style={{ width: "100%", height: "100%" }}
          onEvent={handle}
          emptyFallback={
            <Text size="small" tone="faint">
              nothing to draw
            </Text>
          }
        />
      </AppBody>
    </div>
  );
}
