import {
  CHANNELS,
  MARKS,
  type AnalysisKind,
  type AnalysisSpec,
  type Channel,
  type FacetScalePolicy,
  type Mark,
} from "../../../model/graphic";
import { Presentation } from "../../../pbui";
import { Button, SectionLabel, Text, AppBody, Stack } from "@hyperslop-systems/pbui";
import { FieldChip } from "../../atoms";
import { ChannelRow } from "../../molecules";
import styles from "./EncodingPanel.module.css";

/**
 * The aesthetic mapping: slot ↦ field, plus the geom and the y scale.
 *
 * Each ⌖ ACCEPTS a field, filtered to the types the channel can use (DR-10), so
 * an impossible mapping is unreachable rather than reported. The filter lives
 * in the container, because deciding which fields are acceptable needs the
 * pipeline's schema.
 *
 * ## `logUnavailable` is a prop, not a computation
 *
 * A log scale needs a strictly positive y domain, and deciding that means
 * scanning the y column of the pipeline's output. That is row work, and row
 * work does not belong in a panel — the same rule Part I of the DATADROP-6
 * follow-up guide is about. The container computes it; this component renders
 * a disabled button and a reason.
 *
 * Disabled with a reason rather than hidden, and `plot.ts` falls back as a
 * second line of defence. A control that vanishes teaches nothing about why.
 *
 * ## Staleness
 *
 * A channel mapped to a field the pipeline no longer produces renders STALE
 * with a warning rather than as a blank control. The predecessor shipped the
 * other behaviour: the select read as unset while the specification still held
 * the dead name and the plot refused to draw.
 */
