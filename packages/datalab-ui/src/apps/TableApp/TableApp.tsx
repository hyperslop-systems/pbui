import { registerApp, type AppProps } from "../../appkit/registry";
import { useDocAnalysisResult } from "../useTable";
import { DocBar } from "../../components/molecules";
import { TablePanel } from "../../components/organisms";

/** The current DuckDB output relation — the container half. */
function TableApp({ view }: AppProps) {
  const docId = view.documents.primary ?? null;
  const { doc, pipeline, loading } = useDocAnalysisResult(docId);

  return (
    <>
      <DocBar viewId={view.id} docId={docId} />
      <TablePanel pipeline={pipeline} docId={doc?.id ?? null} loading={loading} />
    </>
  );
}

registerApp({
  id: "table",
  title: "table",
  tone: "var(--pbui-tone-source)",
  docBound: true,
  duplicable: true,
  singleton: false,
  Component: TableApp,
});
