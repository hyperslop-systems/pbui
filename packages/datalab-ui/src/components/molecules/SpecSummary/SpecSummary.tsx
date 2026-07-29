import type { GraphicDocument } from "../../../model/graphic";
import { graphicFacts, orderedTransformIds } from "../../../model/graphicAuthoring";
import { Text } from "@hyperslop-systems/pbui";

/** A canonical graphic document summarized in one line. */
export function SpecSummary({ document }: { document: GraphicDocument }) {
  const facts = new Map(graphicFacts(document));
  const get = (key: string) => facts.get(key) ?? "—";
  const transforms = orderedTransformIds(document).filter(
    (id) => document.transforms[id]?.enabled,
  ).length;
  return (
    <Text size="tiny" tone="faint">
      {get("source")} ⊳ {transforms} transforms ⊳ geom_{get("geom")} · x↦{get("x")} y↦
      {get("y")}
    </Text>
  );
}