export function EncodingPanel({
  geom,
  analysis,
  mapping,
  yScale,
  facetScales,
  staleChannels = [],
  logUnavailable = false,
  docId,
  onGeom,
  onAnalysisKind,
  onAnalysis,
  onAccept,
  onClear,
  onYScale,
  onFacetScales,
}: {
  geom: Mark | null;
  analysis: AnalysisSpec | null;
  /** The current slot assignments. A null value is an unmapped channel. */
  mapping: Record<Channel, string | null>;
  yScale: "linear" | "log" | null;
  facetScales: FacetScalePolicy | null;
  /** Channels whose mapped field is no longer in the pipeline output. */
  staleChannels?: readonly Channel[];
  /** True when the y domain includes a non-positive value. */
  logUnavailable?: boolean;
  docId: string | null;
  onGeom: (geom: Mark) => void;
  onAnalysisKind: (kind: AnalysisKind) => void;
  onAnalysis: (analysis: AnalysisSpec) => void;
  /** Ask the user to point at a field for this channel. */
  onAccept: (channel: Channel) => void;
  onClear: (channel: Channel) => void;
  onYScale: (scale: "linear" | "log") => void;
  onFacetScales: (scales: FacetScalePolicy) => void;
}) {
  const stale = new Set(staleChannels);
  const analysisKind = analysis?.kind ?? "identity";
  const requirements =
    analysisKind === "histogram" || analysisKind === "density"
      ? "needs quantitative x"
      : analysisKind === "summary" || analysisKind === "boxplot"
        ? "needs categorical x and quantitative y"
        : analysisKind === "regression"
          ? "needs quantitative x and y"
          : null;
  const visibleChannels: readonly Channel[] =
    analysisKind === "histogram"
      ? ["x"]
      : analysisKind === "density"
        ? ["x", "color", "facet"]
        : analysisKind === "summary" || analysisKind === "regression" || analysisKind === "boxplot"
          ? ["x", "y", "color", "facet"]
          : CHANNELS;
  const hasSourceY =
    analysisKind === "identity" ||
    analysisKind === "summary" ||
    analysisKind === "regression" ||
    analysisKind === "boxplot";

  return (
    <AppBody>
      <Stack gap={4}>
        <Stack gap={2}>
          <SectionLabel>Analysis</SectionLabel>
          <Stack direction="row" gap={2} wrap>
            {(
              ["identity", "histogram", "summary", "regression", "boxplot", "density"] as const
            ).map((option) => (
              <Button
                key={option}
                variant="framed"
                selected={analysisKind === option}
                onClick={() => onAnalysisKind(option)}
              >
                {option === "identity" ? "raw" : option}
              </Button>
            ))}
          </Stack>
          {requirements && (
            <Text size="tiny" tone="faint">
              {requirements}
            </Text>
          )}
          {analysis?.kind === "histogram" && (
            <Stack direction="row" gap={2} align="center" wrap>
              <Text size="tiny" tone="faint">
                bins
              </Text>
              {[8, 12, 20, 30].map((bins) => (
                <Button
                  key={bins}
                  variant="framed"
                  selected={analysis.bins === bins}
                  onClick={() => onAnalysis({ kind: "histogram", bins })}
                >
                  {bins}
                </Button>
              ))}
            </Stack>
          )}
          {analysis?.kind === "summary" && (
            <>
              <Stack direction="row" gap={2} align="center" wrap>
                {(["standard-error", "standard-deviation"] as const).map((interval) => (
                  <Button
                    key={interval}
                    variant="framed"
                    selected={analysis.interval === interval}
                    onClick={() => onAnalysis({ ...analysis, interval })}
                  >
                    {interval === "standard-error" ? "SE" : "SD"}
                  </Button>
                ))}
              </Stack>
              <Stack direction="row" gap={2} align="center" wrap>
                <Text size="tiny" tone="faint">
                  multiplier
                </Text>
                {[1, 2].map((multiplier) => (
                  <Button
                    key={multiplier}
                    variant="framed"
                    selected={analysis.multiplier === multiplier}
                    onClick={() => onAnalysis({ ...analysis, multiplier })}
                  >
                    {multiplier}×
                  </Button>
                ))}
              </Stack>
            </>
          )}
          {analysis?.kind === "regression" && (
            <Stack direction="row" gap={2} align="center" wrap>
              <Text size="tiny" tone="faint">
                confidence
              </Text>
              {[
                [0.9, "90%"],
                [0.95, "95%"],
                [0.99, "99%"],
              ].map(([confidence, label]) => (
                <Button
                  key={confidence}
                  variant="framed"
                  selected={analysis.confidence === confidence}
                  onClick={() =>
                    onAnalysis({ kind: "regression", confidence: confidence as number })
                  }
                >
                  {label}
                </Button>
              ))}
            </Stack>
          )}
          {analysis?.kind === "density" && (
            <Stack direction="row" gap={2} align="center" wrap>
              <Text size="tiny" tone="faint">
                samples
              </Text>
              {[64, 128, 256].map((points) => (
                <Button
                  key={points}
                  variant="framed"
                  selected={analysis.points === points}
                  onClick={() => onAnalysis({ kind: "density", points })}
                >
                  {points}
                </Button>
              ))}
            </Stack>
          )}
        </Stack>

        {analysisKind === "identity" && (
          <Stack gap={2}>
            <SectionLabel>Mark</SectionLabel>
            <Stack direction="row" gap={2} wrap>
              {MARKS.map((option) => (
                <Presentation
                  key={option}
                  reference={{ type: "geom", value: option }}
                  doc={`<geom> ${option}`}
                  activate={{ run: () => onGeom(option), doc: "use this geom" }}
                >
                  <span
                    className={[styles.geom, geom === option ? styles.selected : ""]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {option}
                  </span>
                </Presentation>
              ))}
            </Stack>
          </Stack>
        )}

        <Stack gap={2}>
          <SectionLabel>Channels</SectionLabel>
          {visibleChannels.map((channel) => (
            <ChannelRow
              key={channel}
              channel={channel}
              mapped={mapping[channel]}
              stale={stale.has(channel)}
              onAcceptRequest={() => onAccept(channel)}
              onClear={() => onClear(channel)}
              // The DR-38 seam: the molecule draws the field's name, and the
              // panel makes it a live presentation so the mapped field can be
              // right-clicked from here exactly as from a table header.
              renderMapped={(name) => (
                <FieldChip field={{ docId, name }} testId={`mapped-${channel}`} />
              )}
            />
          ))}
        </Stack>

        {hasSourceY && (
          <Stack gap={2}>
            <SectionLabel>Y scale</SectionLabel>
            <Stack direction="row" gap={2} align="center">
              {(["linear", "log"] as const).map((scale) => (
                <Button
                  key={scale}
                  variant="framed"
                  selected={yScale === scale}
                  disabled={scale === "log" && logUnavailable}
                  title={
                    scale === "log" && logUnavailable
                      ? "a log scale needs a strictly positive y domain"
                      : undefined
                  }
                  onClick={() => onYScale(scale)}
                >
                  {scale}
                </Button>
              ))}
              {logUnavailable && (
                <Text size="tiny" tone="faint">
                  log needs y &gt; 0 throughout
                </Text>
              )}
            </Stack>
          </Stack>
        )}

        <Stack gap={2}>
          <SectionLabel>Facet scales</SectionLabel>
          <Stack direction="row" gap={2} wrap>
            {(["fixed", "free-x", "free-y", "free"] as const).map((scales) => (
              <Button
                key={scales}
                variant="framed"
                selected={facetScales === scales}
                disabled={!mapping.facet}
                title={!mapping.facet ? "map a facet field first" : undefined}
                onClick={() => onFacetScales(scales)}
              >
                {scales}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </AppBody>
  );
}
