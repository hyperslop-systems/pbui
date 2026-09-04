import { AppBody, Chip, EmptyState, Text, TileHeader } from "@hyperslop-systems/pbui";
import { useWorkbench, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { PlotOutcome } from "@hyperslop-systems/plot";
import { ResponsivePlot } from "@hyperslop-systems/plot/react";
import { useEffect, useState } from "react";
import { readPlotScript } from "../document";
import { useDraft } from "../draftStore";
import { PLOT_BINDING, type PlotScriptHost } from "../host";
import { useScriptRun } from "../runner";
import styles from "./PlotTile.module.css";

export interface PlotTileProps extends AppProps {
  host: PlotScriptHost;
}

/**
 * The plot tile: `ResponsivePlot` over the script's last good result.
 *
 * It never blanks. A failing run leaves the last good plot on screen and marks
 * it stale; a draft that differs from what was last drawn is stale too. The
 * tile can stand alone — with no script tile open it runs the document's
 * source itself, once — so a workspace of plots without editors still draws.
 *
 * A script that returns a LIST gets a grid: one `ResponsivePlot` per result,
 * each its own request with its own scales. For plots that should share
 * scales and legends, facets in ONE document are the grammar's answer; the
 * grid is for genuinely independent plots.
 */
export function PlotTile({ view, host }: PlotTileProps) {
  const workbench = useWorkbench();
  const id = view.documents[PLOT_BINDING] ?? "";
  const doc = workbench.useDocument();
  const script = id ? readPlotScript(doc, id) : null;
  const draft = useDraft(host.drafts, id);
  const run = useScriptRun(host.runner, id);
  const [outcome, setOutcome] = useState<PlotOutcome | null>(null);

  // `run.status` is a dependency so a host reset re-runs the restored
  // document's source; the idle guard makes other status changes no-ops.
  useEffect(() => {
    if (!script) return;
    if (run.status === "idle" && host.runner.getState(script.id).status === "idle") {
      void host.runner.run(script.id, script.source);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script?.id, run.status]);

  if (!id) return <EmptyState message="this tile names no script" hint={`bind it: view.documents.${PLOT_BINDING}`} />;
  if (!script) return <EmptyState message={`no script "${id}" in this workbench`} hint="open one from the launcher, or seed the document" />;

  const result = run.lastGood;
  const all = run.lastGoodAll;
  const stale = result !== null && (run.status === "error" || run.status === "invalid" || (draft !== undefined && draft !== run.lastGoodSource));
  const errors = outcome?.diagnostics.filter((d) => d.severity === "error").length ?? 0;
  const coverage = result?.data.coverage;
  const many = all.length > 1;

  return (
    <div data-part="plot-view" className={styles.app}>
      <TileHeader
        title={many ? `${all.length} plots` : (result?.document.description ?? result?.document.id ?? script.name)}
        status={
          <>
            {many
              ? `${all.reduce((n, r) => n + r.data.coverage.rowCount, 0)} rows across ${all.length}`
              : coverage
                ? `${coverage.rowCount} rows · ${coverage.kind}${coverage.kind === "bounded" && coverage.hasMore ? " · more" : ""}`
                : "no plot yet"}
            {errors > 0 ? ` · ${errors} error${errors === 1 ? "" : "s"}` : ""}
          </>
        }
      >
        {stale ? <Chip label="stale" state="stale" title="the script changed or failed since this was drawn" /> : null}
      </TileHeader>
      <AppBody flush className={styles.body}>
        {result ? (
          many ? (
            <div className={styles.grid} data-part="plot-grid" data-count={all.length} style={{ gridTemplateColumns: `repeat(${all.length <= 2 ? all.length : all.length <= 4 ? 2 : 3}, minmax(0, 1fr))` }}>
              {all.map((one, index) => (
                <div key={`${one.document.id}:${index}`} className={styles.cell}>
                  <Text size="tiny" tone="faint" truncate>
                    {one.document.description ?? one.document.id}
                  </Text>
                  <ResponsivePlot document={one.document} schema={one.schema} data={one.data} {...(one.view ? { view: one.view } : {})} theme="embedded" resizeDelayMs={80} className={styles.plot} style={{ width: "100%", height: "100%" }} />
                </div>
              ))}
            </div>
          ) : (
            <ResponsivePlot
              document={result.document}
              schema={result.schema}
              data={result.data}
              {...(result.view ? { view: result.view } : {})}
              theme="embedded"
              resizeDelayMs={80}
              className={styles.plot}
              style={{ width: "100%", height: "100%" }}
              loading={run.status === "running" && result === null}
              onOutcome={setOutcome}
              emptyFallback={
                <Text size="small" tone="faint">
                  nothing to draw
                </Text>
              }
            />
          )
        ) : (
          <EmptyState
            message={run.status === "error" ? (run.error?.message ?? "the script failed") : run.status === "invalid" ? "the script did not return a plot" : run.status === "running" ? "running…" : "nothing drawn yet"}
            hint="edit the script in its tile; the plot follows"
          />
        )}
      </AppBody>
    </div>
  );
}
