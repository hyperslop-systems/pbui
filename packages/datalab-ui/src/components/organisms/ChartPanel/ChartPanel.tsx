import type { InteractionTargetRecord, PlotOutcome } from "@hyperslop-systems/plot";
import { PlotHost } from "@hyperslop-systems/plot/react";
import type { ReactElement } from "react";
import type { Table } from "../../../model/table";
import { Presentation } from "../../../pbui";
import { Text } from "@hyperslop-systems/pbui";
import { TruncationNotice } from "../../molecules";

/**
 * PBUI composition around the renderer-neutral plotting package.
 *
 * Geometry, axes, scales, limits, and SVG emission now live in
 * `@hyperslop-systems/plot`. PBUI retains its application-specific truthfulness
 * banner and wraps interaction metadata in live Presentation references.
 */
export function ChartPanel({
  plot,
  table,
  loading = false,
  docId,
}: {
  plot: PlotOutcome | null;
  table?: Table | null;
  loading?: boolean;
  docId: string | null;
}) {
  const errors = plot?.diagnostics.filter((item) => item.severity === "error") ?? [];
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

  return (
    <>
      {table && <TruncationNotice table={table} />}
      {!plot && !loading ? (
        <Text size="small" tone="faint">
          no source — load one from the sources tile
        </Text>
      ) : errors.length > 0 ? (
        <div role="status">
          <Text size="small" strong>
            Nothing to draw yet
          </Text>
          {errors.map((item) => (
            <div key={`${item.code}:${item.message}`}>
              <Text size="small" tone="faint">
                · {item.message}
              </Text>
            </div>
          ))}
        </div>
      ) : (
        <PlotHost
          scene={plot?.scene ?? null}
          interactions={plot?.interactions ?? undefined}
          diagnostics={plot?.diagnostics}
          loading={loading}
          renderTarget={renderTarget}
        />
      )}
    </>
  );
}
