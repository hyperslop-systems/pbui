import type { Mark } from "../../model/graphic";
import type { PresentationDescriptor } from "../registry";

/** `<geom>` — a geometry, and the type requirements it states about itself. */
export const geomDescriptor: PresentationDescriptor<Mark> = {
  ptype: "geom",
  tone: "var(--pbui-tone-geom)",

  label: (geom) => `geom_${geom}`,

  describe: (geom) => ({
    presentationType: "geom",
    geom,
    // A geom that states its own requirements is a geom whose refusal to draw
    // is explicable before you try it.
    needs:
      geom === "bar"
        ? "a nominal or temporal x, and a quantitative y"
        : "any x, and a quantitative y",
    baseline:
      geom === "bar" || geom === "area" ? "zero — otherwise magnitude is misrepresented" : "none",
  }),

};
