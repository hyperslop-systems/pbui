import type { InteractionTargetRecord } from "@hyperslop-systems/plot";
import { ResponsivePlot } from "@hyperslop-systems/plot/react";
import type { ReactElement } from "react";
import type { DatalabPlotInput } from "../../../appkit/plotAdapter";
import type { Table } from "../../../model/table";
import { Presentation } from "../../../pbui";
import { Text } from "@hyperslop-systems/pbui";
import { TruncationNotice } from "../../molecules";

/**
 * PBUI composition around the renderer-neutral responsive Plot host.
 *
 * Datalab owns analytical inputs, truncation disclosure, and live Presentation
 * references. Plot owns content-box measurement, planning, diagnostics, and SVG.
 */
export function ChartPanel({
  plot,
  table,
  loading = false,
  docId,
}: {
  plot: DatalabPlotInput | null;
  table?: Table | null;
  loading?: boolean;
  docId: string | null;
}) {
  const renderTarget = (record: InteractionTargetRecord, element: ReactElement) => {
    const { target } = record;
    if (target.kind === "legend") {
      const field = table?.fields.find(({ fieldId }) => fieldId === target.fieldId)?.name;
      if (!field || typeof target.value !== "string") return element;
      return (
        <Presentation
          key={target.id}
          svg
          reference={{ type: "cat", value: { docId, field, value: target.value } }}
          doc={`<cat> ${target.label}`}
        >
          {element}
        </Presentation>
      );
    }
    if (target.kind !== "mark") return element;
    const preview = Object.entries(record.semanticValues)
      .slice(0, 3)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(" · ");
    return (
      <Presentation
        key={target.id}
        svg
        reference={{ type: "datum", value: { docId, row: record.semanticValues } }}
        doc={`<datum> ${preview}`}
      >
        {element}
      </Presentation>
    );
  };

  const emptyFallback = (
    <div role="status">
      <Text size="small" strong>
        Nothing to draw yet
      </Text>
    </div>
  );

  return (
    <>
      {table && <TruncationNotice table={table} />}
      {!plot ? (
        <Text size="small" tone="faint">
          {loading ? "loading plot…" : "no source — load one from the sources tile"}
        </Text>
      ) : (
        <ResponsivePlot
          document={plot.document}
          schema={plot.schema}
          data={plot.data}
          resizeDelayMs={80}
          loading={loading}
          renderTarget={renderTarget}
          emptyFallback={emptyFallback}
        />
      )}
    </>
  );
}
