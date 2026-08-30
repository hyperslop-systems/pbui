import { asText } from "../../model/table";
import type { PresentationDescriptor } from "../registry";
import type { DatumRef } from "../types";

/**
 * `<datum>` — one row, drawn as a mark or as a table row number.
 *
 * The same presentation type in both places, so the verbs are the same in both
 * places. That equivalence is the point: a mark in a scatter plot and a row
 * number in a table are the same object seen twice, and neither is a picture.
 */
export const datumDescriptor: PresentationDescriptor<DatumRef> = {
  ptype: "datum",
  tone: "var(--pbui-tone-neutral)",

  label: (ref) =>
    Object.entries(ref.row)
      .slice(0, 2)
      .map(([key, value]) => `${key}=${asText(value)}`)
      .join(" "),

  describe: (ref, env) => ({
    presentationType: "datum",
    from_chart: env.nameOf(ref.docId),
    ...ref.row,
  }),
};
