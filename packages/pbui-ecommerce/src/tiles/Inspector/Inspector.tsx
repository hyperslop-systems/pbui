import { AppBody, EmptyState, JsonBlock, Text, Toolbar } from "@hyperslop-systems/pbui";
import type { PresentationReference } from "@hyperslop-systems/pbui";
import type { AppProps } from "@hyperslop-systems/pbui-workbench";
import type { Shop } from "../../createShop";
import type { Values } from "../../presentation/types";
import styles from "../tiles.module.css";

export interface InspectorProps extends AppProps {
  shop: Shop;
  /** Phase 1 only: the subject to show, until the `subject` in port exists. */
  preview?: PresentationReference<Values>;
}

/**
 * Anything inspectable, as data. The subject port's contract is the
 * abstract `inspectable` type, so an order, a customer, a SKU, a mark, a
 * category or a metal all reach it by graph reachability alone.
 */
export function Inspector({ shop, preview }: InspectorProps) {
  const { Presentation } = shop.pbui;
  if (!preview) {
    return (
      <div data-part="inspector" className={styles.empty}>
        <EmptyState message="nothing inspected yet" hint="right-click anything and choose “Link to inspector”, or let it follow what the workspace last inspected" />
      </div>
    );
  }
  return (
    <div data-part="inspector" className={styles.app}>
      <Toolbar tight>
        <Presentation reference={preview} doc={`the inspected <${preview.type}>`} inComposite>
          <Text size="tiny" strong>
            &lt;{preview.type}&gt;
          </Text>
        </Presentation>
      </Toolbar>
      <AppBody flush className={styles.body}>
        <div className={styles.detail}>
          <JsonBlock value={preview.value} />
        </div>
      </AppBody>
    </div>
  );
}
