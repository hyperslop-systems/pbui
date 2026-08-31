import type { SelectionSnapshot } from "../../presentation/actions/types";
import type { HelpResolution } from "../../presentation/help/types";
import type { PresentationReference, PresentationValues } from "../../presentation/types";
import { Text } from "../foundation";
import type { HelpRendererRegistry } from "./registry";

/**
 * Renders one resolution through the renderer registry (design doc §8.3).
 * An unknown item kind warns and omits THAT item rather than crashing the
 * surface: one package shipping an unregistered kind must not take down
 * every other package's help.
 */

export interface HelpContentProps<Values extends PresentationValues, ProductFacts> {
  resolution: HelpResolution;
  subject: PresentationReference<Values>;
  snapshot: SelectionSnapshot<ProductFacts>;
  renderers: HelpRendererRegistry;
}

export function HelpContent<Values extends PresentationValues, ProductFacts>({
  resolution,
  subject,
  snapshot,
  renderers,
}: HelpContentProps<Values, ProductFacts>) {
  return (
    <>
      {resolution.items.map((item) => {
        const Renderer = renderers.rendererFor(item.kind);
        if (Renderer === null) {
          console.warn(
            `pbui help: no renderer registered for kind "${item.kind}" ` +
              `(item "${item.id}" from rule "${item.provenance.ruleId}") — item omitted`,
          );
          return null;
        }
        return (
          <section key={item.id} data-part="help-item" data-help-kind={item.kind}>
            {item.title !== undefined && (
              <header data-part="help-title">
                <Text size="tiny" tone="faint" strong>
                  {item.title}
                </Text>
              </header>
            )}
            <Renderer item={item} subject={subject} snapshot={snapshot} />
          </section>
        );
      })}
    </>
  );
}
