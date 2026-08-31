import { registerApp, type AppProps } from "../../appkit/registry";
import { useDocPlot } from "../useTable";
import { AppBody } from "@hyperslop-systems/pbui";
import { DocBar } from "../../components/molecules";
import { ChartPanel } from "../../components/organisms";
import styles from "./ChartApp.module.css";

/** The chart tile owns application data; ResponsivePlot owns content-box measurement. */
function ChartApp({ view }: AppProps) {
  const docId = view.documents.primary ?? null;
  const { doc, table, plot, loading } = useDocPlot(docId);

  return (
    <>
      <DocBar viewId={view.id} docId={docId} />
      <AppBody className={styles.body}>
        <div className={styles.plotFrame}>
          <ChartPanel plot={plot} table={table} loading={loading} docId={doc?.id ?? null} />
        </div>
      </AppBody>
    </>
  );
}

registerApp({
  id: "chart",
  title: "chart",
  tone: "var(--pbui-tone-cat)",
  docBound: true,
  duplicable: true,
  singleton: false,
  Component: ChartApp,
});
