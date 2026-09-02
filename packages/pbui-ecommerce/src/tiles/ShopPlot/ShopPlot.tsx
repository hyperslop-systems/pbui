import { AppBody, EmptyState, Text, Toolbar } from "@hyperslop-systems/pbui";
import { useWorkbench, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { PlotEvent } from "@hyperslop-systems/plot";
import { ResponsivePlot } from "@hyperslop-systems/plot/react";
import { useMemo } from "react";
import type { Shop } from "../../createShop";
import { PLOT_SLOT, TABLE_SLOT, readPlotDocument, readTableName } from "../../document";
import { useHostRevision } from "../../host";
import { plotDataFor, SCHEMAS } from "../../plots/schemas";
import styles from "../tiles.module.css";

export interface ShopPlotProps extends AppProps {
  shop: Shop;
  /** Phase 1: observe the plot's events; Phase 2 routes them to the `datum`/`cat`/`selection` ports. */
  onEvent?: (event: PlotEvent) => void;
}

/**
 * A `hyperslop.plot` document over one of the host's tables. Two document
 * slots: the plot and the table. The rows never enter the workbench
 * document — they come from the host at render time — which is the rule
 * PBUI-DATALAB-1 keeps when the host is DuckDB.
 */
export function ShopPlot({ shop, view, onEvent }: ShopPlotProps) {
  const workbench = useWorkbench();
  const doc = workbench.useDocument();
  const revision = useHostRevision(shop.host);
  const plotId = view.documents[PLOT_SLOT] ?? "";
  const tableId = view.documents[TABLE_SLOT] ?? "";
  const plot = plotId ? readPlotDocument(doc, plotId) : null;
  const table = tableId ? readTableName(doc, tableId) : null;
  const data = useMemo(() => (table ? plotDataFor(shop.host, table) : null), [shop.host, table, revision]);

  if (!plotId || !tableId) return <EmptyState message="this tile names no plot or no table" hint={`bind view.documents.${PLOT_SLOT} and view.documents.${TABLE_SLOT}`} />;
  if (!plot) return <EmptyState message={`no plot "${plotId}" in this workbench`} hint="seed one, or open a plot from the launcher" />;
  if (!table || !data) return <EmptyState message={`no table "${tableId}" in this workbench`} hint="the table document names one of the host's tables" />;

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
          {...(onEvent ? { onEvent } : {})}
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
