import { useState } from "react";
import {
  useGetDatasetQuery,
  useGetDatasetVersionQuery,
  useListDatasetsQuery,
  useListDropsQuery,
  useListStreamsQuery,
  readToken,
  writeToken,
} from "../../api/client";
import { registerApp, type AppProps } from "../../appkit/registry";
import { SourcePanel } from "../../components/organisms";

/**
 * The source browser — the container half.
 *
 * Five queries, chained: the chosen drop decides which streams and datasets are
 * listed, the chosen dataset decides which version is fetched, and the version
 * decides which files exist. Every one of them can legitimately return nothing,
 * which is why `SourcePanel` has more absence states than populated ones.
 */
function SourceApp(_props: AppProps) {
  const [drop, setDrop] = useState("");
  // Was an uncontrolled `defaultValue={readToken()}` that wrote through on
  // every keystroke. The write-through is kept; the state makes it controlled,
  // which is what TextInput requires and what stops the value and the store
  // silently diverging after a programmatic change.
  const [token, setToken] = useState(() => readToken());
  const [dataset, setDataset] = useState("");

  const drops = useListDropsQuery();
  const chosen = drop || drops.data?.drops?.[0]?.name || "";
  const streams = useListStreamsQuery(chosen, { skip: !chosen });
  const datasets = useListDatasetsQuery(chosen, { skip: !chosen });
  const chosenDataset = dataset || datasets.data?.datasets?.[0]?.name || "";
  const detail = useGetDatasetQuery(
    { drop: chosen, dataset: chosenDataset },
    { skip: !chosenDataset },
  );
  const committed = (detail.data?.versions ?? []).filter((v) => v.state === "committed");
  const version = committed[committed.length - 1];

  // The dataset-detail response lists versions WITHOUT their files: naming
  // every file of every version is expensive and most callers do not want it.
  // The symptom of forgetting this is an empty file list and no error at all.
  const versionDetail = useGetDatasetVersionQuery(
    { drop: chosen, dataset: chosenDataset, version: version?.version ?? 0 },
    { skip: !version },
  );

  return (
    <SourcePanel
      token={token}
      // This is an optional user-owned ddp_ token field; normal browser use
      // relies on the OIDC-backed HttpOnly session cookie instead.
      showToken
      drops={(drops.data?.drops ?? []).map((d) => ({
        name: d.name,
        public_read: d.public_read ?? false,
      }))}
      chosenDrop={chosen}
      streams={(streams.data?.streams ?? []).map((s) => s.stream)}
      datasets={(datasets.data?.datasets ?? []).map((d) => d.name)}
      chosenDataset={chosenDataset}
      files={(versionDetail.data?.files ?? []).map((file) => file.path)}
      latestVersion={version?.version ?? null}
      error={drops.error != null}
      onTokenChange={(next) => {
        setToken(next);
        writeToken(next);
      }}
      onDropChange={(next) => {
        setDrop(next);
        setDataset("");
      }}
      onDatasetChange={setDataset}
    />
  );
}

registerApp({
  id: "sources",
  title: "sources",
  tone: "var(--pbui-tone-source)",
  docBound: false,
  duplicable: false,
  singleton: true,
  Component: SourceApp,
});
