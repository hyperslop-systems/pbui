import { SourceChip } from "../../atoms";
import { Callout, Stack, Text } from "@hyperslop-systems/pbui";
import type { Table } from "../../../model/table";

/**
 * The truncation notice.
 *
 * Not dismissible, deliberately: a user who dismisses it and screenshots the
 * chart has produced a misleading artifact, and the whole point of reporting
 * truncation is that the picture must never look complete when it is not. It
 * is a `Callout` rather than a `Chip` (PBUI-VISUAL-1 P4): it carries a whole
 * sentence, not a short tag, which is exactly the "something to know" surface
 * `Callout` is for. `variant="warning"` keeps the `role="status"` announcement
 * the original hand-built box used — a sample being incomplete is a caution
 * about the picture, not a failure.
 *
 * "at least N+1", NOT "at least N". When a table is truncated the server has
 * proved a further row exists — it asks for `limit + 1` and discards the extra.
 * TruncationBanner.tsx printed row_count twice and therefore rendered "showing
 * the most recent 2,000 of at least 2,000 rows", a sentence asserting the sample
 * IS the whole source inside the banner whose only job is to deny that.
 *
 * Dataset reads are capped at one million rows. The notice therefore advises
 * narrowing the source rather than offering an in-browser budget control.
 */
export function TruncationNotice({ table }: { table: Table }) {
  if (!table.truncated) return null;

  const which = table.strategy === "latest" ? "the most recent" : "the first";

  return (
    <Callout
      variant="warning"
      title="This chart describes a sample, not the whole source."
      hint="narrow the source to analyze the complete population"
    >
      <Stack direction="row" gap={3} align="center" wrap>
        <Text size="small">
          Showing {which} {table.row_count.toLocaleString()} of at least{" "}
          {(table.row_count + 1).toLocaleString()} rows.
        </Text>
        <SourceChip source={table.source} />
      </Stack>
    </Callout>
  );
}
