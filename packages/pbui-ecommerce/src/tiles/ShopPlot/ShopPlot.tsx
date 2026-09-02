import { AppBody, EmptyState, Text, Toolbar } from "@hyperslop-systems/pbui";
import { useEmitPort, usePort, useWorkbench, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { DatumId, InteractionIndex, InteractionTargetRecord, PlotEvent, PlotOutcome } from "@hyperslop-systems/plot";
import { ResponsivePlot } from "@hyperslop-systems/plot/react";
import { useMemo, useState } from "react";
import type { Shop } from "../../createShop";
import { PLOT_SLOT, TABLE_SLOT, readPlotDocument, readTableName } from "../../document";
import { IDENTITY_FIELDS, useHostRevision, type TableName } from "../../host";
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

/** The datum ids of the marks whose identity field matches one of these row ids — the external selection, drawn. */
function datumIdsFor(index: InteractionIndex | null, table: TableName, rowIds: ReadonlySet<string>): DatumId[] {
  if (!index || rowIds.size === 0) return [];
  const field = `field:${IDENTITY_FIELDS[table]}`;
  const out = new Set<DatumId>();
  for (const record of index.targets) {
    if (record.target.kind !== "mark") continue;
    for (const identity of record.identities) {
      if (identity.kind !== "source") continue;
      const at = identity.fields.indexOf(field as never);
      if (at >= 0 && rowIds.has(String(identity.values[at]))) out.add(identity.id);
    }
  }
  return [...out];
}

/**
 * A `hyperslop.plot` document over one of the host's tables. Two document
 * slots: the plot and the table. The rows never enter the workbench
 * document — they come from the host at render time — which is the rule
 * PBUI-DATALAB-1 keeps when the host is DuckDB. The plot's events become
 * port emissions: activating a mark emits `datum` (hovering attends it);
 * a legend entry or a category-bearing mark emits `cat`; a brush emits
 * `selection` as rows of the plot's table. The `selection` port is read
 * back too: when it shares a cell with a table (scene 5), the table's
 * selection lights the matching marks.
 */
export function ShopPlot({ shop, view, onEvent }: ShopPlotProps) {
  const workbench = useWorkbench();
  const doc = workbench.useDocument();
  const revision = useHostRevision(shop.host);
  const emitDatum = useEmitPort(view, "datum");
  const emitCategory = useEmitPort(view, "cat");
  const emitSelection = useEmitPort(view, "selection");
  const selection = usePort<DatumValue[]>(view, "selection");
  const [index, setIndex] = useState<InteractionIndex | null>(null);
  const plotId = view.documents[PLOT_SLOT] ?? "";
  const tableId = view.documents[TABLE_SLOT] ?? "";
  const plot = plotId ? readPlotDocument(doc, plotId) : null;
  const table = tableId ? readTableName(doc, tableId) : null;
  const data = useMemo(() => (table ? plotDataFor(shop.host, table) : null), [shop.host, table, revision]);
  const selectedRows = useMemo(() => new Set((selection.value ?? []).filter((d) => d.relation === table).map((d) => String(d.identity[IDENTITY_FIELDS[table ?? "orders"]]))), [selection.value, table]);
  const highlighted = useMemo(() => (table ? datumIdsFor(index, table, selectedRows) : []), [index, table, selectedRows]);

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
    } else if (event.kind === "brush") {
      // The brushed marks, as rows of the plot's table (deduplicated by identity).
      const ids = new Set(event.selection?.datumIds ?? []);
      const rows = new Map<string, DatumValue>();
      for (const record of index?.targets ?? []) {
        if (record.target.kind !== "mark" || !record.target.datumIds.some((id) => ids.has(id))) continue;
        const datum = datumOf(table, record);
        if (datum) rows.set(String(datum.identity[IDENTITY_FIELDS[table]]), datum);
      }
      emitSelection({ type: "datum", value: [...rows.keys()].sort().map((key) => rows.get(key)!) });
    }
  };
  const onOutcome = (outcome: PlotOutcome) => setIndex(outcome.interactions);

  return (
    <div data-part="shop-plot" className={styles.app} data-selected-count={selectedRows.size || undefined}>
      <Toolbar tight>
        <Text size="tiny" strong truncate>
          {plot.description ?? plot.id}
        </Text>
        <span className={styles.spacer} />
        <Text size="tiny" tone="faint">
          {data.coverage.rowCount} rows of {table}
          {selectedRows.size > 0 ? ` · ${selectedRows.size} selected` : ""}
        </Text>
      </Toolbar>
      <AppBody flush className={styles.body}>
        <ResponsivePlot
          document={plot}
          schema={SCHEMAS[table]}
          data={data}
          {...(highlighted.length > 0 ? { view: { selection: highlighted } } : {})}
          theme="embedded"
          resizeDelayMs={80}
          brush="xy"
          className={styles.plot}
          style={{ width: "100%", height: "100%" }}
          onEvent={handle}
          onOutcome={onOutcome}
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
