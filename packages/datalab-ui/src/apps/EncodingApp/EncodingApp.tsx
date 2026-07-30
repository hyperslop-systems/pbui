import { useDispatch, useSelector } from "react-redux";
import { CHANNELS, CHANNEL_ACCEPTS, type AnalysisSpec, type Channel } from "../../model/graphic";
import { rootView } from "../../model/graphicAuthoring";
import { usePbui, type FieldRef } from "../../pbui";
import { registerApp, type AppProps } from "../../appkit/registry";
import { useDocAnalysisResult } from "../useTable";
import type { FieldType } from "../../model/table";
import type { RootState } from "../../store";
import { worldActions } from "../../store/world";
import { DocBar } from "../../components/molecules";
import { EncodingPanel } from "../../components/organisms";

/**
 * The aesthetic mapping — the container half.
 *
 * Two things live here because both need the pipeline's rows or its schema, and
 * a panel that touched either would be back in the render path DATADROP-6's
 * follow-up guide is about:
 *
 *  - **the accept filter**, which decides that a nominal column may not be
 *    mapped to y, so an impossible mapping is unreachable rather than reported;
 *  - **`logUnavailable`**, which scans the y column for a non-positive value.
 */
function EncodingApp({ view: appView }: AppProps) {
  const docId = appView.documents.primary ?? null;
  const dispatch = useDispatch();
  const pbui = usePbui();
  const { doc, pipeline } = useDocAnalysisResult(docId);
  const activeDocId = useSelector((s: RootState) => s.world.activeDocId);
  const target = doc?.id ?? activeDocId;

  const fields = pipeline?.fields ?? [];
  const typeOf = (name: string) => fields.find((f) => f.name === name)?.type ?? null;
  const view = doc ? rootView(doc) : null;
  const mapping = Object.fromEntries(
    CHANNELS.map((channel) => [channel, view?.encodings[channel]?.name ?? null]),
  ) as Record<Channel, string | null>;

  // A log scale needs a strictly positive domain. Disabled with a reason rather
  // than silently ignored; plot.ts falls back too, as a second line of defence.
  const yName = mapping.y;
  const yValues = yName
    ? (pipeline?.rows ?? []).map((r) => Number(r[yName])).filter(Number.isFinite)
    : [];
  const logUnavailable = yValues.length === 0 || Math.min(...yValues) <= 0;

  // A mapping the pipeline no longer produces. The panel renders it stale with a
  // warning; the alternative — a blank control over a specification that still
  // holds the dead name — is what the predecessor shipped.
  const staleChannels = CHANNELS.filter((channel) => {
    const mapped = mapping[channel];
    return mapped !== null && typeOf(mapped) === null;
  });
  const acceptsFor = (channel: Channel): readonly FieldType[] => {
    if (channel !== "x") return CHANNEL_ACCEPTS[channel];
    if (
      view?.analysis.kind === "histogram" ||
      view?.analysis.kind === "density" ||
      view?.analysis.kind === "regression"
    ) {
      return ["q"] as const;
    }
    if (view?.analysis.kind === "summary" || view?.analysis.kind === "boxplot") {
      return ["n", "t"] as const;
    }
    return CHANNEL_ACCEPTS.x;
  };
  const setAnalysisKind = (kind: AnalysisSpec["kind"]) => {
    const analysis: AnalysisSpec =
      kind === "histogram"
        ? { kind, bins: 12 }
        : kind === "summary"
          ? { kind, interval: "standard-error", multiplier: 1 }
          : kind === "regression"
            ? { kind, confidence: 0.95 }
            : kind === "density"
              ? { kind, points: 128 }
              : { kind };
    dispatch(worldActions.setAnalysis({ docId: target, analysis }));
  };

  const acceptFor = async (channel: Channel) => {
    const accepts = acceptsFor(channel);
    const result = await pbui.accept({
      types: "field",
      prompt: `MAP ${channel.toUpperCase()} of chart ${pbui.environment.nameOf(target)} ↦ click a FIELD anywhere`,
      filter: (reference) => {
        const ref = reference.value as FieldRef;
        const field = fields.find((f) => f.name === ref.name);
        return field ? accepts.includes(field.type) : false;
      },
    });
    if (result) {
      dispatch(
        worldActions.setMapping({ docId: target, channel, field: (result.value as FieldRef).name }),
      );
    }
  };

  return (
    <>
      <DocBar viewId={appView.id} docId={docId} />
      <EncodingPanel
        geom={view?.mark ?? null}
        analysis={view?.analysis ?? null}
        mapping={mapping}
        yScale={view?.yScale ?? null}
        facetScales={view?.facetScales ?? null}
        staleChannels={staleChannels}
        logUnavailable={logUnavailable}
        docId={target}
        onGeom={(geom) => dispatch(worldActions.setGeom({ docId: target, geom }))}
        onAnalysisKind={setAnalysisKind}
        onAnalysis={(analysis) => dispatch(worldActions.setAnalysis({ docId: target, analysis }))}
        onAccept={(channel) => void acceptFor(channel)}
        onClear={(channel) =>
          dispatch(worldActions.setMapping({ docId: target, channel, field: null }))
        }
        onYScale={(scale) => dispatch(worldActions.setYScale({ docId: target, scale }))}
        onFacetScales={(scales) => dispatch(worldActions.setFacetScales({ docId: target, scales }))}
      />
    </>
  );
}

registerApp({
  id: "encode",
  title: "encoding",
  tone: "var(--pbui-tone-chart)",
  docBound: true,
  duplicable: true,
  singleton: false,
  Component: EncodingApp,
});
