import { AppBody, Chip, EmptyState, Text, Toolbar } from "@hyperslop-systems/pbui";
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
 */
export function PlotTile({ view, host }: PlotTileProps) {
  const workbench = useWorkbench();
  const id = view.documents[PLOT_BINDING] ?? "";
  const doc = workbench.useDocument();
  const script = id ? readPlotScript(doc, id) : null;
  const draft = useDraft(host.drafts, id);
  const run = useScriptRun(host.runner, id);
  const [outcome, setOutcome] = useState<PlotOutcome | null>(null);

  useEffect(() => {
    if (!script) return;
    if (host.runner.getState(script.id).status === "idle") void host.runner.run(script.id, script.source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script?.id]);

  if (!id) return <EmptyState message="this tile names no script" hint={`bind it: view.documents.${PLOT_BINDING}`} />;
  if (!script) return <EmptyState message={`no script "${id}" in this workbench`} hint="open one from the launcher, or seed the document" />;

  const result = run.lastGood;
  const stale = result !== null && (run.status === "error" || run.status === "invalid" || (draft !== undefined && draft !== run.lastGoodSource));
  const errors = outcome?.diagnostics.filter((d) => d.severity === "error").length ?? 0;
  const coverage = result?.data.coverage;

  return (
    <div data-part="plot-view" className={styles.app}>
      <Toolbar tight>
        <Text size="tiny" strong truncate>
          {result?.document.description ?? result?.document.id ?? script.name}
        </Text>
        {stale ? <Chip label="stale" state="stale" title="the script changed or failed since this was drawn" /> : null}
        <span className={styles.spacer} />
        <Text size="tiny" tone="faint">
          {coverage ? `${coverage.rowCount} rows · ${coverage.kind}${coverage.kind === "bounded" && coverage.hasMore ? " · more" : ""}` : "no plot yet"}
          {errors > 0 ? ` · ${errors} error${errors === 1 ? "" : "s"}` : ""}
        </Text>
      </Toolbar>
      <AppBody flush className={styles.body}>
        {result ? (
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
