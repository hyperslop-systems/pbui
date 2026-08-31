import type { ComponentType } from "react";
import type { SelectionSnapshot } from "../../presentation/actions/types";
import type { HelpItem, HelpKind, ResolvedHelpItem } from "../../presentation/help/types";
import type { PresentationReference, PresentationValues } from "../../presentation/types";

/**
 * The React half of the help kernel (design doc §8): items are data naming a
 * renderer by `kind`; this registry maps kinds to components. It lives here,
 * outside `src/presentation/help/`, so the pure selector never imports React.
 */

export interface HelpRendererProps<
  Payload = unknown,
  Values extends PresentationValues = PresentationValues,
  ProductFacts = unknown,
> {
  item: ResolvedHelpItem<Payload>;
  subject: PresentationReference<Values>;
  snapshot: SelectionSnapshot<ProductFacts>;
}

/**
 * One item kind bundled with its renderer and a `create` helper, so a product
 * cannot spell the kind differently when registering and when emitting
 * (§8.2). `Payload` is `any`-erased at the registry boundary; the definition
 * value keeps it precise for authors.
 */
export interface HelpItemDefinition<Payload = unknown> {
  kind: HelpKind;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Renderer: ComponentType<HelpRendererProps<Payload, any, any>>;
  create(input: Omit<HelpItem<Payload>, "kind">): HelpItem<Payload>;
}

export function defineHelpItem<Payload>(
  kind: HelpKind,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Renderer: ComponentType<HelpRendererProps<Payload, any, any>>,
): HelpItemDefinition<Payload> {
  return {
    kind,
    Renderer,
    create(input) {
      return { ...input, kind };
    },
  };
}

/** The registry stores erased definitions; `rendererFor` returns an erased renderer. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyHelpItemDefinition = HelpItemDefinition<any>;
/*
 * Fully erased: `PresentationReference<PresentationValues>` (the default
 * `object`) resolves to `never`, so the defaults cannot serve as the erased
 * shape — `any` in every slot can.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HelpRenderer = ComponentType<HelpRendererProps<any, any, any>>;

export interface HelpRendererRegistry {
  rendererFor(kind: HelpKind): HelpRenderer | null;
  kinds(): readonly HelpKind[];
}

export function createHelpRendererRegistry(
  definitions: readonly AnyHelpItemDefinition[],
): HelpRendererRegistry {
  const byKind = new Map<HelpKind, HelpRenderer>();
  for (const definition of definitions) {
    if (byKind.has(definition.kind)) {
      throw new Error(
        `duplicate help renderer kind "${definition.kind}" — ` +
          `each kind registers exactly one renderer`,
      );
    }
    byKind.set(definition.kind, definition.Renderer as HelpRenderer);
  }
  return {
    rendererFor: (kind) => byKind.get(kind) ?? null,
    kinds: () => [...byKind.keys()],
  };
}
