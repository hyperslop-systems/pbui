import type { PresentationDescriptor } from "../registry";
import type { CatRef } from "../types";

/**
 * `<cat>` — a level of a categorical field: a legend swatch, a banded axis label.
 *
 * This and `<datum>` are where the thesis of the ticket becomes visible. Its
 * verbs do not filter the *picture*: they append a real `filter` step to the
 * document's pipeline, which appears in the pipeline tile with a checkbox that
 * disables it without deleting it. The click on the legend and the step in the
 * chain are the same act seen from two surfaces.
 */
export const catDescriptor: PresentationDescriptor<CatRef> = {
  ptype: "cat",
  tone: "var(--pbui-tone-cat)",

  label: (ref) => `${ref.field} = ${ref.value}`,

  describe: (ref, env) => ({
    presentationType: "category",
    field: ref.field,
    value: ref.value,
    chart: env.nameOf(ref.docId),
  }),
};
